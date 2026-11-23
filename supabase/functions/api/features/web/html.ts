// HTML responses. Supabase rewrites text/html from Edge Functions to text/plain when there is no custom domain
// (DECISIONS "Free-tier limits"). So every HTML response also carries x-thesis-content-type, and the Cloudflare
// Worker (edge/worker) puts that value back into content-type before the browser sees it.
export const HTML_TYPE = "text/html; charset=utf-8";

export function html(body: string, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set("content-type", HTML_TYPE);
  h.set("x-thesis-content-type", HTML_TYPE);
  if (!h.has("x-content-type-options")) h.set("x-content-type-options", "nosniff");
  return new Response(body, { status, headers: h });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
