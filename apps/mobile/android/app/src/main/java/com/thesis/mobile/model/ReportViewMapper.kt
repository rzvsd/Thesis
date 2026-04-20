package com.thesis.mobile.model

import org.json.JSONArray
import org.json.JSONObject

object ReportViewMapper {
    fun mapAnalysisReport(payload: JSONObject): DeepDiveReportView {
        val sectionsJson = payload.optJSONArray("sections") ?: JSONArray()
        val sections = (0 until sectionsJson.length()).mapNotNull { index ->
            sectionsJson.optJSONObject(index)?.let(::mapSection)
        }

        val schemaVersion = payload.optString("schema_version", "1.0")
        val majorVersion = schemaVersion.substringBefore(".").toIntOrNull() ?: 1
        val thesisFromSection = sections
            .firstOrNull { section ->
                section.sectionId == "thesis_statement" ||
                    section.title.equals("Thesis Statement", ignoreCase = true)
            }
            ?.body
            ?.takeIf { it.isNotBlank() }

        return DeepDiveReportView(
            reportId = payload.optString("report_id"),
            ticker = payload.optNullableString("ticker"),
            schemaVersion = schemaVersion,
            isLegacy = majorVersion < 2,
            thesisStatement = thesisFromSection,
            storyHeader = mapStoryHeader(payload.optJSONObject("story_header")),
            changeSummary = mapChangeSummary(payload.optJSONObject("change_summary")),
            visualPanels = mapVisualPanels(payload.optJSONArray("visual_panels")),
            explainers = mapExplainers(payload.optJSONObject("explainers")),
            watchItems = mapStringArray(payload.optJSONArray("watch_items")),
            coverageTruth = mapCoverageTruth(payload.optJSONObject("coverage_truth")),
            confidence = mapConfidence(payload.optJSONObject("confidence")),
            signalValue = payload.optJSONObject("signal")?.optNullableString("value"),
            signalReasons = mapStringArray(payload.optJSONObject("signal")?.optJSONArray("reasons")),
            confidenceLabel = payload.optJSONObject("confidence")?.optNullableString("label"),
            confidenceScore = payload.optJSONObject("confidence")?.optNullableDouble("score"),
            valuation = mapValuation(payload.optJSONObject("valuation")),
            historical = mapHistorical(payload.optJSONObject("historical_context")),
            trustMetadata = mapTrustMetadata(payload.optJSONObject("trust_metadata")),
            sections = sections
        )
    }

    private fun mapStoryHeader(row: JSONObject?): DeepDiveStoryHeaderView? {
        if (row == null) {
            return null
        }
        val headline = row.optString("headline", "").trim()
        val thesisSummary = row.optString("thesis_summary", "").trim()
        val whyNow = row.optString("why_now", "").trim()
        val readerTakeaway = row.optString("reader_takeaway", "").trim()
        val stanceLabel = row.optString("stance_label", "").trim()
        if (
            headline.isBlank() ||
            thesisSummary.isBlank() ||
            whyNow.isBlank() ||
            readerTakeaway.isBlank() ||
            stanceLabel.isBlank()
        ) {
            return null
        }
        return DeepDiveStoryHeaderView(
            headline = headline,
            thesisSummary = thesisSummary,
            whyNow = whyNow,
            readerTakeaway = readerTakeaway,
            stanceLabel = stanceLabel
        )
    }

    private fun mapChangeSummary(row: JSONObject?): DeepDiveChangeSummaryView? {
        if (row == null) {
            return null
        }
        val previousView = row.optString("previous_view", "").trim()
        val currentView = row.optString("current_view", "").trim()
        if (previousView.isBlank() || currentView.isBlank()) {
            return null
        }
        val changes = row.optJSONArray("top_changes")
        return DeepDiveChangeSummaryView(
            previousView = previousView,
            currentView = currentView,
            topChanges = if (changes == null) {
                emptyList()
            } else {
                (0 until changes.length()).mapNotNull { index ->
                    changes.optJSONObject(index)?.let(::mapTopChange)
                }
            }
        )
    }

    private fun mapTopChange(row: JSONObject): DeepDiveTopChangeView? {
        val title = row.optString("title", "").trim()
        val direction = row.optString("direction", "").trim()
        val impactLevel = row.optString("impact_level", "").trim()
        val whyItChanged = row.optString("why_it_changed", "").trim()
        val whyItMatters = row.optString("why_it_matters", "").trim()
        if (
            title.isBlank() ||
            direction.isBlank() ||
            impactLevel.isBlank() ||
            whyItChanged.isBlank() ||
            whyItMatters.isBlank()
        ) {
            return null
        }
        return DeepDiveTopChangeView(
            title = title,
            direction = direction,
            impactLevel = impactLevel,
            whyItChanged = whyItChanged,
            whyItMatters = whyItMatters
        )
    }

    private fun mapVisualPanels(rows: JSONArray?): List<DeepDiveVisualPanelView> {
        if (rows == null) {
            return emptyList()
        }
        return (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let(::mapVisualPanel)
        }
    }

    private fun mapVisualPanel(row: JSONObject): DeepDiveVisualPanelView? {
        val type = row.optString("type", "").trim()
        val title = row.optString("title", "").trim()
        if (type.isBlank() || title.isBlank()) {
            return null
        }
        val eyebrow = row.optNullableString("eyebrow")
        val summary = row.optNullableString("summary")
        return when (type) {
            "metric_delta" -> MetricDeltaPanelView(
                title = title,
                eyebrow = eyebrow,
                summary = summary,
                metrics = row.optJSONArray("metrics")?.let(::mapMetricDeltaItems).orEmpty()
            )
            "timeline" -> TimelinePanelView(
                title = title,
                eyebrow = eyebrow,
                summary = summary,
                points = row.optJSONArray("points")?.let(::mapTimelinePoints).orEmpty()
            )
            "range_band" -> RangeBandPanelView(
                title = title,
                eyebrow = eyebrow,
                summary = summary,
                lowValue = row.optNullableDouble("low_value"),
                midValue = row.optNullableDouble("mid_value"),
                highValue = row.optNullableDouble("high_value"),
                referenceValue = row.optNullableDouble("reference_value"),
                valueLabel = row.optNullableString("value_label"),
                referenceLabel = row.optNullableString("reference_label")
            )
            "trust_scorecard" -> TrustScorecardPanelView(
                title = title,
                eyebrow = eyebrow,
                summary = summary,
                freshnessState = row.optNullableString("freshness_state"),
                contradictionState = row.optNullableString("contradiction_state"),
                valuationState = row.optNullableString("valuation_state"),
                evidenceCount = row.optNullableInt("evidence_count")
            )
            "evidence_ladder" -> EvidenceLadderPanelView(
                title = title,
                eyebrow = eyebrow,
                summary = summary,
                rungs = row.optJSONArray("rungs")?.let(::mapEvidenceLadderRungs).orEmpty()
            )
            "valuation_bridge" -> ValuationBridgePanelView(
                title = title,
                eyebrow = eyebrow,
                summary = summary,
                points = row.optJSONArray("points")?.let(::mapValuationBridgePoints).orEmpty()
            )
            "scenario_compare" -> {
                val baseLabel = row.optString("base_label", "").trim()
                val scenarioLabel = row.optString("scenario_label", "").trim()
                if (baseLabel.isBlank() || scenarioLabel.isBlank()) {
                    null
                } else {
                    ScenarioComparePanelView(
                        title = title,
                        eyebrow = eyebrow,
                        summary = summary,
                        baseLabel = baseLabel,
                        scenarioLabel = scenarioLabel,
                        baseValue = row.optNullableDouble("base_value"),
                        scenarioValue = row.optNullableDouble("scenario_value"),
                        deltaText = row.optNullableString("delta_text")
                    )
                }
            }
            else -> null
        }
    }

    private fun mapMetricDeltaItems(rows: JSONArray): List<MetricDeltaItemView> =
        (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let { row ->
                val label = row.optString("label", "").trim()
                val basis = row.optString("basis", "").trim()
                val direction = row.optString("direction", "").trim()
                if (label.isBlank() || basis.isBlank() || direction.isBlank()) {
                    null
                } else {
                    MetricDeltaItemView(
                        label = label,
                        currentValue = row.optNullableDouble("current_value"),
                        referenceValue = row.optNullableDouble("reference_value"),
                        deltaPct = row.optNullableDouble("delta_pct"),
                        basis = basis,
                        direction = direction,
                        note = row.optNullableString("note")
                    )
                }
            }
        }

    private fun mapTimelinePoints(rows: JSONArray): List<TimelinePointView> =
        (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let { row ->
                val label = row.optString("label", "").trim()
                val value = row.optString("value", "").trim()
                if (label.isBlank() || value.isBlank()) {
                    null
                } else {
                    TimelinePointView(
                        label = label,
                        value = value,
                        emphasis = row.optNullableString("emphasis")
                    )
                }
            }
        }

    private fun mapEvidenceLadderRungs(rows: JSONArray): List<EvidenceLadderRungView> =
        (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let { row ->
                val label = row.optString("label", "").trim()
                val tone = row.optString("tone", "").trim()
                val count = row.optInt("count", -1)
                if (label.isBlank() || tone.isBlank() || count < 0) {
                    null
                } else {
                    EvidenceLadderRungView(
                        label = label,
                        count = count,
                        tone = tone
                    )
                }
            }
        }

    private fun mapValuationBridgePoints(rows: JSONArray): List<ValuationBridgePointView> =
        (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let { row ->
                val label = row.optString("label", "").trim()
                val tone = row.optString("tone", "").trim()
                val value = row.optNullableDouble("value")
                if (label.isBlank() || tone.isBlank() || value == null) {
                    null
                } else {
                    ValuationBridgePointView(
                        label = label,
                        value = value,
                        tone = tone
                    )
                }
            }
        }

    private fun mapExplainers(row: JSONObject?): DeepDiveExplainersView? {
        if (row == null) {
            return null
        }
        val signal = row.optString("signal", "").trim()
        val confidence = row.optString("confidence", "").trim()
        val freshness = row.optString("freshness", "").trim()
        val valuation = row.optString("valuation", "").trim()
        val omissions = row.optString("omissions", "").trim()
        if (
            signal.isBlank() ||
            confidence.isBlank() ||
            freshness.isBlank() ||
            valuation.isBlank() ||
            omissions.isBlank()
        ) {
            return null
        }
        return DeepDiveExplainersView(
            signal = signal,
            confidence = confidence,
            freshness = freshness,
            valuation = valuation,
            omissions = omissions
        )
    }

    private fun mapCoverageTruth(row: JSONObject?): DeepDiveCoverageTruthView? {
        if (row == null) {
            return null
        }
        val summary = row.optString("summary", "").trim()
        if (summary.isBlank()) {
            return null
        }
        return DeepDiveCoverageTruthView(
            summary = summary,
            covered = mapStringArray(row.optJSONArray("covered")),
            missing = mapStringArray(row.optJSONArray("missing"))
        )
    }

    fun mapReportNote(payload: JSONObject): ReportNoteView? {
        val data = payload.optJSONObject("data") ?: payload
        val content = data.optString("content", "")
        val updatedAt = data.optNullableString("updated_at") ?: return null
        return ReportNoteView(content = content, updatedAt = updatedAt)
    }

    fun mapScenarioResult(payload: JSONObject): ScenarioResultView? {
        val reportId = payload.optString("report_id").ifBlank { return null }
        val base = mapValuation(payload.optJSONObject("base")) ?: return null
        val scenario = mapValuation(payload.optJSONObject("scenario")) ?: return null
        return ScenarioResultView(
            reportId = reportId,
            base = base,
            scenario = scenario,
            deterministicModel = payload.optNullableString("deterministic_model"),
            omissions = mapScenarioOmissions(payload.optJSONArray("omissions"))
        )
    }

    private fun mapSection(row: JSONObject): SectionView {
        return SectionView(
            sectionId = row.optNullableString("section_id"),
            title = row.optString("title", "Untitled"),
            body = row.optString("body", ""),
            status = row.optNullableString("status"),
            evidence = mapEvidence(row.optJSONArray("evidence"))
        )
    }

    private fun mapEvidence(rows: JSONArray?): List<EvidenceView> {
        if (rows == null) {
            return emptyList()
        }
        return (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let { row ->
                EvidenceView(
                    sourceName = row.optString("source_name", "Unknown source"),
                    excerpt = row.optString("excerpt", ""),
                    url = row.optNullableString("url")
                )
            }
        }
    }

    private fun mapConfidence(row: JSONObject?): ConfidenceDisplayView? {
        if (row == null) {
            return null
        }
        return ConfidenceDisplayView(
            score = row.optNullableDouble("score"),
            label = row.optNullableString("label"),
            limitingFactors = mapStringArray(row.optJSONArray("limiting_factors"))
        )
    }

    private fun mapValuation(row: JSONObject?): ValuationDisplayView? {
        if (row == null) {
            return null
        }
        return ValuationDisplayView(
            fairValueMid = row.optNullableDouble("fair_value_mid"),
            fairValueLow = row.optNullableDouble("fair_value_low"),
            fairValueHigh = row.optNullableDouble("fair_value_high"),
            spotPrice = row.optNullableDouble("spot_price"),
            impliedUpsidePct = row.optNullableDouble("implied_upside_pct"),
            assumptions = mapValuationAssumptions(row.optJSONObject("assumptions")),
            degradedReason = row.optNullableString("degraded_reason")
        )
    }

    private fun mapValuationAssumptions(row: JSONObject?): ValuationAssumptionsView? {
        if (row == null) {
            return null
        }
        return ValuationAssumptionsView(
            methodology = row.optNullableString("methodology"),
            projectionYears = row.optNullableInt("projection_years"),
            terminalGrowthRate = row.optNullableDouble("terminal_growth_rate"),
            wacc = row.optNullableDouble("wacc")
        )
    }

    private fun mapHistorical(row: JSONObject?): HistoricalDisplayView? {
        if (row == null) {
            return null
        }
        return HistoricalDisplayView(
            latestPeriod = row.optNullableString("latest_period"),
            priorQuarterPeriod = row.optNullableString("prior_quarter_period"),
            yearAgoPeriod = row.optNullableString("year_ago_period"),
            financialSnapshotCount = row.optInt("financial_snapshot_count", 0),
            transcriptCount = row.optInt("transcript_count", 0)
        )
    }

    private fun mapTrustMetadata(row: JSONObject?): TrustMetadataView? {
        if (row == null) {
            return null
        }
        return TrustMetadataView(
            generatedAt = row.optNullableString("generated_at"),
            freshnessState = row.optNullableString("freshness_state"),
            evidenceCount = row.optNullableInt("evidence_count"),
            contradictionState = row.optNullableString("contradiction_state"),
            contradictions = mapTrustContradictions(row.optJSONArray("contradictions")),
            valuationState = row.optNullableString("valuation_state"),
            missingDataNotes = mapStringArray(row.optJSONArray("missing_data_notes")),
            quoteProvenance = mapQuoteProvenance(row.optJSONArray("quote_provenance")),
            thesisDrift = mapThesisDrift(row.optJSONObject("thesis_drift"))
        )
    }

    private fun mapTrustContradictions(row: JSONArray?): List<TrustContradictionView> {
        if (row == null) {
            return emptyList()
        }
        return (0 until row.length()).mapNotNull { index ->
            row.optJSONObject(index)?.let { entry ->
                val description = entry.optString("description", "").trim()
                if (description.isBlank()) {
                    null
                } else {
                    TrustContradictionView(
                        id = entry.optString("id", "contradiction-$index"),
                        description = description,
                        severity = entry.optString("severity", "medium")
                    )
                }
            }
        }
    }

    private fun mapQuoteProvenance(row: JSONArray?): List<TrustQuoteProvenanceView> {
        if (row == null) {
            return emptyList()
        }
        return (0 until row.length()).mapNotNull { index ->
            row.optJSONObject(index)?.let { entry ->
                val quote = entry.optString("quote", "").trim()
                if (quote.isBlank()) {
                    null
                } else {
                    TrustQuoteProvenanceView(
                        quote = quote,
                        sourceName = entry.optString("source_name", "Unknown source"),
                        sourceType = entry.optString("source_type", "article"),
                        sourcePeriod = entry.optNullableString("source_period"),
                        transcriptId = entry.optNullableString("transcript_id"),
                        retrievedAt = entry.optNullableString("retrieved_at")
                    )
                }
            }
        }
    }

    private fun mapThesisDrift(row: JSONObject?): TrustThesisDriftView? {
        if (row == null) {
            return null
        }
        val summary = row.optString("summary", "").trim()
        if (summary.isBlank()) {
            return null
        }
        return TrustThesisDriftView(
            status = row.optString("status", "unavailable"),
            summary = summary,
            reasons = mapStringArray(row.optJSONArray("reasons")),
            comparableReportId = row.optNullableString("comparable_report_id"),
            comparableGeneratedAt = row.optNullableString("comparable_generated_at"),
            comparableSchemaVersion = row.optNullableString("comparable_schema_version")
        )
    }

    private fun mapStringArray(row: JSONArray?): List<String> {
        if (row == null) {
            return emptyList()
        }
        return (0 until row.length()).mapNotNull { index ->
            row.optString(index).takeIf { it.isNotBlank() }
        }
    }

    private fun mapScenarioOmissions(row: JSONArray?): List<ScenarioInputOmissionView> {
        if (row == null) {
            return emptyList()
        }
        return (0 until row.length()).mapNotNull { index ->
            row.optJSONObject(index)?.let { omission ->
                val code = omission.optString("omission_code").trim()
                val text = omission.optString("omission_text").trim()
                if (code.isBlank() || text.isBlank()) {
                    null
                } else {
                    ScenarioInputOmissionView(
                        omissionCode = code,
                        omissionText = text,
                        affectsFields = mapStringArray(omission.optJSONArray("affects_fields"))
                    )
                }
            }
        }
    }
}

private fun JSONObject.optNullableString(key: String): String? {
    val value = optString(key, "")
    return if (value.isBlank()) null else value
}

private fun JSONObject.optNullableDouble(key: String): Double? {
    if (!has(key) || isNull(key)) {
        return null
    }
    val value = optDouble(key, Double.NaN)
    return if (value.isNaN()) null else value
}

private fun JSONObject.optNullableInt(key: String): Int? {
    if (!has(key) || isNull(key)) {
        return null
    }
    return optInt(key)
}

