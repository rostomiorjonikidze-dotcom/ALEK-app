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
  invoice_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX documents_user_type_number_unique
  ON public.documents (user_id, document_type, document_number)
  WHERE document_number IS NOT NULL;
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
BEGIN
  SELECT 'FA-' || lpad((count(*) + 1)::text, 4, '0') INTO v_number
    FROM public.documents
    WHERE user_id = auth.uid() AND document_type = p_payload->>'document_type';
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
    (p_payload->>'vat_rate')::numeric, (p_payload->>'vat_exempt')::boolean,
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
BEGIN
  RETURN public.issue_artisan_document(p_payload);
END;
$function$;
