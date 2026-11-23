#!/usr/bin/env bash
# Dumps schema app with pg_dump 17, then the Supabase Auth rows (auth.users, auth.identities) as COPY blocks read
# through the ops_backup views (docs/rebuild/M1-backup.md), and encrypts the file with a passphrase.
# Reads BACKUP_DB_URL and BACKUP_PASSPHRASE from the environment. Never prints either.
# Restore: see the drill in docs/rebuild/M1-backup.md (auth rows first, then the app part).
set -euo pipefail

if [ -z "${BACKUP_DB_URL:-}" ] || [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "Backup secrets are not set yet. Skipping."
  exit 0
fi

out="thesis-db-$(date -u +%Y%m%d).sql.gz.gpg"
# shellcheck disable=SC2016  # $PGURL expands inside the container
docker run --rm -e PGURL="$BACKUP_DB_URL" postgres:17-alpine sh -c '
  set -eu
  pg_dump "$PGURL" --schema=app --no-owner --no-privileges
  echo "-- Supabase Auth rows."
  for t in users identities; do
    cols=$(psql "$PGURL" -Atq -c "select string_agg(quote_ident(attname), '"', '"' order by attnum) from pg_attribute where attrelid = '"'"'ops_backup.auth_$t'"'"'::regclass and attnum > 0 and not attisdropped")
    echo "COPY auth.$t ($cols) FROM stdin;"
    psql "$PGURL" -Atq -c "copy (select * from ops_backup.auth_$t) to stdout"
    echo "\\."
  done
' \
  | gzip -9 \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-fd 3 -o "$out" 3<<<"$BACKUP_PASSPHRASE"

size=$(stat -c %s "$out")
echo "Wrote $out ($size bytes)."
echo "file=$out" >> "${GITHUB_OUTPUT:-/dev/null}"
