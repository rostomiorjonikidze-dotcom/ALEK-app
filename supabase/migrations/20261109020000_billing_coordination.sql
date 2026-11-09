-- Cross-provider checkout coordination and ordered billing snapshots.
-- Preflight: this migration deliberately references only profiles columns used by
-- the application. Confirm the full production DDL and constraints before applying.
DO $preflight$
DECLARE
  required_column text;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.profiles is missing';
  END IF;
  FOREACH required_column IN ARRAY ARRAY[
    'id', 'role', 'plan', 'stripe_subscription_id', 'stripe_customer_id',
    'stripe_subscription_status', 'stripe_price_id', 'stripe_updated_at',
    'paypal_subscription_id', 'paypal_subscription_status', 'subscription_updated_at'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = required_column
    ) THEN
      RAISE EXCEPTION 'Preflight failed: public.profiles.% is missing', required_column;
    END IF;
  END LOOP;
END
$preflight$;

CREATE TABLE IF NOT EXISTS public.billing_checkout_attempts (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  tier text NOT NULL CHECK (tier IN ('pro', 'business')),
  status text NOT NULL CHECK (status IN ('creating', 'unknown', 'pending', 'complete', 'failed')),
  fence bigint NOT NULL DEFAULT 1,
  idempotency_key text NOT NULL UNIQUE,
  provider_resource_id text,
  approval_url text,
  lease_expires_at timestamptz,
  retry_deadline_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_checkout_one_open_per_user
  ON public.billing_checkout_attempts(user_id)
  WHERE status IN ('creating', 'unknown', 'pending');

CREATE TABLE IF NOT EXISTS public.billing_provider_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  subscription_id text NOT NULL,
  provider_status text NOT NULL,
  tier text CHECK (tier IN ('pro', 'business')),
  price_id text,
  customer_id text,
  payment_verified boolean NOT NULL DEFAULT false,
  paid_through timestamptz,
  payment_blocked_at timestamptz,
  observed_at timestamptz NOT NULL,
  event_id text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  event_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_created_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (provider, event_id)
);

ALTER TABLE public.billing_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_provider_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_checkout_attempts, public.billing_provider_state,
  public.billing_webhook_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_checkout_attempts,
  public.billing_provider_state, public.billing_webhook_events TO service_role;

CREATE OR REPLACE FUNCTION public.billing_claim_checkout(
  p_user_id uuid, p_provider text, p_tier text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE
  attempt public.billing_checkout_attempts%ROWTYPE;
  new_key text;
BEGIN
  IF p_provider NOT IN ('stripe', 'paypal') OR p_tier NOT IN ('pro', 'business') THEN
    RAISE EXCEPTION 'Invalid billing checkout parameters';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 74129));
  SELECT * INTO attempt FROM public.billing_checkout_attempts
    WHERE user_id = p_user_id AND status IN ('creating', 'unknown', 'pending')
    FOR UPDATE;
  IF FOUND THEN
    IF attempt.provider <> p_provider OR attempt.tier <> p_tier THEN
      RETURN jsonb_build_object('decision', 'conflict');
    END IF;
    IF attempt.status = 'pending' AND attempt.provider_resource_id IS NOT NULL THEN
      RETURN jsonb_build_object('decision', 'reuse', 'attempt_id', attempt.attempt_id,
        'fence', attempt.fence, 'idempotency_key', attempt.idempotency_key,
        'provider_resource_id', attempt.provider_resource_id, 'approval_url', attempt.approval_url);
    END IF;
    IF attempt.status = 'creating' AND attempt.lease_expires_at > clock_timestamp() THEN
      RETURN jsonb_build_object('decision', 'busy');
    END IF;
    IF attempt.retry_deadline_at <= clock_timestamp() THEN
      UPDATE public.billing_checkout_attempts SET status = 'unknown', lease_expires_at = NULL,
        updated_at = clock_timestamp() WHERE attempt_id = attempt.attempt_id;
      RETURN jsonb_build_object('decision', 'manual_review');
    END IF;
    UPDATE public.billing_checkout_attempts SET status = 'creating', fence = fence + 1,
      lease_expires_at = clock_timestamp() + interval '2 minutes', updated_at = clock_timestamp()
      WHERE attempt_id = attempt.attempt_id RETURNING * INTO attempt;
    RETURN jsonb_build_object('decision', 'create', 'attempt_id', attempt.attempt_id,
      'fence', attempt.fence, 'idempotency_key', attempt.idempotency_key);
  END IF;

  new_key := 'alek-' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.billing_checkout_attempts
    (user_id, provider, tier, status, idempotency_key, lease_expires_at,
     retry_deadline_at)
  VALUES (p_user_id, p_provider, p_tier, 'creating', new_key,
    clock_timestamp() + interval '2 minutes', clock_timestamp() + interval '20 hours')
  RETURNING * INTO attempt;
  RETURN jsonb_build_object('decision', 'create', 'attempt_id', attempt.attempt_id,
    'fence', attempt.fence, 'idempotency_key', attempt.idempotency_key);
END
$function$;

CREATE OR REPLACE FUNCTION public.billing_finish_checkout(
  p_attempt_id uuid, p_fence bigint, p_status text,
  p_provider_resource_id text DEFAULT NULL, p_approval_url text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
BEGIN
  IF p_status NOT IN ('unknown', 'pending', 'complete', 'failed') THEN
    RAISE EXCEPTION 'Invalid checkout transition';
  END IF;
  UPDATE public.billing_checkout_attempts SET status = p_status,
    provider_resource_id = COALESCE(p_provider_resource_id, provider_resource_id),
    approval_url = COALESCE(p_approval_url, approval_url),
    lease_expires_at = NULL, updated_at = clock_timestamp()
  WHERE attempt_id = p_attempt_id AND fence = p_fence AND status = 'creating';
  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION public.billing_finish_provider_checkout(
  p_provider text, p_provider_resource_id text, p_status text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
BEGIN
  IF p_provider NOT IN ('stripe', 'paypal') OR p_status NOT IN ('complete', 'failed') THEN
    RAISE EXCEPTION 'Invalid provider checkout transition';
  END IF;
  UPDATE public.billing_checkout_attempts SET status = p_status,
    lease_expires_at = NULL, updated_at = clock_timestamp()
  WHERE provider = p_provider AND provider_resource_id = p_provider_resource_id
    AND status IN ('pending', 'unknown', 'creating');
  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION public.billing_apply_verified_state(
  p_provider text, p_event_id text, p_observed_at timestamptz,
  p_user_id uuid, p_subscription_id text, p_status text, p_tier text,
  p_price_id text, p_customer_id text, p_payment_verified boolean,
  p_paid_through timestamptz, p_payment_event text DEFAULT 'none'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE
  profile public.profiles%ROWTYPE;
  prior public.billing_provider_state%ROWTYPE;
  stripe_tier text;
  paypal_tier text;
  access_plan text;
  blocked_at timestamptz;
  verified boolean;
BEGIN
  IF p_provider NOT IN ('stripe', 'paypal') OR p_subscription_id IS NULL
    OR p_status IS NULL OR p_observed_at IS NULL
    OR p_payment_event NOT IN ('none', 'sale_completed', 'refund', 'failed') THEN
    RAISE EXCEPTION 'Invalid billing state';
  END IF;
  IF p_tier IS NOT NULL AND p_tier NOT IN ('pro', 'business') THEN
    RAISE EXCEPTION 'Invalid billing tier';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 74129));
  SELECT * INTO profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing profile not found'; END IF;

  IF p_event_id IS NOT NULL THEN
    INSERT INTO public.billing_webhook_events(provider, event_id, user_id, provider_created_at)
      VALUES (p_provider, p_event_id, p_user_id, p_observed_at)
      ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN RETURN jsonb_build_object('applied', false, 'reason', 'duplicate'); END IF;
  END IF;

  IF p_provider = 'stripe' AND profile.stripe_subscription_id IS NOT NULL
    AND profile.stripe_subscription_id <> p_subscription_id
    AND lower(COALESCE(profile.stripe_subscription_status, ''))
      IN ('active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete') THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'different_active_subscription');
  END IF;
  IF p_provider = 'paypal' AND profile.paypal_subscription_id IS NOT NULL
    AND profile.paypal_subscription_id <> p_subscription_id
    AND upper(COALESCE(profile.paypal_subscription_status, ''))
      IN ('ACTIVE', 'APPROVAL_PENDING', 'APPROVED', 'SUSPENDED') THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'different_active_subscription');
  END IF;

  SELECT * INTO prior FROM public.billing_provider_state
    WHERE user_id = p_user_id AND provider = p_provider FOR UPDATE;
  IF FOUND AND prior.observed_at >= p_observed_at THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'out_of_order');
  END IF;
  blocked_at := CASE WHEN FOUND THEN prior.payment_blocked_at ELSE NULL END;
  IF p_payment_event = 'refund' THEN blocked_at := p_observed_at; END IF;
  IF p_payment_event = 'sale_completed' THEN blocked_at := NULL; END IF;
  verified := COALESCE(p_payment_verified, false)
    AND blocked_at IS NULL AND p_paid_through > clock_timestamp()
    AND p_tier IS NOT NULL;

  INSERT INTO public.billing_provider_state
    (user_id, provider, subscription_id, provider_status, tier, price_id,
     customer_id, payment_verified, paid_through, payment_blocked_at,
     observed_at, event_id)
  VALUES (p_user_id, p_provider, p_subscription_id, p_status, p_tier,
    p_price_id, p_customer_id, verified, p_paid_through, blocked_at,
    p_observed_at, p_event_id)
  ON CONFLICT (user_id, provider) DO UPDATE SET
    subscription_id = EXCLUDED.subscription_id,
    provider_status = EXCLUDED.provider_status, tier = EXCLUDED.tier,
    price_id = EXCLUDED.price_id, customer_id = EXCLUDED.customer_id,
    payment_verified = EXCLUDED.payment_verified, paid_through = EXCLUDED.paid_through,
    payment_blocked_at = EXCLUDED.payment_blocked_at,
    observed_at = EXCLUDED.observed_at, event_id = EXCLUDED.event_id,
    updated_at = clock_timestamp();

  SELECT tier INTO stripe_tier FROM public.billing_provider_state
    WHERE user_id = p_user_id AND provider = 'stripe' AND payment_verified
      AND provider_status = 'active' AND paid_through > clock_timestamp();
  SELECT tier INTO paypal_tier FROM public.billing_provider_state
    WHERE user_id = p_user_id AND provider = 'paypal' AND payment_verified
      AND provider_status IN ('ACTIVE', 'CANCELLED') AND paid_through > clock_timestamp();
  IF p_provider = 'stripe' AND stripe_tier IS NULL AND p_status <> 'active'
    AND upper(COALESCE(profile.paypal_subscription_status, '')) = 'ACTIVE'
    AND profile.plan IN ('pro', 'business') THEN stripe_tier := NULL; END IF;
  IF profile.role = 'owner' THEN access_plan := 'business';
  ELSIF stripe_tier = 'business' OR paypal_tier = 'business' THEN access_plan := 'business';
  ELSIF stripe_tier = 'pro' OR paypal_tier = 'pro' THEN access_plan := 'pro';
  ELSIF p_provider = 'stripe' AND upper(COALESCE(profile.paypal_subscription_status, '')) = 'ACTIVE'
    AND profile.plan IN ('pro', 'business') THEN access_plan := profile.plan;
  ELSIF p_provider = 'paypal' AND lower(COALESCE(profile.stripe_subscription_status, '')) = 'active'
    AND profile.stripe_price_id IS NOT NULL THEN
      access_plan := CASE WHEN profile.plan = 'business' THEN 'business' ELSE 'pro' END;
  ELSE access_plan := 'free';
  END IF;

  IF p_provider = 'stripe' THEN
    UPDATE public.profiles SET stripe_subscription_id = p_subscription_id,
      stripe_customer_id = p_customer_id, stripe_subscription_status =
        CASE WHEN p_status = 'active' AND NOT verified THEN 'past_due' ELSE p_status END,
      stripe_price_id = p_price_id, stripe_updated_at = clock_timestamp(), plan = access_plan
      WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles SET paypal_subscription_id = p_subscription_id,
      paypal_subscription_status = p_status, subscription_updated_at = clock_timestamp(),
      plan = access_plan WHERE id = p_user_id;
  END IF;
  RETURN jsonb_build_object('applied', true, 'plan', access_plan, 'payment_verified', verified);
END
$function$;

REVOKE ALL ON FUNCTION public.billing_claim_checkout(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_finish_checkout(uuid, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_finish_provider_checkout(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_apply_verified_state(text, text, timestamptz, uuid, text, text, text, text, text, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_claim_checkout(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_finish_checkout(uuid, bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_finish_provider_checkout(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_apply_verified_state(text, text, timestamptz, uuid, text, text, text, text, text, boolean, timestamptz, text) TO service_role;
