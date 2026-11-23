// Macro stress and sentiment. Behaviour from apps/product-api/tests/sentiment.test.ts.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import type { FearGreedSnapshot } from "../../../_lib/research/macro_stress.ts";
import { call, memoryDeps } from "../../../_lib/research/testing.ts";
import {
  macroStressCurrentHandler,
  macroStressHistoryHandler,
  sentimentCurrentHandler,
  sentimentHistoryHandler,
} from "./macro.ts";

function snapshot(date: string, score: number): FearGreedSnapshot {
  return {
    id: `fg-${date}`,
    market_date: date,
    score,
    label: "neutral",
    sub_scores: [
      { input_name: "BLS_CPI_U_ALL_ITEMS", provider: "bls", available: true, weight: 0.2, raw_value: 3.4 },
    ],
    missing_inputs: [],
    calculated_at: `${date}T22:00:00.000Z`,
  };
}

Deno.test("macro stress and sentiment are 404 with their own codes when empty", async () => {
  const deps = memoryDeps();
  const macro = await call(macroStressCurrentHandler(deps), { path: "/v1/macro-stress/current" });
  assertEquals(macro.status, 404);
  assertEquals(macro.body.error, "macro_stress_not_found");
  const senti = await call(sentimentCurrentHandler(deps), { path: "/v1/sentiment/current" });
  assertEquals(senti.status, 404);
  assertEquals(senti.body.error, "sentiment_not_found");
});

Deno.test("macro stress current has the old fields plus a numeric score", async () => {
  const deps = memoryDeps();
  deps.store.fearGreed.push(snapshot("2026-11-19", 40), snapshot("2026-11-20", 55));
  const res = await call(macroStressCurrentHandler(deps), { path: "/v1/macro-stress/current" });
  assertEquals(res.status, 200);
  const d = res.body.data;
  assertEquals(d.as_of, "2026-11-20");
  for (
    const key of [
      "snapshot_id",
      "generated_at",
      "state",
      "summary",
      "no_material_change",
      "inputs",
      "omissions",
    ]
  ) {
    assert(key in d, key);
  }
  assertEquals(typeof d.score, "number");
  assert(typeof d.label === "string");
  assertEquals(d.market_date, "2026-11-20");
});

Deno.test("history routes return oldest first and validate days", async () => {
  const deps = memoryDeps();
  deps.store.fearGreed.push(
    snapshot("2026-11-20", 55),
    snapshot("2026-11-18", 40),
    snapshot("2026-11-19", 45),
  );
  const macro = await call(macroStressHistoryHandler(deps), { path: "/v1/macro-stress/history?days=2" });
  assertEquals(macro.body.data.map((s: { as_of: string }) => s.as_of), ["2026-11-19", "2026-11-20"]);
  const senti = await call(sentimentHistoryHandler(deps), { path: "/v1/sentiment/history" });
  assertEquals(senti.body.data.map((s: { score: number }) => s.score), [40, 45, 55]);
  assertEquals(senti.body.data[0].id, "fg-2026-11-18");
  for (const h of [macroStressHistoryHandler(deps), sentimentHistoryHandler(deps)]) {
    const bad = await call(h, { path: "/x?days=366" });
    assertEquals(bad.status, 422);
    assertEquals(bad.body.error_message, "days must be an integer between 1 and 365.");
  }
});

Deno.test("sentiment current returns the raw snapshot", async () => {
  const deps = memoryDeps();
  deps.store.fearGreed.push(snapshot("2026-11-20", 55));
  const res = await call(sentimentCurrentHandler(deps), { path: "/v1/sentiment/current" });
  assertEquals(res.body.data, snapshot("2026-11-20", 55));
});
