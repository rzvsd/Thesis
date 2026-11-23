// HTML responses. Supabase rewrites text/html from Edge Functions to text/plain when there is no custom domain
// (DECISIONS "Free-tier limits"). So every HTML response also carries x-thesis-content-type, and the Cloudflare
// Worker (edge/worker) puts that value back into content-type before the browser sees it.
export const HTML_TYPE = "text/html; charset=utf-8";

// The Worker drops content-security-policy on HTML (it cannot tell Supabase's sandbox policy from ours), so a page's
// own CSP must also travel as x-thesis-csp; the Worker turns it back into content-security-policy.
export function html(body: string, status = 200, headers: HeadersInit = {}, csp?: string): Response {
  const h = new Headers(headers);
  if (csp) {
    h.set("content-security-policy", csp);
    h.set("x-thesis-csp", csp);
  }
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
