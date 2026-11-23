import { assertEquals } from "jsr:@std/assert@1.0.13";
import { addWatchlistTicker, listWatchlistTickers, removeWatchlistTicker } from "./watchlist.ts";
import { cleanup, dbTest, insertUser } from "./profile_testdb.ts";

dbTest("watchlist add is idempotent, sorted, and remove returns the list", async () => {
  const user = await insertUser();
  try {
    assertEquals(await listWatchlistTickers(user), []);
    assertEquals(await addWatchlistTicker(user, "msft"), ["MSFT"]);
    assertEquals(await addWatchlistTicker(user, "AAPL"), ["AAPL", "MSFT"]);
    assertEquals(await addWatchlistTicker(user, "AAPL"), ["AAPL", "MSFT"]);
    assertEquals(await removeWatchlistTicker(user, "aapl"), ["MSFT"]);
    assertEquals(await removeWatchlistTicker(user, "NOPE"), ["MSFT"]);
  } finally {
    await cleanup([user], []);
  }
});
