-- Protect profile entitlements without replacing the deployed RLS policies.
-- Apply only after reviewing docs/SECURITY-PRODUCTION-SAFETY.md and the live schema.
DO $migration$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Prerequisite missing: public.profiles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'role' AND attnum > 0 AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'plan' AND attnum > 0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Prerequisite missing: public.profiles.role and public.profiles.plan must exist';
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION public.guard_profile_entitlement_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  v_column record;
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb;
  v_default jsonb;
BEGIN
  -- The PostgREST role is the database role, not a caller-controlled JWT claim.
  -- SECURITY DEFINER application RPCs therefore do not inherit this exception.
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
  END IF;

  FOR v_column IN
    SELECT a.attname, a.atttypid, a.attgenerated,
           pg_get_expr(d.adbin, d.adrelid) AS default_expression
    FROM pg_attribute AS a
    LEFT JOIN pg_attrdef AS d
      ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = TG_RELID
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND (
        a.attname IN (
          'role', 'plan', 'paypal_subscription_id', 'paypal_subscription_status',
          'stripe_subscription_id', 'stripe_subscription_status',
          'stripe_customer_id', 'stripe_price_id', 'subscription_updated_at'
        )
        OR a.attname ~* '(^|_)(quota|usage|entitlement|credit|limit|remaining)(_|$)'
        OR a.attname ~* '^ai_(requests|tokens|credits)(_|$)'
      )
  LOOP
    IF TG_OP = 'UPDATE' THEN
      IF v_new -> v_column.attname IS DISTINCT FROM v_old -> v_column.attname THEN
        RAISE EXCEPTION 'Profile field % is managed by the service', v_column.attname
          USING ERRCODE = '42501';
      END IF;
    ELSIF v_column.attgenerated = '' THEN
      -- A new self-profile may use database defaults, but cannot choose an
      -- entitlement value. Evaluate only the default recorded for this column.
      IF v_column.default_expression IS NULL THEN
        v_default := NULL;
      ELSE
        EXECUTE format(
          'SELECT to_jsonb((%s)::%s)',
          v_column.default_expression,
          format_type(v_column.atttypid, NULL)
        ) INTO v_default;
      END IF;

      IF NULLIF(v_new -> v_column.attname, 'null'::jsonb)
           IS DISTINCT FROM v_default THEN
        RAISE EXCEPTION 'Profile field % must use its database default', v_column.attname
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.guard_profile_entitlement_fields() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_profile_entitlement_fields ON public.profiles;
CREATE TRIGGER guard_profile_entitlement_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_entitlement_fields();
