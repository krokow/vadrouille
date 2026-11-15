#!/usr/bin/env bash
# Lance les migrations + seed + tests RLS sur un Postgres local jetable.
# Prérequis : postgres (initdb, pg_ctl, psql) dans le PATH ou dans /usr/lib/postgresql/*/bin
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
export PATH="$PGBIN:$PATH"
TMP=$(mktemp -d)
PORT=${PORT:-54329}
AS=()
if [ "$(id -u)" = 0 ]; then chown postgres "$TMP"; AS=(runuser -u postgres --); fi # initdb refuse root
"${AS[@]}" initdb -D "$TMP/data" -U postgres >/dev/null 2>&1
"${AS[@]}" pg_ctl -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
trap '"${AS[@]}" pg_ctl -D "$TMP/data" stop -m immediate >/dev/null; rm -rf "$TMP"' EXIT
PSQL="psql -h $TMP -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c 'create database t' >/dev/null
$PSQL -d t -f tests/supabase_stub.sql >/dev/null 2>&1
for f in migrations/*.sql; do echo "→ $f"; $PSQL -d t -f "$f" >/dev/null; done
echo "→ seed.sql"; $PSQL -d t -f seed.sql >/dev/null
$PSQL -d t -c "truncate auth.users cascade; truncate public.trips cascade;" >/dev/null 2>&1
$PSQL -tA -d t -f tests/rls_test.sql 2>&1 | grep -v "^$" | sed "s/^psql:[^ ]* NOTICE:  /  /"
