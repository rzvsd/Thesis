import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import test from "node:test";

import type { AnalysisReport, MarketPulseReport } from "../../../packages/contracts/src";
import {
  buildDebateExperimentArtifact,
  buildHistoricalReplayArtifact,
  buildReplayEvaluationArtifact
} from "../src/research-lab";
import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function quarterForIsoDate(value: string): string {
  const month = Number(value.slice(5, 7));
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `${value.slice(0, 4)}-Q${quarter}`;
}

function structuralPayload(input: {
  asOf: string;
  subjectType: "issuer" | "market_pulse";
  subjectId: string;
  issuerMetadata?: Record<string, string>;
}): JsonObject {
  const asOfYear = input.asOf.slice(0, 4);
  const observations =
    input.subjectType === "issuer"
      ? [
          {
            observation_id: "wb-gdp-per-capita",
            family: "gdp_per_capita",
            label: "GDP per capita",
            summary: "The United States remains a high-income demand base for premium devices and services.",
            geography: "United States",
            period: asOfYear,
            source_family: "world_bank",
            retrieval: {
              source: {
                source_id: "WB_NY.GDP.PCAP.CD",
                source_family: "world_bank",
                source_name: "World Bank GDP per capita",
                source_url: "https://api.worldbank.org/",
                agency: "World Bank",
                agency_series_id: "NY.GDP.PCAP.CD"
              },
              retrieved_at: `${input.asOf}T12:00:00.000Z`,
              retrieval_status: "fresh",
              source_period: asOfYear
            },
            missing_fields: [],
            value: 82000,
            unit: "usd"
          },
          {
            observation_id: "wb-sector-mix",
            family: "sector_mix",
            label: "Sector mix",
            summary: "Services-heavy sector mix stays supportive for recurring revenue and ecosystem monetization.",
            geography: "United States",
            period: asOfYear,
            source_family: "world_bank",
            retrieval: {
              source: {
                source_id: "WB_NV.SRV.TOTL.ZS",
                source_family: "world_bank",
                source_name: "World Bank Services share of GDP",
                source_url: "https://api.worldbank.org/",
                agency: "World Bank",
                agency_series_id: "NV.SRV.TOTL.ZS"
              },
              retrieved_at: `${input.asOf}T12:00:00.000Z`,
              retrieval_status: "fresh",
              source_period: asOfYear
            },
            missing_fields: [],
            value: 76.3,
            unit: "pct_gdp"
          },
          {
            observation_id: "wb-population",
            family: "population",
            label: "Population",
            summary: "Population scale still supports a large installed base and a wide distribution surface.",
            geography: "United States",
            period: asOfYear,
            source_family: "world_bank",
            retrieval: {
              source: {
                source_id: "WB_SP.POP.TOTL",
                source_family: "world_bank",
                source_name: "World Bank Population",
                source_url: "https://api.worldbank.org/",
                agency: "World Bank",
                agency_series_id: "SP.POP.TOTL"
              },
              retrieved_at: `${input.asOf}T12:00:00.000Z`,
              retrieval_status: "fresh",
              source_period: asOfYear
            },
            missing_fields: [],
            value: 337000000,
            unit: "people"
          },
          {
            observation_id: "wb-energy-access",
            family: "energy_access",
            label: "Energy access",
            summary: "Energy access remains broad enough that nationwide operations are not constrained by basic availability.",
            geography: "United States",
            period: asOfYear,
            source_family: "world_bank",
            retrieval: {
              source: {
                source_id: "WB_EG.ELC.ACCS.ZS",
                source_family: "world_bank",
                source_name: "World Bank Energy access",
                source_url: "https://api.worldbank.org/",
                agency: "World Bank",
                agency_series_id: "EG.ELC.ACCS.ZS"
              },
              retrieved_at: `${input.asOf}T12:00:00.000Z`,
              retrieval_status: "fresh",
              source_period: asOfYear
            },
            missing_fields: [],
            value: 100,
            unit: "pct"
          },
          {
            observation_id: "wb-debt-context",
            family: "debt_context",
            label: "Debt context",
            summary: "Debt context keeps policy sensitivity in view even when company execution remains strong.",
            geography: "United States",
            period: asOfYear,
            source_family: "world_bank",
            retrieval: {
              source: {
                source_id: "WB_GC.DOD.TOTL.GD.ZS",
                source_family: "world_bank",
                source_name: "World Bank Debt context",
                source_url: "https://api.worldbank.org/",
                agency: "World Bank",
                agency_series_id: "GC.DOD.TOTL.GD.ZS"
              },
              retrieved_at: `${input.asOf}T12:00:00.000Z`,
              retrieval_status: "fresh",
              source_period: asOfYear
            },
            missing_fields: [],
            value: 118.4,
            unit: "pct_gdp"
          }
        ]
      : [
          {
            observation_id: "wb-gdp-level",
            family: "gdp_level",
            label: "GDP level",
            summary: "GDP scale keeps regime pressure grounded in a very large output base.",
            geography: "United States",
            period: asOfYear,
            source_family: "world_bank",
            retrieval: {
              source: {
                source_id: "WB_NY.GDP.MKTP.CD",
                source_family: "world_bank",
                source_name: "World Bank GDP level",
                source_url: "https://api.worldbank.org/",
                agency: "World Bank",
                agency_series_id: "NY.GDP.MKTP.CD"
              },
              retrieved_at: `${input.asOf}T12:00:00.000Z`,
              retrieval_status: "fresh",
              source_period: asOfYear
            },
            missing_fields: [],
            value: 29200000000000,
            unit: "usd"
          },
          {
            observation_id: "wb-debt-context",
            family: "debt_context",
            label: "Debt context",
            summary: "Debt context keeps fiscal pressure and policy sensitivity in the morning frame.",
            geography: "United States",
            period: asOfYear,
            source_family: "world_bank",
            retrieval: {
              source: {
                source_id: "WB_GC.DOD.TOTL.GD.ZS",
                source_family: "world_bank",
                source_name: "World Bank Debt context",
                source_url: "https://api.worldbank.org/",
                agency: "World Bank",
                agency_series_id: "GC.DOD.TOTL.GD.ZS"
              },
              retrieved_at: `${input.asOf}T12:00:00.000Z`,
              retrieval_status: "fresh",
              source_period: asOfYear
            },
            missing_fields: [],
            value: 117.8,
            unit: "pct_gdp"
          },
          {
            observation_id: "wb-population",
            family: "population",
            label: "Population",
            summary: "Population scale continues to matter for breadth of demand and labor availability.",
            geography: "United States",
            period: asOfYear,
            source_family: "world_bank",
            retrieval: {
              source: {
                source_id: "WB_SP.POP.TOTL",
                source_family: "world_bank",
                source_name: "World Bank Population",
                source_url: "https://api.worldbank.org/",
                agency: "World Bank",
                agency_series_id: "SP.POP.TOTL"
              },
              retrieved_at: `${input.asOf}T12:00:00.000Z`,
              retrieval_status: "fresh",
              source_period: asOfYear
            },
            missing_fields: [],
            value: 337000000,
            unit: "people"
          },
          {
            observation_id: "wb-infrastructure",
            family: "infrastructure",
            label: "Infrastructure",
            summary: "Infrastructure remains supportive for enterprise rollout and platform reliability.",
            geography: "United States",
            period: asOfYear,
            source_family: "world_bank",
            retrieval: {
              source: {
                source_id: "WB_IT.NET.SECR.P6",
                source_family: "world_bank",
                source_name: "World Bank Infrastructure proxy",
                source_url: "https://api.worldbank.org/",
                agency: "World Bank",
                agency_series_id: "IT.NET.SECR.P6"
              },
              retrieved_at: `${input.asOf}T12:00:00.000Z`,
              retrieval_status: "fresh",
              source_period: asOfYear
            },
            missing_fields: [],
            value: 181234,
            unit: "per_million"
          }
        ];

  const omissions = [
    {
      omission_id: "imf-gdp-growth-outlook-unavailable",
      family: "gdp_growth_outlook",
      source_family: "imf",
      reason_code: "source_unavailable",
      reason_text: "IMF forecast inputs remain optional and were unavailable in this replay.",
      blocking: false
    }
  ];

  return {
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    as_of: input.asOf,
    coverage_state: "partial",
    summary: "Structural context remains additive, official-source-backed, and omission-forward.",
    issuer_metadata: input.issuerMetadata,
    observations,
    omissions,
    retrievals: observations.map((entry) => entry.retrieval)
  };
}

async function startOpenbbReplayMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const asOf = url.searchParams.get("as_of") ?? "2025-02-14";

    if (url.pathname === "/v1/official/company") {
      const ticker = url.searchParams.get("ticker") ?? "AAPL";
      sendJson(response, 200, {
        ok: true,
        data: {
          ticker,
          retrieval: {
            source: {
              source_name: "SEC EDGAR",
              source_url: `https://www.sec.gov/${ticker}`
            },
            retrieved_at: `${asOf}T12:00:00.000Z`
          },
          missing_fields: [],
          canonical_events: [
            {
              id: `filing-${ticker}-${asOf}`,
              family: "filing_posted",
              subject_type: "ticker",
              subject_id: ticker,
              title: `${ticker} filed a new 8-K`,
              occurred_at: `${asOf}T11:00:00.000Z`,
              source_state: "official",
              source: {
                source: {
                  source_id: `sec-${ticker}`,
                  source_family: "sec_edgar",
                  source_name: "SEC EDGAR",
                  source_url: `https://www.sec.gov/${ticker}`,
                  agency: "SEC",
                  agency_series_id: ticker
                },
                retrieved_at: `${asOf}T11:05:00.000Z`,
                retrieval_status: "fresh",
                source_period: quarterForIsoDate(asOf)
              },
              retrieved_at: `${asOf}T11:05:00.000Z`,
              missing_fields: [],
              metadata: {
                form_type: "8-K"
              }
            }
          ]
        },
        error_flag: false
      });
      return;
    }

    if (url.pathname === "/v1/official/macro") {
      sendJson(response, 200, {
        ok: true,
        data: {
          scope: "daily",
          retrieved_at: `${asOf}T12:00:00.000Z`,
          observations: [
            {
              registry_id: "TREASURY_DAILY_10Y",
              value: 4.12,
              unit: "percent",
              period: asOf,
              category: "rates",
              retrieval: {
                source: {
                  source_id: "TREASURY_DAILY_10Y",
                  source_family: "treasury",
                  source_name: "U.S. Treasury 10Y",
                  source_url: "https://home.treasury.gov/",
                  agency: "U.S. Treasury",
                  agency_series_id: "daily_treasury_rates:10 Yr"
                },
                retrieved_at: `${asOf}T08:00:00.000Z`,
                retrieval_status: "fresh",
                source_period: asOf
              },
              missing_fields: []
            },
            {
              registry_id: "BLS_CPI_U_ALL_ITEMS",
              value: 312.4,
              unit: "index",
              period: asOf.slice(0, 7),
              category: "inflation",
              retrieval: {
                source: {
                  source_id: "BLS_CPI_U_ALL_ITEMS",
                  source_family: "bls",
                  source_name: "BLS CPI",
                  source_url: "https://www.bls.gov/",
                  agency: "BLS",
                  agency_series_id: "CUUR0000SA0"
                },
                retrieved_at: `${asOf}T08:00:00.000Z`,
                retrieval_status: "fresh",
                source_period: asOf.slice(0, 7)
              },
              missing_fields: []
            },
            {
              registry_id: "BLS_UNEMPLOYMENT_RATE",
              value: 4.1,
              unit: "percent",
              period: asOf.slice(0, 7),
              category: "labor",
              retrieval: {
                source: {
                  source_id: "BLS_UNEMPLOYMENT_RATE",
                  source_family: "bls",
                  source_name: "BLS Unemployment Rate",
                  source_url: "https://www.bls.gov/",
                  agency: "BLS",
                  agency_series_id: "LNS14000000"
                },
                retrieved_at: `${asOf}T08:00:00.000Z`,
                retrieval_status: "fresh",
                source_period: asOf.slice(0, 7)
              },
              missing_fields: []
            },
            {
              registry_id: "BEA_REAL_GDP",
              value: 2.2,
              unit: "percent",
              period: quarterForIsoDate(asOf),
              category: "growth",
              retrieval: {
                source: {
                  source_id: "BEA_REAL_GDP",
                  source_family: "bea",
                  source_name: "BEA Real GDP",
                  source_url: "https://www.bea.gov/",
                  agency: "BEA",
                  agency_series_id: "A191RL"
                },
                retrieved_at: `${asOf}T08:00:00.000Z`,
                retrieval_status: "fresh",
                source_period: quarterForIsoDate(asOf)
              },
              missing_fields: []
            },
            {
              registry_id: "EIA_WTI_SPOT",
              value: 77.9,
              unit: "usd_per_barrel",
              period: asOf,
              category: "energy",
              retrieval: {
                source: {
                  source_id: "EIA_WTI_SPOT",
                  source_family: "eia",
                  source_name: "EIA WTI Spot",
                  source_url: "https://www.eia.gov/",
                  agency: "EIA",
                  agency_series_id: "PET.RWTC.D"
                },
                retrieved_at: `${asOf}T08:00:00.000Z`,
                retrieval_status: "fresh",
                source_period: asOf
              },
              missing_fields: []
            }
          ],
          missing_fields: [],
          canonical_events: [
            {
              id: `macro-cpi-${asOf}`,
              family: "macro_release_published",
              subject_type: "macro_series",
              subject_id: "BLS_CPI_U_ALL_ITEMS",
              title: "CPI update published",
              occurred_at: `${asOf}T07:30:00.000Z`,
              source_state: "official",
              source: {
                source: {
                  source_id: "bls-cpi",
                  source_family: "bls",
                  source_name: "BLS CPI",
                  source_url: "https://www.bls.gov/cpi/",
                  agency: "BLS",
                  agency_series_id: "CUUR0000SA0"
                },
                retrieved_at: `${asOf}T07:35:00.000Z`,
                retrieval_status: "fresh",
                source_period: asOf.slice(0, 7)
              },
              retrieved_at: `${asOf}T07:35:00.000Z`,
              missing_fields: [],
              metadata: {
                scope: "daily"
              }
            }
          ]
        },
        error_flag: false
      });
      return;
    }

    if (url.pathname === "/v1/official/structural") {
      const ticker = url.searchParams.get("ticker");
      if (ticker) {
        sendJson(response, 200, {
          ok: true,
          data: structuralPayload({
            asOf,
            subjectType: "issuer",
            subjectId: ticker,
            issuerMetadata: {
              name: "Apple Inc.",
              exchange: "NASDAQ",
              currency: "USD",
              domicile_country: "US",
              region: "North America",
              sector: "Technology",
              industry: "Consumer Electronics"
            }
          }),
          error_flag: false
        });
        return;
      }

      sendJson(response, 200, {
        ok: true,
        data: structuralPayload({
          asOf,
          subjectType: "market_pulse",
          subjectId: url.searchParams.get("country") ?? "US"
        }),
        error_flag: false
      });
      return;
    }

    sendJson(response, 404, { status: "not_found" });
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function startNewsMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/v1/first-party/context" || request.method !== "POST") {
      sendJson(response, 404, { status: "not_found" });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      data: {
        context_items: [
          {
            context_id: "ctx-aapl-2025-02-14",
            ticker: "AAPL",
            registry_entry_id: "aapl-ir",
            source_url: "https://investor.apple.com/investor-relations/",
            source_domain: "investor.apple.com",
            page_type: "investor_relations",
            title: "Apple investor update",
            summary: "Apple published an investor update tied to product and services cadence.",
            excerpt: "Apple investor update confirms release cadence.",
            retrieved_at: "2025-02-14T12:05:00.000Z",
            published_at: "2025-02-14T12:00:00.000Z",
            content_hash: "ctx-aapl",
            fetch_state: "fetched",
            rights: {
              rights_class: "first_party_public",
              display_mode: "excerpt_only",
              source_rank: "first_party",
              source_type: "investor_relations",
              can_store_full_text: false,
              can_display_excerpt: true,
              can_display_link: true,
              policy_reason: "Approved first-party source.",
              reviewed_at: "2025-02-01T00:00:00.000Z"
            }
          }
        ]
      },
      error_flag: false
    });
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function closeServer(server: Server): Promise<void> {
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
    method?: string;
    body?: JsonObject;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; payload: JsonObject }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
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

async function createVerifiedSession(baseUrl: string): Promise<{
  accessToken: string;
  internalToken: string;
}> {
  const email = `m6-research-lab-${Date.now()}@example.com`;
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

function replayDeepDiveReport(input: {
  jobId: string;
  reportId: string;
  ticker: string;
  generatedAt: string;
}): JsonObject {
  return {
    report_id: input.reportId,
    job_id: input.jobId,
    schema_version: "2.0",
    type: "deep_dive",
    ticker: input.ticker,
    generated_at: input.generatedAt,
    confidence: {
      score: 0.74,
      label: "medium",
      limiting_factors: []
    },
    signal: {
      value: "positive",
      reasons: ["The thesis remains constructive when services monetization stays durable."],
      evidence: [
        {
          evidence_id: "signal-evidence-1",
          source_type: "financial_data",
          source_name: "fixture-financials",
          excerpt: "Cash conversion and installed-base monetization remain intact.",
          retrieved_at: input.generatedAt
        }
      ]
    },
    sections: [
      {
        section_id: "executive_summary",
        title: "Executive Summary",
        body: "Replay fixture keeps the original thesis constructive while preserving omission honesty.",
        status: "complete",
        evidence: []
      }
    ],
    due_diligence: {
      prompt_version: "m8-due-diligence-fixture-v1",
      generation_mode: "deterministic_fixture",
      sections: [
        {
          section_id: "financial_analysis",
          title: "Financial Analysis",
          summary: "Financial performance remains constructive with explicit omission handling.",
          narrative_paragraphs: [
            "Revenue, margin, and free-cash-flow trends are discussed together so the report does not over-index on a single headline metric."
          ],
          key_points: ["Revenue trend remains constructive."],
          evidence_refs: ["section:executive_summary"],
          omissions: [],
          coverage_state: "full"
        },
        {
          section_id: "competitive_positioning",
          title: "Competitive Positioning",
          summary: "Competitive read stays grounded in approved evidence only.",
          narrative_paragraphs: [
            "The report uses segment mix and approved context to discuss where the business still looks durable."
          ],
          key_points: ["Segment mix remains relevant."],
          evidence_refs: ["section:executive_summary"],
          omissions: [],
          coverage_state: "full"
        },
        {
          section_id: "management_and_governance",
          title: "Management and Governance",
          summary: "Management commentary is usable while governance stays intentionally constrained.",
          narrative_paragraphs: ["Management tone is interpreted through approved evidence rather than impressionistic commentary."],
          key_points: ["Management commentary is available."],
          evidence_refs: ["section:executive_summary"],
          omissions: ["Proxy-grade governance detail unavailable in this fixture."],
          coverage_state: "partial"
        },
        {
          section_id: "risks_and_challenges",
          title: "Risks and Challenges",
          summary: "Risks remain falsifiable through explicit break conditions.",
          narrative_paragraphs: [
            "The risk section uses explicit kill switches and omission notes rather than generic warnings."
          ],
          key_points: ["Risk review is falsifiable."],
          evidence_refs: ["section:executive_summary"],
          omissions: [],
          coverage_state: "full"
        },
        {
          section_id: "growth_opportunities_and_outlook",
          title: "Growth Opportunities and Outlook",
          summary: "Outlook is discussed conservatively and only where approved evidence supports it.",
          narrative_paragraphs: [
            "Growth opportunities are framed around visible business drivers and management commentary."
          ],
          key_points: ["Growth outlook stays evidence-aware."],
          evidence_refs: ["section:executive_summary"],
          omissions: [],
          coverage_state: "full"
        },
        {
          section_id: "valuation_and_thesis_stance",
          title: "Valuation and Thesis Stance",
          summary: "Valuation stays deterministic and tied to stance language.",
          narrative_paragraphs: [
            "Valuation remains useful only because the assumptions are explicit and bounded."
          ],
          key_points: ["Valuation is deterministic."],
          evidence_refs: ["section:executive_summary"],
          omissions: [],
          coverage_state: "full"
        }
      ]
    },
    flags: [],
    data_sources: ["fixture-replay"]
  };
}

async function completeDeepDive(
  baseUrl: string,
  accessToken: string,
  internalToken: string,
  input: {
    reportId: string;
    ticker: string;
    generatedAt: string;
  }
): Promise<void> {
  const createJob = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    body: { ticker: input.ticker }
  });
  assert.equal(createJob.status, 202);
  const jobId = createJob.payload.job_id;
  assert.equal(typeof jobId, "string");

  const claim = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/claim`, {
    method: "POST",
    headers: {
      "x-internal-token": internalToken
    }
  });
  assert.equal(claim.status, 200);

  const complete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
    method: "POST",
    headers: {
      "x-internal-token": internalToken
    },
    body: {
      report: replayDeepDiveReport({
        jobId: jobId as string,
        reportId: input.reportId,
        ticker: input.ticker,
        generatedAt: input.generatedAt
      })
    }
  });
  assert.equal(complete.status, 200);
}

async function waitForPulseReport(
  baseUrl: string,
  token: string,
  path: string,
  timeoutMs = 10000
): Promise<MarketPulseReport> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await requestJson(baseUrl, path, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    if (response.status === 200) {
      return response.payload as unknown as MarketPulseReport;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for pulse report at ${path}`);
}

test("PH6 M6 research lab builds replay, evaluation, and debate artifacts without a publish path", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    MARKET_PULSE_DATA_OPENBB_BASE_URL: process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL,
    MARKET_PULSE_NEWS_INGEST_BASE_URL: process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";

  const openbbMock = await startOpenbbReplayMock();
  const newsMock = await startNewsMock();
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = openbbMock.baseUrl;
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = newsMock.baseUrl;

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const asOf = "2025-02-14";
    const session = await createVerifiedSession(baseUrl);
    const authHeaders = { authorization: `Bearer ${session.accessToken}` };
    const internalHeaders = { "x-internal-token": session.internalToken };

    const tokenRegistration = await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers: authHeaders,
      body: {
        device_token: "fcm_token_m6_research_lab"
      }
    });
    assert.equal(tokenRegistration.status, 200);

    const addWatchlist = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: authHeaders,
      body: {
        ticker: "AAPL"
      }
    });
    assert.equal(addWatchlist.status, 200);

    await completeDeepDive(baseUrl, session.accessToken, session.internalToken, {
      reportId: "ph6-m6-replay-report",
      ticker: "AAPL",
      generatedAt: `${asOf}T12:00:00.000Z`
    });

    const reportResponse = await requestJson(baseUrl, "/reports/ph6-m6-replay-report", {
      headers: authHeaders
    });
    assert.equal(reportResponse.status, 200);
    const deepDive = reportResponse.payload as unknown as AnalysisReport;
    assert.equal(deepDive.structural_context?.as_of, asOf);
    assert.equal(deepDive.issuer?.currency, "USD");
    const enrichedDueDiligenceSections =
      deepDive.due_diligence?.sections.filter((section) =>
        section.narrative_paragraphs.some((paragraph) => paragraph.includes("Structural context:"))
      ) ?? [];
    assert.equal(enrichedDueDiligenceSections.length, 3);

    const recompute = await requestJson(baseUrl, "/internal/monitor/recompute", {
      method: "POST",
      headers: internalHeaders,
      body: { as_of: asOf }
    });
    assert.equal(recompute.status, 200);

    const dispatch = await requestJson(baseUrl, "/internal/pulse/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        cycle_start: `${asOf}T00:00:00.000Z`,
        cycle_end: `${asOf}T23:59:00.000Z`
      }
    });
    assert.equal(dispatch.status, 202);

    const pulse = await waitForPulseReport(baseUrl, session.accessToken, `/pulse/${asOf}`);
    assert.equal(pulse.structural_context?.as_of, asOf);
    assert.equal(pulse.macro_stress.as_of, asOf);
    assert.match(
      pulse.sections.official_macro_pressure.body,
      /GDP level: GDP scale keeps regime pressure grounded/
    );
    assert.match(
      pulse.sections.bounded_context.body,
      /Population: Population scale continues to matter/
    );
    assert.deepEqual(
      pulse.macro_stress.inputs.map((input) => input.category),
      ["rates", "inflation", "labor", "growth", "energy"]
    );

    const replayArtifact = buildHistoricalReplayArtifact({
      asOf,
      deepDive,
      marketPulse: pulse
    });
    const evaluationArtifact = buildReplayEvaluationArtifact(replayArtifact);
    const debateArtifact = buildDebateExperimentArtifact({
      asOf,
      report: deepDive
    });

    assert.equal(replayArtifact.deep_dive.checks.every((check) => check.passed), true);
    assert.equal(replayArtifact.morning_exception_briefing.checks.every((check) => check.passed), true);
    assert.equal(evaluationArtifact.verdict, "pass");
    assert.equal(evaluationArtifact.score, evaluationArtifact.max_score);
    assert.equal(debateArtifact.publish_blocked, true);
    assert.equal(debateArtifact.publish_route, null);
    assert.equal(debateArtifact.mode, "internal_only");
  } finally {
    await closeServer(server);
    await closeServer(openbbMock.server);
    await closeServer(newsMock.server);

    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = previous.MARKET_PULSE_DATA_OPENBB_BASE_URL;
    process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = previous.MARKET_PULSE_NEWS_INGEST_BASE_URL;
  }
});
