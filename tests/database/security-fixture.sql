-- SYNTHETIC ONLY. Run only in a disposable database named
-- alek_security_fixture_* via tests/database/security-isolation.sh.
\set ON_ERROR_STOP on

DO $guard$
BEGIN
  IF current_database() !~ '^alek_security_fixture_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Refusing synthetic fixture in database %', current_database();
  END IF;
END
$guard$;

DROP FUNCTION IF EXISTS public.guard_profile_entitlement_fields() CASCADE;
DROP TABLE IF EXISTS public.profiles, public.fixture_documents, public.fixture_clients,
  public.fixture_catalog, public.fixture_expenses, public.fixture_receipts,
  public.fixture_signatures, public.alek_synthetic_security_fixture CASCADE;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
SET search_path = pg_catalog
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.alek_synthetic_security_fixture (
  fixture_name text PRIMARY KEY,
  marker text NOT NULL CHECK (marker = 'SYNTHETIC ONLY')
);
INSERT INTO public.alek_synthetic_security_fixture VALUES ('profile-isolation-v1', 'SYNTHETIC ONLY');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL DEFAULT 'user',
  plan text NOT NULL DEFAULT 'free',
  paypal_subscription_id text,
  paypal_subscription_status text,
  stripe_subscription_id text,
  stripe_subscription_status text,
  stripe_customer_id text,
  stripe_price_id text,
  subscription_updated_at timestamptz,
  ai_usage_count integer NOT NULL DEFAULT 0,
  company_name text
);

CREATE TABLE public.fixture_documents (id uuid PRIMARY KEY, user_id uuid NOT NULL, value text NOT NULL);
CREATE TABLE public.fixture_clients (id uuid PRIMARY KEY, user_id uuid NOT NULL, value text NOT NULL);
CREATE TABLE public.fixture_catalog (id uuid PRIMARY KEY, user_id uuid NOT NULL, value text NOT NULL);
CREATE TABLE public.fixture_expenses (id uuid PRIMARY KEY, user_id uuid NOT NULL, value text NOT NULL);
CREATE TABLE public.fixture_receipts (id uuid PRIMARY KEY, user_id uuid NOT NULL, value text NOT NULL);
CREATE TABLE public.fixture_signatures (id uuid PRIMARY KEY, user_id uuid NOT NULL, value text NOT NULL);

INSERT INTO public.profiles (id, company_name) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Société A'),
  ('00000000-0000-0000-0000-00000000000b', 'Société B');

DO $seed$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'fixture_documents', 'fixture_clients', 'fixture_catalog',
    'fixture_expenses', 'fixture_receipts', 'fixture_signatures'
  ] LOOP
    EXECUTE format(
      'INSERT INTO public.%I (id, user_id, value) VALUES ($1, $2, $3), ($4, $5, $6)',
      v_table
    ) USING
      (md5(v_table || '-a')::uuid), '00000000-0000-0000-0000-00000000000a'::uuid, 'A fixture',
      (md5(v_table || '-b')::uuid), '00000000-0000-0000-0000-00000000000b'::uuid, 'B fixture';
  END LOOP;
END
$seed$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self ON public.profiles
  FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DO $policies$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'fixture_documents', 'fixture_clients', 'fixture_catalog',
    'fixture_expenses', 'fixture_receipts', 'fixture_signatures'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format(
      'CREATE POLICY owner_isolation ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      v_table
    );
  END LOOP;
END
$policies$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles,
  public.fixture_documents, public.fixture_clients, public.fixture_catalog,
  public.fixture_expenses, public.fixture_receipts, public.fixture_signatures
TO anon, authenticated;
GRANT ALL ON public.profiles, public.fixture_documents, public.fixture_clients,
  public.fixture_catalog, public.fixture_expenses, public.fixture_receipts,
  public.fixture_signatures TO service_role;

CREATE OR REPLACE FUNCTION public.fixture_read_profile(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $rpc$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT company_name FROM public.profiles WHERE id = p_user_id);
END
$rpc$;
CREATE OR REPLACE FUNCTION public.fixture_promote_profile(p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ UPDATE public.profiles SET role = 'owner' WHERE id = p_user_id $$;
GRANT CREATE ON SCHEMA public TO service_role;
ALTER FUNCTION public.fixture_promote_profile(uuid) OWNER TO service_role;
REVOKE CREATE ON SCHEMA public FROM service_role;
GRANT EXECUTE ON FUNCTION public.fixture_read_profile(uuid), public.fixture_promote_profile(uuid)
TO authenticated;
