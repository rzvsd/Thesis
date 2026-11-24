import { assertEquals } from "jsr:@std/assert@1.0.13";
import { readFactPack } from "./fact_pack.ts";
import { sampleApplePack, sampleBankPack, sampleLossmakerPack, sampleReport } from "./testdata_pack.ts";

Deno.test("sample packs are valid fact packs", () => {
  for (const pack of [sampleApplePack(), sampleLossmakerPack(), sampleBankPack()]) {
    const read = readFactPack(sampleReport(pack));
    assertEquals(read?.ticker, pack.ticker);
    assertEquals(read?.annual.length, pack.annual.length);
  }
  const apple = sampleApplePack();
  assertEquals(apple.latest_filing?.filing_date, "2025-10-31");
  assertEquals(apple.price_at_filing, null);
  assertEquals(apple.missing, ["segments", "regions", "owners", "price_at_filing"]);
  assertEquals(apple.filings.some((f) => f.form === "8-K" && f.items?.includes("2.02")), true);
  assertEquals(sampleBankPack().annual.every((r) => r.gross_profit === undefined), true);
});
