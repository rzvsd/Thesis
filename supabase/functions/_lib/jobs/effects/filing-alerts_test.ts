import { assertEquals } from "jsr:@std/assert@1.0.13";
import {
  dispatchFilingChangeAlerts,
  filingAlertEmailText,
  findPriorDeepDive,
  noopNotifier,
} from "./filing-alerts.ts";
import { FakeEffectsStore } from "./testing/fake_store.ts";
import { deepDiveFixture } from "./testing/report_fixture.ts";
import type { ReportRecord } from "../types.ts";
import type { AnalysisReport } from "../types.ts";
import type { FilingAlertNotifier } from "./types.ts";

const prior: ReportRecord = {
  id: "rpt_0",
  jobId: "job_0",
  type: "deep_dive",
  ticker: "AAPL",
  schemaVersion: "2.0",
  artifactKey: "reports/rpt_0.json",
  fingerprint: "AAPL|2.0|2026Q2",
  createdAt: "2026-08-01T00:00:00.000Z",
  isCurrent: true,
};

const report = deepDiveFixture({
  signal: { value: "negative" },
  filing_intelligence: {
    latest_filing: { form: "10-Q", accession_number: "0000320193-26-000100" },
    top_changes: [" Revenue fell ", "", "Buyback paused", "Debt up", "Fourth"],
    memo: { what_changed: "ignored" },
  },
});

function depsFor(store: FakeEffectsStore, notifier: FilingAlertNotifier = noopNotifier) {
  return {
    store,
    notifier,
    readReport: () => Promise.resolve(deepDiveFixture({ signal: { value: "positive" } }) as AnalysisReport),
    now: () => new Date("2026-11-20T13:00:00.000Z"),
  };
}

Deno.test("findPriorDeepDive only looks for deep dives with a ticker", async () => {
  const store = new FakeEffectsStore();
  store.priorReport = prior;
  assertEquals(await findPriorDeepDive(store, report), prior);
  assertEquals(await findPriorDeepDive(store, deepDiveFixture({ ticker: undefined })), undefined);
});

Deno.test("noopNotifier: followers with a channel get partial_failure, without one get sent", async () => {
  const store = new FakeEffectsStore();
  store.watchlists.set("u1", ["AAPL"]);
  store.watchlists.set("u2", ["aapl "]);
  store.watchlists.set("u3", ["MSFT"]);
  store.pushTargets = [{ userId: "u1", installationId: "i1", deviceToken: "t1" }];
  await dispatchFilingChangeAlerts(depsFor(store), { report, prior });

  assertEquals(store.alerts.length, 2);
  const [first, second] = store.alerts;
  assertEquals(first.userId, "u1");
  assertEquals(first.deliveryState, "partial_failure");
  assertEquals(second.userId, "u2");
  assertEquals(second.deliveryState, "sent");
  assertEquals(first.title, "AAPL filed its 10-Q");
  assertEquals(first.body, "4 things changed since the last Deep Dive (2026Q3).");
  assertEquals(
    first.detailBody,
    "- Revenue fell\n- Buyback paused\n- Debt up\n- Signal moved from positive to negative since the last Deep Dive.",
  );
  assertEquals(first.context, {
    ticker: "AAPL",
    report_id: "rpt_1",
    filing_form: "10-Q",
    filing_period: "2026Q3",
    filing_accession: "0000320193-26-000100",
  });
  assertEquals(first.id.startsWith("filing_"), true);

  // Second run: the ledger id is stable, so nothing is sent or written twice.
  await dispatchFilingChangeAlerts(depsFor(store), { report, prior });
  assertEquals(store.alerts.length, 2);
});

Deno.test("dispatchFilingChangeAlerts respects disabled preference and sends email/push payloads", async () => {
  const store = new FakeEffectsStore();
  store.watchlists.set("u1", ["AAPL"]);
  store.watchlists.set("u2", ["AAPL"]);
  store.preferences.set("u2", [{ type: "filing_change", enabled: false }]);
  store.tiers.set("u1", "PRO");
  store.emailTargets = [{ userId: "u1", email: "x@example.com" }];
  store.pushTargets = [{ userId: "u1", installationId: "i1", deviceToken: "t1" }];
  const sent: string[] = [];
  const notifier: FilingAlertNotifier = {
    sendPush: (targets, payload) => {
      sent.push(`push:${payload.data.reason_code}`);
      return Promise.resolve({ failed: 0, invalidTargets: targets });
    },
    sendEmail: (_targets, payload) => {
      sent.push(`email:${payload.headers?.["List-Unsubscribe"]}`);
      return Promise.resolve({ failed: 0 });
    },
    emailUnsubscribeUrl: (userId) => `https://api.example/unsub?u=${userId}`,
  };
  await dispatchFilingChangeAlerts(depsFor(store, notifier), { report, prior });
  assertEquals(sent, ["push:new_filing", "email:<https://api.example/unsub?u=u1>"]);
  assertEquals(store.invalidatedDevices, ["u1:i1"]);
  assertEquals(store.alerts.map((alert) => [alert.userId, alert.deliveryState]), [["u1", "sent"]]);
});

Deno.test("dispatchFilingChangeAlerts skips same or older periods and never throws", async () => {
  const store = new FakeEffectsStore();
  store.watchlists.set("u1", ["AAPL"]);
  await dispatchFilingChangeAlerts(depsFor(store), {
    report: deepDiveFixture({ historical_context: { latest_period: "2026Q2" } }),
    prior,
  });
  await dispatchFilingChangeAlerts(depsFor(store), { report, prior: undefined });
  await dispatchFilingChangeAlerts(depsFor(store), {
    report,
    prior: { ...prior, fingerprint: "AAPL|2.0|LATEST_UNKNOWN" },
  });
  assertEquals(store.alerts.length, 0);

  store.listUsersWithWatchlist = () => Promise.reject(new Error("db down"));
  await dispatchFilingChangeAlerts(depsFor(store), { report, prior });
});

Deno.test("filingAlertEmailText shows changes to PRO and the headline to FREE", () => {
  const change = {
    ticker: "AAPL",
    reportId: "r",
    form: "10-Q",
    period: "2026Q3",
    filingKey: "k",
    title: "AAPL filed its 10-Q",
    body: "1 thing changed since the last Deep Dive (2026Q3).",
    changes: ["Revenue fell"],
  };
  assertEquals(filingAlertEmailText(change, undefined, true).includes("- Revenue fell"), true);
  const free = filingAlertEmailText(change, "https://u", false);
  assertEquals(free.includes("Upgrade to Thesis Pro"), true);
  assertEquals(free.endsWith("Stop all Thesis notification emails: https://u"), true);
});
