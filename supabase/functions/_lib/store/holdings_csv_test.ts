import { assertEquals } from "jsr:@std/assert@1.0.13";
import { parseAmount, parseHoldingsCsv, splitCsvLine } from "./holdings_csv.ts";

Deno.test("splitCsvLine handles quotes and escaped quotes", () => {
  assertEquals(splitCsvLine('AAPL, "1,000" ,"say ""hi"""'), ["AAPL", "1,000", 'say "hi"']);
  assertEquals(splitCsvLine(""), [""]);
});

Deno.test("parseAmount accepts broker formats and rejects negatives", () => {
  assertEquals(parseAmount("$1,234.50"), 1234.5);
  assertEquals(parseAmount(" "), undefined);
  assertEquals(parseAmount(undefined), undefined);
  assertEquals(parseAmount("-1"), null);
  assertEquals(parseAmount("abc"), null);
});

Deno.test("parseHoldingsCsv reads header aliases in any order", () => {
  const parsed = parseHoldingsCsv("cost,QUANTITY,symbol\n1,2,AAPL\n\n");
  assertEquals(parsed, {
    ok: true,
    columns: { ticker: 2, shares: 1, cost_basis: 0 },
    rows: [{ line: 2, cells: ["1", "2", "AAPL"] }],
  });
});
