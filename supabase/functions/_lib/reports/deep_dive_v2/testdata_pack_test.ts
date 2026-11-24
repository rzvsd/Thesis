import { assertEquals } from "jsr:@std/assert@1.0.13";
import { readFactPack } from "./fact_pack.ts";
import {
  sampleApplePack,
  sampleBankPack,
  sampleLossmakerPack,
  sampleReport,
  sampleSharesPack,
} from "./testdata_pack.ts";

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

Deno.test("the split sample keeps its splits list through readFactPack only when it lists one", () => {
  const listed = readFactPack(sampleReport(sampleSharesPack("split_listed")));
  assertEquals(listed?.splits?.map((s) => [s.ratio, s.effective_fiscal_year]), [[4, 2025]]);
  assertEquals(listed?.annual[0].as_reported?.shares_diluted, 80e6);
  assertEquals(readFactPack(sampleReport(sampleSharesPack("split_raw")))?.splits, undefined);
});
