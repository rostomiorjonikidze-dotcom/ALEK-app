-- Assertions run against only the SYNTHETIC fixture from security-fixture.sql.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
  IF current_database() !~ '^alek_security_fixture_[a-z0-9_]+$'
     OR NOT EXISTS (
       SELECT 1 FROM public.alek_synthetic_security_fixture
       WHERE fixture_name = 'profile-isolation-v1' AND marker = 'SYNTHETIC ONLY'
     ) THEN
    RAISE EXCEPTION 'Synthetic fixture marker/database guard failed';
  END IF;
END
$guard$;

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
DO $anon$
DECLARE v_table text; v_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles) THEN RAISE EXCEPTION 'anon saw profiles'; END IF;
  FOREACH v_table IN ARRAY ARRAY[
    'fixture_documents', 'fixture_clients', 'fixture_catalog',
    'fixture_expenses', 'fixture_receipts', 'fixture_signatures'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_count;
    IF v_count <> 0 THEN RAISE EXCEPTION 'anon saw rows in %', v_table; END IF;
  END LOOP;
END
$anon$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
DO $user_a$
DECLARE v_table text; v_count integer; v_rows integer; v_blocked boolean;
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'A profile isolation failed'; END IF;
  IF public.fixture_read_profile('00000000-0000-0000-0000-00000000000a') <> 'Société A' THEN
    RAISE EXCEPTION 'authorized profile RPC failed';
  END IF;
  v_blocked := false;
  BEGIN
    PERFORM public.fixture_read_profile('00000000-0000-0000-0000-00000000000b');
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'RPC returned another user profile'; END IF;

  UPDATE public.profiles SET company_name = 'Société A modifiée'
    WHERE id = '00000000-0000-0000-0000-00000000000a';
  IF NOT FOUND THEN RAISE EXCEPTION 'safe self-profile edit failed'; END IF;

  v_blocked := false;
  BEGIN
    UPDATE public.profiles SET role = 'owner'
      WHERE id = '00000000-0000-0000-0000-00000000000a';
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'self role escalation succeeded'; END IF;

  v_blocked := false;
  BEGIN
    UPDATE public.profiles SET plan = 'business'
      WHERE id = '00000000-0000-0000-0000-00000000000a';
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'self plan escalation succeeded'; END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', false);
  v_blocked := false;
  BEGIN
    UPDATE public.profiles SET plan = 'business'
      WHERE id = '00000000-0000-0000-0000-00000000000a';
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', false);
  IF NOT v_blocked THEN RAISE EXCEPTION 'mutable JWT role claim bypassed profile guard'; END IF;

  v_blocked := false;
  BEGIN
    UPDATE public.profiles SET ai_usage_count = 9999
      WHERE id = '00000000-0000-0000-0000-00000000000a';
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'self quota escalation succeeded'; END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO public.profiles (id, role, plan)
      VALUES (auth.uid(), 'owner', 'business');
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'profile insert escalation succeeded'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
  INSERT INTO public.profiles (id, company_name)
    VALUES (auth.uid(), 'Nouvelle société');
  IF NOT FOUND THEN RAISE EXCEPTION 'safe self-profile insert failed'; END IF;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

  v_blocked := false;
  BEGIN
    PERFORM public.fixture_promote_profile(auth.uid());
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'SECURITY DEFINER profile escalation succeeded'; END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'fixture_documents', 'fixture_clients', 'fixture_catalog',
    'fixture_expenses', 'fixture_receipts', 'fixture_signatures'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = auth.uid()', v_table) INTO v_count;
    IF v_count <> 1 THEN RAISE EXCEPTION 'A SELECT isolation failed for %', v_table; END IF;
    EXECUTE format('UPDATE public.%I SET value = %L WHERE user_id = %L',
      v_table, 'A updated', '00000000-0000-0000-0000-00000000000a');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'A UPDATE failed for %', v_table; END IF;
    EXECUTE format('UPDATE public.%I SET value = %L WHERE user_id = %L',
      v_table, 'unauthorized', '00000000-0000-0000-0000-00000000000b');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN RAISE EXCEPTION 'A updated B row in %', v_table; END IF;
    v_blocked := false;
    BEGIN
      EXECUTE format('INSERT INTO public.%I (id, user_id, value) VALUES (%L, %L, %L)',
        v_table, md5(v_table || '-transfer')::uuid,
        '00000000-0000-0000-0000-00000000000b', 'forged');
    EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION 'A inserted B-owned row in %', v_table; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE user_id = %L',
      v_table, '00000000-0000-0000-0000-00000000000b');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN RAISE EXCEPTION 'A deleted B row in %', v_table; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE user_id = %L',
      v_table, '00000000-0000-0000-0000-00000000000a');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'A could not delete own row in %', v_table; END IF;
  END LOOP;
END
$user_a$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
DO $user_b$
DECLARE v_table text; v_count integer; v_rows integer; v_blocked boolean;
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'B profile isolation failed'; END IF;
  v_blocked := false;
  BEGIN
    PERFORM public.fixture_read_profile('00000000-0000-0000-0000-00000000000a');
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'B RPC returned A profile'; END IF;
  UPDATE public.profiles SET company_name = 'Société B modifiée' WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'B safe self-profile edit failed'; END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'fixture_documents', 'fixture_clients', 'fixture_catalog',
    'fixture_expenses', 'fixture_receipts', 'fixture_signatures'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = auth.uid()', v_table) INTO v_count;
    IF v_count <> 1 THEN RAISE EXCEPTION 'B SELECT isolation failed for %', v_table; END IF;
    EXECUTE format('UPDATE public.%I SET value = %L WHERE user_id = %L',
      v_table, 'unauthorized', '00000000-0000-0000-0000-00000000000a');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN RAISE EXCEPTION 'B updated A row in %', v_table; END IF;
    v_blocked := false;
    BEGIN
      EXECUTE format('INSERT INTO public.%I (id, user_id, value) VALUES (%L, %L, %L)',
        v_table, md5(v_table || '-forged-b')::uuid,
        '00000000-0000-0000-0000-00000000000a', 'forged');
    EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
    END;
    IF NOT v_blocked THEN RAISE EXCEPTION 'B inserted A-owned row in %', v_table; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE user_id = %L',
      v_table, '00000000-0000-0000-0000-00000000000a');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN RAISE EXCEPTION 'B deleted A row in %', v_table; END IF;
    EXECUTE format('INSERT INTO public.%I (id, user_id, value) VALUES (%L, %L, %L)',
      v_table, md5(v_table || '-new-b')::uuid,
      '00000000-0000-0000-0000-00000000000b', 'B inserted');
    EXECUTE format('UPDATE public.%I SET value = %L WHERE id = %L',
      v_table, 'B updated', md5(v_table || '-new-b')::uuid);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'B own UPDATE failed for %', v_table; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id = %L',
      v_table, md5(v_table || '-new-b')::uuid);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'B own DELETE failed for %', v_table; END IF;
  END LOOP;
END
$user_b$;
RESET ROLE;

SET ROLE service_role;
UPDATE public.profiles SET plan = 'business'
WHERE id = '00000000-0000-0000-0000-00000000000a';
DO $service$
BEGIN
  IF (SELECT plan FROM public.profiles
      WHERE id = '00000000-0000-0000-0000-00000000000a') <> 'business' THEN
    RAISE EXCEPTION 'verified service_role billing update failed';
  END IF;
END
$service$;
RESET ROLE;

\echo 'PASS: synthetic two-user RLS, CRUD ownership, RPC checks, protected profile fields, SECURITY DEFINER guard, and service_role billing path'
