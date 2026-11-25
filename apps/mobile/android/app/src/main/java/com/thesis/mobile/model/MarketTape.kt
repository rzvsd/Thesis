package com.thesis.mobile.model

import org.json.JSONArray
import org.json.JSONObject

/**
 * The structured market tape that `/pulse/latest` and `/pulse/:date` already return (`market_tape`, contract
 * `packages/contracts/src/market-tape.ts`). Replaces reading levels out of section prose: it has levels, units,
 * the dollar index and an instrument family, so colour can follow the family (DESIGN-DIRECTION 2.2, 5.5).
 *
 * A dated snapshot, never a live quote: [asOf] is shown next to it (principle 14).
 */
data class MarketTapeView(
    val asOf: String?,
    val coverageState: String?,
    val summary: String?,
    val indices: List<MarketTapeMoveView>,
    val crossAsset: List<MarketTapeMoveView>
) {
    /** Indices first, then cross-asset, in server order (the order the tape row shows them). */
    val moves: List<MarketTapeMoveView> get() = indices + crossAsset

    val isEmpty: Boolean get() = indices.isEmpty() && crossAsset.isEmpty()
}

data class MarketTapeMoveView(
    val instrumentId: String,
    val label: String,
    val family: MarketTapeFamily,
    /** The server's family string, kept for families this version does not know yet. */
    val familyRaw: String,
    val value: Double?,
    val previousValue: Double?,
    val dailyChange: Double?,
    val dailyChangePct: Double?,
    /** "index", "percent", "usd_per_barrel", "price", ... as sent. */
    val unit: String?,
    /** "up", "down" or "flat" as sent (the server computes it; do not re-derive from the sign). */
    val direction: String,
    /** The market day the value belongs to: the source period when given, else the tape's as-of date. */
    val asOf: String?,
    val retrievedAt: String?,
    val sourceName: String?,
    val sourceUrl: String?
)

/**
 * Instrument families from the contract. [directionNeutral] families (volatility, rates, currency, credit)
 * are shown with sign and arrow only, never green/red: a rising VIX or yield is not "good" (principle 5).
 */
enum class MarketTapeFamily(val wire: String, val directionNeutral: Boolean) {
    CoreIndex("core_index", false),
    Volatility("volatility", true),
    Rates("rates", true),
    Commodity("commodity", false),
    Currency("currency", true),
    Credit("credit", true),
    Sector("sector", false),
    Unknown("", true);

    companion object {
        fun fromWire(raw: String?): MarketTapeFamily {
            val key = raw?.trim()?.lowercase().orEmpty()
            return entries.firstOrNull { it.wire == key && it != Unknown } ?: Unknown
        }
    }
}

object MarketTapeParser {

    /** Parses a `market_tape` object. Null when it is absent or has no usable move. Never throws. */
    fun parse(json: JSONObject?): MarketTapeView? {
        if (json == null) return null
        return runCatching {
            val asOf = json.optStringOrNull("as_of")
            val tape = MarketTapeView(
                asOf = asOf,
                coverageState = json.optStringOrNull("coverage_state"),
                summary = json.optStringOrNull("summary"),
                indices = parseMoves(json.optJSONArray("indices"), asOf),
                crossAsset = parseMoves(json.optJSONArray("cross_asset"), asOf)
            )
            tape.takeUnless { it.isEmpty }
        }.getOrNull()
    }

    /** The same shape the server sends, so a cached Pulse parses through [parse] again. */
    fun toJson(tape: MarketTapeView): JSONObject = JSONObject()
        .putOpt("as_of", tape.asOf)
        .putOpt("coverage_state", tape.coverageState)
        .putOpt("summary", tape.summary)
        .put("indices", JSONArray().apply { tape.indices.forEach { put(moveToJson(it)) } })
        .put("cross_asset", JSONArray().apply { tape.crossAsset.forEach { put(moveToJson(it)) } })

    private fun parseMoves(array: JSONArray?, packAsOf: String?): List<MarketTapeMoveView> {
        if (array == null) return emptyList()
        return (0 until array.length()).mapNotNull { index -> parseMove(array.optJSONObject(index), packAsOf) }
    }

    private fun parseMove(row: JSONObject?, packAsOf: String?): MarketTapeMoveView? {
        if (row == null) return null
        val instrumentId = row.optStringOrNull("instrument_id") ?: return null
        val label = row.optStringOrNull("label") ?: instrumentId
        val familyRaw = row.optString("family", "").trim()
        val retrieval = row.optJSONObject("retrieval")
        val source = retrieval?.optJSONObject("source")
        val value = row.optFiniteDouble("value")
        val change = row.optFiniteDouble("daily_change")
        val changePct = row.optFiniteDouble("daily_change_pct")
        // A move with no level and no change carries nothing to show.
        if (value == null && change == null && changePct == null) return null
        return MarketTapeMoveView(
            instrumentId = instrumentId,
            label = label,
            family = MarketTapeFamily.fromWire(familyRaw),
            familyRaw = familyRaw,
            value = value,
            previousValue = row.optFiniteDouble("previous_value"),
            dailyChange = change,
            dailyChangePct = changePct,
            unit = row.optStringOrNull("unit"),
            direction = row.optStringOrNull("direction")?.lowercase() ?: "flat",
            asOf = retrieval?.optStringOrNull("source_period")?.takeIf(::isIsoDay) ?: packAsOf,
            retrievedAt = retrieval?.optStringOrNull("retrieved_at"),
            sourceName = source?.optStringOrNull("source_name"),
            sourceUrl = source?.optStringOrNull("source_url")
        )
    }

    private fun moveToJson(move: MarketTapeMoveView): JSONObject {
        val source = JSONObject()
            .putOpt("source_name", move.sourceName)
            .putOpt("source_url", move.sourceUrl)
        val retrieval = JSONObject()
            .putOpt("source_period", move.asOf)
            .putOpt("retrieved_at", move.retrievedAt)
            .put("source", source)
        return JSONObject()
            .put("instrument_id", move.instrumentId)
            .put("label", move.label)
            .put("family", move.familyRaw)
            .putOpt("value", move.value)
            .putOpt("previous_value", move.previousValue)
            .putOpt("daily_change", move.dailyChange)
            .putOpt("daily_change_pct", move.dailyChangePct)
            .putOpt("unit", move.unit)
            .put("direction", move.direction)
            .put("retrieval", retrieval)
    }

    private fun isIsoDay(value: String): Boolean = Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(value)

    private fun JSONObject.optStringOrNull(key: String): String? {
        if (!has(key) || isNull(key)) return null
        return optString(key, "").trim().ifBlank { null }
    }

    private fun JSONObject.optFiniteDouble(key: String): Double? {
        if (!has(key) || isNull(key)) return null
        val value = optDouble(key)
        return value.takeIf { it.isFinite() }
    }
}
