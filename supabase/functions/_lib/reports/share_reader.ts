// Web reader around a shared Deep Dive (/r/:token). Copied from apps/product-api/src/routes/report-share-routes.ts.
// The report artifact is about the company only; the sharer's identity is never rendered.
import { env } from "../../_shared/env.ts";
import { SHARE_PAGE_CSP } from "./deep_dive_v2/client.ts";

export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export const READER_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

// Deep Dive 2.0 page (deep_dive_v2/render.ts): its one inline script is allowed by hash, fonts are data: URIs.
// One definition, in deep_dive_v2/client.ts next to the script it hashes.
export const READER_V2_CSP: string = SHARE_PAGE_CSP;

export const READER_HEADERS: Record<string, string> = {
  "cache-control": "private, max-age=300",
  "x-robots-tag": "noindex, nofollow",
  // The token is in the URL: do not pass it to other sites through the Referer header.
  "referrer-policy": "no-referrer",
  // The v2 page also sends frame-ancestors 'none'; this covers the editorial fallback and the 404 page too.
  "x-frame-options": "DENY",
};

export function appDownloadUrl(): string {
  return env("APP_DOWNLOAD_URL")?.trim() || "https://play.google.com/store/apps/details?id=com.thesis.mobile";
}

// share url = PUBLIC_API_BASE_URL + "/r/" + token, or null when PUBLIC_API_BASE_URL is unset.
export function shareUrl(token: string): string | null {
  const base = env("PUBLIC_API_BASE_URL")?.trim().replace(/\/+$/, "");
  return base ? `${base}/r/${token}` : null;
}

// Random 24 bytes as base64url (32 chars), like randomBytes(24).toString("base64url").
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The old file's escape (no apostrophe), kept so the page bytes match.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const NOT_ADVICE =
  "Thesis is research, not financial advice. This report is general information about a company, " +
  "not a recommendation to buy or sell any security. Do your own research before you invest.";

/** Web-reader additions around the existing report HTML: noindex, notice, app link, screen layout. */
export function readerHtml(reportHtml: string, downloadUrl: string): string {
  const banner =
    '<div style="max-width:8.5in;margin:0 auto;padding:14px 18px;background:#1a2128;color:#f8f4eb;' +
    "font:14px/1.45 'Helvetica Neue',Arial,sans-serif\">" +
    `<p style="margin:0 0 6px;color:#f8f4eb">${escapeHtml(NOT_ADVICE)}</p>` +
    `<a href="${escapeHtml(downloadUrl)}" style="color:#d7b985;font-weight:700">Get the Thesis app</a>` +
    "</div>";
  const screenCss =
    "<style>@media screen{.page{width:auto;max-width:8.5in;height:auto;min-height:0;margin:0 auto 12px;" +
    "overflow:visible}}@media screen and (max-width:600px){.page{padding:20px 14px}}</style>";
  return reportHtml
    .replace("<head>", '<head>\n<meta name="robots" content="noindex, nofollow" />')
    .replace("</head>", `${screenCss}\n</head>`)
    .replace("<body>", `<body>\n${banner}`)
    .replace("</body>", `${banner}\n</body>`);
}

export function notFoundHtml(downloadUrl: string): string {
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="robots" content="noindex, nofollow" /><title>Thesis</title></head>',
    "<body style=\"font-family:'Helvetica Neue',Arial,sans-serif;padding:24px\">",
    "<p>This shared report is not available.</p>",
    `<p><a href="${escapeHtml(downloadUrl)}">Get the Thesis app</a></p>`,
    "</body></html>",
  ].join("");
}
