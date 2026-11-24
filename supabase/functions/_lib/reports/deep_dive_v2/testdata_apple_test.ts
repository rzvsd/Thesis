import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { sampleAppleFacts } from "./testdata_apple.ts";

Deno.test("sample Apple facts are consistent", () => {
  const rows = sampleAppleFacts();
  assertEquals(rows.length, 11);
  assertEquals(rows.map((r) => r.fiscal_year), [
    2015,
    2016,
    2017,
    2018,
    2019,
    2020,
    2021,
    2022,
    2023,
    2024,
    2025,
  ]);
  const rev = rows.map((r) => Math.round((r.revenue as number) / 1e8) / 10);
  assertEquals(rev, [233.7, 215.6, 229.2, 265.6, 260.2, 274.5, 365.8, 394.3, 383.3, 391.0, 416.2]);
  const ni = rows.map((r) => Math.round((r.net_income as number) / 1e8) / 10);
  assertEquals(ni, [53.4, 45.7, 48.4, 59.5, 55.3, 57.4, 94.7, 99.8, 97.0, 93.7, 112.0]);
  for (const r of rows) {
    assertEquals(r.net_income, (r.pretax_income as number) - (r.income_tax as number));
    assertEquals(r.free_cash_flow, (r.operating_cash_flow as number) - (r.capex as number));
    assert((r.gross_profit as number) < (r.revenue as number));
    assert(
      Math.abs((r.eps_diluted as number) - (r.net_income as number) / (r.shares_diluted as number)) < 0.03,
    );
  }
  // A fresh copy each call.
  rows[0].revenue = 1;
  assertEquals(sampleAppleFacts()[0].revenue, 233_715_000_000);
});
