#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
bindir=${PG_BINDIR:-$(pg_config --bindir)}
for tool in initdb pg_ctl createdb psql; do
  if [ ! -x "$bindir/$tool" ]; then
    echo "Missing executable: $bindir/$tool" >&2
    exit 2
  fi
done

# Do not inherit a caller-selected connection target or service configuration.
for variable in $(env | sed -n 's/^\(PG[A-Z0-9_]*\)=.*/\1/p'); do
  unset "$variable"
done

work=$(mktemp -d "${TMPDIR:-/tmp}/alek-security.XXXXXX")
data="$work/data"
socket="$work/socket"
log="$work/postgres.log"
port=$((54000 + ($$ % 10000)))
db_name="alek_security_fixture_$$"
db_user=$(id -un)
runner=
server_started=no

if [ "$(id -u)" -eq 0 ]; then
  if ! command -v runuser >/dev/null 2>&1 || ! id postgres >/dev/null 2>&1; then
    echo 'Root execution requires runuser and the postgres operating-system account' >&2
    rm -rf "$work"
    exit 2
  fi
  runner="runuser -u postgres --"
  db_user=postgres
  chown postgres:postgres "$work"
fi
mkdir "$socket"
if [ -n "$runner" ]; then chown postgres:postgres "$socket"; fi

cleanup() {
  status=$?
  if [ "$server_started" = yes ]; then
    if [ -n "$runner" ]; then
      $runner "$bindir/pg_ctl" -D "$data" -m immediate stop >/dev/null 2>&1 || true
    else
      "$bindir/pg_ctl" -D "$data" -m immediate stop >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "$work"
  exit "$status"
}
trap cleanup EXIT HUP INT TERM

if [ -n "$runner" ]; then
  $runner "$bindir/initdb" -D "$data" --auth-local=trust --auth-host=reject \
    --username="$db_user" >/dev/null
  $runner "$bindir/pg_ctl" -D "$data" \
    -o "-k $socket -p $port -h '' -c listen_addresses=''" \
    -l "$log" start >/dev/null
else
  "$bindir/initdb" -D "$data" --auth-local=trust --auth-host=reject \
    --username="$db_user" >/dev/null
  "$bindir/pg_ctl" -D "$data" \
    -o "-k $socket -p $port -h '' -c listen_addresses=''" \
    -l "$log" start >/dev/null
fi
server_started=yes

createdb --host="$socket" --port="$port" --username="$db_user" "$db_name"
psql_fixture() {
  psql --no-psqlrc --set=ON_ERROR_STOP=1 --host="$socket" --port="$port" \
    --username="$db_user" --dbname="$db_name" "$@"
}
psql_fixture --file="$root/tests/database/security-fixture.sql"
psql_fixture --file="$root/supabase/migrations/2026110903_profiles_protect_billing_fields.sql"
psql_fixture --file="$root/tests/database/security-isolation.sql"
