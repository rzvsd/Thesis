import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

async function closeServer(server: ReturnType<typeof startServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function requestJson(
  baseUrl: string,
  path: string,
  options: {
    method: string;
    body?: JsonObject;
    headers?: Record<string, string>;
  }
): Promise<{ status: number; payload: JsonObject }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: {
      "content-type": "application/json",
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = (await response.json()) as JsonObject;
  return {
    status: response.status,
    payload
  };
}

async function requestBinary(
  baseUrl: string,
  path: string,
  options: {
    method: string;
    headers?: Record<string, string>;
  }
): Promise<{
  status: number;
  headers: Headers;
  bytes: Buffer;
}> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: options.headers
  });
  const arrayBuffer = await response.arrayBuffer();
  return {
    status: response.status,
    headers: response.headers,
    bytes: Buffer.from(arrayBuffer)
  };
}

async function createVerifiedSession(baseUrl: string, email: string): Promise<{
  accessToken: string;
  internalToken: string;
}> {
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email,
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(register.status, 201);
  const verificationToken = register.payload.verification_token;
  assert.equal(typeof verificationToken, "string");

  const verify = await requestJson(baseUrl, "/auth/verify", {
    method: "POST",
    body: {
      token: verificationToken as string
    }
  });
  assert.equal(verify.status, 200);

  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      email,
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(login.status, 200);
  const accessToken = login.payload.access_token;
  assert.equal(typeof accessToken, "string");

  return {
    accessToken: accessToken as string,
    internalToken: process.env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token"
  };
}

function sampleInstitutionalReport(jobId: string, reportId: string): JsonObject {
  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: "2.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-04-20T08:00:00.000Z",
    confidence: {
      score: 0.74,
      label: "medium",
      limiting_factors: ["transcript_delay"]
    },
    signal: {
      value: "positive",
      reasons: ["Cash conversion remains resilient."],
      evidence: []
    },
    story_header: {
      headline: "Cash resilience is outpacing market skepticism.",
      thesis_summary: "AAPL keeps converting demand into durable cash generation.",
      why_now: "The next review window centers on margin resilience and buyback pacing.",
      reader_takeaway: "Base thesis remains intact with moderate upside and clear risk controls.",
      stance_label: "positive"
    },
    change_summary: {
      previous_view: "Margin pressure risk dominated.",
      current_view: "Margin pressure eased while free cash flow remained durable.",
      top_changes: [
        {
          title: "Operating margin stabilized",
          direction: "up",
          impact_level: "high",
          why_it_changed: "Cost controls offset slower top-line momentum.",
          why_it_matters: "Thesis depends on growth converting into durable operating profit."
        }
      ]
    },
    valuation: {
      fair_value_mid: 208.0,
      fair_value_low: 178.0,
      fair_value_high: 236.0,
      spot_price: 191.0,
      implied_upside_pct: 8.9,
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: 5,
        terminal_growth_rate: 0.025,
        wacc: 0.095
      }
    },
    investment_memo: {
      prompt_version: "m4-synthesizer-fixture-v1",
      generation_mode: "deterministic_fixture",
      company_angle: "durable_cash_compounder",
      decision_question: "Does margin stability support a durable free-cash-flow compounding case?",
      sections: [
        {
          section_id: "investment_thesis",
          title: "Investment Thesis",
          narrative: "Cash conversion remains the central driver of the thesis.",
          key_points: ["Cash conversion stayed resilient.", "Capital returns remain disciplined."]
        },
        {
          section_id: "what_changed",
          title: "What Changed",
          narrative: "Cost discipline improved operating margin resilience.",
          key_points: ["Operating leverage improved year over year."]
        },
        {
          section_id: "business_quality",
          title: "Business Quality",
          narrative: "Ecosystem durability continues to support margin quality.",
          key_points: ["Recurring revenue mix supports resilience."]
        },
        {
          section_id: "valuation",
          title: "Valuation",
          narrative: "Base valuation remains sensitive to WACC and terminal growth.",
          key_points: ["Range remains wide enough to require risk controls."]
        },
        {
          section_id: "risks",
          title: "Risks",
          narrative: "Execution risk and demand normalization remain key watch points.",
          key_points: ["Demand normalization could pressure margin durability."]
        }
      ],
      material_claims: [
        {
          claim_id: "claim-1",
          section_id: "investment_thesis",
          statement: "Cash conversion is still supporting thesis durability.",
          materiality: "material",
          supports: [
            {
              support_type: "metric",
              ref_id: "fcf_trend",
              summary: "Free cash flow remained positive through the latest annual snapshots."
            }
          ]
        }
      ],
      unsupported_claims: [],
      sparse_data_honesty_note: "No major sparse-data blockers were detected in this fixture."
    },
    financial_analysis: {
      annual_history: [
        {
          period: "FY-2025",
          period_type: "annual",
          fiscal_year: 2025,
          revenue: 390000,
          gross_margin: 0.45,
          operating_margin: 0.31,
          free_cash_flow: 110000
        }
      ],
      quarterly_history: [],
      trend_metrics: [
        {
          key: "revenue_growth",
          label: "Revenue Growth",
          value: 0.08,
          unit: "pct",
          status: "available",
          direction: "improving"
        }
      ],
      quality_metrics: [],
      omissions: []
    },
    value_discipline: {
      score: 6,
      max_score: 9,
      available_signals: 7,
      completeness: "partial",
      context_label: "quality_mega_cap",
      interpretation: "Signals indicate durable quality, but valuation discipline still matters.",
      missing_signals: ["asset_turnover_delta"],
      does_not_prove: "This score does not replace full competitive and valuation analysis.",
      signals: [
        {
          key: "roa_positive",
          label: "ROA positive",
          family: "profitability",
          status: "pass",
          reason: "ROA remained positive in the latest annual period."
        }
      ],
      value_trap_warning: {
        triggered: false,
        summary: "No immediate value-trap profile in current evidence.",
        reason_codes: []
      }
    },
    watch_items: ["Re-check margin stability after the next earnings release."],
    coverage_truth: {
      summary: "Coverage is strong on financials, with moderate transcript freshness limits.",
      covered: ["financial_statements", "valuation_assumptions"],
      missing: ["fresh_transcript_excerpt"]
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "AAPL remains a cash-resilient thesis with moderate upside and explicit risk controls.",
        status: "complete",
        evidence: [
          {
            evidence_id: "ev-1",
            source_type: "financial_data",
            source_name: "Annual statement snapshot",
            excerpt: "Free cash flow remained positive and stable in the latest annual period.",
            retrieved_at: "2026-04-20T08:00:00.000Z"
          }
        ]
      }
    ],
    flags: [],
    data_sources: ["fixture-financials", "fixture-dexter"]
  };
}

function sampleLegacyReport(jobId: string, reportId: string): JsonObject {
  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: "1.0",
    type: "deep_dive",
    ticker: "MSFT",
    generated_at: "2026-04-20T09:00:00.000Z",
    confidence: {
      score: 0.58,
      label: "medium",
      limiting_factors: ["limited_context"]
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "Legacy report with partial context.",
        status: "complete",
        evidence: []
      }
    ],
    flags: ["legacy_fixture"],
    data_sources: ["legacy-fixture"]
  };
}

test("M5 PDF export route returns institutional multi-page artifact and enforces access", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const owner = await createVerifiedSession(baseUrl, "m5-export-owner@example.com");
    const other = await createVerifiedSession(baseUrl, "m5-export-other@example.com");
    const ownerAuth = { authorization: `Bearer ${owner.accessToken}` };
    const otherAuth = { authorization: `Bearer ${other.accessToken}` };

    const createJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: ownerAuth,
      body: { ticker: "AAPL" }
    });
    assert.equal(createJob.status, 202);
    const jobId = createJob.payload.job_id;
    assert.equal(typeof jobId, "string");

    const claim = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/claim`, {
      method: "POST",
      headers: {
        "x-internal-token": owner.internalToken
      }
    });
    assert.equal(claim.status, 200);

    const reportId = "m5-export-report-001";
    const complete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
      method: "POST",
      headers: {
        "x-internal-token": owner.internalToken
      },
      body: {
        report: sampleInstitutionalReport(jobId as string, reportId)
      }
    });
    assert.equal(complete.status, 200);

    const exportResponse = await requestBinary(baseUrl, `/v1/reports/${reportId}/export/pdf`, {
      method: "GET",
      headers: ownerAuth
    });
    assert.equal(exportResponse.status, 200);
    assert.equal(exportResponse.headers.get("content-type"), "application/pdf");
    assert.match(exportResponse.headers.get("content-disposition") ?? "", /thesis-deep-dive-AAPL/i);
    assert.ok(exportResponse.bytes.length > 1024);
    assert.equal(exportResponse.bytes.subarray(0, 8).toString("utf8"), "%PDF-1.4");

    const pdfText = exportResponse.bytes.toString("utf8");
    assert.match(pdfText, /Page 1 - Cover and One-Page Memo/);
    assert.match(pdfText, /Page 9 - Appendix/);
    assert.match(pdfText, /Page 1 of 9/);
    assert.match(pdfText, /Ticker: AAPL/);

    const blocked = await requestJson(baseUrl, `/v1/reports/${reportId}/export/pdf`, {
      method: "GET",
      headers: otherAuth
    });
    assert.equal(blocked.status, 404);
    assert.equal(blocked.payload.error, "report_not_found");
  } finally {
    await closeServer(server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  }
});

test("M5 PDF export keeps legacy report fallback exportable", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const owner = await createVerifiedSession(baseUrl, "m5-export-legacy@example.com");
    const ownerAuth = { authorization: `Bearer ${owner.accessToken}` };

    const createJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: ownerAuth,
      body: { ticker: "MSFT" }
    });
    assert.equal(createJob.status, 202);
    const jobId = createJob.payload.job_id;
    assert.equal(typeof jobId, "string");

    const claim = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/claim`, {
      method: "POST",
      headers: {
        "x-internal-token": owner.internalToken
      }
    });
    assert.equal(claim.status, 200);

    const reportId = "m5-export-legacy-report-001";
    const complete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
      method: "POST",
      headers: {
        "x-internal-token": owner.internalToken
      },
      body: {
        report: sampleLegacyReport(jobId as string, reportId)
      }
    });
    assert.equal(complete.status, 200);

    const exportResponse = await requestBinary(baseUrl, `/v1/reports/${reportId}/export/pdf`, {
      method: "GET",
      headers: ownerAuth
    });
    assert.equal(exportResponse.status, 200);
    assert.equal(exportResponse.headers.get("content-type"), "application/pdf");
    assert.equal(exportResponse.bytes.subarray(0, 8).toString("utf8"), "%PDF-1.4");
    const pdfText = exportResponse.bytes.toString("utf8");
    assert.match(pdfText, /Page 9 - Appendix/);
    assert.match(pdfText, /omitted/i);
  } finally {
    await closeServer(server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  }
});
