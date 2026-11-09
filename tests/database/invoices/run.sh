#!/usr/bin/env bash
set -euo pipefail

# Always creates its own socket-only PostgreSQL cluster; no connection target is accepted.
for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null || { echo "Missing required PostgreSQL tool: $tool" >&2; exit 2; }
done

if [[ "$(id -u)" -eq 0 ]]; then
  db_user=postgres
  command -v runuser >/dev/null || { echo 'runuser is required when invoked as root' >&2; exit 2; }
  run_pg() { runuser -u "$db_user" -- "$@"; }
else
  db_user="$(id -un)"
  run_pg() { "$@"; }
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/alek-invoice-pg.XXXXXX")"
data="$work/data"
socket="$work/socket"
mkdir -p "$data" "$socket"
if [[ "$(id -u)" -eq 0 ]]; then chown -R "$db_user" "$work"; fi
port=55432
started=0
cleanup() {
  if [[ "$started" -eq 1 ]]; then run_pg pg_ctl -D "$data" -m immediate -w stop >/dev/null 2>&1 || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

export PGHOST="$socket" PGPORT="$port" PGUSER=postgres PGDATABASE=postgres
unset PGPASSFILE PGSERVICE PGSERVICEFILE PGOPTIONS PGHOSTADDR PGDATABASE_URL DATABASE_URL || true

run_pg initdb -D "$data" --no-locale --encoding=UTF8 --auth=trust >/dev/null
run_pg pg_ctl -D "$data" -o "-F -k $socket -p $port -c listen_addresses=''" -l "$work/postgres.log" -w start >/dev/null
started=1

psql -X -v ON_ERROR_STOP=1 -f tests/database/invoices/bootstrap.sql >/dev/null
psql -X -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261109010100_invoice_immutability_and_legacy_rpc_lock.sql >/dev/null

user_a=00000000-0000-0000-0000-000000000001
user_b=00000000-0000-0000-0000-000000000002
key_a=10000000-0000-0000-0000-000000000001
key_b=10000000-0000-0000-0000-000000000002
key_c=10000000-0000-0000-0000-000000000003
tmp_sql="$work/query.sql"

make_payload() {
  python3 - "$1" "$2" "$3" <<'PY'
import json, sys
uid, key, amount = sys.argv[1], sys.argv[2], sys.argv[3]
amount = int(amount)
print(json.dumps({
  "user_id": uid,
  "request_id": key,
  "document_type": "facture",
  "document_number": "CLIENT-MUST-NOT-CHOOSE",
  "document_date": "2026-11-09",
  "due_date": "2026-12-09",
  "services": [{"description": "Prestation test", "type": "labor", "priceType": "total", "quantity": 1, "hours": 1, "price": amount}],
  "total_ht": amount,
  "total_vat": round(amount * 0.2, 2),
  "total_ttc": round(amount + round(amount * 0.2, 2), 2),
  "vat_rate": 20,
  "vat_exempt": False,
  "invoice_status": "paid"
}, separators=(",", ":")))
PY
}

issue() {
  local uid="$1" key="$2" amount="$3" payload
  payload="$(make_payload "$uid" "$key" "$amount")"
  cat >"$tmp_sql" <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$uid', false);
SELECT public.issue_artisan_document_v3(\$\$$payload\$\$::jsonb);
SQL
  psql -X -qAt -v ON_ERROR_STOP=1 -f "$tmp_sql" | tail -n 1
}

expect_failure() {
  local label="$1" sql="$2"
  if psql -X -v ON_ERROR_STOP=1 -c "$sql" >"$work/failure.log" 2>&1; then
    echo "FAIL: expected rejection: $label" >&2
    exit 1
  fi
  printf 'ok - rejects %s\n' "$label"
}

result_a="$(issue "$user_a" "$key_a" 100)"
id_a="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["id"])' "$result_a")"
number_a="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["document_number"])' "$result_a")"
[[ "$number_a" != CLIENT-MUST-NOT-CHOOSE ]]
printf 'ok - recalculates and issues immutable invoice %s\n' "$number_a"

replay="$(issue "$user_a" "$key_a" 100)"
[[ "$replay" == "$result_a" ]]
count="$(psql -X -qAt -c "SELECT count(*) FROM public.documents WHERE user_id='$user_a' AND document_type='facture'")"
[[ "$count" == 1 ]]
echo 'ok - repeated request returns the original invoice without duplication'
expect_failure 'same key with a changed request' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT public.issue_artisan_document_v3('$(make_payload "$user_a" "$key_a" 101)'::jsonb)"

historical="$(psql -X -qAt -c "SELECT (document_number='FACT-2025-01' AND total_ht=10 AND invoice_status='paid')::text FROM public.documents WHERE user_id='$user_b'")"
[[ "$historical" == true ]]
echo 'ok - pre-existing invoice data is unchanged'

round_payload="$(python3 - "$user_a" "$key_c" <<'PY'
import json, sys
print(json.dumps({
  "user_id": sys.argv[1], "request_id": sys.argv[2],
  "document_type": "facture", "document_date": "2026-11-09", "due_date": None,
  "services": [
    {"description": "Unités", "type": "material", "priceType": "unit", "quantity": 3, "hours": 1, "price": 1.005},
    {"description": "Heures", "type": "labor", "priceType": "hourly", "quantity": 1, "hours": 2.5, "price": 35}
  ],
  "total_ht": 90.52, "total_vat": 18.1, "total_ttc": 108.62,
  "vat_rate": 20, "vat_exempt": False
}, separators=(",", ":")))
PY
)"
rounded="$(psql -X -qAt -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT public.issue_artisan_document_v3('$round_payload'::jsonb)" | tail -n 1)"
rounded_id="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["id"])' "$rounded")"
rounded_totals="$(psql -X -qAt -c "SELECT (total_ht=90.52 AND total_vat=18.1 AND total_ttc=108.62)::text FROM public.documents WHERE id='$rounded_id'")"
[[ "$rounded_totals" == true ]]
echo 'ok - hourly/unit line rounding and multiple lines match the client contract'

expect_failure 'browser-supplied totals' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT public.issue_artisan_document_v3('$(make_payload "$user_a" "$key_b" 100 | sed 's/"total_ttc":120.0/"total_ttc":999.0/')'::jsonb)"
expect_failure 'negative line price' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT public.issue_artisan_document_v3(jsonb_set('$(make_payload "$user_a" "$key_b" 100)'::jsonb,'{services,0,price}','-1'::jsonb))"
expect_failure 'unsupported VAT rate' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT public.issue_artisan_document_v3(jsonb_set('$(make_payload "$user_a" "$key_b" 100)'::jsonb,'{vat_rate}','19'::jsonb))"
expect_failure 'spoofed owner' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT public.issue_artisan_document_v3('$(make_payload "$user_b" "$key_b" 100)'::jsonb)"
expect_failure 'missing request id' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT public.issue_artisan_document_v3(('$(make_payload "$user_a" "$key_b" 100)'::jsonb)-'request_id')"

expect_failure 'direct legacy v1 RPC call' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT public.issue_artisan_document('{}'::jsonb)"
expect_failure 'direct legacy v2 RPC call' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT public.issue_artisan_document_v2('{}'::jsonb)"
expect_failure 'direct numbered invoice insert' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); INSERT INTO public.documents(user_id,document_type,document_number,document_date,services,total_ht,total_vat,total_ttc,vat_rate,invoice_status) VALUES ('$user_a','facture','FORGED-1','2026-11-09','[]',1,0,1,0,'unpaid')"
expect_failure 'RLS-bypassing service-role numbered insert' "SET ROLE service_role; INSERT INTO public.documents(user_id,document_type,document_number,document_date,services,total_ht,total_vat,total_ttc,vat_rate,invoice_status) VALUES ('$user_a','facture','SERVICE-FORGED','2026-11-09','[]',1,0,1,0,'unpaid')"
expect_failure 'fiscal field update' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); UPDATE public.documents SET total_ttc=999 WHERE id='$id_a'"
expect_failure 'invoice deletion' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); DELETE FROM public.documents WHERE id='$id_a'"
expect_failure 'unapproved payment status' "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); UPDATE public.documents SET invoice_status='refunded' WHERE id='$id_a'"

psql -X -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); UPDATE public.documents SET invoice_status='paid' WHERE id='$id_a'" >/dev/null
status="$(psql -X -qAt -c "SELECT invoice_status FROM public.documents WHERE id='$id_a'")"
[[ "$status" == paid ]]
echo 'ok - payment status remains independently updateable'

visible="$(psql -X -qAt -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); SELECT count(*) FROM public.documents WHERE user_id='$user_b'")"
[[ "$(printf '%s\n' "$visible" | tail -n 1)" == 0 ]]
echo 'ok - authenticated SELECT remains owner-isolated'

draft_id="$(psql -X -qAt -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); INSERT INTO public.documents(user_id,document_type,document_date,services,total_ht,total_vat,total_ttc,vat_rate,invoice_status) VALUES ('$user_a','facture','2026-11-09','[]',0,0,0,0,NULL) RETURNING id" | tail -n 1)"
psql -X -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$user_a',false); UPDATE public.documents SET total_ht=12 WHERE id='$draft_id'; DELETE FROM public.documents WHERE id='$draft_id'" >/dev/null
echo 'ok - unnumbered drafts remain editable and deletable'

# Two concurrent retries with one key must observe the same committed result.
issue "$user_a" "$key_b" 50 >"$work/replay-1" & p1=$!
issue "$user_a" "$key_b" 50 >"$work/replay-2" & p2=$!
wait "$p1"; wait "$p2"
cmp -s "$work/replay-1" "$work/replay-2"
echo 'ok - concurrent identical requests are idempotent'

# Distinct concurrent requests serialize through the per-user issue lock and keep the existing unique index valid.
for i in 1 2 3 4 5 6; do
  key="$(printf '20000000-0000-0000-0000-%012d' "$i")"
  issue "$user_a" "$key" "$((i + 10))" >"$work/concurrent-$i" &
done
wait
distinct="$(psql -X -qAt -c "SELECT count(DISTINCT document_number) FROM public.documents WHERE user_id='$user_a' AND document_type='facture'")"
all="$(psql -X -qAt -c "SELECT count(*) FROM public.documents WHERE user_id='$user_a' AND document_type='facture'")"
[[ "$distinct" == "$all" ]]
echo 'ok - concurrent issuance preserves numbering uniqueness'

echo 'PASS: isolated PostgreSQL invoice migration, authorization, immutability, validation, replay and concurrency tests'
