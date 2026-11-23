// What the research and alerts handlers need. Tests pass a MemoryResearchStore; the api function uses
// the Postgres store, which opens its connection on the first query, never at import time.
import { db } from "../../_shared/db.ts";
import { missingReportBodyReader, type ReportBodyReader } from "./ports.ts";
import { PostgresResearchStore, type ResearchStore } from "./store.ts";

export interface ResearchDeps {
  store: ResearchStore;
  readReportBody: ReportBodyReader;
}

export function defaultResearchDeps(): ResearchDeps {
  return { store: new PostgresResearchStore(db), readReportBody: missingReportBodyReader };
}

// Old readJsonBody: an empty body is {}, invalid JSON throws (the old server answered 500).
export async function readJsonBody<T>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export function requireUserId(userId: string | null): string {
  if (!userId) throw new Error("User route reached without a user id");
  return userId;
}
