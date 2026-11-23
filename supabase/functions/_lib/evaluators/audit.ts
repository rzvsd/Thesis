// Best-effort audit rows, like appendAudit in the old server. A failed audit insert never fails the route.
import { logError } from "../../_shared/log.ts";
import type { EvaluatorStore } from "./store.ts";
import { createId } from "./util.ts";

export async function appendAudit(
  store: EvaluatorStore,
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  try {
    await store.appendAuditEvent({
      id: createId(),
      eventType,
      payload,
      userId,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logError("Audit insert failed", {
      event_type: eventType,
      error: err instanceof Error ? err.name : "unknown",
    });
  }
}
