// Test helpers for the research and alerts handlers. Not used at runtime.
import type { RouteContext } from "../../api/router.ts";
import { MemoryResearchStore } from "./memory_store.ts";
import type { ReportBodyReader } from "./ports.ts";
import type { ResearchDeps } from "./deps.ts";

export const USER = "user-1";
export const OTHER_USER = "user-2";

export function memoryDeps(readReportBody?: ReportBodyReader): ResearchDeps & { store: MemoryResearchStore } {
  return {
    store: new MemoryResearchStore(),
    readReportBody: readReportBody ?? (() => Promise.resolve(undefined)),
  };
}

export interface CallOptions {
  method?: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
  userId?: string;
}

type Handler = (ctx: RouteContext) => Promise<Response> | Response;

export async function call(
  handler: Handler,
  opts: CallOptions,
): Promise<{ status: number; body: Json }> {
  const url = new URL(`http://x${opts.path}`);
  const init: RequestInit = { method: opts.method ?? "GET" };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    init.headers = { "content-type": "application/json" };
  }
  const res = await handler({
    req: new Request(url, init),
    url,
    path: url.pathname,
    params: opts.params ?? {},
    auth: { mode: "user", userId: opts.userId ?? USER, accessToken: "t" },
  });
  return { status: res.status, body: await res.json() };
}

// deno-lint-ignore no-explicit-any
export type Json = any;
