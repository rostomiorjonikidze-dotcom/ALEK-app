# ALEK — live Supabase schema preflight (9 November 2026)

## Scope

A **read-only** inspection of the connected ALEK Supabase database (not the shop database), compared against the three candidate migrations from PR #29. No migration, database write, real checkout or production deployment was performed. These are catalog observations, **not** a completed production integration test.

## Confirmed production structure

- Public `documents`, `profiles`, `artisan_document_counters` and `artisan_signature_requests` exist; RLS is enabled on these tables.
- `documents` presently allows authenticated users to UPDATE and DELETE their own rows through RLS; finalized invoices are not protected by an immutable-row database trigger.
- The valid unique partial index `artisan_documents_user_type_number_unique` has predicate `(user_id IS NOT NULL) AND (document_number IS NOT NULL)`; the original PR #29 preflight incorrectly required only `document_number IS NOT NULL`.
- Both legacy issuer RPCs, `issue_artisan_document(jsonb)` and `issue_artisan_document_v2(jsonb)`, are SECURITY DEFINER functions owned by `postgres`. The legacy issuer inserts/updates document counters, and v2 updates `vat_exempt` and `client_is_professional` on the freshly inserted document.
- `artisan_document_counters` has RLS enabled and no policies, so an isolated non-bypass issuer role needs an explicit policy as well as SELECT/INSERT/UPDATE privileges.
- The connected PostgreSQL server is version 17; its non-superuser `postgres` role has CREATEROLE. PostgreSQL 17 automatically creates an ADMIN membership for a role creator without SET/INHERIT. Ownership transfers need temporary SET membership and CREATE on the schema.
- The preexisting `protect_profile_system_fields` trigger covers `role`, `plan`, `usage_count`, `usage_period_start`; server-owned `reserve_ai_usage` and `refund_ai_usage` SECURITY DEFINER routines can be called only by privileged server roles.
- Anonymous SELECT and simulated authenticated SELECT checks found no cross-account document/profile exposure. These tests do **not** prove write isolation or the compatibility of migration DDL.

## Adjustments prepared in this review branch

1. Accept the verified existing unique-index predicate without removing or rebuilding the index.
2. Handle the PostgreSQL 17 creator ADMIN membership, grant SET temporarily for function ownership transfer and revoke SET/INHERIT afterwards.
3. Set the existing issuer RPCs' search paths and remove old EXECUTE grants **before** ownership transfer.
4. Grant the isolated issuer only the document and counter privileges required by the existing allocator, including a counter-specific RLS policy.
5. Permit the v2 issuer's immediate internal VAT/client-kind update while continuing to prohibit ordinary edits of already-issued invoices.
6. Keep CREATE on the schema only until the new routines' ownership transfers finish; revoke afterwards.
7. Allow a verified service-role session through the existing postgres-owned quota RPC path in the new profile trigger.
8. Rename the profile guard migration to a full `YYYYMMDDHHMMSS` timestamp and update its test/doc references.

## Mandatory blockers — not tested or authorized

- **No isolated Supabase staging database exists in the connected project.** The three candidate migrations have **not** been replayed against a clone of the real schema, only against synthetic fixtures in Hoplite's prior PR. Do not use the production database as a write-test fixture.
- Export and inspect the real DDL, grants, RLS, triggers, defaults and dependencies before applying; make a verified, restorable backup and then repeat the migration sequence on an isolated copy.
- Validate authenticated RLS/RPC mutation isolation with at least two dummy accounts; verify numbering, idempotency, receipt/PDF consistency, profile quota changes and cross-provider checkout locking.
- Configure and test independent Auth/SMTP and Stripe/PayPal **sandbox** environments. Never use production payment credentials for test charges.
- Check legal requirements for issued invoices, corrections, archives, mixed TVA and French e-invoicing with qualified professionals.
- The current Vercel Preview configuration includes the project's Supabase integration credentials; **do not** exercise Preview mutations against production.
- Do not merge this branch or PR #27–#29, apply live migrations or deploy to production until release checks pass and the owner authorizes that separate action.

## Action for next engineer

Review this branch against PR #29, rerun PostgreSQL 17 migration/SQL tests on a real schema-only clone (not only mocked fixtures), adjust any discovered incompatibilities, and attach the preflight/postflight results to a PR. A passing frontend build alone is not the release gate.
