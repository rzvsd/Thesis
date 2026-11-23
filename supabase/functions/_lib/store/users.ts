// Users and tiers. Owner: M1. app.users.id holds the Supabase auth user id as text (DECISIONS D6).
import { db, iso } from "./common.ts";

export type Tier = "FREE" | "PRO";

export interface UserRow {
  id: string;
  email: string;
  createdAt: string;
  verifiedAt?: string;
  failedLoginAttempts: number;
  failedLoginWindowStartedAt?: string;
  lockedUntil?: string;
  authUserId?: string;
}

export function mapUser(row: Record<string, unknown>): UserRow {
  return {
    id: String(row.id),
    email: String(row.email),
    createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
    verifiedAt: iso(row.verified_at),
    failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
    failedLoginWindowStartedAt: iso(row.failed_login_window_started_at),
    lockedUntil: iso(row.locked_until),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : undefined,
  };
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const rows = await db()`select * from users where id = ${id} limit 1`;
  return rows[0] ? mapUser(rows[0]) : undefined;
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const rows = await db()`select * from users where email = ${email.trim().toLowerCase()} limit 1`;
  return rows[0] ? mapUser(rows[0]) : undefined;
}

// Read-only tier lookup. app.subscriptions belongs to M4; a missing row means FREE.
export async function getUserTier(userId: string): Promise<Tier> {
  const rows = await db()`select tier from subscriptions where user_id = ${userId} limit 1`;
  return rows[0]?.tier === "PRO" ? "PRO" : "FREE";
}
