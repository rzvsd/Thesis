import { assertEquals } from "jsr:@std/assert@1.0.13";
import { enrichAnalysisReportIssuer } from "./issuer.ts";
import { FakeEffectsStore } from "./testing/fake_store.ts";
import { deepDiveFixture } from "./testing/report_fixture.ts";

Deno.test("enrichAnalysisReportIssuer fills name and exchange from the registry", async () => {
  const store = new FakeEffectsStore();
  store.tickers.set("AAPL", { symbol: "AAPL", companyName: "Apple Inc.", exchange: "NASDAQ" });
  const enriched = await enrichAnalysisReportIssuer(store, deepDiveFixture());
  assertEquals(enriched.issuer?.name, "Apple Inc.");
  assertEquals(enriched.issuer?.exchange, "NASDAQ");

  const kept = await enrichAnalysisReportIssuer(store, deepDiveFixture({ issuer: { name: "Apple" } }));
  assertEquals(kept.issuer?.name, "Apple");
  assertEquals(kept.issuer?.exchange, "NASDAQ");

  const unknown = deepDiveFixture({ ticker: "ZZZZ" });
  assertEquals(await enrichAnalysisReportIssuer(store, unknown), unknown);
});

Deno.test("enrichAnalysisReportIssuer merges an injected structural context and survives a throwing fetch", async () => {
  const store = new FakeEffectsStore();
  store.tickers.set("AAPL", { symbol: "AAPL", companyName: "Apple Inc.", exchange: "NASDAQ" });
  const report = deepDiveFixture({
    due_diligence: {
      sections: [{ section_id: "risks_and_challenges", narrative_paragraphs: [], key_points: [] }],
    },
  });
  const enriched = await enrichAnalysisReportIssuer(store, report, {
    fetchStructuralContext: () =>
      Promise.resolve({
        subject_type: "issuer",
        issuer_metadata: { sector: "Technology" },
        observations: [{ family: "public_debt", label: "Public debt", summary: "Debt is high." }],
        omissions: [],
      }),
  });
  assertEquals(enriched.issuer?.sector, "Technology");
  // deno-lint-ignore no-explicit-any
  const section = (enriched.due_diligence as any).sections[0];
  assertEquals(section.narrative_paragraphs, ["Structural context: Debt is high."]);
  assertEquals(section.key_points, ["Public debt remains part of the macro risk frame."]);
  assertEquals(enriched.structural_context?.subject_type, "issuer");

  const survived = await enrichAnalysisReportIssuer(store, report, {
    fetchStructuralContext: () => Promise.reject(new Error("gone")),
  });
  assertEquals(survived.issuer?.name, "Apple Inc.");
});
