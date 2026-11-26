package com.thesis.mobile.ui.today

import androidx.compose.runtime.staticCompositionLocalOf
import java.time.Clock
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.Month
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters

/*
 * Time for the Today screens (docs/app-redesign/DESIGN-DIRECTION.md 2.4, 5.6): the clock the screens read "now"
 * from, and the US market phase word. The phase uses New York time internally and is shown as a word only; it is
 * left out whenever it is not certain (weekends, exchange holidays, the afternoon of an early-close day).
 */

/**
 * The clock the Today screens read "now" from (the eyebrow date, the phase word, "this week"). The app uses the
 * system clock; renders and tests provide a fixed one, together with a matching `LocalFmt`.
 */
val LocalTodayClock = staticCompositionLocalOf<Clock> { Clock.systemDefaultZone() }

/** Where the US cash session stands. */
enum class MarketPhase { PreMarket, Open, AfterClose }

/** NYSE calendar arithmetic: regular holidays and early closes, computed (no table to keep up to date). */
object MarketCalendar {
    val NewYork: ZoneId = ZoneId.of("America/New_York")

    private val Open: LocalTime = LocalTime.of(9, 30)
    private val Close: LocalTime = LocalTime.of(16, 0)
    private val EarlyClose: LocalTime = LocalTime.of(13, 0)

    /** The phase at [now], or null when it is not certain (weekend, holiday, after 13:00 on an early-close day). */
    fun phase(now: Instant): MarketPhase? {
        val ny = now.atZone(NewYork)
        val day = ny.toLocalDate()
        if (!isTradingDay(day)) return null
        val time = ny.toLocalTime()
        return when {
            time.isBefore(Open) -> MarketPhase.PreMarket
            isEarlyClose(day) && !time.isBefore(EarlyClose) -> null
            time.isBefore(Close) -> MarketPhase.Open
            else -> MarketPhase.AfterClose
        }
    }

    /** A weekday that is not an exchange holiday. */
    fun isTradingDay(day: LocalDate): Boolean =
        day.dayOfWeek != DayOfWeek.SATURDAY && day.dayOfWeek != DayOfWeek.SUNDAY && day !in holidays(day.year)

    /** The first trading day after [day] (Friday 27 Nov -> Monday 30 Nov; skips holidays). */
    fun nextTradingDay(day: LocalDate): LocalDate {
        var next = day.plusDays(1)
        while (!isTradingDay(next)) next = next.plusDays(1)
        return next
    }

    /** The day after Thanksgiving, and 3 July and 24 December when they are trading days: the market closes at 13:00. */
    fun isEarlyClose(day: LocalDate): Boolean {
        val thanksgiving = nth(day.year, Month.NOVEMBER, DayOfWeek.THURSDAY, 4)
        return day == thanksgiving.plusDays(1) ||
            (day.month == Month.JULY && day.dayOfMonth == 3) ||
            (day.month == Month.DECEMBER && day.dayOfMonth == 24)
    }

    /** NYSE full-day holidays of [year] (observed dates). */
    fun holidays(year: Int): Set<LocalDate> = buildSet {
        // New Year's Day: when it falls on a Saturday the exchange does not close the Friday before.
        LocalDate.of(year, Month.JANUARY, 1).let { if (it.dayOfWeek != DayOfWeek.SATURDAY) add(observed(it)) }
        add(nth(year, Month.JANUARY, DayOfWeek.MONDAY, 3))
        add(nth(year, Month.FEBRUARY, DayOfWeek.MONDAY, 3))
        add(easter(year).minusDays(2))
        add(LocalDate.of(year, Month.MAY, 31).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)))
        if (year >= 2022) add(observed(LocalDate.of(year, Month.JUNE, 19)))
        add(observed(LocalDate.of(year, Month.JULY, 4)))
        add(nth(year, Month.SEPTEMBER, DayOfWeek.MONDAY, 1))
        add(nth(year, Month.NOVEMBER, DayOfWeek.THURSDAY, 4))
        add(observed(LocalDate.of(year, Month.DECEMBER, 25)))
    }

    private fun observed(day: LocalDate): LocalDate = when (day.dayOfWeek) {
        DayOfWeek.SATURDAY -> day.minusDays(1)
        DayOfWeek.SUNDAY -> day.plusDays(1)
        else -> day
    }

    private fun nth(year: Int, month: Month, dow: DayOfWeek, n: Int): LocalDate =
        LocalDate.of(year, month, 1).with(TemporalAdjusters.dayOfWeekInMonth(n, dow))

    /** Gregorian Easter Sunday (anonymous Gregorian algorithm). */
    fun easter(year: Int): LocalDate {
        val a = year % 19
        val b = year / 100
        val c = year % 100
        val d = b / 4
        val e = b % 4
        val f = (b + 8) / 25
        val g = (b - f + 1) / 3
        val h = (19 * a + b - d - g + 15) % 30
        val i = c / 4
        val k = c % 4
        val l = (32 + 2 * e + 2 * i - h - k) % 7
        val m = (a + 11 * h + 22 * l) / 451
        val month = (h + l - 7 * m + 114) / 31
        val day = (h + l - 7 * m + 114) % 31 + 1
        return LocalDate.of(year, month, day)
    }
}

/** Parses an ISO-8601 instant or offset date-time; null when unreadable. */
internal fun parseInstant(raw: String?): Instant? {
    val value = raw?.trim()?.ifBlank { null } ?: return null
    return runCatching { Instant.parse(value) }.getOrNull()
        ?: runCatching { java.time.OffsetDateTime.parse(value).toInstant() }.getOrNull()
}

/** Parses an ISO day ("2026-11-24", or the date part of a date-time); null when unreadable. */
internal fun parseDay(raw: String?): LocalDate? {
    val value = raw?.trim()?.ifBlank { null } ?: return null
    return runCatching { LocalDate.parse(value.take(10)) }.getOrNull()
}
