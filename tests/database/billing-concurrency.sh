#!/bin/sh
set -eu

if [ "$#" -ne 5 ]; then
  echo "Usage: $0 PG_BINDIR LOCAL_SOCKET PORT USER DATABASE" >&2
  exit 2
fi

bindir=$1
socket=$2
port=$3
db_user=$4
db_name=$5
psql="$bindir/psql"

for tool in "$psql" "$(command -v timeout || true)"; do
  if [ -z "$tool" ] || [ ! -x "$tool" ]; then
    echo "Missing executable: $tool" >&2
    exit 2
  fi
done

work=$(mktemp -d "${TMPDIR:-/tmp}/alek-billing-concurrency.XXXXXX")
claim_pid=
state_pid=

cleanup() {
  status=$?
  if [ -n "$claim_pid" ]; then kill "$claim_pid" >/dev/null 2>&1 || true; wait "$claim_pid" >/dev/null 2>&1 || true; fi
  if [ -n "$state_pid" ]; then kill "$state_pid" >/dev/null 2>&1 || true; wait "$state_pid" >/dev/null 2>&1 || true; fi
  rm -rf "$work"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

psql_local() {
  PGCONNECT_TIMEOUT=5 timeout 12s "$psql" --no-psqlrc --set=ON_ERROR_STOP=1 --quiet --tuples-only --no-align \
    --field-separator='|' --host="$socket" --port="$port" \
    --username="$db_user" --dbname="$db_name" "$@"
}

wait_for_marker() {
  marker=$1
  pid=$2
  output=$3
  tries=0
  while [ ! -f "$marker" ]; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      wait "$pid" || true
      echo "FAIL: concurrent PostgreSQL session exited before lock marker $marker" >&2
      cat "$output" >&2
      exit 1
    fi
    tries=$((tries + 1))
    if [ "$tries" -ge 100 ]; then
      echo "FAIL: timed out waiting for concurrent PostgreSQL session marker $marker" >&2
      cat "$output" >&2
      exit 1
    fi
    sleep 0.05
  done
}

user_claim=00000000-0000-4000-8000-00000000000c
user_state=00000000-0000-4000-8000-00000000000d
psql_local <<SQL
INSERT INTO auth.users(id) VALUES ('$user_claim'), ('$user_state') ON CONFLICT DO NOTHING;
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO public.profiles(id, role, plan) VALUES
  ('$user_claim', 'user', 'free'), ('$user_state', 'user', 'free')
ON CONFLICT (id) DO UPDATE SET plan = 'free',
  stripe_subscription_id = NULL, stripe_subscription_status = NULL,
  paypal_subscription_id = NULL, paypal_subscription_status = NULL;
DELETE FROM public.billing_checkout_attempts WHERE user_id IN ('$user_claim', '$user_state');
DELETE FROM public.billing_provider_state WHERE user_id IN ('$user_claim', '$user_state');
DELETE FROM public.billing_webhook_events WHERE user_id IN ('$user_claim', '$user_state');
COMMIT;
SQL

claim_marker="$work/claim-held"
cat >"$work/claim-owner.sql" <<SQL
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT public.billing_claim_checkout('$user_claim', 'stripe', 'pro');
\\! touch '$claim_marker'
SELECT pg_sleep(2);
COMMIT;
SQL

psql_local --file="$work/claim-owner.sql" >"$work/claim-owner.out" 2>&1 &
claim_pid=$!
wait_for_marker "$claim_marker" "$claim_pid" "$work/claim-owner.out"

psql_local <<SQL >"$work/claim-contender.out" 2>&1
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
WITH started AS MATERIALIZED (SELECT clock_timestamp() AS at),
claimed AS MATERIALIZED (
  SELECT public.billing_claim_checkout('$user_claim', 'paypal', 'pro') AS result FROM started
)
SELECT result->>'decision', round(extract(epoch FROM clock_timestamp() - started.at)::numeric, 3)
FROM started CROSS JOIN claimed;
COMMIT;
SQL
claim_line=$(grep -E '^(conflict|entitled|busy|reuse|create|manual_review|invalid)\|' "$work/claim-contender.out" | tail -n 1 || true)
claim_decision=${claim_line%%|*}
claim_wait=${claim_line#*|}
if [ "$claim_decision" != conflict ] || [ "$claim_wait" = "$claim_line" ] \
  || ! awk -v seconds="$claim_wait" 'BEGIN { exit !(seconds >= 0.25) }'; then
  echo 'FAIL: cross-provider claim did not wait for and conflict with the open Stripe checkout' >&2
  cat "$work/claim-owner.out" "$work/claim-contender.out" >&2
  exit 1
fi
wait "$claim_pid"
claim_pid=
grep -q '"decision": "create"' "$work/claim-owner.out" || {
  echo 'FAIL: Stripe checkout owner did not create its claim' >&2
  cat "$work/claim-owner.out" >&2
  exit 1
}

state_marker="$work/state-held"
cat >"$work/state-owner.sql" <<SQL
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT public.billing_apply_verified_state(
  'stripe', 'evt-concurrency-local', clock_timestamp(), '$user_state',
  'sub-concurrency-local', 'active', 'pro', 'price-pro', 'cus-concurrency-local',
  true, clock_timestamp() + interval '30 days', 'sale_completed'
);
\\! touch '$state_marker'
SELECT pg_sleep(2);
COMMIT;
SQL

psql_local --file="$work/state-owner.sql" >"$work/state-owner.out" 2>&1 &
state_pid=$!
wait_for_marker "$state_marker" "$state_pid" "$work/state-owner.out"

psql_local <<SQL >"$work/state-contender.out" 2>&1
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
WITH started AS MATERIALIZED (SELECT clock_timestamp() AS at),
claimed AS MATERIALIZED (
  SELECT public.billing_claim_checkout('$user_state', 'paypal', 'business') AS result FROM started
)
SELECT result->>'decision', round(extract(epoch FROM clock_timestamp() - started.at)::numeric, 3)
FROM started CROSS JOIN claimed;
COMMIT;
SQL
state_line=$(grep -E '^(conflict|entitled|busy|reuse|create|manual_review|invalid)\|' "$work/state-contender.out" | tail -n 1 || true)
state_decision=${state_line%%|*}
state_wait=${state_line#*|}
if [ "$state_decision" != entitled ] || [ "$state_wait" = "$state_line" ] \
  || ! awk -v seconds="$state_wait" 'BEGIN { exit !(seconds >= 0.25) }'; then
  echo 'FAIL: delayed claim did not wait for the verified billing state and return entitled' >&2
  cat "$work/state-owner.out" "$work/state-contender.out" >&2
  exit 1
fi
wait "$state_pid"
state_pid=
grep -q '"applied": true' "$work/state-owner.out" || {
  echo 'FAIL: verified state owner did not apply subscription state' >&2
  cat "$work/state-owner.out" >&2
  exit 1
}

postcondition=$(psql_local <<SQL | grep -E '^[0-9]+\|'
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT
  (SELECT count(*) FROM public.billing_checkout_attempts
    WHERE user_id = '$user_claim' AND status IN ('creating', 'unknown', 'pending')),
  (SELECT provider FROM public.billing_checkout_attempts
    WHERE user_id = '$user_claim' AND status IN ('creating', 'unknown', 'pending')),
  (SELECT count(*) FROM public.billing_checkout_attempts
    WHERE user_id = '$user_state' AND status IN ('creating', 'unknown', 'pending'));
SQL
)
if [ "$postcondition" != '1|stripe|0' ]; then
  echo "FAIL: unexpected open checkout state after races: $postcondition" >&2
  exit 1
fi

echo "PASS: two-session billing races (Stripe/PayPal claim conflict waited ${claim_wait}s; verified-state claim waited ${state_wait}s and was entitled)"
