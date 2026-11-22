import type { ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { ProductApiConfig } from "../config";
import { verifyEmailUnsubscribeToken } from "../filing-change-alerts";
import type { ProductStore } from "../store";

interface EmailUnsubscribeRuntime {
  config: ProductApiConfig;
  store: ProductStore;
}

export interface EmailUnsubscribeRouteContext<TRuntime extends EmailUnsubscribeRuntime> {
  method: string;
  pathname: string;
  response: ServerResponse;
  runtime: TRuntime;
  url: URL;
}

function sendHtml(response: ServerResponse, statusCode: number, message: string, form?: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
    `<title>Thesis email</title></head><body><p>${message}</p>${form ?? ""}</body></html>`
  );
}

/**
 * Public unsubscribe link from notification emails (no login). GET shows a confirm button so
 * link scanners do not unsubscribe people; POST (also RFC 8058 one-click) sets the opt-out.
 */
export async function handleEmailUnsubscribeRoutes<TRuntime extends EmailUnsubscribeRuntime>(
  context: EmailUnsubscribeRouteContext<TRuntime>
): Promise<boolean> {
  const { method, pathname, response, runtime, url } = context;
  if (pathname !== "/v1/email/unsubscribe" || (method !== "GET" && method !== "POST")) {
    return false;
  }

  const token = url.searchParams.get("token") ?? "";
  const userId = verifyEmailUnsubscribeToken(runtime.config.jwtSecret, token);
  if (!userId) {
    sendHtml(response, 400, "This unsubscribe link is not valid.");
    return true;
  }

  if (method === "GET") {
    sendHtml(
      response,
      200,
      "Stop all Thesis notification emails? Push notifications in the app are not changed.",
      `<form method="post" action="/v1/email/unsubscribe?token=${encodeURIComponent(token)}">` +
      `<button type="submit">Unsubscribe</button></form>`
    );
    return true;
  }

  await runtime.store.setEmailOptOut({ userId, optOut: true, updatedAt: new Date().toISOString() });
  sendHtml(
    response,
    200,
    "You will no longer get Thesis notification emails. You can turn them back on in the app."
  );
  return true;
}
