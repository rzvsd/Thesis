import assert from "node:assert/strict";
import test from "node:test";

import { buildFactPack } from "../../src/fact-pack/build";
import { ingestBodyFromPack, postFinancialsIngest } from "../../src/fact-pack/ingest";
import { DEFAULT_SEC_USER_AGENT, SecClient, SecHttpError } from "../../src/fact-pack/sec-client";
import { runFactPackStep } from "../../src/fact-pack/step";
import { CIK, FAST, SEC, TICKERS, acmeRoutes, fakeSec } from "./sec-samples";

const NOW = () => new Date("2025-02-15T12:00:00.000Z");

test("SEC client sends the User-Agent, retries 503 and 429, and does not retry 404", async () => {
  let calls = 0;
  const seen: Array<string | null> = [];
  const client = new SecClient({
    ...FAST,
    userAgent: "Thesis test ops@example.test",
    fetchImpl: (_url, init) => {
      calls += 1;
      seen.push(new Headers(init?.headers).get("user-agent"));
      if (calls === 1) return Promise.resolve(new Response("", { status: 503 }));
      if (calls === 2) return Promise.resolve(new Response("", { status: 429, headers: { "retry-after": "1" } }));
      return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
    }
  });
  assert.deepEqual(await client.getJson("https://data.sec.gov/x"), { ok: true });
  assert.equal(calls, 3);
  assert.deepEqual(seen, Array(3).fill("Thesis test ops@example.test"));

  let notFound = 0;
  const strict = new SecClient({
    ...FAST,
    fetchImpl: () => {
      notFound += 1;
      return Promise.resolve(new Response("", { status: 404 }));
    }
  });
  await assert.rejects(strict.getJson("https://data.sec.gov/y"), (error: unknown) => {
    return error instanceof SecHttpError && error.status === 404;
  });
  assert.equal(notFound, 1);
});

test("SEC client gives up after two retries and uses the default User-Agent", async () => {
  const fake = fakeSec({ "https://data.sec.gov/z": 500 });
  const client = new SecClient({ ...FAST, fetchImpl: fake.fetch });
  await assert.rejects(client.getJson("https://data.sec.gov/z"), SecHttpError);
  assert.equal(fake.calls.length, 3);
  assert.equal(fake.calls[0]?.userAgent, DEFAULT_SEC_USER_AGENT);
});

test("SEC client spaces request starts to stay under 8 a second", async () => {
  const waits: number[] = [];
  const client = new SecClient({
    minIntervalMs: 125,
    now: () => 1_000,
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
    fetchImpl: () => Promise.resolve(new Response("{}", { status: 200 }))
  });
  await Promise.all([client.getJson("a"), client.getJson("b"), client.getJson("c")]);
  assert.deepEqual(waits, [125, 250]);
});

test("buildFactPack: a full pack from the three SEC files", async () => {
  const sec = fakeSec(acmeRoutes());
  const pack = await buildFactPack("acme", { clientOptions: { ...FAST, fetchImpl: sec.fetch }, now: NOW });
  assert.ok(pack);
  assert.equal(pack.version, 1);
  assert.equal(pack.source, "sec_companyfacts");
  assert.equal(pack.ticker, "ACME");
  assert.equal(pack.cik, CIK);
  assert.equal(pack.entity_name, "Acme Devices Inc.");
  assert.equal(pack.currency, "USD");
  assert.equal(pack.fiscal_year_end, "0928");
  assert.equal(pack.sic, "3571");
  assert.equal(pack.state_of_incorporation, "CA");
  assert.equal(pack.retrieved_at, "2025-02-15T12:00:00.000Z");
  assert.equal(pack.latest_filing?.period_label, "2025-Q1");
  assert.deepEqual(
    pack.annual.map((row) => row.fiscal_year),
    [2021, 2022, 2023, 2024]
  );
  assert.equal(pack.filings.length, 4);
  assert.equal(pack.price_at_filing, null);
  for (const always of ["segments", "regions", "owners", "price_at_filing"]) {
    assert.ok(pack.missing.includes(always), always);
  }
  // Missing in the latest year.
  assert.ok(pack.missing.includes("buybacks"));
  assert.ok(pack.missing.includes("pretax_income"));
  assert.ok(!pack.missing.includes("revenue"));
  assert.ok(pack.sources.some((source) => /restated/.test(source.name)));
  assert.equal(sec.calls.length, 3);
});

test("buildFactPack never throws: unknown ticker, SEC down, network error, odd JSON", async () => {
  const unknown = fakeSec(acmeRoutes());
  assert.equal(await buildFactPack("ZZZZ", { clientOptions: { ...FAST, fetchImpl: unknown.fetch } }), null);
  assert.equal(unknown.calls.length, 1);

  const down = fakeSec({ [SEC.tickers]: 503 });
  assert.equal(await buildFactPack("ACME", { clientOptions: { ...FAST, fetchImpl: down.fetch } }), null);

  const broken = fakeSec({ [SEC.tickers]: new Error("socket hang up") });
  assert.equal(await buildFactPack("ACME", { clientOptions: { ...FAST, fetchImpl: broken.fetch } }), null);

  const odd = fakeSec({ [SEC.tickers]: TICKERS, [SEC.submissions(CIK)]: { cik: 1 }, [SEC.facts(CIK)]: { facts: 7 } });
  const pack = await buildFactPack("ACME", { clientOptions: { ...FAST, fetchImpl: odd.fetch } });
  assert.ok(pack);
  assert.deepEqual(pack.annual, []);
  assert.equal(pack.latest_filing, null);
  assert.ok(pack.missing.includes("annual") && pack.missing.includes("latest_filing"));

  assert.equal(await buildFactPack("", {}), null);
  assert.equal(await buildFactPack(undefined as unknown as string, {}), null);
});

test("buildFactPack: no company facts yet (404) still gives the latest filing", async () => {
  const routes = acmeRoutes();
  delete routes[SEC.facts(CIK)];
  const sec = fakeSec(routes);
  const pack = await buildFactPack("ACME", { clientOptions: { ...FAST, fetchImpl: sec.fetch } });
  assert.ok(pack);
  assert.deepEqual(pack.annual, []);
  assert.ok(pack.missing.includes("xbrl_facts"));
  // Without facts the 10-Q's quarter cannot be counted, so the newest 10-K with its own period wins.
  assert.equal(pack.latest_filing?.form, "10-K");
});

test("ingest body: canonical keys, margins in percent, missing fields listed", async () => {
  const pack = await buildFactPack("ACME", { clientOptions: { ...FAST, fetchImpl: fakeSec(acmeRoutes()).fetch } });
  assert.ok(pack);
  const body = ingestBodyFromPack(pack);
  assert.equal(body.ticker, "ACME");
  assert.equal(body.provider, "sec_companyfacts");
  assert.equal(body.latest_period, "2025-Q1");
  const fy2024 = body.snapshots.find((snapshot) => snapshot.period === "2024-FY")!;
  assert.equal(fy2024.period_type, "annual");
  assert.equal(fy2024.fiscal_year, 2024);
  assert.equal(fy2024.filing_date, "2024-11-01");
  assert.equal(fy2024.data.gross_margin, 46.04);
  assert.equal(fy2024.data.operating_margin, 31.46);
  assert.equal(fy2024.data.capital_expenditure, 9.4e9);
  assert.equal(fy2024.data.cash_and_equivalents, 29.9e9);
  assert.equal(fy2024.data.shareholders_equity, 57e9);
  assert.deepEqual(fy2024.missing_fields, []);
  assert.ok(body.snapshots.find((snapshot) => snapshot.period === "2021-FY")!.missing_fields.includes("debt_total"));
});

test("ingest post: token header, URL, failures logged and swallowed", async () => {
  const pack = await buildFactPack("ACME", { clientOptions: { ...FAST, fetchImpl: fakeSec(acmeRoutes()).fetch } });
  assert.ok(pack);
  const seen: Array<{ url: string; token: string | null; body: unknown }> = [];
  const ok = await postFinancialsIngest(pack, {
    baseUrl: "https://api.example.test/functions/v1/api/",
    token: "secret-token",
    fetchImpl: (url, init) => {
      seen.push({ url, token: new Headers(init?.headers).get("x-internal-token"), body: JSON.parse(String(init?.body)) });
      return Promise.resolve(new Response('{"status":"ok"}', { status: 200 }));
    }
  });
  assert.equal(ok, true);
  assert.equal(seen[0]?.url, "https://api.example.test/functions/v1/api/internal/financials/ingest");
  assert.equal(seen[0]?.token, "secret-token");
  assert.equal((seen[0]?.body as { latest_period: string }).latest_period, "2025-Q1");

  const refused = await postFinancialsIngest(pack, {
    baseUrl: "https://api.example.test",
    token: "t",
    fetchImpl: () => Promise.resolve(new Response("{}", { status: 422 }))
  });
  assert.equal(refused, false);
  const thrown = await postFinancialsIngest(pack, {
    baseUrl: "https://api.example.test",
    token: "t",
    fetchImpl: () => Promise.reject(new Error("ECONNREFUSED"))
  });
  assert.equal(thrown, false);
});

test("fact-pack step: off switch, time box, ingest only with URL and token", async () => {
  const config = { factPackEnabled: true, secUserAgent: "Thesis test ops@example.test" };
  const sec = fakeSec(acmeRoutes());
  assert.equal(await runFactPackStep({ ticker: "ACME" }, { ...config, factPackEnabled: false }, { secFetch: sec.fetch }), null);
  assert.equal(sec.calls.length, 0);

  // SEC never answers: the time box returns null and aborts the request.
  let aborted = false;
  const hang = (_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      });
    });
  const timedOut = await runFactPackStep({ ticker: "ACME" }, config, {
    secFetch: hang,
    timeBoxMs: 20,
    build: { clientOptions: FAST }
  });
  assert.equal(timedOut, null);
  assert.equal(aborted, true);

  let ingested = 0;
  const pack = await runFactPackStep(
    { ticker: "ACME", jobId: "job-1" },
    { ...config, financialsIngestUrl: "https://api.example.test", financialsIngestToken: "tok" },
    {
      secFetch: sec.fetch,
      ingestFetch: () => {
        ingested += 1;
        return Promise.resolve(new Response("{}", { status: 200 }));
      },
      build: { clientOptions: FAST }
    }
  );
  assert.equal(pack?.latest_filing?.period_label, "2025-Q1");
  assert.equal(ingested, 1);
  assert.equal(sec.calls[0]?.userAgent, "Thesis test ops@example.test");

  await runFactPackStep({ ticker: "ACME" }, config, {
    secFetch: fakeSec(acmeRoutes()).fetch,
    ingestFetch: () => {
      ingested += 1;
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
    build: { clientOptions: FAST }
  });
  assert.equal(ingested, 1);
});
