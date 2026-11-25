package com.thesis.mobile.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import kotlin.math.abs
import kotlin.math.roundToInt

/*
 * Semantic colour API (docs/app-redesign/DESIGN-DIRECTION.md, section 2.2). Replaces the private
 * label-to-colour helpers in the screens. Colour carries meaning only, on the figure or mark it describes,
 * and never alone (a sign or an arrow goes with it). Up is not automatically good.
 */

/** What a value means for the reader, not which way it moved. */
enum class Tone { Favourable, Unfavourable, Neutral, Attention, Unknown }

/** Text colour for [tone] in [p]: Favourable = upText, Unfavourable = downText, Neutral = ink2, Attention = warn, Unknown = muted. */
fun Tone.textColor(p: ThesisPalette): Color = when (this) {
    Tone.Favourable -> p.upText
    Tone.Unfavourable -> p.downText
    Tone.Neutral -> p.ink2
    Tone.Attention -> p.warn
    Tone.Unknown -> p.muted
}

/** Mark colour (bars, squares, chart points) for [tone] in [p]: up / down marks, ink2, warn, muted. */
fun Tone.markColor(p: ThesisPalette): Color = when (this) {
    Tone.Favourable -> p.up
    Tone.Unfavourable -> p.down
    Tone.Neutral -> p.ink2
    Tone.Attention -> p.warn
    Tone.Unknown -> p.muted
}

/** Text colour for this tone in the active palette. */
@Composable
@ReadOnlyComposable
fun Tone.color(): Color = textColor(LocalThesisPalette.current)

/** Mark colour for this tone in the active palette. */
@Composable
@ReadOnlyComposable
fun Tone.mark(): Color = markColor(LocalThesisPalette.current)

/** Families of the Pulse `market_tape` instruments (server `marketTapeInstrumentFamilies`). */
enum class MarketFamily {
    CoreIndex, Sector, Commodity, Volatility, Rates, Currency, Credit, Unknown;

    companion object {
        /** Maps a `market_tape` family key ("core_index", "rates", ...). Unknown keys give [Unknown]. */
        fun fromKey(key: String?): MarketFamily = when (key?.trim()?.lowercase()) {
            "core_index", "index", "equity_index", "equity" -> CoreIndex
            "sector" -> Sector
            "commodity", "commodities" -> Commodity
            "volatility", "vol" -> Volatility
            "rates", "rate", "yield", "yields" -> Rates
            "currency", "fx", "dollar" -> Currency
            "credit", "spread", "spreads" -> Credit
            else -> Unknown
        }

        private val NeutralLabel = Regex(
            "\\b(vix|vxn|move|volatility|yield|yields|treasury|treasuries|bund|gilt|jgb|[0-9]{1,2}\\s?y(r|ear)?|" +
                "dxy|dollar index|usd index|spread|spreads|oas|cdx|itraxx|high yield|investment grade|ig|hy)\\b",
            RegexOption.IGNORE_CASE,
        )
        private val IndexLabel = Regex(
            "(s&p|nasdaq|dow|russell|stoxx|ftse|dax|cac|nikkei|hang seng|msci|spx|ndx|qqq|spy|iwm|\\bes\\b|\\bnq\\b)",
            RegexOption.IGNORE_CASE,
        )
        private val CommodityLabel = Regex(
            "\\b(gold|silver|copper|oil|wti|brent|crude|natural gas|nat gas|platinum|wheat|corn)\\b",
            RegexOption.IGNORE_CASE,
        )

        /** Best effort from an instrument label when no family key is available ("VIX", "US 10Y", "S&P 500"). */
        fun fromLabel(label: String): MarketFamily = when {
            Regex("\\b(vix|vxn|move)\\b", RegexOption.IGNORE_CASE).containsMatchIn(label) -> Volatility
            NeutralLabel.containsMatchIn(label) -> when {
                Regex("dxy|dollar|usd index", RegexOption.IGNORE_CASE).containsMatchIn(label) -> Currency
                Regex("spread|oas|cdx|itraxx|high yield|investment grade|\\big\\b|\\bhy\\b", RegexOption.IGNORE_CASE)
                    .containsMatchIn(label) -> Credit
                else -> Rates
            }
            IndexLabel.containsMatchIn(label) -> CoreIndex
            CommodityLabel.containsMatchIn(label) -> Commodity
            else -> Unknown
        }
    }
}

/**
 * Tone of a market move. Equity indices, sectors and commodities: by sign. Volatility (VIX), yields (2Y, 10Y,
 * 30Y), the dollar (DXY), credit spreads and anything unrecognised: always [Tone.Neutral] (sign and arrow only).
 */
fun marketTone(family: MarketFamily, change: Double): Tone = when {
    change.isNaN() -> Tone.Unknown
    family != MarketFamily.CoreIndex && family != MarketFamily.Sector && family != MarketFamily.Commodity -> Tone.Neutral
    change > 0.0 -> Tone.Favourable
    change < 0.0 -> Tone.Unfavourable
    else -> Tone.Neutral
}

/** [marketTone] keyed on a `market_tape` family key ("core_index") or, failing that, the instrument label. */
fun marketTone(instrument: String, change: Double): Tone {
    val family = MarketFamily.fromKey(instrument).takeIf { it != MarketFamily.Unknown }
        ?: MarketFamily.fromLabel(instrument)
    return marketTone(family, change)
}

/** Macro stress regime boundaries (inclusive upper bounds of Contained and Balanced). */
const val MACRO_STRESS_CONTAINED_MAX = 35
const val MACRO_STRESS_BALANCED_MAX = 69

/** 0-35 Favourable ("Contained"), 36-69 Neutral ("Balanced"), 70-100 Unfavourable ("Elevated"). */
fun macroStressTone(score: Double): Tone {
    if (score.isNaN()) return Tone.Unknown
    val s = score.roundToInt()
    return when {
        s <= MACRO_STRESS_CONTAINED_MAX -> Tone.Favourable
        s <= MACRO_STRESS_BALANCED_MAX -> Tone.Neutral
        else -> Tone.Unfavourable
    }
}

/** The only place the three macro stress words are produced. */
fun macroStressLabel(score: Double): String = when (macroStressTone(score)) {
    Tone.Favourable -> "Contained"
    Tone.Neutral -> "Balanced"
    Tone.Unfavourable -> "Elevated"
    else -> "Not computed"
}

/** Rising stress is Unfavourable, falling stress Favourable; a change that rounds to 0 points is Neutral. */
fun macroStressDeltaTone(delta: Double): Tone = when {
    delta.isNaN() -> Tone.Unknown
    abs(delta) < 0.5 -> Tone.Neutral
    delta > 0.0 -> Tone.Unfavourable
    else -> Tone.Favourable
}

/** intact = Favourable; watch / drifting = Attention; at risk / broken = Unfavourable; anything else Unknown. */
fun thesisStateTone(state: String?): Tone = when (state?.trim()?.lowercase()?.replace(' ', '_')?.replace('-', '_')) {
    "intact", "improved", "strengthening" -> Tone.Favourable
    "watch", "drifting", "drift", "weakening", "unresolved" -> Tone.Attention
    "at_risk", "broken", "weakened" -> Tone.Unfavourable
    else -> Tone.Unknown
}

/** Category square colour for an alert: thesis_drift plum, earnings blue, macro clay, pulse gold, system muted. */
fun alertCategoryColor(category: String?, p: ThesisPalette): Color =
    when (category?.trim()?.lowercase()?.replace(' ', '_')?.replace('-', '_')) {
        "thesis_drift", "drift" -> p.series[1]
        "earnings" -> p.series[3]
        "macro" -> p.series[4]
        "pulse" -> p.series[0]
        else -> p.muted
    }

/** [alertCategoryColor] in the active palette. */
@Composable
@ReadOnlyComposable
fun alertCategoryColor(category: String?): Color = alertCategoryColor(category, LocalThesisPalette.current)
