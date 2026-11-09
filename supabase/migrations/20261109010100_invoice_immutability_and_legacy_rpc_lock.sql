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

  IF has_schema_privilege('anon', 'public', 'CREATE')
     OR has_schema_privilege('authenticated', 'public', 'CREATE')
     OR has_schema_privilege('service_role', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'API roles must not be able to create objects in public before SECURITY DEFINER installation';
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
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      AND proname = 'issue_artisan_document') <> 1
     OR (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      AND proname = 'issue_artisan_document_v2') <> 1 THEN
    RAISE EXCEPTION 'Issuer RPC overloads must be reviewed and removed or explicitly handled';
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
-- Install only after 20261109010100 and a reviewed production-schema preflight.
CREATE TABLE public.alek_document_issue_requests (
  user_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  request_fingerprint bytea NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, idempotency_key)
);

ALTER TABLE public.alek_document_issue_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY alek_document_issue_requests_issuer
  ON public.alek_document_issue_requests
  FOR ALL TO alek_invoice_issuer
  USING (true) WITH CHECK (true);
REVOKE ALL ON public.alek_document_issue_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.alek_document_issue_requests TO alek_invoice_issuer;

CREATE FUNCTION public.alek_round_document_money(p_value numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.floor(
    (p_value + 0.0000000000000002220446049250313::numeric * pg_catalog.abs(p_value))
    * 100 + 0.5
  ) / 100
$function$;
ALTER FUNCTION public.alek_round_document_money(numeric) OWNER TO alek_invoice_issuer;
REVOKE ALL ON FUNCTION public.alek_round_document_money(numeric) FROM PUBLIC;

CREATE FUNCTION public.issue_artisan_document_v3(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, public
AS $function$
DECLARE
  v_user_id uuid;
  v_key uuid;
  v_kind text;
  v_date date;
  v_due_date date;
  v_rate numeric;
  v_exempt boolean;
  v_line jsonb;
  v_price numeric;
  v_quantity numeric;
  v_hours numeric;
  v_line_total numeric;
  v_total_ht numeric := 0;
  v_total_vat numeric;
  v_total_ttc numeric;
  v_forward_payload jsonb;
  v_request_payload jsonb;
  v_request_fingerprint bytea;
  v_existing_fingerprint bytea;
  v_result jsonb;
  v_saved jsonb;
  v_document_id uuid;
  v_document_number text;
  v_inserted integer;
  v_before_count bigint;
  v_after_count bigint;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Une session authentifiée est requise';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Le contenu du document est invalide';
  END IF;
  IF p_payload->>'user_id' IS DISTINCT FROM v_user_id::text THEN
    RAISE EXCEPTION 'Le propriétaire du document ne correspond pas à la session';
  END IF;
  IF jsonb_typeof(p_payload->'idempotency_key') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Une clé idempotente UUID est obligatoire';
  END IF;
  BEGIN
    v_key := (p_payload->>'idempotency_key')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'La clé idempotente doit être un UUID valide';
  END;

  v_kind := p_payload->>'document_type';
  IF v_kind NOT IN ('facture', 'devis') THEN
    RAISE EXCEPTION 'Type de document non pris en charge';
  END IF;
  IF jsonb_typeof(p_payload->'document_date') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'La date du document est obligatoire';
  END IF;
  BEGIN
    v_date := (p_payload->>'document_date')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'La date du document est invalide';
  END;
  IF to_char(v_date, 'YYYY-MM-DD') <> p_payload->>'document_date' THEN
    RAISE EXCEPTION 'La date du document doit être au format AAAA-MM-JJ';
  END IF;
  IF p_payload->'due_date' IS NOT NULL AND p_payload->'due_date' <> 'null'::jsonb THEN
    IF jsonb_typeof(p_payload->'due_date') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'La date d’échéance est invalide';
    END IF;
    BEGIN
      v_due_date := (p_payload->>'due_date')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'La date d’échéance est invalide';
    END;
    IF to_char(v_due_date, 'YYYY-MM-DD') <> p_payload->>'due_date'
       OR v_due_date < v_date THEN
      RAISE EXCEPTION 'La date d’échéance précède ou invalide la date du document';
    END IF;
  END IF;

  IF jsonb_typeof(p_payload->'vat_rate') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_payload->'vat_exempt') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'Le taux et le régime de TVA sont invalides';
  END IF;
  v_rate := (p_payload->>'vat_rate')::numeric;
  v_exempt := (p_payload->>'vat_exempt')::boolean;
  IF v_rate NOT IN (0, 5.5, 10, 20) OR (v_exempt AND v_rate <> 0) THEN
    RAISE EXCEPTION 'Taux de TVA non pris en charge ou incompatible avec l’exonération';
  END IF;
  IF jsonb_typeof(p_payload->'services') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload->'services') = 0 THEN
    RAISE EXCEPTION 'Au moins une prestation est requise';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'services') AS e(value)
  LOOP
    IF jsonb_typeof(v_line) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_line->'description') IS DISTINCT FROM 'string'
       OR btrim(v_line->>'description') = ''
       OR jsonb_typeof(v_line->'type') IS DISTINCT FROM 'string'
       OR v_line->>'type' NOT IN ('labor', 'material')
       OR jsonb_typeof(v_line->'priceType') IS DISTINCT FROM 'string'
       OR v_line->>'priceType' NOT IN ('total', 'unit', 'hourly')
       OR jsonb_typeof(v_line->'quantity') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_line->'price') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Une ligne de prestation a un format invalide';
    END IF;
    v_price := (v_line->>'price')::numeric;
    v_quantity := (v_line->>'quantity')::numeric;
    IF v_price < 0 OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Les prix doivent être positifs ou nuls et les quantités strictement positives';
    END IF;

    IF v_line->>'priceType' = 'hourly' THEN
      IF jsonb_typeof(v_line->'hours') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'Le nombre d’heures doit être numérique';
      END IF;
      v_hours := (v_line->>'hours')::numeric;
      IF v_hours <= 0 THEN
        RAISE EXCEPTION 'Le nombre d’heures doit être strictement positif';
      END IF;
      v_line_total := public.alek_round_document_money(v_price * v_hours);
    ELSIF v_line->>'priceType' = 'unit' THEN
      v_line_total := public.alek_round_document_money(v_price * v_quantity);
    ELSE
      v_line_total := public.alek_round_document_money(v_price);
    END IF;
    v_total_ht := v_total_ht + v_line_total;
  END LOOP;

  v_total_ht := public.alek_round_document_money(v_total_ht);
  v_total_vat := public.alek_round_document_money(v_total_ht * v_rate / 100);
  v_total_ttc := public.alek_round_document_money(v_total_ht + v_total_vat);
  IF jsonb_typeof(p_payload->'total_ht') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_payload->'total_vat') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_payload->'total_ttc') IS DISTINCT FROM 'number'
     OR (p_payload->>'total_ht')::numeric <> v_total_ht
     OR (p_payload->>'total_vat')::numeric <> v_total_vat
     OR (p_payload->>'total_ttc')::numeric <> v_total_ttc THEN
    RAISE EXCEPTION 'Les montants transmis ne correspondent pas aux prestations et à la TVA recalculées';
  END IF;

  v_forward_payload := p_payload - 'idempotency_key' - 'document_number';
  v_forward_payload := v_forward_payload || jsonb_build_object(
    'user_id', v_user_id::text,
    'document_number', NULL,
    'total_ht', v_total_ht,
    'total_vat', v_total_vat,
    'total_ttc', v_total_ttc,
    'vat_rate', v_rate,
    'invoice_status', CASE WHEN v_kind = 'facture' THEN 'unpaid' ELSE NULL END
  );
  v_request_payload := v_forward_payload;
  v_request_fingerprint := pg_catalog.sha256(convert_to(v_request_payload::text, 'UTF8'));

  -- The old allocator is not known to be concurrency-safe. Serialize all of
  -- one user's issue operations while preserving its existing number format.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 2026110901));
  SELECT count(*) INTO v_before_count FROM public.documents WHERE user_id = v_user_id;
  INSERT INTO public.alek_document_issue_requests(user_id, idempotency_key, request_fingerprint)
    VALUES (v_user_id, v_key, v_request_fingerprint)
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT request_fingerprint, result INTO v_existing_fingerprint, v_result
      FROM public.alek_document_issue_requests
      WHERE user_id = v_user_id AND idempotency_key = v_key
      FOR UPDATE;
    IF v_existing_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION 'Cette clé idempotente a déjà été utilisée avec un autre document';
    END IF;
    IF v_result IS NULL THEN
      RAISE EXCEPTION 'La demande précédente est incomplète; vérification opérateur requise';
    END IF;
    RETURN v_result;
  END IF;

  v_result := public.issue_artisan_document_v2(v_forward_payload);
  IF v_result IS NULL OR jsonb_typeof(v_result) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_result->'id') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_result->'document_number') IS DISTINCT FROM 'string'
     OR btrim(v_result->>'document_number') = '' THEN
    RAISE EXCEPTION 'L’émetteur existant n’a pas retourné une pièce numérotée vérifiable';
  END IF;
  BEGIN
    v_document_id := (v_result->>'id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'L’émetteur existant a retourné un identifiant invalide';
  END;
  v_document_number := v_result->>'document_number';

  SELECT count(*) INTO v_after_count FROM public.documents WHERE user_id = v_user_id;
  IF v_after_count <> v_before_count + 1 THEN
    RAISE EXCEPTION 'L’émetteur existant doit créer exactement un seul document';
  END IF;

  SELECT to_jsonb(d) INTO v_saved
    FROM public.documents AS d
    WHERE d.id = v_document_id AND d.user_id = v_user_id
      AND d.document_type = v_kind AND d.document_number = v_document_number;
  IF v_saved IS NULL
     OR (v_saved->>'total_ht')::numeric <> v_total_ht
     OR (v_saved->>'total_vat')::numeric <> v_total_vat
     OR (v_saved->>'total_ttc')::numeric <> v_total_ttc
     OR (v_saved->>'vat_rate')::numeric <> v_rate
     OR (v_saved->>'vat_exempt')::boolean <> v_exempt
     OR v_saved->'services' IS DISTINCT FROM p_payload->'services'
     OR v_saved->>'document_date' IS DISTINCT FROM p_payload->>'document_date' THEN
    RAISE EXCEPTION 'La pièce persistée ne correspond pas aux montants recalculés et au propriétaire';
  END IF;
  IF v_kind = 'facture' AND v_saved->>'invoice_status' IS DISTINCT FROM 'unpaid' THEN
    RAISE EXCEPTION 'Une facture ne peut pas être émise comme déjà réglée';
  END IF;

  v_result := jsonb_build_object('id', v_document_id, 'document_number', v_document_number);
  UPDATE public.alek_document_issue_requests
    SET result = v_result
    WHERE user_id = v_user_id AND idempotency_key = v_key;
  RETURN v_result;
END;
$function$;

ALTER FUNCTION public.issue_artisan_document_v3(jsonb) OWNER TO alek_invoice_issuer;
REVOKE ALL ON FUNCTION public.issue_artisan_document_v3(jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.issue_artisan_document_v3(jsonb) TO authenticated;
