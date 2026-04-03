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
            scenario = scenario
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

