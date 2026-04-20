import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../../..");
const envPath = path.join(rootDir, "qa", "maestro", ".maestro.env");

const baseUrl = (process.env.MAESTRO_API_BASE_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
const appId = process.env.MAESTRO_APP_ID || "com.thesis.mobile";
const deviceSerial = process.env.MAESTRO_DEVICE_SERIAL || "";
const ticker = (process.env.MAESTRO_DEEP_DIVE_TICKER || "AAPL").trim().toUpperCase();
const email = process.env.MAESTRO_TEST_EMAIL || `deepdive.qa.${Date.now()}@example.com`;
const password = process.env.MAESTRO_TEST_PASSWORD || "VeryStrongPass1!";
const internalToken = process.env.MAESTRO_INTERNAL_TOKEN || process.env.INTERNAL_WORKER_TOKEN || "dev-internal-worker-token";

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[deepdive:seed] ERROR: ${message}`);
  process.exit(1);
});

async function main() {
  await ensureHealth();

  const register = await request("POST", "/auth/register", {
    body: { email, password }
  });
  if (register.verification_token) {
    await request("POST", "/auth/verify", {
      body: { token: register.verification_token }
    });
  }

  const login = await request("POST", "/auth/login", {
    body: { email, password }
  });
  const accessToken = requiredString(login.access_token, "Login did not return an access token.");

  const created = await request("POST", "/jobs", {
    accessToken,
    body: { ticker }
  });
  const jobId = requiredString(created.job_id, "Create job did not return a job_id.");

  await request("POST", `/internal/jobs/${jobId}/claim`, {
    headers: { "x-internal-token": internalToken }
  });

  const reportId = `deepdive-story-${Date.now()}`;
  await request("POST", `/internal/jobs/${jobId}/complete`, {
    headers: { "x-internal-token": internalToken },
    body: { report: buildReport(jobId, reportId) }
  });

  await writeFile(
    envPath,
    [
      `MAESTRO_APP_ID=${appId}`,
      `MAESTRO_DEVICE_SERIAL=${deviceSerial}`,
      `MAESTRO_API_BASE_URL=${baseUrl}`,
      `MAESTRO_TEST_EMAIL=${email}`,
      `MAESTRO_TEST_PASSWORD=${password}`,
      `MAESTRO_DEEP_DIVE_TICKER=${ticker}`,
      `MAESTRO_SEEDED_REPORT_ID=${reportId}`,
      "MAESTRO_DEEP_DIVE_AVAILABLE=true"
    ].join("\n") + "\n",
    "utf8"
  );

  console.log(`[deepdive:seed] Seeded ${ticker} report ${reportId}`);
  console.log(`[deepdive:seed] Wrote ${envPath}`);
}

async function ensureHealth() {
  const response = await request("GET", "/health");
  if (response.status && response.status !== "ok") {
    throw new Error("Product API health response was not ok.");
  }
}

async function request(method, pathName, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };
  if (options.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const rawBody = await response.text();
  let json = {};
  if (rawBody.trim()) {
    try {
      json = JSON.parse(rawBody);
    } catch {
      json = {};
    }
  }
  if (response.status >= 400) {
    throw new Error(`${method} ${pathName} failed: HTTP ${response.status} ${rawBody}`.trim());
  }
  return json;
}

function buildReport(jobId, reportId) {
  const now = new Date().toISOString();
  const evidence = {
    evidence_id: "ev-1",
    source_type: "article",
    source_name: "fixture-news",
    excerpt: "Revenue growth remained stable.",
    retrieved_at: now,
    url: "https://example.com/news"
  };

  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: "2.0",
    type: "deep_dive",
    ticker,
    generated_at: now,
    confidence: {
      score: 0.68,
      label: "medium",
      limiting_factors: ["Fixture evidence is sufficient for UI smoke, not an investment recommendation."]
    },
    signal: {
      value: "neutral",
      reasons: ["Evidence threshold met for a balanced thesis."],
      evidence: [evidence]
    },
    historical_context: {
      latest_period: "2025-Q4",
      prior_quarter_period: "2025-Q3",
      year_ago_period: "2024-Q4",
      transcript_period: "2025-Q4",
      financial_snapshot_count: 6,
      transcript_count: 2,
      transcript_available: true,
      missing_reasons: []
    },
    story_header: {
      headline: `${ticker}: services strength keeps the thesis intact`,
      thesis_summary: "The thesis is intact, but hardware recovery still matters.",
      why_now: "Revenue improved while valuation stayed disciplined.",
      reader_takeaway: "Read what changed first, then check the proof layer.",
      stance_label: "neutral"
    },
    change_summary: {
      previous_view: "Prior thesis watched hardware weakness.",
      current_view: "Current evidence is stable but not decisive.",
      top_changes: [
        {
          title: "Revenue reset the tone",
          direction: "up",
          impact_level: "high",
          why_it_changed: "Revenue improved in the latest period.",
          why_it_matters: "Revenue quality determines whether the thesis can hold."
        }
      ]
    },
    visual_panels: [
      {
        type: "trust_scorecard",
        title: "Trust and Freshness",
        freshness_state: "fresh",
        contradiction_state: "none",
        valuation_state: "available",
        evidence_count: 1
      },
      {
        type: "metric_delta",
        title: "Quarter-over-quarter moves",
        metrics: [
          {
            label: "Revenue",
            current_value: 100,
            reference_value: 90,
            delta_pct: 11.1,
            basis: "qoq",
            direction: "up"
          }
        ]
      },
      {
        type: "evidence_ladder",
        title: "Evidence Ladder",
        rungs: [
          {
            label: "Primary evidence",
            count: 1,
            tone: "strong"
          }
        ]
      }
    ],
    explainers: {
      signal: "Signal explains the directional call.",
      confidence: "Confidence explains the limits.",
      freshness: "Freshness explains whether the report is current.",
      valuation: "Valuation explains the modeled range.",
      omissions: "Omissions explain what is missing."
    },
    watch_items: [
      "Watch margin quality.",
      "Watch whether services growth offsets hardware softness."
    ],
    coverage_truth: {
      summary: "The report states what it covers and what is missing.",
      covered: ["Latest financial snapshot", "Fixture evidence"],
      missing: ["Live provider data was not required for this UI smoke."]
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: `${ticker} thesis statement sample.`,
        status: "complete",
        evidence: []
      },
      {
        section_id: "executive_summary",
        title: "Executive Summary",
        body: "Sample deep dive report.",
        status: "complete",
        evidence: []
      },
      {
        section_id: "evidence_references",
        title: "Evidence References",
        body: "Fixture evidence reference.",
        status: "complete",
        evidence: [evidence]
      }
    ],
    flags: [],
    data_sources: ["fixture-news"]
  };
}

function requiredString(value, message) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  throw new Error(message);
}
