package com.thesis.mobile.offline

import com.thesis.mobile.model.ConfidenceDisplayView
import com.thesis.mobile.model.DeepDiveChangeSummaryView
import com.thesis.mobile.model.DeepDiveCoverageTruthView
import com.thesis.mobile.model.DeepDiveExplainersView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveStoryHeaderView
import com.thesis.mobile.model.DeepDiveTopChangeView
import com.thesis.mobile.model.DeepDiveVisualPanelView
import com.thesis.mobile.model.DueDiligenceSectionView
import com.thesis.mobile.model.DueDiligenceView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.EvidenceLadderPanelView
import com.thesis.mobile.model.HistoricalDisplayView
import com.thesis.mobile.model.InvestmentMemoClaimView
import com.thesis.mobile.model.InvestmentMemoSectionView
import com.thesis.mobile.model.InvestmentMemoView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.KillSwitchConditionView
import com.thesis.mobile.model.MetricDeltaPanelView
import com.thesis.mobile.model.MarketTapeParser
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.RangeBandPanelView
import com.thesis.mobile.model.ReportViewMapper
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SentimentSubScoreView
import com.thesis.mobile.model.ScenarioComparePanelView
import com.thesis.mobile.model.TimelinePanelView
import com.thesis.mobile.model.TrustScorecardPanelView
import com.thesis.mobile.model.FinancialAnalysisView
import com.thesis.mobile.model.FinancialDerivedMetricView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.FinancialOmissionView
import com.thesis.mobile.model.ValuationAssumptionsView
import com.thesis.mobile.model.ValuationBridgePanelView
import com.thesis.mobile.model.ValuationDisplayView
import com.thesis.mobile.model.ValueDisciplineSignalView
import com.thesis.mobile.model.ValueDisciplineView
import com.thesis.mobile.model.ValueTrapWarningView
import org.json.JSONArray
import org.json.JSONObject

object OfflineJsonCodec {
    fun encodePulseReport(pulse: PulseReportView): String {
        val payload = JSONObject()
            .put("report_id", pulse.reportId)
            .put("generated_at", pulse.generatedAt)
            .put("cycle_end", pulse.cycleEnd)
            .put(
                "sections",
                JSONArray().apply {
                    pulse.sections.forEach { put(sectionToJson(it)) }
                }
            )
            .putOpt("market_tape", pulse.tape?.let(MarketTapeParser::toJson))
        return payload.toString()
    }

    fun decodePulseReport(payload: String): PulseReportView? = runCatching {
        val root = JSONObject(payload)
        val reportId = root.optString("report_id").ifBlank { return null }
        val generatedAt = root.optString("generated_at").ifBlank { return null }
        val sections = root.optJSONArray("sections")?.let(::sectionsFromJsonArray).orEmpty()
        PulseReportView(
            reportId = reportId,
            generatedAt = generatedAt,
            cycleEnd = root.optString("cycle_end").ifBlank { null },
            sections = sections,
            tape = MarketTapeParser.parse(root.optJSONObject("market_tape"))
        )
    }.getOrNull()

    fun encodeDeepDiveReport(report: DeepDiveReportView): String {
        val payload = JSONObject()
            .put("report_id", report.reportId)
            .put("ticker", report.ticker)
            .put("generated_at", report.generatedAt)
            .put("issuer", issuerToJson(report.issuer))
            .put("schema_version", report.schemaVersion)
            .put("story_header", storyHeaderToJson(report.storyHeader))
            .put("change_summary", changeSummaryToJson(report.changeSummary))
            .put(
                "visual_panels",
                JSONArray().apply {
                    report.visualPanels.forEach { put(visualPanelToJson(it)) }
                }
            )
            .put("explainers", explainersToJson(report.explainers))
            .put("watch_items", JSONArray(report.watchItems))
            .put("coverage_truth", coverageTruthToJson(report.coverageTruth))
            .put("investment_memo", investmentMemoToJson(report.investmentMemo))
            .put("due_diligence", dueDiligenceToJson(report.dueDiligence))
            .put("financial_analysis", financialAnalysisToJson(report.financialAnalysis))
            .put("value_discipline", valueDisciplineToJson(report.valueDiscipline))
            .put(
                "signal",
                JSONObject()
                    .put("value", report.signalValue)
                    .put("reasons", JSONArray(report.signalReasons))
            )
            .put("confidence", confidenceToJson(report.confidence))
            .put("valuation", valuationToJson(report.valuation))
            .put("historical_context", historicalToJson(report.historical))
            .put(
                "kill_switch_conditions",
                JSONArray().apply {
                    report.killSwitchConditions.forEach { put(killSwitchConditionToJson(it)) }
                }
            )
            .put(
                "sections",
                JSONArray().apply {
                    report.sections.forEach { put(sectionToJson(it)) }
                }
            )
        return payload.toString()
    }

    fun decodeDeepDiveReport(payload: String): DeepDiveReportView? = runCatching {
        ReportViewMapper.mapAnalysisReport(JSONObject(payload))
    }.getOrNull()

    fun encodeSentimentSnapshot(snapshot: SentimentSnapshotView): String {
        val payload = JSONObject()
            .put("id", snapshot.id)
            .put("market_date", snapshot.marketDate)
            .put("score", snapshot.score)
            .put("label", snapshot.label)
            .put("calculated_at", snapshot.calculatedAt)
            .put(
                "sub_scores",
                JSONArray().apply {
                    snapshot.subScores.forEach { subScore ->
                        put(
                            JSONObject()
                                .put("input_name", subScore.inputName)
                                .put("provider", subScore.provider)
                                .put("available", subScore.available)
                                .put("weight", subScore.weight)
                                .put("normalized_score", subScore.normalizedScore)
                                .put("raw_value", subScore.rawValue)
                                .put("retrieved_at", subScore.retrievedAt)
                                .put("notes", subScore.notes)
                        )
                    }
                }
            )
            .put("missing_inputs", JSONArray(snapshot.missingInputs))
        return payload.toString()
    }

    fun decodeSentimentSnapshot(payload: String): SentimentSnapshotView? = runCatching {
        val root = JSONObject(payload)
        val id = root.optString("id").ifBlank { return null }
        val marketDate = root.optString("market_date").ifBlank { return null }
        val score = root.optDouble("score", Double.NaN)
        if (score.isNaN()) {
            return null
        }
        val label = root.optString("label").ifBlank { return null }
        val calculatedAt = root.optString("calculated_at").ifBlank { return null }
        val subScoresJson = root.optJSONArray("sub_scores") ?: JSONArray()
        val subScores = (0 until subScoresJson.length()).mapNotNull { index ->
            mapSubScore(subScoresJson.optJSONObject(index))
        }
        val missingInputsJson = root.optJSONArray("missing_inputs") ?: JSONArray()
        val missingInputs = (0 until missingInputsJson.length()).mapNotNull { index ->
            missingInputsJson.optString(index).takeIf { it.isNotBlank() }
        }
        SentimentSnapshotView(
            id = id,
            marketDate = marketDate,
            score = score,
            label = label,
            subScores = subScores,
            missingInputs = missingInputs,
            calculatedAt = calculatedAt
        )
    }.getOrNull()

    private fun sectionToJson(section: SectionView): JSONObject =
        JSONObject()
            .put("section_id", section.sectionId)
            .put("title", section.title)
            .put("body", section.body)
            .put("status", section.status)
            .put(
                "evidence",
                JSONArray().apply {
                    section.evidence.forEach { evidence ->
                        put(
                            JSONObject()
                                .put("source_name", evidence.sourceName)
                                .put("excerpt", evidence.excerpt)
                                .put("url", evidence.url)
                        )
                    }
                }
            )

    private fun storyHeaderToJson(header: DeepDiveStoryHeaderView?): JSONObject? {
        if (header == null) {
            return null
        }
        return JSONObject()
            .put("headline", header.headline)
            .put("thesis_summary", header.thesisSummary)
            .put("why_now", header.whyNow)
            .put("reader_takeaway", header.readerTakeaway)
            .put("stance_label", header.stanceLabel)
    }

    private fun issuerToJson(issuer: IssuerView?): JSONObject? {
        if (issuer == null) {
            return null
        }
        return JSONObject()
            .put("name", issuer.name)
            .put("exchange", issuer.exchange)
    }

    private fun changeSummaryToJson(changeSummary: DeepDiveChangeSummaryView?): JSONObject? {
        if (changeSummary == null) {
            return null
        }
        return JSONObject()
            .put("previous_view", changeSummary.previousView)
            .put("current_view", changeSummary.currentView)
            .put(
                "top_changes",
                JSONArray().apply {
                    changeSummary.topChanges.forEach { put(topChangeToJson(it)) }
                }
            )
    }

    private fun topChangeToJson(change: DeepDiveTopChangeView): JSONObject =
        JSONObject()
            .put("title", change.title)
            .put("direction", change.direction)
            .put("impact_level", change.impactLevel)
            .put("why_it_changed", change.whyItChanged)
            .put("why_it_matters", change.whyItMatters)

    private fun visualPanelToJson(panel: DeepDiveVisualPanelView): JSONObject {
        val root = JSONObject()
            .put("type", panel.type)
            .put("title", panel.title)
            .put("eyebrow", panel.eyebrow)
            .put("summary", panel.summary)

        when (panel) {
            is MetricDeltaPanelView -> root.put(
                "metrics",
                JSONArray().apply {
                    panel.metrics.forEach { metric ->
                        put(
                            JSONObject()
                                .put("label", metric.label)
                                .put("current_value", metric.currentValue)
                                .put("reference_value", metric.referenceValue)
                                .put("delta_pct", metric.deltaPct)
                                .put("basis", metric.basis)
                                .put("direction", metric.direction)
                                .put("note", metric.note)
                        )
                    }
                }
            )
            is TimelinePanelView -> root.put(
                "points",
                JSONArray().apply {
                    panel.points.forEach { point ->
                        put(
                            JSONObject()
                                .put("label", point.label)
                                .put("value", point.value)
                                .put("emphasis", point.emphasis)
                        )
                    }
                }
            )
            is RangeBandPanelView -> root
                .put("low_value", panel.lowValue)
                .put("mid_value", panel.midValue)
                .put("high_value", panel.highValue)
                .put("reference_value", panel.referenceValue)
                .put("value_label", panel.valueLabel)
                .put("reference_label", panel.referenceLabel)
            is TrustScorecardPanelView -> root
                .put("freshness_state", panel.freshnessState)
                .put("contradiction_state", panel.contradictionState)
                .put("valuation_state", panel.valuationState)
                .put("evidence_count", panel.evidenceCount)
            is EvidenceLadderPanelView -> root.put(
                "rungs",
                JSONArray().apply {
                    panel.rungs.forEach { rung ->
                        put(
                            JSONObject()
                                .put("label", rung.label)
                                .put("count", rung.count)
                                .put("tone", rung.tone)
                        )
                    }
                }
            )
            is ValuationBridgePanelView -> root.put(
                "points",
                JSONArray().apply {
                    panel.points.forEach { point ->
                        put(
                            JSONObject()
                                .put("label", point.label)
                                .put("value", point.value)
                                .put("tone", point.tone)
                        )
                    }
                }
            )
            is ScenarioComparePanelView -> root
                .put("base_label", panel.baseLabel)
                .put("scenario_label", panel.scenarioLabel)
                .put("base_value", panel.baseValue)
                .put("scenario_value", panel.scenarioValue)
                .put("delta_text", panel.deltaText)
        }
        return root
    }

    private fun explainersToJson(explainers: DeepDiveExplainersView?): JSONObject? {
        if (explainers == null) {
            return null
        }
        return JSONObject()
            .put("signal", explainers.signal)
            .put("confidence", explainers.confidence)
            .put("freshness", explainers.freshness)
            .put("valuation", explainers.valuation)
            .put("omissions", explainers.omissions)
    }

    private fun coverageTruthToJson(coverageTruth: DeepDiveCoverageTruthView?): JSONObject? {
        if (coverageTruth == null) {
            return null
        }
        return JSONObject()
            .put("summary", coverageTruth.summary)
            .put("covered", JSONArray(coverageTruth.covered))
            .put("missing", JSONArray(coverageTruth.missing))
    }

    private fun investmentMemoToJson(investmentMemo: InvestmentMemoView?): JSONObject? {
        if (investmentMemo == null) {
            return null
        }
        return JSONObject()
            .put("prompt_version", investmentMemo.promptVersion)
            .put("generation_mode", investmentMemo.generationMode)
            .put("company_angle", investmentMemo.companyAngle)
            .put("decision_question", investmentMemo.decisionQuestion)
            .put(
                "sections",
                JSONArray().apply {
                    investmentMemo.sections.forEach { put(investmentMemoSectionToJson(it)) }
                }
            )
            .put(
                "material_claims",
                JSONArray().apply {
                    investmentMemo.materialClaims.forEach { put(investmentMemoClaimToJson(it)) }
                }
            )
            .put("unsupported_claims", JSONArray(investmentMemo.unsupportedClaims))
            .put("sparse_data_honesty_note", investmentMemo.sparseDataHonestyNote)
    }

    private fun dueDiligenceToJson(dueDiligence: DueDiligenceView?): JSONObject? {
        if (dueDiligence == null) {
            return null
        }
        return JSONObject()
            .put("prompt_version", dueDiligence.promptVersion)
            .put("generation_mode", dueDiligence.generationMode)
            .put(
                "sections",
                JSONArray().apply {
                    dueDiligence.sections.forEach { put(dueDiligenceSectionToJson(it)) }
                }
            )
    }

    private fun dueDiligenceSectionToJson(section: DueDiligenceSectionView): JSONObject =
        JSONObject()
            .put("section_id", section.sectionId)
            .put("title", section.title)
            .put("summary", section.summary)
            .put("narrative_paragraphs", JSONArray(section.narrativeParagraphs))
            .put("key_points", JSONArray(section.keyPoints))
            .put("evidence_refs", JSONArray(section.evidenceRefs))
            .put("omissions", JSONArray(section.omissions))
            .put("coverage_state", section.coverageState)

    private fun investmentMemoSectionToJson(section: InvestmentMemoSectionView): JSONObject =
        JSONObject()
            .put("section_id", section.sectionId)
            .put("title", section.title)
            .put("narrative", section.narrative)
            .put("key_points", JSONArray(section.keyPoints))

    private fun investmentMemoClaimToJson(claim: InvestmentMemoClaimView): JSONObject =
        JSONObject()
            .put("claim_id", claim.claimId)
            .put("section_id", claim.sectionId)
            .put("statement", claim.statement)
            .put("materiality", claim.materiality)
            .put(
                "supports",
                JSONArray().apply {
                    claim.supports.forEach { support ->
                        put(
                            JSONObject()
                                .put("support_type", support.supportType)
                                .put("ref_id", support.refId)
                                .put("summary", support.summary)
                        )
                    }
                }
            )

    private fun financialAnalysisToJson(financialAnalysis: FinancialAnalysisView?): JSONObject? {
        if (financialAnalysis == null) {
            return null
        }
        return JSONObject()
            .put(
                "annual_history",
                JSONArray().apply {
                    financialAnalysis.annualHistory.forEach { put(financialHistoryRowToJson(it)) }
                }
            )
            .put(
                "quarterly_history",
                JSONArray().apply {
                    financialAnalysis.quarterlyHistory.forEach { put(financialHistoryRowToJson(it)) }
                }
            )
            .put(
                "trend_metrics",
                JSONArray().apply {
                    financialAnalysis.trendMetrics.forEach { put(financialDerivedMetricToJson(it)) }
                }
            )
            .put(
                "quality_metrics",
                JSONArray().apply {
                    financialAnalysis.qualityMetrics.forEach { put(financialDerivedMetricToJson(it)) }
                }
            )
            .put(
                "omissions",
                JSONArray().apply {
                    financialAnalysis.omissions.forEach { put(financialOmissionToJson(it)) }
                }
            )
    }

    private fun financialHistoryRowToJson(row: FinancialHistoryRowView): JSONObject =
        JSONObject()
            .put("period", row.period)
            .put("period_type", row.periodType)
            .put("fiscal_year", row.fiscalYear)
            .put("fiscal_quarter", row.fiscalQuarter)
            .put("revenue", row.revenue)
            .put("gross_margin", row.grossMargin)
            .put("operating_margin", row.operatingMargin)
            .put("net_income", row.netIncome)
            .put("free_cash_flow", row.freeCashFlow)
            .put("debt_total", row.debtTotal)
            .put("cash_and_equivalents", row.cashAndEquivalents)
            .put("shares_outstanding", row.sharesOutstanding)

    private fun financialDerivedMetricToJson(metric: FinancialDerivedMetricView): JSONObject =
        JSONObject()
            .put("key", metric.key)
            .put("label", metric.label)
            .put("value", metric.value)
            .put("unit", metric.unit)
            .put("status", metric.status)
            .put("direction", metric.direction)
            .put("note", metric.note)

    private fun financialOmissionToJson(omission: FinancialOmissionView): JSONObject =
        JSONObject()
            .put("code", omission.code)
            .put("label", omission.label)
            .put("reason", omission.reason)
            .put("impacts", JSONArray(omission.impacts))

    private fun valueDisciplineToJson(valueDiscipline: ValueDisciplineView?): JSONObject? {
        if (valueDiscipline == null) {
            return null
        }
        return JSONObject()
            .put("score", valueDiscipline.score)
            .put("max_score", valueDiscipline.maxScore)
            .put("available_signals", valueDiscipline.availableSignals)
            .put("completeness", valueDiscipline.completeness)
            .put("context_label", valueDiscipline.contextLabel)
            .put("interpretation", valueDiscipline.interpretation)
            .put("missing_signals", JSONArray(valueDiscipline.missingSignals))
            .put("does_not_prove", valueDiscipline.doesNotProve)
            .put(
                "signals",
                JSONArray().apply {
                    valueDiscipline.signals.forEach { put(valueDisciplineSignalToJson(it)) }
                }
            )
            .put("value_trap_warning", valueTrapWarningToJson(valueDiscipline.valueTrapWarning))
    }

    private fun valueDisciplineSignalToJson(signal: ValueDisciplineSignalView): JSONObject =
        JSONObject()
            .put("key", signal.key)
            .put("label", signal.label)
            .put("family", signal.family)
            .put("status", signal.status)
            .put("reason", signal.reason)
            .put("value", signal.value)

    private fun valueTrapWarningToJson(warning: ValueTrapWarningView): JSONObject =
        JSONObject()
            .put("triggered", warning.triggered)
            .put("summary", warning.summary)
            .put("reason_codes", JSONArray(warning.reasonCodes))

    private fun killSwitchConditionToJson(condition: KillSwitchConditionView): JSONObject =
        JSONObject()
            .put("condition_text", condition.conditionText)
            .put("signal_type", condition.signalType)
            .put("direction", condition.direction)
            .put("rationale", condition.thresholdDescription)

    private fun sectionsFromJsonArray(rows: JSONArray): List<SectionView> =
        (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let { row ->
                SectionView(
                    sectionId = row.optString("section_id").ifBlank { null },
                    title = row.optString("title", "Untitled"),
                    body = row.optString("body", ""),
                    status = row.optString("status").ifBlank { null },
                    evidence = (row.optJSONArray("evidence") ?: JSONArray()).let { evidenceRows ->
                        (0 until evidenceRows.length()).mapNotNull { evidenceIndex ->
                            evidenceRows.optJSONObject(evidenceIndex)?.let { evidenceRow ->
                                EvidenceView(
                                    sourceName = evidenceRow.optString("source_name", "Unknown source"),
                                    excerpt = evidenceRow.optString("excerpt", ""),
                                    url = evidenceRow.optString("url").ifBlank { null }
                                )
                            }
                        }
                    }
                )
            }
        }

    private fun confidenceToJson(confidence: ConfidenceDisplayView?): JSONObject? {
        if (confidence == null) {
            return null
        }
        return JSONObject()
            .put("score", confidence.score)
            .put("label", confidence.label)
            .put("limiting_factors", JSONArray(confidence.limitingFactors))
    }

    private fun valuationToJson(valuation: ValuationDisplayView?): JSONObject? {
        if (valuation == null) {
            return null
        }
        return JSONObject()
            .put("fair_value_mid", valuation.fairValueMid)
            .put("fair_value_low", valuation.fairValueLow)
            .put("fair_value_high", valuation.fairValueHigh)
            .put("spot_price", valuation.spotPrice)
            .put("implied_upside_pct", valuation.impliedUpsidePct)
            .put("assumptions", assumptionsToJson(valuation.assumptions))
            .put("degraded_reason", valuation.degradedReason)
    }

    private fun assumptionsToJson(assumptions: ValuationAssumptionsView?): JSONObject? {
        if (assumptions == null) {
            return null
        }
        return JSONObject()
            .put("methodology", assumptions.methodology)
            .put("projection_years", assumptions.projectionYears)
            .put("terminal_growth_rate", assumptions.terminalGrowthRate)
            .put("wacc", assumptions.wacc)
    }

    private fun historicalToJson(historical: HistoricalDisplayView?): JSONObject? {
        if (historical == null) {
            return null
        }
        return JSONObject()
            .put("latest_period", historical.latestPeriod)
            .put("prior_quarter_period", historical.priorQuarterPeriod)
            .put("year_ago_period", historical.yearAgoPeriod)
            .put("financial_snapshot_count", historical.financialSnapshotCount)
            .put("transcript_count", historical.transcriptCount)
    }

    private fun mapSubScore(row: JSONObject?): SentimentSubScoreView? {
        if (row == null) {
            return null
        }
        val inputName = row.optString("input_name").ifBlank { return null }
        val provider = row.optString("provider").ifBlank { return null }
        val available = row.optBoolean("available", false)
        val weight = row.optDouble("weight", Double.NaN)
        if (weight.isNaN()) {
            return null
        }
        val normalizedScore = row.optDouble("normalized_score", Double.NaN).let { value ->
            if (value.isNaN()) null else value
        }
        val rawValue = row.optDouble("raw_value", Double.NaN).let { value ->
            if (value.isNaN()) null else value
        }
        return SentimentSubScoreView(
            inputName = inputName,
            provider = provider,
            available = available,
            weight = weight,
            normalizedScore = normalizedScore,
            rawValue = rawValue,
            retrievedAt = row.optString("retrieved_at").ifBlank { null },
            notes = row.optString("notes").ifBlank { null }
        )
    }
}
