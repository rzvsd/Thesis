import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { FONT_CSS } from "./fonts.ts";
import { NEWSREADER_ITALIC_WOFF2, NEWSREADER_NORMAL_WOFF2 } from "./fonts_data.ts";

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

Deno.test("fonts_data: each font is valid base64 woff2", () => {
  for (const s of [NEWSREADER_NORMAL_WOFF2, NEWSREADER_ITALIC_WOFF2]) {
    assert(s.length > 10_000, "font data present");
    assert(B64.test(s), "plain base64");
    assertEquals(s.length % 4, 0);
    // "wOF2" magic bytes
    assertEquals(atob(s.slice(0, 8)).slice(0, 4), "wOF2");
  }
});

Deno.test("FONT_CSS: two Newsreader faces with data URIs only, page stays light", () => {
  assertEquals(FONT_CSS.match(/@font-face/g)?.length, 2);
  assertStringIncludes(FONT_CSS, 'font-family:"Newsreader";font-style:normal');
  assertStringIncludes(FONT_CSS, 'font-family:"Newsreader";font-style:italic');
  assertEquals(FONT_CSS.match(/url\(data:font\/woff2;base64,/g)?.length, 2);
  assert(!/https?:/.test(FONT_CSS), "no external URL");
  assert(!FONT_CSS.includes("</"), "safe inside <style>");
  assertStringIncludes(FONT_CSS, "unicode-range:U+0020-007E");
  assertStringIncludes(FONT_CSS, "font-display:swap");
  assert(FONT_CSS.length < 140_000, `fonts add ${FONT_CSS.length} bytes to every page`);
});
