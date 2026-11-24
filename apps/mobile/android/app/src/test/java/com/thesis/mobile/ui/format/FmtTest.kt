package com.thesis.mobile.ui.format

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Locale

class FmtTest {
    private val zone: ZoneId = ZoneId.of("Europe/Bucharest")
    private val now: ZonedDateTime = ZonedDateTime.of(2026, 11, 24, 7, 2, 0, 0, zone) // Tue 24 Nov 2026, 07:02
    private val clock: Clock = Clock.fixed(now.toInstant(), zone)
    private val fmt = Fmt(clock, zone, is24h = true)
    private val fmt12 = Fmt(clock, zone, is24h = false)
    private val defaultLocale: Locale = Locale.getDefault()

    @After
    fun restoreLocale() = Locale.setDefault(defaultLocale)

    private fun ago(minutes: Long): Instant = now.toInstant().minusSeconds(minutes * 60)

    @Test
    fun moneyUsesThreeSignificantFigures() {
        assertEquals("$416B", Fmt.money(416.2e9))
        assertEquals("$98.8B", Fmt.money(98.76e9))
        assertEquals("$42.1M", Fmt.money(42.08e6))
        assertEquals("$3.42T", Fmt.money(3.4249e12))
        assertEquals("$7.47", Fmt.money(7.4655))
        assertEquals("$750M", Fmt.money(750e6))
        assertEquals("$12.5K", Fmt.money(12_499.0))
        assertEquals("$1.00B", Fmt.money(999.6e6)) // rolls over to the next scale
        assertEquals("$1.00K", Fmt.money(999.996))
        assertEquals("$0.00", Fmt.money(0.0))
    }

    @Test
    fun negativesUseTheTrueMinus() {
        assertEquals("−$1.20B", Fmt.money(-1.2e9))
        assertEquals("−2.2%", Fmt.signedPct(-2.2))
        assertEquals("−35 bps", Fmt.bps(-35.0))
        assertEquals("−12.5%", Fmt.pct(-12.5))
        assertEquals("−1,204", Fmt.number(-1204.0))
        // a value that rounds to zero carries no sign
        assertEquals("0.0%", Fmt.signedPct(-0.04))
        assertEquals("$0.00", Fmt.money(-0.001))
    }

    @Test
    fun currenciesCarryTheirPrefix() {
        assertEquals("€41.2B", Fmt.money(41.2e9, "EUR"))
        assertEquals("CA$3.10B", Fmt.money(3.1e9, "CAD"))
        assertEquals("£980M", Fmt.money(980e6, "gbp"))
        assertEquals("CHF 12.3B", Fmt.money(12.3e9, "CHF"))
        assertEquals("$5.00M", Fmt.money(5e6, "not-a-code"))
    }

    @Test
    fun percentsBasisPointsPointsMultiplesScores() {
        assertEquals("32.0%", Fmt.pct(32.0))
        assertEquals("0.45%", Fmt.pct(0.45))
        assertEquals("+6.4%", Fmt.signedPct(6.4))
        assertEquals("+120 bps", Fmt.bps(120.0))
        assertEquals("+120 bps", Fmt.bpsFromPoints(1.2))
        assertEquals("0 bps", Fmt.bps(0.2))
        assertEquals("+6 pts", Fmt.pts(6.0))
        assertEquals("−1 pt", Fmt.pts(-1.0))
        assertEquals("28.4×", Fmt.multiple(28.43))
        assertEquals("62", Fmt.score(61.5))
        assertEquals("61", Fmt.score(61.49))
        assertEquals("1 name", Fmt.count(1, "name", "names"))
        assertEquals("8 names", Fmt.count(8, "name", "names"))
        assertEquals("1,204 names", Fmt.count(1204, "name", "names"))
    }

    @Test
    fun missingValuesUseThreeWordsNeverADash() {
        assertEquals("Not disclosed", Fmt.money(null))
        assertEquals("n/a", Fmt.pct(Double.NaN))
        assertEquals("n/a", Fmt.multiple(Double.POSITIVE_INFINITY))
        assertEquals("Not computed", Fmt.score(null))
        assertEquals("Not computed", Fmt.pct(null, missing = Missing.NotComputed))
        assertEquals("n/a", Fmt.bps(null, missing = Missing.NotMeaningful))
        assertEquals(listOf("Not disclosed", "n/a", "Not computed"), Missing.entries.map(Fmt::missing))
    }

    @Test
    fun periodsAndFilings() {
        assertEquals("FY2025", Fmt.period(PeriodKind.FY, 2025))
        assertEquals("FY Sep-25", Fmt.period(PeriodKind.FY, 2025, fyEnd = YearMonth.of(2025, 9), header = true))
        assertEquals("Q3 FY25", Fmt.period(PeriodKind.Q, 2025, q = 3))
        assertEquals("Q1 FY05", Fmt.period(PeriodKind.Q, 2005, q = 1))
        assertEquals("LTM Sep-25", Fmt.period(PeriodKind.LTM, 2025, fyEnd = YearMonth.of(2025, 9)))
        assertEquals("10-K FY2025", fmt.filing("10-K", "FY2025"))
        assertEquals("10-Q Q3 FY25 · filed 30 Oct", fmt.filing("10-Q", "Q3 FY25", LocalDate.of(2026, 10, 30)))
        assertEquals("10-K FY2024 · filed 1 Nov 2025", fmt.filing("10-K", "FY2024", LocalDate.of(2025, 11, 1)))
        assertEquals("10-K · 23 days ago", fmt.reportAge("10-K", ago(23L * 24 * 60)))
        assertEquals("10-K FY2025 · 23 days ago", fmt.reportAge("10-K", ago(23L * 24 * 60), "FY2025"))
    }

    @Test
    fun timestampsAndRelativeTimes() {
        assertEquals("As of 07:02, Tue 24 Nov", fmt.asOf(now.toInstant()))
        assertEquals("As of 7:02 AM, Tue 24 Nov", fmt12.asOf(now.toInstant()))
        assertEquals("just now", fmt.relative(ago(0)))
        assertEquals("just now", fmt.relative(now.toInstant().plusSeconds(90))) // clock skew
        assertEquals("12 min ago", fmt.relative(ago(12)))
        assertEquals("3 h ago", fmt.relative(ago(180)))
        assertEquals("yesterday", fmt.relative(ago(25 * 60)))
        assertEquals("23 days ago", fmt.relative(ago(23L * 24 * 60)))
        assertEquals("15 Oct", fmt.relative(ago(40L * 24 * 60)))
    }

    @Test
    fun datesShowTheYearWhenItDiffers() {
        assertEquals("Tue 24 Nov", fmt.marketDate(LocalDate.of(2026, 11, 24)))
        assertEquals("24 Nov 2024", fmt.marketDate(LocalDate.of(2024, 11, 24)))
        assertEquals("24 Nov 2024", fmt.relative(LocalDate.of(2024, 11, 24).atStartOfDay(zone).toInstant()))
        assertEquals("17 to 23 Nov", fmt.weekRange(LocalDate.of(2026, 11, 17), LocalDate.of(2026, 11, 23)))
        assertEquals("27 Oct to 2 Nov", fmt.weekRange(LocalDate.of(2026, 10, 27), LocalDate.of(2026, 11, 2)))
        assertEquals(
            "29 Dec 2025 to 4 Jan 2026",
            fmt.weekRange(LocalDate.of(2025, 12, 29), LocalDate.of(2026, 1, 4)),
        )
    }

    @Test
    fun digitsAreLocaleUsWhateverTheDeviceLocale() {
        Locale.setDefault(Locale.GERMANY)
        assertEquals("32.0%", Fmt.pct(32.0))
        assertEquals("1,204.5", Fmt.number(1204.5, decimals = 1))
        assertEquals("$98.8B", Fmt.money(98.76e9))
        assertEquals("As of 07:02, Tue 24 Nov", fmt.asOf(now.toInstant()))
        Locale.setDefault(Locale("ro", "RO"))
        assertEquals("28.4×", Fmt.multiple(28.43))
    }
}
