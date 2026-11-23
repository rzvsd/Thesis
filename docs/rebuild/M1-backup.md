# M1: backup of Supabase Auth users (H11)

The weekly backup (`jobs/ops/backup.sh`, workflow `rebuild-backup.yml`) dumps schema `app` only.
Passwords, sign-in identities and email confirmations live in `auth.users` and `auth.identities`, which Supabase owns.
`app.users.auth_user_id` points at `auth.users`, so a restore without them leaves every account unusable.
This must be fixed before anyone but the owner signs up.

## What M1 adds

Migration `supabase/migrations/20261124080000_m1_auth_backup_views.sql`:

- A private schema `ops_backup` with two views, `auth_users` and `auth_identities`. They list the real columns of
  the Supabase tables (generated columns are left out, so the rows load back with `COPY`).
- Only `thesis_backup` (read-only, `NOLOGIN` until the owner turns it on) can use the schema. `anon`,
  `authenticated` and `public` get nothing. The schema is not exposed by the REST API.
- Why views: Supabase does not let us grant `usage` on schema `auth` to our own role, but `postgres` may read
  the two tables and can share that read through a view it owns.

## Script change (approved by the owner on 2026-11-23, applied in `jobs/ops/backup.sh`)

The `docker run ...` pipeline in `jobs/ops/backup.sh` is the one below. It appends the auth rows to the
same encrypted file as `COPY` blocks.

```bash
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
```

## Restore drill (do it once before real users sign up)

1. Download the newest `thesis-db-*.sql.gz.gpg` file from the Supabase dashboard: Storage > `db-backups`
   (the private bucket the workflow writes to; it keeps the newest 5). Run artifacts are no longer used, because
   the repository is public.
2. `gpg --decrypt thesis-db-YYYYMMDD.sql.gz.gpg | gunzip > thesis-db.sql`
3. Split it: everything above the line `-- Supabase Auth rows.` is the app dump, the rest is the auth rows.
4. On the target project (a new free project, or a local `supabase start`), load the auth rows **first**, as
   `postgres`: `psql "<target url>" -f auth-part.sql`. Then load the app part: `psql "<target url>" -f app-part.sql`.
5. Check: `select count(*) from auth.users` equals `select count(*) from app.users`, and one test account can log in
   through `/auth/login` on the restored project.
6. Write the date and result of the drill at the bottom of this file.

If step 4 is refused on a hosted project (Supabase can tighten writes to `auth`), ask Supabase support to load it,
or recreate the users with the admin API and send password reset emails. App data still restores either way.
