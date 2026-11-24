package com.thesis.mobile.ui.format

import androidx.compose.runtime.staticCompositionLocalOf
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * The one number and date formatter (docs/app-redesign/DESIGN-DIRECTION.md, section 2.4), ported from
 * `DeepDiveNativeMemo.formatValue` and the renderer's `format.ts`.
 *
 * - Digits are always `Locale.US` (no decimal commas), the minus is U+2212, and figures never ellipsize.
 * - Number functions live on the companion (`Fmt.money(...)`), so mappers and copy can call them anywhere.
 * - Date functions are instance members: a [Fmt] carries the injected [clock], [zone] and [is24h] (the shell
 *   passes the device values through [LocalFmt]), so tests are deterministic.
 * - Missing values are one of three words, never a dash: [NOT_DISCLOSED] (absent from the filing), [NA] (not
 *   meaningful) or [NOT_COMPUTED] (a pipeline gap on our side). Number functions take nullable values and
 *   show [Missing.NotDisclosed] for null unless told otherwise; NaN and infinities show [NA].
 */
class Fmt(
    private val clock: Clock,
    private val zone: ZoneId,
    private val is24h: Boolean,
) {
    // ---- Dates and times (device zone) ----

    private fun today(): LocalDate = LocalDate.now(clock.withZone(zone))

    /** "As of 07:02, Mon 24 Nov" (12 h: "As of 7:02 AM, Mon 24 Nov"); the date carries the year when it differs. */
    fun asOf(instant: Instant): String {
        val at = instant.atZone(zone)
        val time = at.format(if (is24h) Time24 else Time12)
        return "As of $time, ${marketDate(at.toLocalDate())}"
    }

    /** The time of day alone: "07:02" or "7:02 AM". */
    fun time(instant: Instant): String = instant.atZone(zone).format(if (is24h) Time24 else Time12)

    /**
     * "just now", "12 min ago", "3 h ago", "yesterday", "23 days ago", then the date ("24 Nov", or
     * "24 Nov 2024" when not this year). Future instants (clock skew) read "just now".
     */
    fun relative(instant: Instant): String {
        val now = clock.instant()
        val elapsed = Duration.between(instant, now)
        if (elapsed.seconds < 60) return "just now"
        if (elapsed.toMinutes() < 60) return "${elapsed.toMinutes()} min ago"
        if (elapsed.toHours() < 24) return "${elapsed.toHours()} h ago"
        val date = instant.atZone(zone).toLocalDate()
        val days = ChronoUnit.DAYS.between(date, today())
        return when {
            days <= 1 -> "yesterday"
            days < RELATIVE_DAYS_MAX -> "$days days ago"
            else -> shortDate(date)
        }
    }

    /** "Mon 24 Nov"; "24 Nov 2024" whenever the year differs from the current one. */
    fun marketDate(date: LocalDate): String =
        if (date.year == today().year) date.format(DayDate) else date.format(DateYear)

    /** "24 Nov"; "24 Nov 2024" when not this year. */
    fun shortDate(date: LocalDate): String =
        if (date.year == today().year) date.format(DayMonth) else date.format(DateYear)

    /** "17 to 23 Nov", "27 Oct to 2 Nov", "29 Dec 2025 to 4 Jan 2026" (years shown when they differ from now or each other). */
    fun weekRange(start: LocalDate, end: LocalDate): String {
        val thisYear = today().year
        val showYears = start.year != end.year || end.year != thisYear
        return when {
            showYears -> "${start.format(DateYear)} to ${end.format(DateYear)}"
            start.month == end.month -> "${start.dayOfMonth} to ${end.format(DayMonth)}"
            else -> "${start.format(DayMonth)} to ${end.format(DayMonth)}"
        }
    }

    /** "10-K FY2025", "10-Q Q3 FY25 · filed 30 Oct" (the filed date carries the year when it differs). */
    fun filing(form: String, period: String, filed: LocalDate? = null): String {
        val head = listOf(form.trim(), period.trim()).filter { it.isNotEmpty() }.joinToString(" ")
        return if (filed == null) head else "$head · filed ${shortDate(filed)}"
    }

    /** Report age for rows and captions: "10-K · 23 days ago", or "10-K FY2025 · 23 days ago" with a period. */
    fun reportAge(form: String, at: Instant, period: String? = null): String =
        "${filing(form, period.orEmpty())} · ${relative(at)}"

    companion object {
        /** U+2212, the typographic minus. */
        const val MINUS = "−"
        const val NOT_DISCLOSED = "Not disclosed"
        const val NA = "n/a"
        const val NOT_COMPUTED = "Not computed"

        /** Beyond this many days, [relative] shows the date. */
        const val RELATIVE_DAYS_MAX = 30L

        private val Time24 = DateTimeFormatter.ofPattern("HH:mm", Locale.US)
        private val Time12 = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
        private val DayDate = DateTimeFormatter.ofPattern("EEE d MMM", Locale.US)
        private val DayMonth = DateTimeFormatter.ofPattern("d MMM", Locale.US)
        private val DateYear = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.US)
        private val MonthYear = DateTimeFormatter.ofPattern("MMM-yy", Locale.US)

        private val Symbols = DecimalFormatSymbols(Locale.US)

        /** Reporting currencies with a symbol; others carry their ISO code and a space ("CHF 41.2B"). */
        private val CurrencyPrefix = mapOf("USD" to "$", "EUR" to "€", "GBP" to "£", "CAD" to "CA$")

        /** The word for a missing value. */
        fun missing(kind: Missing): String = when (kind) {
            Missing.NotDisclosed -> NOT_DISCLOSED
            Missing.NotMeaningful -> NA
            Missing.NotComputed -> NOT_COMPUTED
        }

        private fun absent(v: Double?, missing: Missing): String? = when {
            v == null -> missing(missing)
            v.isNaN() || v.isInfinite() -> NA
            else -> null
        }

        /** Grouped fixed-point digits for |v| ("1,204.5"), Locale.US. */
        private fun digits(absValue: Double, decimals: Int): String {
            val pattern = if (decimals > 0) "#,##0." + "0".repeat(decimals) else "#,##0"
            return DecimalFormat(pattern, Symbols).apply { roundingMode = RoundingMode.HALF_UP }
                .format(BigDecimal.valueOf(absValue))
        }

        /** Sign for a value already rounded to [decimals] (so −0.04 at 1 decimal has no sign). */
        private fun signOf(v: Double, decimals: Int, plus: Boolean): String {
            val rounded = BigDecimal.valueOf(abs(v)).setScale(decimals, RoundingMode.HALF_UP)
            return when {
                rounded.signum() == 0 -> ""
                v < 0 -> MINUS
                plus -> "+"
                else -> ""
            }
        }

        /** Plain number with grouping: "1,204", "12.5" ([decimals] digits), U+2212 for negatives. */
        fun number(v: Double?, decimals: Int = 0, missing: Missing = Missing.NotDisclosed): String {
            absent(v, missing)?.let { return it }
            val x = v!!
            return signOf(x, decimals, plus = false) + digits(abs(x), decimals)
        }

        /** Whole count with grouping: "1,204". */
        fun number(n: Long): String = (if (n < 0) MINUS else "") + digits(abs(n.toDouble()), 0)

        /**
         * Compact money, 3 significant figures: "$416B", "$98.8B", "$42.1M", "$3.42T", "$7.47" (below 1,000:
         * 2 decimals), "−$1.20B"; non-USD reporting currencies carry their prefix: "€41.2B", "CA$3.10B",
         * "CHF 12.3B". 999.6M rolls over to "$1.00B".
         */
        fun money(v: Double?, ccy: String = "USD", missing: Missing = Missing.NotDisclosed): String {
            absent(v, missing)?.let { return it }
            val x = v!!
            val prefix = currencyPrefix(ccy)
            val a = abs(x)
            if (a < 999.995) {
                return signOf(x, 2, plus = false) + prefix + digits(a, 2)
            }
            // Round to 3 significant figures first, then pick the scale, so 999.6M becomes 1.00B.
            val r = BigDecimal.valueOf(a).round(MathContext(3, RoundingMode.HALF_UP))
            val (scale, suffix) = Scales.first { r >= it.first }
            val mantissa = r.divide(scale)
            val decimals = when {
                mantissa >= BigDecimal(100) -> 0
                mantissa >= BigDecimal(10) -> 1
                else -> 2
            }
            val text = mantissa.setScale(decimals, RoundingMode.HALF_UP).toPlainString()
            return (if (x < 0) MINUS else "") + prefix + text + suffix
        }

        private val Scales = listOf(
            BigDecimal("1e12") to "T",
            BigDecimal("1e9") to "B",
            BigDecimal("1e6") to "M",
            BigDecimal("1e3") to "K",
        )

        /** The money prefix for an ISO currency code: "$", "€", "£", "CA$", else the code and a space. */
        fun currencyPrefix(ccy: String?): String {
            val code = ccy?.trim()?.uppercase().takeIf { it != null && it.length == 3 && it.all(Char::isLetter) }
                ?: "USD"
            return CurrencyPrefix[code] ?: "$code "
        }

        /** Percent of a percent number: pct(32.0) = "32.0%"; 2 decimals when |v| < 1 ("0.45%"). */
        fun pct(v: Double?, decimals: Int? = null, missing: Missing = Missing.NotDisclosed): String {
            absent(v, missing)?.let { return it }
            val x = v!!
            val d = decimals ?: if (abs(x) < 1.0) 2 else 1
            return signOf(x, d, plus = false) + digits(abs(x), d) + "%"
        }

        /** Signed percent change: "+6.4%", "−2.2%", "0.0%". */
        fun signedPct(v: Double?, decimals: Int = 1, missing: Missing = Missing.NotDisclosed): String {
            absent(v, missing)?.let { return it }
            val x = v!!
            return signOf(x, decimals, plus = true) + digits(abs(x), decimals) + "%"
        }

        /** Margin and rate changes in basis points: bps(120.0) = "+120 bps", bps(−35.0) = "−35 bps", "0 bps". */
        fun bps(v: Double?, missing: Missing = Missing.NotDisclosed): String {
            absent(v, missing)?.let { return it }
            val x = v!!
            return signOf(x, 0, plus = true) + digits(abs(x), 0) + " bps"
        }

        /** [bps] from a change in percentage points: 1.2 points = "+120 bps". */
        fun bpsFromPoints(points: Double?, missing: Missing = Missing.NotDisclosed): String =
            bps(points?.let { it * 100.0 }, missing)

        /** Score changes only (macro stress, monitor score): "+6 pts", "−1 pt", "0 pts". */
        fun pts(v: Double?, missing: Missing = Missing.NotDisclosed): String {
            absent(v, missing)?.let { return it }
            val x = v!!
            val n = abs(x).roundToLong()
            return signOf(x, 0, plus = true) + digits(n.toDouble(), 0) + if (n == 1L) " pt" else " pts"
        }

        /** Valuation multiple: "28.4×". */
        fun multiple(v: Double?, decimals: Int = 1, missing: Missing = Missing.NotDisclosed): String {
            absent(v, missing)?.let { return it }
            val x = v!!
            return signOf(x, decimals, plus = false) + digits(abs(x), decimals) + "×"
        }

        /** A 0-100 score, rounded half up (not truncated): score(61.5) = "62". */
        fun score(v: Double?, missing: Missing = Missing.NotComputed): String {
            absent(v, missing)?.let { return it }
            return number(v, 0)
        }

        /** "1 name", "8 names", "1,204 names" (never "name(s)"). */
        fun count(n: Int, one: String, other: String): String = "${number(n.toLong())} ${if (n == 1) one else other}"

        /**
         * Fiscal period labels: FY "FY2025" (column header form "FY Sep-25" when [fyEnd] is given and [header] is
         * true), Q "Q3 FY25", LTM "LTM Sep-25" (the month the twelve months end; "LTM" alone without [fyEnd]).
         */
        fun period(kind: PeriodKind, fy: Int, q: Int? = null, fyEnd: YearMonth? = null, header: Boolean = false): String =
            when (kind) {
                PeriodKind.FY ->
                    if (header && fyEnd != null) "FY ${fyEnd.format(MonthYear)}" else "FY$fy"
                PeriodKind.Q -> {
                    val yy = Math.floorMod(fy, 100).toString().padStart(2, '0')
                    if (q != null) "Q$q FY$yy" else "FY$yy"
                }
                PeriodKind.LTM -> if (fyEnd != null) "LTM ${fyEnd.format(MonthYear)}" else "LTM"
            }
    }
}

/** Why a value is missing (section 2.4). When the mapper cannot tell, [NotDisclosed]. */
enum class Missing { NotDisclosed, NotMeaningful, NotComputed }

/** Fundamental period kinds; every fundamental figure carries one. */
enum class PeriodKind { FY, Q, LTM }

/**
 * The formatter for the current composition. The shell provides one built from the device clock, zone and
 * 12/24 h setting (`android.text.format.DateFormat.is24HourFormat`); the default is the JVM's clock and zone, 24 h.
 */
val LocalFmt = staticCompositionLocalOf { Fmt(Clock.systemDefaultZone(), ZoneId.systemDefault(), is24h = true) }
