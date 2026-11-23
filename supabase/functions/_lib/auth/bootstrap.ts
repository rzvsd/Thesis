// Admin seed (N11) and the old login bootstrap hook. The seed script (seed_admin.ts) is the preferred way.
// Both create or repair one verified account, mark it as a test account in Supabase app_metadata,
// and optionally give it PRO.
import { timingSafeEqual } from "../../_shared/auth.ts";
import type { AuthStore } from "../store/auth.ts";
import type { BootstrapConfig } from "./config.ts";
import { type GoTrueClient, isEmailExists } from "./gotrue.ts";

export const TEST_ACCOUNT_METADATA = { thesis_test_account: true };

export async function seedAdmin(
  input: { email: string; password: string; forcePro: boolean },
  deps: { gotrue: GoTrueClient; store: AuthStore },
): Promise<{ userId: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const existing = await deps.store.findUserByEmail(email);
  let userId: string;
  let created = false;
  if (existing) {
    userId = existing.id;
    const upd = await deps.gotrue.adminUpdateUser(existing.authUserId ?? existing.id, {
      password: input.password,
      email_confirm: true,
      app_metadata: TEST_ACCOUNT_METADATA,
    });
    if (!upd.ok) throw new Error(`Could not update the auth user (${upd.code}).`);
    if (!existing.verifiedAt) await deps.store.markUserVerified(userId, now);
    await deps.store.clearFailedLoginAttempts(userId);
  } else {
    const res = await deps.gotrue.adminCreateUser({
      email,
      password: input.password,
      email_confirm: true,
      app_metadata: TEST_ACCOUNT_METADATA,
    });
    if (!res.ok) {
      if (isEmailExists(res)) {
        throw new Error("An auth user with this email exists without an app.users row. Remove it first.");
      }
      throw new Error(`Could not create the auth user (${res.code}).`);
    }
    userId = res.data.id;
    await deps.store.insertUser({ id: userId, email, authUserId: userId, verifiedAt: now });
    created = true;
  }
  if (input.forcePro) await deps.store.setProTier(userId);
  return { userId, created };
}

// Login hook: a no-op unless ADMIN_BOOTSTRAP_ENABLED is on outside production and the email and password
// match ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD. (Old server compared a bcrypt hash; see the mapping doc.)
export async function maybeBootstrapAdmin(
  cfg: BootstrapConfig | null,
  email: string,
  password: string,
  deps: { gotrue: GoTrueClient; store: AuthStore },
): Promise<void> {
  if (!cfg) return;
  if (email !== cfg.email || !timingSafeEqual(password, cfg.password)) return;
  try {
    await seedAdmin({ email, password, forcePro: cfg.forcePro }, deps);
  } catch {
    // The normal login path then answers 401.
  }
}
