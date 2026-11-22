package com.thesis.mobile.model

import org.json.JSONArray
import org.json.JSONObject

// Native views of the report blocks that until now only reached the HTML/PDF export:
// `filing_intelligence` (what changed in the latest filing) and
// `financial_indicators` (indicators, value lens, plain-English reads, education).

data class FilingMetricDeltaView(
    val label: String,
    val currentPeriod: String,
    val referencePeriod: String?,
    val unit: String,
    val currentValue: Double?,
    val referenceValue: Double?,
    val deltaPct: Double?,
    val direction: String,
    val plainEnglish: String
)

data class FilingReadView(
    val form: String?,
    val period: String?,
    val generationMode: String,
    val theFilingRead: String,
    val whatChanged: String,
    val theGood: String,
    val theBad: String,
    val takeaway: String,
    val whatToWatchNext: String,
    val topChanges: List<String>,
    val metricDeltas: List<FilingMetricDeltaView>
)

data class IndicatorView(
    val group: String,
    val label: String,
    val value: Double?,
    val unit: String,
    val period: String,
    val interpretation: String
)

data class EducationBoxView(
    val title: String,
    val body: String,
    val example: String?
)

data class IndicatorsReadView(
    val period: String,
    val classification: String?,
    val classificationConfidence: String?,
    val classificationReasons: List<String>,
    val trapWarnings: List<String>,
    val valueLens: String,
    val businessQuality: String,
    val balanceSheetRead: String,
    val cashFlowRead: String,
    val fiveYearRead: String,
    val takeaway: String,
    val whatToWatchNext: String,
    val indicators: List<IndicatorView>,
    val education: List<EducationBoxView>
)

private val indicatorGroups = listOf(
    "valuation",
    "profitability",
    "growth",
    "balance_sheet",
    "cash_flow_quality",
    "capital_allocation"
)

internal fun mapFilingRead(row: JSONObject?): FilingReadView? {
    val memo = row?.optJSONObject("memo") ?: return null
    val latest = row.optJSONObject("latest_filing")
    return FilingReadView(
        form = latest?.text("form"),
        period = latest?.text("period"),
        generationMode = row.optString("generation_mode"),
        theFilingRead = memo.optString("the_filing_read"),
        whatChanged = memo.optString("what_changed"),
        theGood = memo.optString("the_good"),
        theBad = memo.optString("the_bad"),
        takeaway = memo.optString("plain_english_takeaway"),
        whatToWatchNext = memo.optString("what_to_watch_next"),
        topChanges = row.optJSONArray("top_changes").strings(),
        metricDeltas = row.optJSONArray("metric_deltas").objects().map { delta ->
            FilingMetricDeltaView(
                label = delta.optString("label"),
                currentPeriod = delta.optString("current_period"),
                referencePeriod = delta.text("reference_period"),
                unit = delta.optString("unit"),
                currentValue = delta.number("current_value"),
                referenceValue = delta.number("reference_value"),
                deltaPct = delta.number("delta_pct"),
                direction = delta.optString("direction"),
                plainEnglish = delta.optString("plain_english")
            )
        }
    )
}

internal fun mapIndicatorsRead(row: JSONObject?): IndicatorsReadView? {
    val plain = row?.optJSONObject("plain_english") ?: return null
    val classification = row.optJSONObject("value_classification")
    return IndicatorsReadView(
        period = row.optString("period"),
        classification = classification?.text("classification"),
        classificationConfidence = classification?.text("confidence"),
        classificationReasons = classification?.optJSONArray("reasons").strings(),
        trapWarnings = classification?.optJSONArray("trap_warnings").strings(),
        valueLens = plain.optString("value_lens"),
        businessQuality = plain.optString("business_quality"),
        balanceSheetRead = plain.optString("balance_sheet_read"),
        cashFlowRead = plain.optString("cash_flow_read"),
        fiveYearRead = plain.optString("five_year_read"),
        takeaway = plain.optString("plain_english_takeaway"),
        whatToWatchNext = plain.optString("what_to_watch_next"),
        indicators = indicatorGroups.flatMap { group ->
            row.optJSONArray(group).objects()
                .filter { it.optString("state") == "available" }
                .map { indicator ->
                    IndicatorView(
                        group = group,
                        label = indicator.optString("label"),
                        value = indicator.number("value"),
                        unit = indicator.optString("unit"),
                        period = indicator.optString("period"),
                        interpretation = indicator.optString("interpretation")
                    )
                }
        },
        education = row.optJSONArray("education").objects().map { box ->
            EducationBoxView(
                title = box.optString("title"),
                body = box.optString("body"),
                example = box.text("example")
            )
        }
    )
}

private fun JSONObject.text(key: String): String? =
    if (isNull(key)) null else optString(key).trim().ifBlank { null }

private fun JSONObject.number(key: String): Double? =
    if (isNull(key) || !has(key)) null else optDouble(key).takeIf { it.isFinite() }

private fun JSONArray?.objects(): List<JSONObject> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it) }

private fun JSONArray?.strings(): List<String> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { optString(it).trim().ifBlank { null } }
