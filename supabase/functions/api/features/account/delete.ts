// Account deletion: DELETE /v1/account and the shared delete used by the web flow.
// Order: strip emails from audit rows, delete stored files, delete the Supabase auth user (its FK cascade
// removes app.users and linked rows), then sweep every app table with a user_id column.
import { apiError, json } from "../../../_shared/http.ts";
import { logInfo } from "../../../_shared/log.ts";
import { rules } from "../../../_lib/store/rate_limit.ts";
import type { RouteContext } from "../../router.ts";
import { audit, type AuthDeps } from "../auth/deps.ts";

export const STORE_SUBSCRIPTION_NOTICE =
  "Deleting your account does not cancel a Google Play subscription. " +
  "To stop billing, open the Google Play Store app, tap your profile icon, " +
  "then Payments & subscriptions > Subscriptions > Thesis > Cancel subscription.";

export async function deleteAccount(
  d: AuthDeps,
  userId: string,
  via: "app" | "web",
): Promise<{ hadPaidTier: boolean }> {
  const user = await d.store.findUserById(userId);
  const hadPaidTier = (await d.store.getUserTier(userId)) !== "FREE";
  await d.store.stripAuditEmails(userId);
  await d.deleteUserFiles(userId);
  const removed = await d.gotrue.adminDeleteUser(user?.authUserId ?? userId);
  if (!removed.ok && removed.status !== 404) {
    throw new Error(`Auth user delete failed (${removed.status})`);
  }
  await d.store.deleteUserRows(userId);
  // Logged without a user link: the user row no longer exists.
  await audit(d, "account.deleted", { deleted_user_id: userId, via, had_paid_tier: hadPaidTier });
  logInfo("Account deleted", { user_id: userId, via });
  return { hadPaidTier };
}

export function deleteAccountRoute(get: () => AuthDeps) {
  return async ({ req, auth }: RouteContext): Promise<Response> => {
    const d = get();
    const limited = await d.rateLimit(req, rules().general, "/v1/account");
    if (limited) return limited;
    if (!auth.userId) return apiError(401, "unauthorized", "Authentication required.");
    const result = await deleteAccount(d, auth.userId, "app");
    return json({
      status: "deleted",
      store_subscription_notice: result.hadPaidTier ? STORE_SUBSCRIPTION_NOTICE : undefined,
    });
  };
}
