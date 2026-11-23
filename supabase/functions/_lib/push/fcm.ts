// FCM HTTP v1 sender (docs: firebase.google.com/docs/cloud-messaging/send-message). Owner: M4.
// Messages are data-only with Android priority HIGH, exactly like the old firebase-admin sender
// (apps/product-api/src/push.ts): the app's ThesisFirebaseMessagingService reads title, body, route and
// notification_type from the data map. HTTP v1 has no multicast, so we send one request per token with a
// small concurrency pool. Network time does not count against the Edge Function CPU limit.
import type { AccessTokenSource } from "./fcm_auth.ts";
import type { PushPayload, PushResult, PushSender, PushTarget } from "./types.ts";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FcmOptions {
  projectId: string;
  tokens: AccessTokenSource;
  fetchFn?: FetchLike;
  concurrency?: number;
  // Wait before the single retry of a 429 or 5xx answer.
  retryDelayMs?: number;
}

type Outcome = "delivered" | "failed" | "invalid";

export function buildFcmMessage(token: string, payload: PushPayload): Record<string, unknown> {
  return {
    message: {
      token,
      android: { priority: "HIGH" },
      data: {
        route: payload.route,
        title: payload.title,
        body: payload.body,
        notification_type: payload.notificationType,
        ...(payload.data ?? {}),
      },
    },
  };
}

// UNREGISTERED: the app was uninstalled or the token expired. INVALID_ARGUMENT on the token: never valid.
// Both match the old sender's messaging/registration-token-not-registered and invalid-registration-token.
export async function classifyFcmError(res: Response): Promise<"invalid" | "retry" | "failed"> {
  if (res.status === 429 || res.status >= 500) {
    await res.body?.cancel();
    return "retry";
  }
  let text = "";
  try {
    text = await res.text();
  } catch {
    return "failed";
  }
  if (res.status === 404 && /UNREGISTERED/.test(text)) return "invalid";
  if (res.status === 400 && /UNREGISTERED|registration token|INVALID_REGISTRATION/i.test(text)) {
    return "invalid";
  }
  return "failed";
}

async function sendOne(
  opts: FcmOptions,
  url: string,
  target: PushTarget,
  payload: PushPayload,
): Promise<Outcome> {
  const fetchFn = opts.fetchFn ?? fetch;
  for (let attempt = 0; attempt < 2; attempt++) {
    const accessToken = await opts.tokens.get();
    const res = await fetchFn(url, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(buildFcmMessage(target.deviceToken, payload)),
    });
    if (res.ok) {
      await res.body?.cancel();
      return "delivered";
    }
    const kind = await classifyFcmError(res);
    if (kind === "invalid") return "invalid";
    if (kind === "failed") return "failed";
    if (attempt === 0) await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 500));
  }
  return "failed";
}

export function fcmPushSender(opts: FcmOptions): PushSender {
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(opts.projectId)}/messages:send`;
  return {
    mode: "fcm",
    async send(targets, payload): Promise<PushResult> {
      const result: PushResult = {
        attempted: targets.length,
        delivered: 0,
        failed: 0,
        skipped: 0,
        invalidTargets: [],
      };
      if (targets.length === 0) return result;
      let next = 0;
      const worker = async () => {
        while (next < targets.length) {
          const target = targets[next++];
          let outcome: Outcome;
          try {
            outcome = await sendOne(opts, url, target, payload);
          } catch {
            outcome = "failed";
          }
          if (outcome === "delivered") result.delivered++;
          else {
            result.failed++;
            if (outcome === "invalid") result.invalidTargets.push(target);
          }
        }
      };
      const pool = Math.max(1, Math.min(opts.concurrency ?? 20, targets.length));
      await Promise.all(Array.from({ length: pool }, worker));
      return result;
    },
  };
}
