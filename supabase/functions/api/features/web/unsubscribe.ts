// GET and POST /v1/email/unsubscribe?token=... Ported from apps/product-api/src/routes/email-unsubscribe-routes.ts.
// Public link from notification emails (no login). GET shows a confirm button so link scanners do not unsubscribe
// people; POST (also RFC 8058 one-click) sets the opt-out.
import { html } from "./html.ts";
import { verifyUnsubscribeToken } from "../../../_lib/reports/unsubscribe_token.ts";

export function unsubscribePage(statusCode: number, message: string, form?: string): Response {
  return html(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
      `<title>Thesis email</title></head><body><p>${message}</p>${form ?? ""}</body></html>`,
    statusCode,
    { "cache-control": "no-store" },
  );
}

export interface UnsubscribeDeps {
  verify: (token: string) => Promise<string | undefined>;
  setEmailOptOut: (input: { userId: string; optOut: boolean; updatedAt: string }) => Promise<void>;
}

export const defaultVerify = (token: string) => verifyUnsubscribeToken(token);

export async function handleUnsubscribe(req: Request, url: URL, deps: UnsubscribeDeps): Promise<Response> {
  const token = url.searchParams.get("token") ?? "";
  const userId = await deps.verify(token);
  if (!userId) return unsubscribePage(400, "This unsubscribe link is not valid.");

  if (req.method === "GET") {
    return unsubscribePage(
      200,
      "Stop all Thesis notification emails? Push notifications in the app are not changed.",
      `<form method="post" action="/v1/email/unsubscribe?token=${encodeURIComponent(token)}">` +
        `<button type="submit">Unsubscribe</button></form>`,
    );
  }

  await deps.setEmailOptOut({ userId, optOut: true, updatedAt: new Date().toISOString() });
  return unsubscribePage(
    200,
    "You will no longer get Thesis notification emails. You can turn them back on in the app.",
  );
}
