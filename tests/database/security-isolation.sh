#!/bin/sh
set -eu

: "${ALEK_SECURITY_TEST_DATABASE:?Set to a disposable alek_security_fixture_* database}"
: "${PGHOST:?Set PGHOST to a local Unix-domain socket directory (remote hosts are refused)}"
: "${ALEK_SECURITY_TEST_CONFIRM_SYNTHETIC:?Set to YES only after confirming this database is disposable}"
case "$PGHOST" in
  /*) ;;
  *) echo "Refusing non-local PostgreSQL host; set PGHOST to a Unix socket directory" >&2; exit 2 ;;
esac
case "$ALEK_SECURITY_TEST_DATABASE" in
  alek_security_fixture_[a-z0-9_]*) ;;
  *) echo "Refusing database name outside alek_security_fixture_*" >&2; exit 2 ;;
esac
if [ "$ALEK_SECURITY_TEST_CONFIRM_SYNTHETIC" != YES ]; then
  echo "Refusing to create synthetic tables without explicit confirmation" >&2
  exit 2
fi

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
psql --no-psqlrc --set=ON_ERROR_STOP=1 --dbname="$ALEK_SECURITY_TEST_DATABASE" \
  --file="$root/tests/database/security-fixture.sql"
psql --no-psqlrc --set=ON_ERROR_STOP=1 --dbname="$ALEK_SECURITY_TEST_DATABASE" \
  --file="$root/supabase/migrations/2026110903_profiles_protect_billing_fields.sql"
psql --no-psqlrc --set=ON_ERROR_STOP=1 --dbname="$ALEK_SECURITY_TEST_DATABASE" \
  --file="$root/tests/database/security-isolation.sql"
