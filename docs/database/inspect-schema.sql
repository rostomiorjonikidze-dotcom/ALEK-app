-- Lecture seule : exécuter d'abord sur une copie isolée du schéma réel.
-- Relire les résultats avant partage : les définitions SQL peuvent contenir des secrets.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
ORDER BY c.relname;

SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges WHERE table_schema = 'public'
ORDER BY table_name, grantee, privilege_type;

SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges WHERE table_schema = 'public'
ORDER BY table_name, column_name, grantee;

SELECT c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
ORDER BY c.relname, con.conname;

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;

SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY c.relname, t.tgname;

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f' ORDER BY p.proname;
ROLLBACK;
