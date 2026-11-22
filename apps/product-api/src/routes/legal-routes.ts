import type { ServerResponse } from "node:http";

import { LEGAL_DOCUMENTS, LEGAL_DRAFT_BANNER, type LegalDocument } from "../legal/legal-texts";

const legalPaths: Record<string, LegalDocument["slug"]> = {
  "/legal/privacy": "privacy",
  "/legal/terms": "terms"
};

// Public, unauthenticated HTML pages so store listings and the app can link to them.
export function handleLegalRoutes(method: string, pathname: string, response: ServerResponse): boolean {
  const slug = legalPaths[pathname.replace(/\/$/, "")];
  if (method !== "GET" || !slug) {
    return false;
  }

  const body = renderLegalPage(LEGAL_DOCUMENTS[slug]);
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=300",
    "content-security-policy":
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  });
  response.end(body);
  return true;
}

function renderLegalPage(document: LegalDocument): string {
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(document.title)}</title>`,
    "<style>",
    "body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:0 auto;padding:1rem;color:#1a1a1a;background:#fff}",
    ".draft{position:sticky;top:0;background:#b00020;color:#fff;font-weight:700;padding:.75rem 1rem;text-align:center}",
    "h1{font-size:1.6rem;margin-top:2rem}h2{font-size:1.25rem;margin-top:1.75rem}h3{font-size:1.05rem}",
    "@media (prefers-color-scheme:dark){body{color:#e8e8e8;background:#121212}}",
    "</style></head><body>",
    `<div class="draft" role="alert">${escapeHtml(LEGAL_DRAFT_BANNER)}</div>`,
    renderMarkdown(document.markdown),
    "</body></html>"
  ].join("\n");
}

// Renders the small markdown subset used in legal-texts.ts.
function renderMarkdown(markdown: string): string {
  const html: string[] = [];
  let paragraph: string[] = [];
  let listOpen = false;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (!line) {
      flushParagraph();
      closeList();
    } else if (heading) {
      flushParagraph();
      closeList();
      const [, hashes = "#", text = ""] = heading;
      html.push(`<h${hashes.length}>${inline(text)}</h${hashes.length}>`);
    } else if (line.startsWith("- ")) {
      flushParagraph();
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
    } else {
      closeList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  closeList();
  return html.join("\n");
}

function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
