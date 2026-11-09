# Production security safety gate

## Scope and verified boundary

The repository does not contain an authoritative schema dump for the deployed
Supabase database. No Supabase connection was available, and no live database
or customer data was accessed. External audit evidence reported by the project
owner (not reproduced here): RLS is enabled on `profiles`, `documents`, `artisan_clients`,
`artisan_catalog`, `artisan_expenses` and related private tables; simulated
two-user SELECT checks showed each user saw only their own `documents` and
`profiles`; anonymous SELECT returned no private documents or profiles. The
owner also reports `reserve_ai_usage`/`refund_ai_usage` are not executable by
ordinary authenticated users. These findings are separate from the synthetic
local test results below. Invoice issue RPC authorization is owned by the
document-issuance workstream.

The app currently reads profile billing fields including `role`, `plan`, Stripe
and PayPal subscription/customer/price identifiers and statuses, and
`subscription_updated_at`. Server billing routes write those fields using the
service client. AI reservation is performed through RPCs; the actual quota
storage schema is not present here.

## Prepared profile guard

`supabase/migrations/2026110903_profiles_protect_billing_fields.sql` is an
unapplied, reversible migration. It fails if `public.profiles`, `role`, or
`plan` is missing. It adds a row trigger, without replacing RLS policies or
changing table grants. Authenticated profile edits to business information
remain possible; entitlement, provider-ID/status, and quota/usage columns are
immutable to ordinary roles. A new self-profile may use only database defaults
for those protected fields. The service client role (`service_role`) may perform
verified billing writes only when both JWT role and SQL `current_role` plus the
caller's active SQL `role` are `service_role`. A `SECURITY DEFINER` RPC invoked
by an authenticated user does not gain the exception, even when its owner is
`service_role`; a mutable JWT claim alone is insufficient. The migration refuses
a pre-existing guard name, volatile protected-field defaults, or authenticated
membership in `service_role`. The
database owner remains trusted and can alter or disable the guard.

Before applying anywhere, inspect the exact column list and defaults with
`docs/database/inspect-schema.sql`. Review any column matched by the guard's
name patterns, test auth sign-up/profile bootstrap and service-role billing
updates against a schema clone, and verify that no alternate `SECURITY DEFINER`
path changes protected values. The test fixture's table layout is deliberately
synthetic; it is not asserted to match production.

Rollback: in a reviewed rollback migration, drop trigger
`public.guard_profile_entitlement_fields` from `public.profiles`, then drop
function `public.guard_profile_entitlement_fields()`. The migration changes no
rows, so rollback does not restore data. Rollback reopens profile-field
escalation risk; do not use it as a routine release step.

```sql
BEGIN;
DROP TRIGGER guard_profile_entitlement_fields ON public.profiles;
DROP FUNCTION public.guard_profile_entitlement_fields();
COMMIT;
```

## Isolated security regression test

`tests/database/security-fixture.sql` and
`tests/database/security-isolation.sql` are synthetic-only and exercise two
users, anonymous access, SELECT/INSERT/UPDATE/DELETE ownership, profile insert
and update escalation, a `SECURITY DEFINER` bypass attempt, an ownership-checking
RPC, service-role billing writes, and fixture-only receipts/signatures. They do
not validate the actual deployed receipt/signature table names, policies, grants,
RPCs, or storage.

Run the standalone suite:

```sh
tests/database/security-isolation.sh
```

The runner selects binaries from `PG_BINDIR` or `pg_config --bindir`, provisions
its own temporary local cluster and Unix socket, clears inherited `PG*`
connection variables, and stops/removes the cluster on exit. It accepts no
database URL or target host. It requires `initdb`, `pg_ctl`, `createdb`, `psql`,
and permission to create test roles. As root it uses `runuser -u postgres`;
otherwise it runs as the current user. The suite passed against this synthetic
local fixture; it did not connect to Supabase or validate the actual production
schema. Never adapt this synthetic runner to a production target.

## Production verification checklist

1. Export and review schema-only metadata using `docs/database/inspect-schema.sql`
   from a controlled clone. Redact function bodies and defaults before sharing
   if they contain secrets. Confirm the real table/column names, defaults, RLS
   policies, grants, view security modes, triggers and every exposed routine.
2. Apply the prepared migration only to a disposable clone first. Test signup,
   self-service business-profile edits, plan/role/quota tampering, direct REST
   writes, ordinary `SECURITY DEFINER` RPC attempts, and service-role billing
   updates. Confirm legitimate billing/reconciliation code uses the service role.
3. Use two isolated Supabase users plus anon and authenticated JWTs to check
   SELECT, INSERT, UPDATE, DELETE and RPC behavior on the actual profiles,
   documents, client/catalog/expense, receipt and signature objects. Include
   ownership transfer attempts and token/hash/snapshot integrity checks. RLS
   for one table does not establish isolation for another or for Storage.
4. Review every `SECURITY DEFINER` function's owner, safe fixed `search_path`,
   effective EXECUTE privileges, caller identity/ownership checks, and behavior
   when called directly through PostgREST. Do not infer safety from application
   routes or a function's name.
5. Capture redacted test results and a rollback plan. Production application
   requires explicit approval, a current backup/recovery plan, and a separate
   release decision. No production migration is authorized by this document.

No claim of full Supabase security, French legal invoicing compliance, or
electronic-signature compliance is made here.
