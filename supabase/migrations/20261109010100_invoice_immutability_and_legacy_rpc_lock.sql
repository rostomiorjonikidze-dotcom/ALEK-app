-- Fail closed unless the verified ALEK documents/issuer contract is present.
-- This migration preserves all existing rows and the existing numbering index.
DO $migration$
DECLARE
  v_table regclass := to_regclass('public.documents');
  v_function regprocedure;
  v_owner oid;
  v_existing_role record;
  v_column record;
  v_index_ok boolean;
  v_policy text := 'alek_invoice_issuer_documents';
  v_sequence text;
BEGIN
  IF v_table IS NULL THEN
    RAISE EXCEPTION 'Prerequisite missing: public.documents';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'anon'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Expected Supabase roles anon, authenticated and service_role';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = v_table) THEN
    RAISE EXCEPTION 'RLS must remain enabled on public.documents';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = v_table AND NOT polpermissive
  ) THEN
    RAISE EXCEPTION 'Review restrictive documents policies before adding the issuer policy';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = v_table AND polname = v_policy
  ) THEN
    RAISE EXCEPTION 'Policy % already exists; inspect prior installation before continuing', v_policy;
  END IF;

  FOR v_column IN
    SELECT * FROM (VALUES
      ('id', ARRAY['uuid']::text[]),
      ('user_id', ARRAY['uuid']::text[]),
      ('document_type', ARRAY['text', 'character varying']::text[]),
      ('document_number', ARRAY['text', 'character varying']::text[]),
      ('document_date', ARRAY['date']::text[]),
      ('due_date', ARRAY['date']::text[]),
      ('services', ARRAY['jsonb']::text[]),
      ('total_ht', ARRAY['numeric']::text[]),
      ('total_vat', ARRAY['numeric']::text[]),
      ('total_ttc', ARRAY['numeric']::text[]),
      ('vat_rate', ARRAY['numeric']::text[]),
      ('vat_exempt', ARRAY['boolean']::text[]),
      ('invoice_status', ARRAY['text', 'character varying']::text[])
    ) AS expected(column_name, data_types)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'documents'
        AND c.column_name = v_column.column_name
        AND c.data_type = ANY(v_column.data_types)
    ) THEN
      RAISE EXCEPTION 'Expected public.documents.% with type % is absent or differs',
        v_column.column_name, v_column.data_types;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'documents'
      AND c.column_name IN ('document_type', 'document_number', 'invoice_status')
      AND c.data_type NOT IN ('text', 'character varying')
  ) THEN
    RAISE EXCEPTION 'document_type, document_number and invoice_status must be text-compatible';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = v_table AND i.indisunique AND i.indisvalid
      AND i.indnkeyatts = 3
      AND i.indkey[0] = (SELECT attnum FROM pg_attribute WHERE attrelid = v_table AND attname = 'user_id')
      AND i.indkey[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = v_table AND attname = 'document_type')
      AND i.indkey[2] = (SELECT attnum FROM pg_attribute WHERE attrelid = v_table AND attname = 'document_number')
      AND pg_get_expr(i.indpred, i.indrelid) IS NOT NULL
  ) INTO v_index_ok;
  IF NOT v_index_ok THEN
    RAISE EXCEPTION 'Expected existing unique partial index on (user_id, document_type, document_number) was not found';
  END IF;

  FOR v_function IN SELECT unnest(ARRAY[
    to_regprocedure('public.issue_artisan_document(jsonb)'),
    to_regprocedure('public.issue_artisan_document_v2(jsonb)')
  ])
  LOOP
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_function) THEN
      RAISE EXCEPTION 'Expected % to be SECURITY DEFINER', v_function;
    END IF;
    IF (SELECT prorettype FROM pg_proc WHERE oid = v_function) <> 'jsonb'::regtype THEN
      RAISE EXCEPTION 'Expected % to return jsonb for the guarded wrapper contract', v_function;
    END IF;
    IF (SELECT proretset FROM pg_proc WHERE oid = v_function) THEN
      RAISE EXCEPTION 'Set-returning issuer % needs a separately reviewed wrapper', v_function;
    END IF;
  END LOOP;

  IF to_regprocedure('public.issue_artisan_document(jsonb)') IS NULL
     OR to_regprocedure('public.issue_artisan_document_v2(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Both existing invoice issuer RPCs are required';
  END IF;

  SELECT p.proowner INTO v_owner FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.issue_artisan_document(jsonb)');
  IF v_owner <> (SELECT proowner FROM pg_proc
    WHERE oid = to_regprocedure('public.issue_artisan_document_v2(jsonb)')) THEN
    RAISE EXCEPTION 'Legacy issuer functions must have one owner before isolation';
  END IF;

  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is required';
  END IF;

  SELECT * INTO v_existing_role FROM pg_roles WHERE rolname = 'alek_invoice_issuer';
  IF FOUND THEN
    RAISE EXCEPTION 'Role alek_invoice_issuer already exists; inspect its ownership and grants before proceeding';
  END IF;
  CREATE ROLE alek_invoice_issuer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;

  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    WHERE m.roleid = 'alek_invoice_issuer'::regrole
       OR m.member = 'alek_invoice_issuer'::regrole
  ) THEN
    RAISE EXCEPTION 'alek_invoice_issuer must have no role memberships';
  END IF;

  -- The isolated NOLOGIN role owns only the two reviewed legacy functions and
  -- the new guarded entry point. It has no table-owner or RLS-bypass powers.
  GRANT USAGE ON SCHEMA public, auth TO alek_invoice_issuer;
  GRANT CREATE ON SCHEMA public TO alek_invoice_issuer;
  ALTER FUNCTION public.issue_artisan_document(jsonb) OWNER TO alek_invoice_issuer;
  ALTER FUNCTION public.issue_artisan_document_v2(jsonb) OWNER TO alek_invoice_issuer;
  ALTER FUNCTION public.issue_artisan_document(jsonb)
    SET search_path = pg_catalog, auth, public;
  ALTER FUNCTION public.issue_artisan_document_v2(jsonb)
    SET search_path = pg_catalog, auth, public;
  REVOKE CREATE ON SCHEMA public FROM alek_invoice_issuer;

  -- Remove direct entry to both pre-existing RPCs from every login/API role.
  REVOKE ALL ON FUNCTION public.issue_artisan_document(jsonb) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.issue_artisan_document_v2(jsonb) FROM PUBLIC;
  FOR v_existing_role IN SELECT rolname FROM pg_roles
    WHERE oid <> 'alek_invoice_issuer'::regrole
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.issue_artisan_document(jsonb) FROM %I', v_existing_role.rolname);
    EXECUTE format('REVOKE ALL ON FUNCTION public.issue_artisan_document_v2(jsonb) FROM %I', v_existing_role.rolname);
  END LOOP;

  GRANT SELECT, INSERT ON public.documents TO alek_invoice_issuer;
  GRANT EXECUTE ON FUNCTION auth.uid() TO alek_invoice_issuer;
  v_sequence := pg_get_serial_sequence('public.documents', 'id');
  IF v_sequence IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO alek_invoice_issuer', v_sequence::regclass);
  END IF;

  EXECUTE format(
    'CREATE POLICY %I ON public.documents FOR ALL TO alek_invoice_issuer USING (true) WITH CHECK (true)',
    v_policy
  );
END;
$migration$;

CREATE OR REPLACE FUNCTION public.alek_guard_issued_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.document_type = 'facture' AND NEW.document_number IS NOT NULL THEN
      IF current_user <> 'alek_invoice_issuer' THEN
        RAISE EXCEPTION 'Les factures numérotées doivent être émises par la fonction sécurisée';
      END IF;
      IF NEW.invoice_status IS DISTINCT FROM 'unpaid' THEN
        RAISE EXCEPTION 'Une facture émise doit commencer au statut impayé';
      END IF;
    ELSIF NEW.document_type = 'facture'
          AND NEW.invoice_status IS NOT NULL
          AND NEW.invoice_status NOT IN ('unpaid', 'pending') THEN
      RAISE EXCEPTION 'Un brouillon de facture ne peut pas être marqué payé';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.document_type = 'facture' AND OLD.document_number IS NOT NULL THEN
      RAISE EXCEPTION 'Une facture numérotée ne peut pas être supprimée';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.document_type = 'facture' AND OLD.document_number IS NOT NULL THEN
    IF (to_jsonb(NEW) - 'invoice_status') IS DISTINCT FROM
       (to_jsonb(OLD) - 'invoice_status') THEN
      RAISE EXCEPTION 'Les données fiscales d’une facture numérotée sont immuables';
    END IF;
    IF NEW.invoice_status IS DISTINCT FROM OLD.invoice_status
       AND (NEW.invoice_status IS NULL OR NEW.invoice_status NOT IN ('unpaid', 'pending', 'paid')) THEN
      RAISE EXCEPTION 'Statut de paiement non pris en charge';
    END IF;
  ELSIF NEW.document_type = 'facture' AND NEW.document_number IS NOT NULL
        AND current_user <> 'alek_invoice_issuer' THEN
    RAISE EXCEPTION 'La numérotation d’une facture est réservée à la fonction sécurisée';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.alek_guard_issued_document() FROM PUBLIC;
CREATE TRIGGER alek_guard_issued_document
BEFORE INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.alek_guard_issued_document();
