import { assertEquals } from "jsr:@std/assert@1.0.13";
import {
  isCoveredTicker,
  isSupportedTicker,
  listCoveredTickers,
  normalizeTicker,
  searchTickers,
  supportedTickers,
} from "./tickers.ts";
import { cleanup, dbTest, insertCoverage, insertTicker, testSymbol } from "./profile_testdb.ts";

Deno.test("normalizeTicker trims, upper-cases and checks the pattern", () => {
  assertEquals(normalizeTicker(" brk.b "), "BRK.B");
  assertEquals(normalizeTicker("A1"), undefined);
  assertEquals(normalizeTicker(""), undefined);
  assertEquals(normalizeTicker(7), undefined);
  assertEquals(normalizeTicker("ABCDEFGHIJKLM"), undefined);
});

dbTest("search ranks exact, then prefix, then name matches; skips unsupported and delisted", async () => {
  const base = testSymbol();
  const exact = base;
  const prefix = `${base}A`;
  const other = testSymbol();
  const hidden = `${base}B`;
  const delisted = `${base}C`;
  const symbols = [exact, prefix, other, hidden, delisted];
  try {
    await insertTicker(prefix);
    await insertTicker(exact);
    await insertTicker(other, { company: `Holding of ${base} Group`, exchange: "NYSE" });
    await insertTicker(hidden, { supported: false });
    await insertTicker(delisted, { status: "delisted" });
    const rows = await searchTickers(base.toLowerCase(), 25);
    assertEquals(rows.map((r) => r.symbol), [exact, prefix, other]);
    assertEquals(rows[2], { symbol: other, company_name: `Holding of ${base} Group`, exchange: "NYSE" });
    assertEquals((await searchTickers(base, 1)).length, 1);
    assertEquals(await searchTickers("  ", 25), []);

    assertEquals(await isSupportedTicker(exact.toLowerCase()), true);
    assertEquals(await isSupportedTicker(hidden), false);
    assertEquals(await isSupportedTicker(delisted), false);
    assertEquals(await supportedTickers([exact, hidden, delisted, "NOPE"]), new Set([exact]));
    assertEquals(await supportedTickers([]), new Set());
  } finally {
    await cleanup([], symbols);
  }
});

dbTest("coverage counts success and partial only", async () => {
  const ok = testSymbol();
  const partial = testSymbol();
  const failed = testSymbol();
  try {
    await insertCoverage(ok, "success");
    await insertCoverage(partial, "partial", 2);
    await insertCoverage(failed, "failed");
    const list = await listCoveredTickers();
    assertEquals(list.includes(ok) && list.includes(partial), true);
    assertEquals(list.includes(failed), false);
    assertEquals(await isCoveredTicker(ok.toLowerCase()), true);
    assertEquals(await isCoveredTicker(partial), true);
    assertEquals(await isCoveredTicker(failed), false);
    assertEquals(await isCoveredTicker(testSymbol()), false);
  } finally {
    await cleanup([], [ok, partial, failed]);
  }
});
