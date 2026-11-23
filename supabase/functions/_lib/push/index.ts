// Push entry point. Owner: M4. Pick the sender from PUSH_PROVIDER_MODE:
//   disabled (default) - sends nothing, every target is "skipped" (what M3's evaluators expect)
//   stub               - pretends every target got it (local tests, like the old "stub" provider)
//   fcm                - FCM HTTP v1 with FCM_SERVICE_ACCOUNT_JSON (a Supabase secret)
// With fcm and no usable service account, every target counts as failed, as the old server did.
import { env } from "../../_shared/env.ts";
import { parseServiceAccount, serviceAccountTokenSource } from "./fcm_auth.ts";
import { fcmPushSender } from "./fcm.ts";
import type { PushMode, PushSender } from "./types.ts";

export type { PushMode, PushPayload, PushResult, PushSender, PushTarget } from "./types.ts";

export const disabledPushSender: PushSender = {
  mode: "disabled",
  send: (targets) =>
    Promise.resolve({ attempted: 0, delivered: 0, failed: 0, skipped: targets.length, invalidTargets: [] }),
};

export const stubPushSender: PushSender = {
  mode: "stub",
  send: (targets) =>
    Promise.resolve({
      attempted: targets.length,
      delivered: targets.length,
      failed: 0,
      skipped: 0,
      invalidTargets: [],
    }),
};

function brokenFcmSender(): PushSender {
  return {
    mode: "fcm",
    send: (targets) =>
      Promise.resolve({
        attempted: targets.length,
        delivered: 0,
        failed: targets.length,
        skipped: 0,
        invalidTargets: [],
      }),
  };
}

export function pushMode(): PushMode {
  const raw = (env("PUSH_PROVIDER_MODE") ?? "disabled").toLowerCase();
  return raw === "fcm" || raw === "stub" ? raw : "disabled";
}

let cached: { mode: PushMode; sender: PushSender } | undefined;

// One sender per isolate, so the Google access token is reused between requests.
export function pushSenderFromEnv(): PushSender {
  const mode = pushMode();
  if (cached?.mode === mode) return cached.sender;
  let sender: PushSender;
  if (mode === "stub") sender = stubPushSender;
  else if (mode === "fcm") {
    const account = parseServiceAccount(env("FCM_SERVICE_ACCOUNT_JSON"));
    sender = account
      ? fcmPushSender({ projectId: account.projectId, tokens: serviceAccountTokenSource(account) })
      : brokenFcmSender();
  } else sender = disabledPushSender;
  cached = { mode, sender };
  return sender;
}
