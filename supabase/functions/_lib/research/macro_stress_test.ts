import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { buildMacroStressSnapshot, macroStressToLegacySnapshot, toAppMacroStress } from "./macro_stress.ts";

const observations = [
  {
    registry_id: "TREASURY_DAILY_10Y",
    value: 4.9,
    category: "rates",
    retrieval: { retrieved_at: "2026-11-20T00:00:00Z" },
  },
  { registry_id: "TREASURY_DAILY_2Y", value: 4.6, category: "rates" },
  { registry_id: "BLS_CPI_U_ALL_ITEMS", value: 3.4, category: "inflation" },
  { registry_id: "BLS_UNEMPLOYMENT_RATE", value: 4.1, category: "labor" },
  { registry_id: "EIA_WTI_SPOT", value: 80, category: "energy" },
];

Deno.test("app shape keeps the macro stress fields and adds a numeric score", () => {
  const snap = buildMacroStressSnapshot({
    asOf: "2026-11-20",
    generatedAt: "2026-11-21T11:30:00Z",
    observations,
  });
  const legacy = macroStressToLegacySnapshot(snap);
  const app = toAppMacroStress(legacy);
  // old fields unchanged
  assertEquals(app.snapshot_id, legacy.id);
  assertEquals(app.as_of, "2026-11-20");
  assert(typeof app.state === "string" && typeof app.summary === "string");
  // fields the Android parser needs
  assertEquals(app.id, legacy.id);
  assertEquals(app.market_date, "2026-11-20");
  assert(Number.isFinite(app.score) && app.score >= 0 && app.score <= 100);
  assert(["elevated_pressure", "balanced", "low_pressure", "insufficient_data"].includes(app.label));
  assertEquals(app.sub_scores.length, legacy.sub_scores.length);
});

Deno.test("no inputs gives insufficient_data and a neutral score", () => {
  const snap = buildMacroStressSnapshot({
    asOf: "2026-11-20",
    generatedAt: "2026-11-21T11:30:00Z",
    observations: [],
  });
  const app = toAppMacroStress(macroStressToLegacySnapshot(snap));
  assertEquals(app.label, "insufficient_data");
  assertEquals(app.score, 50);
});
