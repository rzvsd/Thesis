import { assertEquals } from "jsr:@std/assert@1.0.13";
import { deleteHolding, listHoldings, toHoldingView, upsertHolding } from "./holdings.ts";
import { cleanup, dbTest, insertUser } from "./profile_testdb.ts";

dbTest("holdings upsert maps numerics to numbers and overwrites on conflict", async () => {
  const user = await insertUser();
  try {
    const first = await upsertHolding(user, {
      ticker: "aapl",
      quantity: 2.5,
      costBasis: 170.25,
      label: "Core",
    });
    assertEquals([first.ticker, first.quantity, first.costBasis, first.label, first.notes], [
      "AAPL",
      2.5,
      170.25,
      "Core",
      undefined,
    ]);
    assertEquals(typeof first.updatedAt, "string");
    const second = await upsertHolding(user, { ticker: "AAPL", quantity: 3 });
    assertEquals([second.quantity, second.costBasis, second.label], [3, undefined, undefined]);
    await upsertHolding(user, { ticker: "MSFT" });
    const list = await listHoldings(user);
    assertEquals(list.map((h) => h.ticker), ["AAPL", "MSFT"]);
    assertEquals(Object.keys(toHoldingView(list[1])), ["ticker", "updated_at"]);
    assertEquals(await deleteHolding(user, "aapl"), true);
    assertEquals(await deleteHolding(user, "AAPL"), false);
  } finally {
    await cleanup([user], []);
  }
});
