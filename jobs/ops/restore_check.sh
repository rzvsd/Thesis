#!/usr/bin/env bash
# Restore check for the weekly backup (audit H11, docs/rebuild/M1-backup.md). Decrypts the new file inside the run,
# loads it into a throwaway Postgres 17 container the same way the restore drill does (auth rows first, then the
# app part), and fails if any statement fails or a table is missing. The container and the decrypted copy are
# removed at the end.
# This repository is public, so the log shows counts and SQLSTATE codes only: no rows, no error details.
# Reads BACKUP_PASSPHRASE. RESTORE_PSQL may name another throwaway server's psql command (tests use it).
set -euo pipefail

file="${1:?usage: restore_check.sh <thesis-db-YYYYMMDD.sql.gz.gpg>}"
if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "BACKUP_PASSPHRASE is not set." >&2
  exit 1
fi

work="$(mktemp -d)"
chmod 700 "$work"
container=""
cleanup() {
  if [ -n "$container" ]; then docker rm -f "$container" >/dev/null 2>&1 || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

gpg --batch --quiet --decrypt --passphrase-fd 3 "$file" 3<<<"$BACKUP_PASSPHRASE" | gunzip >"$work/dump.sql"

marker='-- Supabase Auth rows.'
if ! grep -qxF -- "$marker" "$work/dump.sql"; then
  echo "The backup has no Supabase Auth part." >&2
  exit 1
fi
awk -v m="$marker" '$0 == m { found = 1 } !found' "$work/dump.sql" >"$work/app.sql"
awk -v m="$marker" 'found { print } $0 == m { found = 1 }' "$work/dump.sql" >"$work/auth.sql"
rm -f "$work/dump.sql"

# Stand-ins for Supabase's auth tables, built from the COPY column lists. id is a uuid key because app.users
# refers to auth.users(id); every other column is text, which is enough to prove the rows load.
stub() {
  local cols defs
  cols=$(sed -n "s/^COPY auth\.$1 (\(.*\)) FROM stdin;\$/\1/p" "$work/auth.sql")
  if [ -z "$cols" ]; then
    echo "The backup has no rows block for auth.$1." >&2
    exit 1
  fi
  defs=$(printf '%s\n' "$cols" | tr ',' '\n' | sed 's/^ *//; s/ *$//' |
    awk '{ if ($0 == "id") print $0 " uuid primary key"; else print $0 " text" }' | paste -sd, -)
  echo "create table auth.$1 ($defs);"
}
{
  echo "create schema auth;"
  echo "create schema if not exists extensions;"
  echo "create extension if not exists pgcrypto with schema extensions;"
  stub users
  stub identities
} >"$work/prep.sql"

if [ -n "${RESTORE_PSQL:-}" ]; then
  # shellcheck disable=SC2086  # RESTORE_PSQL is a command line on purpose
  run_psql() { $RESTORE_PSQL -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate "$@"; }
else
  container="thesis-restore-check-$$"
  docker run -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
  # TCP only answers once the image's own first-start setup is over.
  for _ in $(seq 1 60); do
    if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -q; then break; fi
    sleep 1
  done
  run_psql() { docker exec -i "$container" psql -h 127.0.0.1 -U postgres -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate "$@"; }
fi

step() {
  local name="$1" sql="$2"
  if ! run_psql -o /dev/null <"$sql" 2>"$work/err"; then
    echo "Restore check failed while loading the $name. Postgres error code(s):" >&2
    grep -oE '^(psql:[^ ]* )?ERROR: +[0-9A-Z]{5}' "$work/err" | grep -oE '[0-9A-Z]{5}$' | sort -u >&2 || true
    exit 1
  fi
}
step "auth stand-ins" "$work/prep.sql"
step "auth rows" "$work/auth.sql"
step "app part" "$work/app.sql"

expected=$(grep -cE '^CREATE TABLE app\.' "$work/app.sql" || true)
counts=$(
  run_psql -At -F ' ' <<'SQL'
select
  (select count(*) from information_schema.tables where table_schema = 'app' and table_type = 'BASE TABLE'),
  (select coalesce(sum((xpath('/row/c/text()',
      query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint), 0)
     from information_schema.tables where table_schema = 'app' and table_type = 'BASE TABLE'),
  (select count(*) from auth.users),
  (select count(*) from app.users);
SQL
)
read -r tables rows auth_users app_users <<<"$counts"

echo "Restore check: $tables of $expected app tables, $rows app rows, $auth_users auth users, $app_users app users."
if [ "$expected" -eq 0 ] || [ "$tables" -ne "$expected" ]; then
  echo "Restore check failed: the restored app schema does not match the backup." >&2
  exit 1
fi
echo "Restore check passed."
