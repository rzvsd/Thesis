// Audit rows, best effort. Same insert as the old appendAudit (server.ts). A failed write never fails
// the request. Callers pass ids and counts only, never emails or tokens (N10).
import { logError } from "../../_shared/log.ts";
import type { ResearchStore } from "./store.ts";

export async function appendAudit(
  store: ResearchStore,
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  try {
    await store.appendAuditEvent({
      id: crypto.randomUUID(),
      eventType,
      payload,
      userId,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logError("Audit write failed", {
      event_type: eventType,
      error: err instanceof Error ? err.name : "unknown",
    });
  }
}

export function requestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}
