import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const fixtureDir = resolve(
  "C:/BOTS/Thesis/fintech/Project Note/DeepDive/Milestones/M9/evidence/2026-04-22",
);

const aaplReport = JSON.parse(
  readFileSync(resolve(fixtureDir, "m9_due_diligence_aapl_2026-04-22.json"), "utf8"),
);
const nvdaReport = JSON.parse(
  readFileSync(resolve(fixtureDir, "m9_due_diligence_nvda_2026-04-22.json"), "utf8"),
);

const reportsById = new Map([
  [aaplReport.report_id, aaplReport],
  [nvdaReport.report_id, nvdaReport],
]);

const reportHistory = [aaplReport, nvdaReport].map((report) => ({
  report_id: report.report_id,
  job_id: report.job_id,
  type: report.type ?? "deep_dive",
  ticker: report.ticker ?? null,
  created_at: report.generated_at ?? "2026-04-22T00:00:00.000Z",
}));

const authTokens = {
  access_token: "fixture-access-token",
  refresh_token: "fixture-refresh-token",
  access_token_expires_at: "2035-01-01T00:00:00.000Z",
  refresh_token_expires_at: "2035-06-01T00:00:00.000Z",
};

const pulsePayload = {
  report_id: "fixture-pulse-2026-04-22",
  generated_at: "2026-04-22T08:00:00.000Z",
  sections: {
    macro_stress: {
      section_id: "macro_stress",
      title: "Macro Stress",
      body: "Macro pressure remains balanced, with no exceptional stress signal in the current fixture run.",
      status: "complete",
      evidence: [],
    },
    market_moves: {
      section_id: "market_moves",
      title: "Market Moves",
      body: "Major indices are stable in the fixture environment while research proofs run.",
      status: "complete",
      evidence: [],
    },
    watchlist_overlay: {
      section_id: "watchlist_overlay",
      title: "Watchlist Overlay",
      body: "AAPL and NVDA are ready for Deep Dive review in the local fixture server.",
      status: "complete",
      evidence: [],
    },
  },
};

const macroStressCurrent = {
  data: {
    id: "fixture-macro-stress",
    market_date: "2026-04-22",
    score: 51,
    label: "balanced",
    calculated_at: "2026-04-22T08:00:00.000Z",
    sub_scores: [
      {
        input_name: "Rates",
        provider: "fixture",
        available: true,
        weight: 0.4,
        normalized_score: 54,
        raw_value: 54,
      },
      {
        input_name: "Credit",
        provider: "fixture",
        available: true,
        weight: 0.3,
        normalized_score: 48,
        raw_value: 48,
      },
      {
        input_name: "Volatility",
        provider: "fixture",
        available: true,
        weight: 0.3,
        normalized_score: 50,
        raw_value: 50,
      },
    ],
    missing_inputs: [],
  },
};

const macroStressHistory = {
  data: [
    macroStressCurrent.data,
    {
      ...macroStressCurrent.data,
      id: "fixture-macro-stress-prior",
      market_date: "2026-04-21",
      score: 49,
      calculated_at: "2026-04-21T08:00:00.000Z",
    },
  ],
};

const emptyData = { data: [] };

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function notFound(res, errorCode = "not_found", message = "Not found.") {
  json(res, 404, { error: errorCode, error_message: message });
}

function parseBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch (error) {
        rejectBody(error);
      }
    });
    req.on("error", rejectBody);
  });
}

function requireFixtureAuth(req, res) {
  const header = req.headers.authorization ?? "";
  if (header === `Bearer ${authTokens.access_token}`) {
    return true;
  }
  json(res, 401, { error: "unauthorized", error_message: "Fixture token missing or invalid." });
  return false;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  try {
    if (req.method === "POST" && path === "/auth/login") {
      const body = await parseBody(req);
      if ((body.email ?? "").trim() && (body.password ?? "").trim()) {
        json(res, 200, authTokens);
        return;
      }
      json(res, 400, { error: "invalid_credentials", error_message: "Email and password are required." });
      return;
    }

    if (req.method === "POST" && path === "/auth/refresh") {
      json(res, 200, authTokens);
      return;
    }

    if (req.method === "POST" && path === "/auth/logout") {
      json(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "POST" && path === "/notifications/device-token") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "GET" && path === "/v1/user/profile") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, {
        data: {
          user_id: "fixture-user",
          email: "m9@example.com",
          tier: "FREE",
          billing_period_end: null,
          watchlist_limit: 5,
          daily_deep_dive_limit: 5,
          deep_dives_remaining_today: 5,
        },
      });
      return;
    }

    if (req.method === "GET" && path === "/v1/user/notification-preferences") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, {
        data: {
          preferences: [
            { type: "earnings_preview", enabled: true },
            { type: "market_pulse_ready", enabled: true },
          ],
        },
      });
      return;
    }

    if (req.method === "GET" && path === "/v1/user/alerts") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, emptyData);
      return;
    }

    if (req.method === "GET" && path === "/v1/user/monitor-snapshots") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, {
        data: [
          {
            ticker: "AAPL",
            state: "stable",
            reason: "Fixture monitor state remains stable.",
            score: 0.74,
            report_id: aaplReport.report_id,
            report_generated_at: aaplReport.generated_at,
            report_schema_version: aaplReport.schema_version,
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && path === "/watchlist") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, { data: ["AAPL", "NVDA"] });
      return;
    }

    if (req.method === "GET" && path === "/pulse/latest") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, pulsePayload);
      return;
    }

    if (req.method === "GET" && path.startsWith("/pulse/")) {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, pulsePayload);
      return;
    }

    if (req.method === "GET" && path === "/v1/macro-stress/current") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, macroStressCurrent);
      return;
    }

    if (req.method === "GET" && path === "/v1/macro-stress/history") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, macroStressHistory);
      return;
    }

    if (req.method === "GET" && path === "/reports") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, reportHistory);
      return;
    }

    if (req.method === "GET" && path.startsWith("/reports/")) {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      const reportId = decodeURIComponent(path.slice("/reports/".length));
      const report = reportsById.get(reportId);
      if (!report) {
        notFound(res, "report_not_found", "Fixture report was not found.");
        return;
      }
      json(res, 200, report);
      return;
    }

    if (req.method === "GET" && path.startsWith("/v1/reports/") && path.endsWith("/note")) {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      notFound(res, "note_not_found", "No note is stored for the fixture report.");
      return;
    }

    if (req.method === "GET" && path === "/v1/conviction/timeline") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, emptyData);
      return;
    }

    if (req.method === "GET" && path === "/v1/conviction/insights") {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      json(res, 200, emptyData);
      return;
    }

    if (req.method === "GET" && /^\/v1\/reports\/[^/]+\/opposite-case$/.test(path)) {
      if (!requireFixtureAuth(req, res)) {
        return;
      }
      notFound(res, "opposite_case_not_found", "No opposite case exists for the fixture report.");
      return;
    }

    notFound(res);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "fixture_server_error", error_message: error.message ?? "Fixture server error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`M9 mobile fixture server listening on http://${HOST}:${PORT}`);
  console.log(`AAPL report id: ${aaplReport.report_id}`);
  console.log(`NVDA report id: ${nvdaReport.report_id}`);
});
