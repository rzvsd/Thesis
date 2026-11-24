// Deep Dive 2.0: embedded web fonts. The share page CSP allows only `font-src data:`, so the fonts travel inside
// the page as base64 woff2 data URIs (fonts_data.ts, cut down from Google Fonts, SIL Open Font License 1.1).
// Only Newsreader (normal, variable opsz + wght, and an italic) is embedded, about 100 KB. Body text uses the
// system sans. Characters outside the subsets fall back to Georgia, which still reads well.
// Pure TS (no Deno APIs).

import {
  NEWSREADER_ITALIC_UNICODE_RANGE,
  NEWSREADER_ITALIC_WEIGHT,
  NEWSREADER_ITALIC_WOFF2,
  NEWSREADER_NORMAL_WOFF2,
  NEWSREADER_UNICODE_RANGE,
  NEWSREADER_WEIGHT,
} from "./fonts_data.ts";

function face(style: "normal" | "italic", weight: string, range: string, base64: string): string {
  if (!base64) return "";
  return `@font-face{font-family:"Newsreader";font-style:${style};font-weight:${weight};font-display:swap;` +
    `src:url(data:font/woff2;base64,${base64}) format("woff2");unicode-range:${range}}`;
}

/** @font-face rules with data: URIs. Put it before PAGE_CSS in the page's <style>. */
export const FONT_CSS: string = [
  face("normal", NEWSREADER_WEIGHT, NEWSREADER_UNICODE_RANGE, NEWSREADER_NORMAL_WOFF2),
  face("italic", NEWSREADER_ITALIC_WEIGHT, NEWSREADER_ITALIC_UNICODE_RANGE, NEWSREADER_ITALIC_WOFF2),
].filter(Boolean).join("\n");
