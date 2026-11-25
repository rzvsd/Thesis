package com.thesis.mobile.ui.today

import androidx.compose.runtime.Immutable
import com.thesis.mobile.model.MarketTapeFamily
import com.thesis.mobile.model.MarketTapeMoveView
import com.thesis.mobile.model.MarketTapeView
import com.thesis.mobile.ui.components.TapeItem
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.marketTone

/*
 * The market tape view model (docs/app-redesign/DESIGN-DIRECTION.md 5.5, 5.6 block 3, 5.7 chapter 01): the
 * structured `market_tape` the Pulse already carries, formatted once for the Home tape row and the Pulse Markets
 * rows. Tone follows the instrument family the server sent (`marketTone`): indices and commodities by sign;
 * volatility, rates, the dollar and credit spreads always neutral (sign only). A dated snapshot, never live.
 */

/** One instrument, formatted. [change] is the compact change the tape shows; [delta] the full one for rows. */
@Immutable
data class TapeLine(
    val id: String,
    /** Short name for the tape ("10Y", "Dollar"). */
    val short: String,
    /** Full name for rows and TalkBack ("10-year Treasury yield"). */
    val name: String,
    val level: String,
    /** Compact change: "+0.7%", "−3 bps". */
    val change: String,
    /** Row delta: "+40.44 · +0.7%", "−3 bps". */
    val delta: String,
    val tone: Tone,
    val family: MarketTapeFamily,
    val sourceName: String? = null,
    val sourceUrl: String? = null,
)

object TapeModel {

    /** The tape's instruments in reading order: indices, rates, volatility, the dollar, commodities, credit. */
    fun lines(tape: MarketTapeView?): List<TapeLine> {
        if (tape == null) return emptyList()
        return tape.moves
            .withIndex()
            .sortedWith(compareBy({ familyRank(it.value.family) }, { it.index }))
            .map { line(it.value) }
    }

    /** The kit's tape items for the Home `TapeRow`. */
    fun items(lines: List<TapeLine>): List<TapeItem> = lines.map { TapeItem(it.short, it.level, it.change, it.tone) }

    /** Tab-separated text ("Copy as table"): instrument, level, change, % change; pastes into a spreadsheet. */
    fun tsv(tape: MarketTapeView?): String {
        val rows = lines(tape)
        if (rows.isEmpty()) return ""
        val moves = tape!!.moves.associateBy { it.instrumentId }
        val header = listOf("Instrument", "Level", "Change", "Change %").joinToString("\t")
        val body = rows.map { line ->
            val move = moves[line.id]
            listOf(
                line.name,
                line.level,
                move?.let { changeText(it) } ?: "",
                move?.dailyChangePct?.let { Fmt.signedPct(it) } ?: Fmt.NA,
            ).joinToString("\t")
        }
        return (listOf(header) + body).joinToString("\n")
    }

    fun line(move: MarketTapeMoveView): TapeLine {
        val change = move.dailyChange ?: move.dailyChangePct ?: Double.NaN
        return TapeLine(
            id = move.instrumentId,
            short = shortName(move),
            name = longName(move),
            level = level(move),
            change = compactChange(move),
            delta = rowDelta(move),
            tone = if (change.isNaN()) Tone.Unknown else marketTone(move.family, change),
            family = move.family,
            sourceName = move.sourceName,
            sourceUrl = move.sourceUrl,
        )
    }

    private fun familyRank(family: MarketTapeFamily): Int = when (family) {
        MarketTapeFamily.CoreIndex -> 0
        MarketTapeFamily.Rates -> 1
        MarketTapeFamily.Volatility -> 2
        MarketTapeFamily.Currency -> 3
        MarketTapeFamily.Commodity -> 4
        MarketTapeFamily.Credit -> 5
        MarketTapeFamily.Sector -> 6
        MarketTapeFamily.Unknown -> 7
    }

    /** True when the level is a rate in percent: changes are then basis points, never "%". */
    private fun isRate(move: MarketTapeMoveView): Boolean =
        move.unit?.lowercase() == "percent" || move.family == MarketTapeFamily.Rates

    fun level(move: MarketTapeMoveView): String {
        val v = move.value ?: return Fmt.NOT_DISCLOSED
        return when (move.unit?.lowercase()) {
            "percent" -> Fmt.pct(v, dp = 2)
            "usd_per_barrel", "usd", "price", "usd_per_ounce" -> "$" + Fmt.number(v, 2)
            else -> Fmt.number(v, 2)
        }
    }

    /** Points change for non-rates: "+40.44", "−0.78". */
    private fun changeText(move: MarketTapeMoveView): String {
        val c = move.dailyChange ?: return Fmt.NA
        if (isRate(move)) return Fmt.bpsFromPoints(c)
        val sign = if (Math.round(c * 100) == 0L) "" else if (c > 0) "+" else ""
        return sign + Fmt.number(c, 2)
    }

    private fun compactChange(move: MarketTapeMoveView): String = when {
        isRate(move) && move.dailyChange != null -> Fmt.bpsFromPoints(move.dailyChange)
        move.dailyChangePct != null -> Fmt.signedPct(move.dailyChangePct)
        move.dailyChange != null -> changeText(move)
        else -> Fmt.NA
    }

    private fun rowDelta(move: MarketTapeMoveView): String = when {
        isRate(move) && move.dailyChange != null -> Fmt.bpsFromPoints(move.dailyChange)
        move.dailyChange != null && move.dailyChangePct != null ->
            "${changeText(move)} · ${Fmt.signedPct(move.dailyChangePct)}"
        move.dailyChangePct != null -> Fmt.signedPct(move.dailyChangePct)
        move.dailyChange != null -> changeText(move)
        else -> Fmt.NA
    }

    private val ShortById = mapOf(
        "SP500" to "S&P 500",
        "SPX" to "S&P 500",
        "NASDAQCOM" to "Nasdaq",
        "NASDAQ100" to "Nasdaq 100",
        "NDX" to "Nasdaq 100",
        "DJIA" to "Dow",
        "RUT" to "Russell 2000",
        "VIXCLS" to "VIX",
        "VIX" to "VIX",
        "DGS2" to "2Y",
        "DGS10" to "10Y",
        "DGS30" to "30Y",
        "DCOILWTICO" to "WTI",
        "WTI" to "WTI",
        "DCOILBRENTEU" to "Brent",
        "DTWEXBGS" to "Dollar",
        "DXY" to "DXY",
        "BAMLH0A0HYM2" to "HY spread",
        "BAMLC0A0CM" to "IG spread",
    )

    private val LongById = mapOf(
        "SP500" to "S&P 500",
        "SPX" to "S&P 500",
        "NASDAQCOM" to "Nasdaq Composite",
        "NASDAQ100" to "Nasdaq 100",
        "NDX" to "Nasdaq 100",
        "DJIA" to "Dow Jones Industrial Average",
        "RUT" to "Russell 2000",
        "VIXCLS" to "VIX",
        "VIX" to "VIX",
        "DGS2" to "2-year Treasury yield",
        "DGS10" to "10-year Treasury yield",
        "DGS30" to "30-year Treasury yield",
        "DCOILWTICO" to "WTI crude, $ a barrel",
        "WTI" to "WTI crude, $ a barrel",
        "DCOILBRENTEU" to "Brent crude, $ a barrel",
        "DTWEXBGS" to "Dollar index, broad",
        "DXY" to "Dollar index (DXY)",
        "BAMLH0A0HYM2" to "High-yield spread",
        "BAMLC0A0CM" to "Investment-grade spread",
    )

    fun shortName(move: MarketTapeMoveView): String {
        ShortById[move.instrumentId.uppercase()]?.let { return it }
        val label = move.label.trim()
        Regex("(?i)treasury\\s*(\\d{1,2})\\s*y").find(label)?.let { return "${it.groupValues[1]}Y" }
        return when {
            label.contains("Dow Jones", ignoreCase = true) -> "Dow"
            label.contains("dollar", ignoreCase = true) -> "Dollar"
            label.contains("high yield", ignoreCase = true) -> "HY spread"
            label.contains("Nasdaq Composite", ignoreCase = true) -> "Nasdaq"
            else -> label
        }
    }

    fun longName(move: MarketTapeMoveView): String {
        LongById[move.instrumentId.uppercase()]?.let { return it }
        val label = move.label.trim()
        Regex("(?i)treasury\\s*(\\d{1,2})\\s*y").find(label)?.let { return "${it.groupValues[1]}-year Treasury yield" }
        return label
    }
}
