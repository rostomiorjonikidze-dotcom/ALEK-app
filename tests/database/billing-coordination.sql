-- Run after the billing coordination migration on an isolated Supabase-shaped database.
\set ON_ERROR_STOP on
INSERT INTO auth.users(id) VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO public.profiles(id, role, plan) VALUES
  ('00000000-0000-4000-8000-000000000001', 'user', 'free'),
  ('00000000-0000-4000-8000-000000000002', 'user', 'free')
ON CONFLICT DO NOTHING;
DO $tests$
DECLARE
  user_a uuid := '00000000-0000-4000-8000-000000000001';
  user_b uuid := '00000000-0000-4000-8000-000000000002';
  claim jsonb;
  v_attempt_id uuid;
  v_fence bigint;
  event_result jsonb;
  observed timestamptz := clock_timestamp();
BEGIN
  claim := public.billing_claim_checkout(user_a, 'stripe', 'pro');
  IF claim->>'decision' <> 'create' THEN RAISE EXCEPTION 'first checkout was not claimed: %', claim; END IF;
  v_attempt_id := (claim->>'attempt_id')::uuid;
  v_fence := (claim->>'fence')::bigint;
  IF length(claim->>'idempotency_key') <> 37 THEN
    RAISE EXCEPTION 'PayPal-safe idempotency key has the wrong length: %', claim->>'idempotency_key';
  END IF;
  IF public.billing_claim_checkout(user_a, 'stripe', 'pro')->>'decision' <> 'busy'
    THEN RAISE EXCEPTION 'concurrent same-provider checkout was not blocked'; END IF;
  IF public.billing_claim_checkout(user_a, 'paypal', 'pro')->>'decision' <> 'conflict'
    THEN RAISE EXCEPTION 'cross-provider checkout was not blocked'; END IF;

  UPDATE public.billing_checkout_attempts SET lease_expires_at = clock_timestamp() - interval '1 second'
    WHERE billing_checkout_attempts.attempt_id = v_attempt_id;
  claim := public.billing_claim_checkout(user_a, 'stripe', 'pro');
  IF claim->>'decision' <> 'create' OR (claim->>'fence')::bigint <= v_fence
    THEN RAISE EXCEPTION 'expired lease did not advance fencing token: %', claim; END IF;
  IF public.billing_finish_checkout(v_attempt_id, v_fence, 'pending', 'cs_stale', NULL)
    THEN RAISE EXCEPTION 'stale checkout writer was accepted'; END IF;
  v_attempt_id := (claim->>'attempt_id')::uuid;
  v_fence := (claim->>'fence')::bigint;
  IF NOT public.billing_finish_checkout(v_attempt_id, v_fence, 'pending', 'cs-current', NULL)
    THEN RAISE EXCEPTION 'current checkout writer was rejected'; END IF;
  IF public.billing_claim_checkout(user_a, 'stripe', 'pro')->>'decision' <> 'reuse'
    THEN RAISE EXCEPTION 'pending checkout resource was not reused'; END IF;
  IF NOT public.billing_finish_provider_checkout('stripe', 'cs-current', 'failed')
    THEN RAISE EXCEPTION 'terminal checkout did not release the lock'; END IF;

  claim := public.billing_claim_checkout(user_b, 'paypal', 'business');
  v_attempt_id := (claim->>'attempt_id')::uuid;
  v_fence := (claim->>'fence')::bigint;
  IF NOT public.billing_finish_checkout(v_attempt_id, v_fence, 'unknown')
    THEN RAISE EXCEPTION 'unknown provider response was not retained'; END IF;
  UPDATE public.billing_checkout_attempts SET retry_deadline_at = clock_timestamp() - interval '1 second'
    WHERE billing_checkout_attempts.attempt_id = v_attempt_id;
  IF public.billing_claim_checkout(user_b, 'paypal', 'business')->>'decision' <> 'manual_review'
    THEN RAISE EXCEPTION 'expired unknown result was not held for review'; END IF;
  IF NOT public.billing_resolve_checkout(v_attempt_id, 'failed')
    THEN RAISE EXCEPTION 'operator could not resolve a reviewed provider failure'; END IF;
  IF public.billing_claim_checkout(user_b, 'paypal', 'business')->>'decision' <> 'create'
    THEN RAISE EXCEPTION 'verified failed attempt did not release checkout lock'; END IF;

  event_result := public.billing_apply_verified_state('stripe', 'evt-paid', observed,
    user_a, 'sub-a', 'active', 'pro', 'price-pro', 'cus-a', true,
    observed + interval '30 days', 'sale_completed');
  IF event_result->>'plan' <> 'pro' OR event_result->>'payment_verified' <> 'true'
    THEN RAISE EXCEPTION 'verified Stripe payment did not grant pro: %', event_result; END IF;
  IF public.billing_claim_checkout(user_a, 'paypal', 'business')->>'decision' <> 'entitled'
    THEN RAISE EXCEPTION 'paid-through entitlement did not block another provider checkout'; END IF;
  event_result := public.billing_apply_verified_state('stripe', 'evt-paid', observed,
    user_a, 'sub-a', 'active', 'pro', 'price-pro', 'cus-a', true,
    observed + interval '30 days', 'sale_completed');
  IF event_result->>'reason' <> 'duplicate' THEN RAISE EXCEPTION 'webhook replay was not deduplicated'; END IF;
  event_result := public.billing_apply_verified_state('stripe', 'evt-old', observed - interval '1 second',
    user_a, 'sub-a', 'past_due', 'pro', 'price-pro', 'cus-a', false,
    observed + interval '30 days', 'failed');
  IF event_result->>'reason' <> 'out_of_order' THEN RAISE EXCEPTION 'stale event changed provider state'; END IF;

  event_result := public.billing_apply_verified_state('stripe', 'evt-refund', observed + interval '1 second',
    user_a, 'sub-a', 'active', 'pro', 'price-pro', 'cus-a', false,
    observed + interval '30 days', 'refund');
  IF event_result->>'plan' <> 'free' THEN RAISE EXCEPTION 'refund did not remove access: %', event_result; END IF;
  event_result := public.billing_apply_verified_state('stripe', NULL, observed + interval '2 seconds',
    user_a, 'sub-a', 'active', 'pro', 'price-pro', 'cus-a', true,
    observed + interval '30 days', 'none');
  IF event_result->>'plan' <> 'free' THEN RAISE EXCEPTION 'sync incorrectly cleared a refund block'; END IF;
  event_result := public.billing_apply_verified_state('stripe', 'evt-repaid', observed + interval '3 seconds',
    user_a, 'sub-a', 'active', 'pro', 'price-pro', 'cus-a', true,
    observed + interval '30 days', 'sale_completed');
  IF event_result->>'plan' <> 'pro' THEN RAISE EXCEPTION 'new paid invoice did not clear refund block'; END IF;

  event_result := public.billing_apply_verified_state('stripe', 'evt-cancel', observed + interval '4 seconds',
    user_a, 'sub-a', 'canceled', 'pro', 'price-pro', 'cus-a', false, NULL, 'none');
  IF event_result->>'plan' <> 'pro' OR
     (SELECT stripe_subscription_status FROM public.profiles WHERE id = user_a) <> 'active'
    THEN RAISE EXCEPTION 'paid-through cancellation access was not retained: %', event_result; END IF;

  event_result := public.billing_apply_verified_state('stripe', 'evt-tied-refund', observed + interval '4 seconds',
    user_a, 'sub-a', 'active', 'pro', 'price-pro', 'cus-a', false,
    observed + interval '30 days', 'refund');
  IF event_result->>'applied' IS DISTINCT FROM 'true' OR event_result->>'plan' IS DISTINCT FROM 'free'
    THEN RAISE EXCEPTION 'distinct same-second refund was discarded: %', event_result; END IF;
  event_result := public.billing_apply_verified_state('stripe', 'evt-tied-paid', observed + interval '4 seconds',
    user_a, 'sub-a', 'active', 'pro', 'price-pro', 'cus-a', true,
    observed + interval '30 days', 'sale_completed');
  IF event_result->>'applied' IS DISTINCT FROM 'true' OR event_result->>'plan' IS DISTINCT FROM 'free'
    THEN RAISE EXCEPTION 'ambiguous same-second payment cleared refund: %', event_result; END IF;
  event_result := public.billing_apply_verified_state('stripe', 'evt-later-paid', observed + interval '5 seconds',
    user_a, 'sub-a', 'active', 'pro', 'price-pro', 'cus-a', true,
    observed + interval '30 days', 'sale_completed');
  IF event_result->>'plan' IS DISTINCT FROM 'pro'
    THEN RAISE EXCEPTION 'later payment did not clear refund: %', event_result; END IF;

  -- A delayed request must not open a second billable subscription after success.
  UPDATE public.billing_provider_state SET paid_through = NULL, payment_verified = false
    WHERE user_id = user_a;
  IF public.billing_claim_checkout(user_a, 'paypal', 'business')->>'decision' <> 'conflict'
    THEN RAISE EXCEPTION 'existing subscription did not block delayed checkout'; END IF;

  event_result := public.billing_apply_verified_state('paypal', 'evt-no-deadline', observed,
    user_b, 'paypal-b', 'ACTIVE', 'business', NULL, NULL, true, NULL, 'sale_completed');
  IF event_result->>'plan' IS DISTINCT FROM 'free'
    OR event_result->>'payment_verified' IS DISTINCT FROM 'false'
    THEN RAISE EXCEPTION 'missing paid-through must fail closed: %', event_result; END IF;
  IF public.billing_claim_checkout(user_b, 'paypal', 'business')->>'decision' <> 'conflict'
    THEN RAISE EXCEPTION 'pending retry ignored existing subscription'; END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
    AND proname LIKE 'billing_%' AND prosecdef)
    THEN RAISE EXCEPTION 'billing RPC must retain service-role caller context'; END IF;

  IF has_function_privilege('authenticated',
    'public.billing_claim_checkout(uuid,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role',
    'public.billing_claim_checkout(uuid,text,text)', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.billing_provider_state', 'SELECT')
    OR has_function_privilege('authenticated',
    'public.billing_resolve_checkout(uuid,text,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role',
    'public.billing_resolve_checkout(uuid,text,text,text)', 'EXECUTE')
    THEN RAISE EXCEPTION 'billing RPC/table grants are not service-role only'; END IF;
END
$tests$;
ROLLBACK;
