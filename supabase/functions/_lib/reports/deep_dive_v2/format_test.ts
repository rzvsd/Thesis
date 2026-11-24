import { assertEquals } from "jsr:@std/assert@1.0.13";
import { esc, fmt, fmtAxis, fmtMoney, fy, MINUS, pct } from "./format.ts";

const B = 1e9;

Deno.test("esc escapes the five HTML characters and blanks null", () => {
  assertEquals(
    esc(`<a href="x">Tom & 'Jerry'</a>`),
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
  );
  assertEquals(esc(null), "");
  assertEquals(esc(undefined), "");
  assertEquals(esc(12.5), "12.5");
});

Deno.test("fmt usd is compact with T/B/M and a real minus", () => {
  assertEquals(fmt(416.2 * B, "usd"), "$416B");
  assertEquals(fmt(98.8 * B, "usd"), "$98.8B");
  assertEquals(fmt(750e6, "usd"), "$750M");
  assertEquals(fmt(1.2e12, "usd"), "$1.2T");
  assertEquals(fmt(-12.3 * B, "usd"), `${MINUS}$12.3B`);
  assertEquals(fmt(12.3 * B, "usd", { sign: true }), "+$12.3B");
  assertEquals(fmt(999.96 * B, "usd"), "$1.0T");
  assertEquals(fmt(99.96 * B, "usd"), "$100B");
  assertEquals(fmt(950, "usd"), "$950");
  assertEquals(fmt(0, "usd", { sign: true }), "$0");
});

Deno.test("fmt covers every unit", () => {
  assertEquals(fmt(416.2 * B, "usd_b"), "$416B");
  assertEquals(fmt(98.8 * B, "usd_b"), "$98.8B");
  assertEquals(fmt(-0.75 * B, "usd_b"), `${MINUS}$0.8B`);
  assertEquals(fmt(7.47, "usd_ps"), "$7.47");
  assertEquals(fmt(-0.4, "usd_ps"), `${MINUS}$0.40`);
  assertEquals(fmt(0.4, "usd_ps", { sign: true }), "+$0.40");
  assertEquals(fmt(46.9, "pct"), "46.9%");
  assertEquals(fmt(6.4, "pct", { sign: true }), "+6.4%");
  assertEquals(fmt(0.7, "pp"), "+0.7 points");
  assertEquals(fmt(-0.5, "pp"), `${MINUS}0.5 points`);
  assertEquals(fmt(25.6, "x"), "25.6x");
  assertEquals(fmt(15e9, "shares_b"), "15.00B");
  assertEquals(fmt(1234567, "plain"), "1,234,567");
  assertEquals(fmt(9.44, "plain", { digits: 1 }), "9.4");
});

Deno.test("fmt says Not disclosed for missing and non-finite values", () => {
  assertEquals(fmt(null, "usd"), "Not disclosed");
  assertEquals(fmt(undefined, "pct"), "Not disclosed");
  assertEquals(fmt(NaN, "x"), "Not disclosed");
  assertEquals(fmt(Infinity, "usd_ps"), "Not disclosed");
  assertEquals(fmtMoney(null), "Not disclosed");
});

Deno.test("rounding to zero never shows a minus", () => {
  assertEquals(pct(-0.04), "0.0%");
  assertEquals(fmt(-0.001, "usd_ps"), "$0.00");
});

Deno.test("fmtMoney keeps one decimal for B and T", () => {
  assertEquals(fmtMoney(416.2 * B), "$416.2B");
  assertEquals(fmtMoney(98.8 * B), "$98.8B");
  assertEquals(fmtMoney(750e6), "$750M");
  assertEquals(fmtMoney(1.2e12), "$1.2T");
  assertEquals(fmtMoney(-2.5e9), `${MINUS}$2.5B`);
});

Deno.test("pct and fy", () => {
  assertEquals(pct(6.4), "6.4%");
  assertEquals(pct(-2.1), `${MINUS}2.1%`);
  assertEquals(pct(33.333, 0), "33%");
  assertEquals(fy(2025), "FY2025");
});

Deno.test("fmtAxis shares one scale and the fewest decimals", () => {
  assertEquals(fmtAxis([0, 100 * B, 200 * B], "usd"), ["$0", "$100B", "$200B"]);
  assertEquals(fmtAxis([-2 * B, 0, 2 * B], "usd"), [`${MINUS}$2B`, "$0", "$2B"]);
  assertEquals(fmtAxis([0, 2.5, 5], "pct"), ["0%", "2.5%", "5.0%"]);
  assertEquals(fmtAxis([0, 0.5, 1], "usd_ps"), ["$0", "$0.50", "$1.00"]);
  assertEquals(fmtAxis([14e9, 16e9], "shares_b"), ["14B", "16B"]);
  assertEquals(fmtAxis([-1, 0, 1], "pp"), [`${MINUS}1`, "0", "+1"]);
  assertEquals(fmtAxis([0, 20, 40], "x"), ["0x", "20x", "40x"]);
});
