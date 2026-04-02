package com.thesis.mobile.offline

import com.thesis.mobile.model.ConfidenceDisplayView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.HistoricalDisplayView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportViewMapper
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SentimentSubScoreView
import com.thesis.mobile.model.ValuationAssumptionsView
import com.thesis.mobile.model.ValuationDisplayView
import org.json.JSONArray
import org.json.JSONObject

object OfflineJsonCodec {
    fun encodePulseReport(pulse: PulseReportView): String {
        val payload = JSONObject()
            .put("report_id", pulse.reportId)
            .put("generated_at", pulse.generatedAt)
            .put(
                "sections",
                JSONArray().apply {
                    pulse.sections.forEach { put(sectionToJson(it)) }
                }
            )
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
            sections = sections
        )
    }.getOrNull()

    fun encodeDeepDiveReport(report: DeepDiveReportView): String {
        val payload = JSONObject()
            .put("report_id", report.reportId)
            .put("ticker", report.ticker)
            .put("schema_version", report.schemaVersion)
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
