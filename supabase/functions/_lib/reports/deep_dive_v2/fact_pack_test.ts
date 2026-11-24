import { assertEquals } from "jsr:@std/assert@1.0.13";
import { readFactPack } from "./fact_pack.ts";
import { sampleApplePack } from "./testdata_pack.ts";

Deno.test("readFactPack sorts the annual rows oldest first and drops bad rows", () => {
  const pack = sampleApplePack();
  const rows = [...pack.annual].reverse();
  const out = readFactPack({
    fact_pack: {
      ...pack,
      annual: [...rows, { fiscal_year: "2030", period_end: "x" }, null, { fiscal_year: 2031 }],
    },
  });
  assertEquals(out?.annual.map((r) => r.fiscal_year), pack.annual.map((r) => r.fiscal_year));
});

Deno.test("readFactPack returns null for junk and fills missing lists with empty ones", () => {
  for (
    const junk of [null, 1, "x", [], {}, { fact_pack: null }, { fact_pack: { version: 2, annual: [{}] } }]
  ) {
    assertEquals(readFactPack(junk), null);
  }
  assertEquals(readFactPack({ fact_pack: { ...sampleApplePack(), annual: [] } }), null);
  assertEquals(readFactPack({ fact_pack: { ...sampleApplePack(), annual: [{ fiscal_year: "x" }] } }), null);
  const out = readFactPack({
    fact_pack: {
      ...sampleApplePack(),
      filings: "nope",
      missing: 3,
      sources: {},
      price_at_filing: "61.5",
      latest_filing: [],
    },
  });
  assertEquals(out?.filings, []);
  assertEquals(out?.missing, []);
  assertEquals(out?.sources, []);
  assertEquals(out?.price_at_filing, null);
  assertEquals(out?.latest_filing, null);
});
