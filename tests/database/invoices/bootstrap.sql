\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO PUBLIC;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
SET search_path = pg_catalog
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  document_number text,
  document_date date NOT NULL,
  due_date date,
  services jsonb NOT NULL,
  total_ht numeric,
  total_vat numeric,
  total_ttc numeric,
  vat_rate numeric NOT NULL,
  vat_exempt boolean NOT NULL DEFAULT false,
  client_is_professional boolean NOT NULL DEFAULT false,
  invoice_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX artisan_documents_user_type_number_unique
  ON public.documents (user_id, document_type, document_number)
  WHERE user_id IS NOT NULL AND document_number IS NOT NULL;
-- Model the actual production counter table (RLS enabled without any API policies).
CREATE TABLE public.artisan_document_counters (
  user_id uuid NOT NULL,
  kind text NOT NULL,
  doc_year integer NOT NULL,
  last_value integer NOT NULL,
  PRIMARY KEY(user_id, kind, doc_year)
);
ALTER TABLE public.artisan_document_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_select_own ON public.documents
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY documents_insert_own ON public.documents
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY documents_update_own ON public.documents
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY documents_delete_own ON public.documents
  FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO service_role;
INSERT INTO public.documents (
  user_id, document_type, document_number, document_date, services,
  total_ht, total_vat, total_ttc, vat_rate, vat_exempt, invoice_status
) VALUES (
  '00000000-0000-0000-0000-000000000002', 'facture', 'FACT-2025-01',
  '2025-04-05', '[{"description":"Historique","type":"labor","priceType":"total","quantity":1,"hours":1,"price":10}]',
  10, 2, 12, 20, false, 'paid'
);

CREATE FUNCTION public.issue_artisan_document(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, auth, public
AS $function$
DECLARE
  v_number text;
  v_id uuid;
  v_n integer;
  v_kind text := p_payload->>'document_type';
  v_date date := (p_payload->>'document_date')::date;
  v_year integer := extract(year from (p_payload->>'document_date')::date);
  v_prefix text := CASE WHEN p_payload->>'document_type' = 'facture' THEN 'FAC' ELSE 'DEV' END;
BEGIN
  INSERT INTO public.artisan_document_counters(user_id, kind, doc_year, last_value)
    VALUES(auth.uid(), v_kind, v_year, 1)
  ON CONFLICT(user_id,kind,doc_year) DO UPDATE
    SET last_value = public.artisan_document_counters.last_value + 1
  RETURNING last_value INTO v_n;
  v_number := v_prefix || '-' || v_year || '-' || lpad(v_n::text,3,'0');
  INSERT INTO public.documents (
    user_id, document_type, document_number, document_date, due_date,
    services, total_ht, total_vat, total_ttc, vat_rate, vat_exempt, invoice_status
  ) VALUES (
    auth.uid(), p_payload->>'document_type', v_number,
    (p_payload->>'document_date')::date,
    CASE WHEN p_payload->>'test_wrong_due_date' = 'true' THEN NULL
      ELSE nullif(p_payload->>'due_date', '')::date END,
    p_payload->'services',
    CASE WHEN p_payload->>'test_null_total_ht' = 'true' THEN NULL
      ELSE (p_payload->>'total_ht')::numeric END,
    (p_payload->>'total_vat')::numeric,
    (p_payload->>'total_ttc')::numeric,
    (p_payload->>'vat_rate')::numeric, false,
    p_payload->>'invoice_status'
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'document_number', v_number);
END;
$function$;

CREATE FUNCTION public.issue_artisan_document_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, auth, public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.issue_artisan_document(p_payload);
  UPDATE public.documents SET
    vat_exempt = COALESCE((p_payload->>'vat_exempt')::boolean,false),
    client_is_professional = COALESCE((p_payload->>'client_is_professional')::boolean,false)
  WHERE id = (v_result->>'id')::uuid AND user_id = auth.uid();
  RETURN v_result;
END;
$function$;
