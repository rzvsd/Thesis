// Route table and guard checks through the real app handler.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { handle } from "../../app.ts";
import { feature as alerts } from "../alerts/index.ts";
import { feature as research } from "./index.ts";

Deno.test("research and alerts register every M3 app route as a user route", () => {
  const routes = [...research.routes, ...alerts.routes].map((r) => `${r.method} ${r.path}`).sort();
  assertEquals(routes, [
    "GET /v1/conviction/insights",
    "GET /v1/conviction/timeline",
    "GET /v1/macro-stress/current",
    "GET /v1/macro-stress/history",
    "GET /v1/names/relationships",
    "GET /v1/reports/:id/opposite-case",
    "GET /v1/research/earnings/state",
    "GET /v1/research/war-room/:id",
    "GET /v1/scenarios/runs/:id",
    "GET /v1/scenarios/templates",
    "GET /v1/sentiment/current",
    "GET /v1/sentiment/history",
    "GET /v1/user/alerts",
    "GET /v1/user/alerts/:id",
    "GET /v1/user/monitor-snapshots",
    "POST /v1/feedback/report",
    "POST /v1/feedback/subscription",
    "POST /v1/reports/:id/opposite-case",
    "POST /v1/reports/:id/scenario",
    "POST /v1/scenarios/runs",
    "POST /v1/user/alerts/:id/feedback",
    "POST /v1/user/alerts/:id/mute",
  ]);
  assert([...research.routes, ...alerts.routes].every((r) => r.auth === "user"));
});

Deno.test("M3 routes answer 401 without a token, before touching the database", async () => {
  const noUser = () => Promise.resolve(null);
  for (const path of ["/v1/macro-stress/current", "/v1/user/alerts", "/v1/scenarios/runs/abc"]) {
    const res = await handle(new Request(`http://x/functions/v1/api${path}`), noUser);
    assertEquals(res.status, 401, path);
    assertEquals((await res.json()).error, "unauthorized");
  }
});
