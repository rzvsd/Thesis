// SQL for auth and account deletion. Owner: M1. Copied from apps/product-api/src/store.ts (PostgresStore).
// Supabase Auth owns passwords and sessions (D6), so app.sessions and app.verification_tokens are no longer written.
import { db, newId, nowIso } from "./common.ts";
import { findUserByEmail, findUserById, getUserTier, mapUser, type Tier, type UserRow } from "./users.ts";

export type AccountActionPurpose = "password_reset" | "account_deletion";

export interface AuthStore {
  findUserByEmail(email: string): Promise<UserRow | undefined>;
  findUserById(id: string): Promise<UserRow | undefined>;
  // Returns undefined when the email or id already exists.
  insertUser(input: { id: string; email: string; authUserId: string; verifiedAt?: string }): Promise<
    UserRow | undefined
  >;
  markUserVerified(userId: string, verifiedAt: string): Promise<UserRow | undefined>;
  recordFailedLoginAttempt(input: {
    userId: string;
    attemptedAt: string;
    windowSeconds: number;
    maxFailures: number;
    lockoutDurationSeconds: number;
  }): Promise<UserRow | undefined>;
  clearFailedLoginAttempts(userId: string): Promise<UserRow | undefined>;
  createAccountActionToken(input: {
    userId: string;
    purpose: AccountActionPurpose;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<void>;
  consumeAccountActionToken(
    purpose: AccountActionPurpose,
    tokenHash: string,
    consumedAt: string,
  ): Promise<{ userId: string } | undefined>;
  getUserTier(userId: string): Promise<Tier>;
  setProTier(userId: string): Promise<void>;
  stripAuditEmails(userId: string): Promise<void>;
  deleteUserRows(userId: string): Promise<boolean>;
  appendAudit(eventType: string, payload: Record<string, unknown>, userId?: string): Promise<void>;
}

// Tables with a user_id column whose rows are kept on delete (FK sets user_id null, as the old server did):
// jobs keep their row (reports hang off them), audit_events keep security history.
const KEEP_ON_DELETE = new Set(["users", "jobs", "audit_events"]);

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export const pgAuthStore: AuthStore = {
  findUserByEmail,
  findUserById,
  getUserTier,

  async insertUser(input) {
    const rows = await db()`
      insert into users (id, email, password_hash, created_at, verified_at, auth_user_id)
      values (${input.id}, ${input.email.toLowerCase()}, null, ${nowIso()}, ${input.verifiedAt ?? null},
              ${input.authUserId})
      on conflict do nothing
      returning *`;
    return rows[0] ? mapUser(rows[0]) : undefined;
  },

  async markUserVerified(userId, verifiedAt) {
    const rows = await db()`update users set verified_at = ${verifiedAt} where id = ${userId} returning *`;
    return rows[0] ? mapUser(rows[0]) : undefined;
  },

  async recordFailedLoginAttempt(input) {
    const rows = await db()`
      with next_state as (
        select
          id,
          case
            when failed_login_window_started_at is null
              or failed_login_window_started_at <= (${input.attemptedAt}::timestamptz - (${input.windowSeconds} * interval '1 second'))
            then 1
            else failed_login_attempts + 1
          end as next_attempts,
          case
            when failed_login_window_started_at is null
              or failed_login_window_started_at <= (${input.attemptedAt}::timestamptz - (${input.windowSeconds} * interval '1 second'))
            then ${input.attemptedAt}::timestamptz
            else failed_login_window_started_at
          end as next_window_started_at
        from users
        where id = ${input.userId}
      )
      update users u
         set failed_login_attempts = s.next_attempts,
             failed_login_window_started_at = s.next_window_started_at,
             locked_until = case
               when s.next_attempts >= ${input.maxFailures}
               then ${input.attemptedAt}::timestamptz + (${input.lockoutDurationSeconds} * interval '1 second')
               else null
             end
        from next_state s
       where u.id = s.id
      returning u.*`;
    return rows[0] ? mapUser(rows[0]) : undefined;
  },

  async clearFailedLoginAttempts(userId) {
    const rows = await db()`
      update users
         set failed_login_attempts = 0,
             failed_login_window_started_at = null,
             locked_until = null
       where id = ${userId}
      returning *`;
    return rows[0] ? mapUser(rows[0]) : undefined;
  },

  async createAccountActionToken(input) {
    // A new code supersedes any open code for the same purpose.
    await db()`
      with superseded as (
        update account_action_tokens
           set consumed_at = ${input.createdAt}
         where user_id = ${input.userId}
           and purpose = ${input.purpose}
           and consumed_at is null
      )
      insert into account_action_tokens (id, user_id, purpose, token_hash, created_at, expires_at)
      values (${newId()}, ${input.userId}, ${input.purpose}, ${input.tokenHash}, ${input.createdAt},
              ${input.expiresAt})`;
  },

  async consumeAccountActionToken(purpose, tokenHash, consumedAt) {
    const rows = await db()`
      update account_action_tokens
         set consumed_at = ${consumedAt}
       where token_hash = ${tokenHash}
         and purpose = ${purpose}
         and consumed_at is null
         and expires_at > now()
      returning user_id`;
    return rows[0] ? { userId: String(rows[0].user_id) } : undefined;
  },

  // Bootstrap/seed only. app.subscriptions belongs to M4; this writes a row, it does not alter the table.
  async setProTier(userId) {
    await db()`
      insert into subscriptions (user_id, tier, created_at, updated_at)
      values (${userId}, 'PRO', now(), now())
      on conflict (user_id) do update set tier = 'PRO', updated_at = now()`;
  },

  // Must run before the users row goes: afterwards audit_events.user_id is null (FK on delete set null).
  async stripAuditEmails(userId) {
    await db()`update audit_events set payload = payload - 'email' where user_id = ${userId}`;
  },

  // Deletes the user's rows in every app table with a user_id column (also tables added by M2-M4 later),
  // then report_shares by created_by, then the users row (its FKs cascade the rest).
  async deleteUserRows(userId) {
    return await db().begin(async (tx) => {
      const tables = await tx`
        select c.table_name
          from information_schema.columns c
          join information_schema.tables t
            on t.table_schema = c.table_schema and t.table_name = c.table_name
         where c.table_schema = 'app'
           and c.column_name = 'user_id'
           and t.table_type = 'BASE TABLE'
         order by c.table_name`;
      for (const row of tables) {
        const name = String(row.table_name);
        if (KEEP_ON_DELETE.has(name)) continue;
        await tx.unsafe(`delete from app.${quoteIdent(name)} where user_id::text = $1`, [userId]);
      }
      await tx`delete from report_shares where created_by = ${userId}`;
      const deleted = await tx`delete from users where id = ${userId} returning id`;
      return deleted.length > 0;
    });
  },

  async appendAudit(eventType, payload, userId) {
    await db()`
      insert into audit_events (id, user_id, event_type, payload, created_at)
      values (${newId()}, ${userId ?? null}, ${eventType}, ${db().json(payload as never)}, ${nowIso()})`;
  },
};
