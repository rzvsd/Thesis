-- Server-side timeouts for the api's database role (thread "Stop server requests from hanging", 2026-11-24).
-- The api reaches Postgres through the Supabase transaction pooler, where SET and startup parameters do not
-- stick, so the limits live on the role. A new pooled backend for thesis_api picks them up when it logs in.
-- statement_timeout: no single api or job statement should run 30 s; user requests give up at 25 s anyway.
-- lock_timeout: wait at most 10 s for a row or table lock.
-- idle_in_transaction_session_timeout: end a transaction left open for 30 s, so it cannot hold locks.
alter role thesis_api set statement_timeout = '30s';
alter role thesis_api set lock_timeout = '10s';
alter role thesis_api set idle_in_transaction_session_timeout = '30s';
