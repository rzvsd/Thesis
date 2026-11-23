#!/usr/bin/env bash
# Dumps schema app with pg_dump 17 (auth.users is not included yet; see docs/rebuild/DECISIONS.md ADR 16) and encrypts the file with a passphrase.
# Reads BACKUP_DB_URL and BACKUP_PASSPHRASE from the environment. Never prints either.
# Restore: gpg --decrypt thesis-db.sql.gz.gpg | gunzip | psql "<target url>"
set -euo pipefail

if [ -z "${BACKUP_DB_URL:-}" ] || [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "Backup secrets are not set yet. Skipping."
  exit 0
fi

out="thesis-db-$(date -u +%Y%m%d).sql.gz.gpg"
docker run --rm -e PGURL="$BACKUP_DB_URL" postgres:17-alpine \
  sh -c 'pg_dump "$PGURL" --schema=app --no-owner --no-privileges' \
  | gzip -9 \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-fd 3 -o "$out" 3<<<"$BACKUP_PASSPHRASE"

size=$(stat -c %s "$out")
echo "Wrote $out ($size bytes)."
echo "file=$out" >> "${GITHUB_OUTPUT:-/dev/null}"
