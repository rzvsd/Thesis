// Report-scoped research routes:
//   GET  /v1/reports/:id/opposite-case   stored opposite case, Pro only
//   POST /v1/reports/:id/opposite-case   build it (no LLM) from the stored Deep Dive body, Pro only
//   POST /v1/reports/:id/scenario        what-if DCF recompute, bare ScenarioResponse, Pro only
// Report rows (M2) are read with SQL. The report body comes through the ReportBodyReader port.
import { json } from "../../../_shared/http.ts";
import { appendAudit, requestId } from "../../../_lib/research/audit.ts";
import {
  assertAnalysisReport,
  buildOppositeCaseReportRecord,
  convictionThesisSnapshotFromReport,
  recordConvictionJournalEntry,
  toOppositeCaseView,
} from "../../../_lib/research/conviction.ts";
import { readJsonBody, requireUserId, type ResearchDeps } from "../../../_lib/research/deps.ts";
import type { ResearchStore } from "../../../_lib/research/store.ts";
import type { ReportRecord, ScenarioOverrides } from "../../../_lib/research/types.ts";
import { buildUpgradeRequiredPayload, isFiniteNumber } from "../../../_lib/research/util.ts";
import { computeScenarioResponse } from "../../../_lib/research/what_if.ts";
import type { RouteContext } from "../../router.ts";

const reportNotFound = (message = "Report not found.") =>
  json({ error: "report_not_found", error_message: message }, 404);

// Same order as the old server: report exists, the user may read it.
async function accessibleReport(store: ResearchStore, userId: string, reportId: string) {
  const report = await store.getReportById(reportId);
  if (!report) return undefined;
  return (await store.hasReportAccessForUser(userId, report.id)) ? report : undefined;
}

async function readDeepDiveArtifact(deps: ResearchDeps, report: ReportRecord) {
  const artifact = await deps.readReportBody(report);
  if (!artifact || typeof artifact !== "object" || !("job_id" in artifact)) return undefined;
  return assertAnalysisReport(artifact);
}

export function oppositeCaseGetHandler({ store }: ResearchDeps) {
  return async ({ req, path, params, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const reportId = params.id;
    if (!(await accessibleReport(store, userId, reportId))) return reportNotFound();
    if ((await store.getSubscriptionTier(userId)) !== "PRO") {
      return json(
        buildUpgradeRequiredPayload(
          "conviction_intelligence",
          "Opposite-case generation is available on the Pro tier.",
        ),
        403,
      );
    }
    const existing = await store.getOppositeCaseReportBySource({ userId, sourceReportId: reportId });
    if (!existing) {
      return json({
        error: "opposite_case_not_found",
        error_message: "No opposite-case report exists for this Deep Dive yet.",
      }, 404);
    }
    await appendAudit(store, "conviction.opposite_case_retrieved", {
      request_id: requestId(req),
      route: path,
      report_id: reportId,
      opposite_case_id: existing.id,
    }, userId);
    return json({ data: toOppositeCaseView(existing) });
  };
}

export function oppositeCaseCreateHandler(deps: ResearchDeps) {
  const { store } = deps;
  return async ({ req, path, params, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const reportId = params.id;
    const reportMetadata = await accessibleReport(store, userId, reportId);
    if (!reportMetadata) return reportNotFound();
    if ((await store.getSubscriptionTier(userId)) !== "PRO") {
      return json(
        buildUpgradeRequiredPayload(
          "conviction_intelligence",
          "Opposite-case generation is available on the Pro tier.",
        ),
        403,
      );
    }
    const existing = await store.getOppositeCaseReportBySource({ userId, sourceReportId: reportId });
    if (existing) return json({ data: toOppositeCaseView(existing) });

    const report = await readDeepDiveArtifact(deps, reportMetadata);
    if (!report) return reportNotFound("Report artifact missing.");
    if (report.type !== "deep_dive" || !report.ticker) {
      return json({
        error: "validation_failed",
        error_message: "Opposite-case generation is only supported for Deep Dive reports.",
      }, 422);
    }

    const nowIso = new Date().toISOString();
    const oppositeCase = await store.upsertOppositeCaseReport(
      buildOppositeCaseReportRecord({ report, userId, sourceReportId: reportId, nowIso }),
    );
    await recordConvictionJournalEntry(store, {
      userId,
      ticker: oppositeCase.ticker,
      eventType: "opposite_case_generated",
      sourceType: "opposite_case",
      sourceId: oppositeCase.id,
      eventAt: oppositeCase.generatedAt,
      title: `${oppositeCase.ticker} opposite case generated`,
      summary: oppositeCase.oppositeCaseSummary,
      thesisSnapshot: convictionThesisSnapshotFromReport(report),
      evidenceRefs: [
        {
          kind: "report",
          ref_id: reportId,
          label: "Source Deep Dive report",
          ticker: oppositeCase.ticker,
          captured_at: report.generated_at,
        },
        ...oppositeCase.sharedEvidenceRefs,
      ],
      reportId,
      oppositeCaseId: oppositeCase.id,
    });
    await appendAudit(store, "conviction.opposite_case_generated", {
      request_id: requestId(req),
      route: path,
      report_id: reportId,
      opposite_case_id: oppositeCase.id,
      prompt_version: oppositeCase.promptVersion,
    }, userId);
    return json({ data: toOppositeCaseView(oppositeCase) });
  };
}

const invalid = (message: string) => json({ error: "validation_failed", error_message: message }, 422);

export function reportScenarioHandler(deps: ResearchDeps) {
  const { store } = deps;
  return async ({ req, path, params, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const reportId = params.id;
    const reportMetadata = await accessibleReport(store, userId, reportId);
    if (!reportMetadata) return reportNotFound();
    if ((await store.getSubscriptionTier(userId)) !== "PRO") {
      return json(
        buildUpgradeRequiredPayload("what_if_scenario", "What-If scenarios are available on the Pro tier."),
        403,
      );
    }

    const report = await readDeepDiveArtifact(deps, reportMetadata);
    if (!report) return reportNotFound("Report artifact missing.");
    if (report.type !== "deep_dive") {
      return invalid("Scenario requests are only supported for Deep Dive reports.");
    }
    if (!report.valuation) {
      return json({
        error: "scenario_unavailable",
        error_message: "Valuation block is required for scenario analysis.",
      }, 422);
    }

    const body = await readJsonBody<{ overrides?: ScenarioOverrides }>(req);
    const overridesRaw = body.overrides ?? {};
    const projectionYears = overridesRaw.projection_years;
    const terminalGrowth = overridesRaw.terminal_growth_rate;
    const wacc = overridesRaw.wacc;

    if (
      projectionYears !== undefined &&
      (!isFiniteNumber(projectionYears) || !Number.isInteger(projectionYears) || projectionYears < 1 ||
        projectionYears > 30)
    ) {
      return invalid("projection_years must be an integer between 1 and 30.");
    }
    if (
      terminalGrowth !== undefined &&
      (!isFiniteNumber(terminalGrowth) || terminalGrowth < -0.2 || terminalGrowth > 0.2)
    ) {
      return invalid("terminal_growth_rate must be between -0.2 and 0.2.");
    }
    if (wacc !== undefined && (!isFiniteNumber(wacc) || wacc <= 0 || wacc > 1)) {
      return invalid("wacc must be between 0 and 1.");
    }

    const mergedWacc = wacc ?? report.valuation.assumptions.wacc;
    const mergedGrowth = terminalGrowth ?? report.valuation.assumptions.terminal_growth_rate;
    if (mergedWacc <= mergedGrowth) return invalid("wacc must be greater than terminal_growth_rate.");

    const scenario = computeScenarioResponse(reportId, report.valuation, {
      projection_years: projectionYears,
      terminal_growth_rate: terminalGrowth,
      wacc,
    });
    await appendAudit(store, "report.scenario_generated", {
      request_id: requestId(req),
      route: path,
      report_id: reportId,
      has_projection_years_override: projectionYears !== undefined,
      has_terminal_growth_override: terminalGrowth !== undefined,
      has_wacc_override: wacc !== undefined,
    }, userId);
    // Bare ScenarioResponse, no { data } envelope (contract).
    return json(scenario);
  };
}
