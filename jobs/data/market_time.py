"""New York time, US trading days and the schedule checks the workflows use.

The holiday rules are a port of isUsTradingDay in apps/product-api/src/sentiment.ts,
so the job and the api agree on which days are trading days.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

NEW_YORK = ZoneInfo("America/New_York")

# The daily workflow has two UTC crons (10:30 and 11:30). Only the one that lands
# between 06:00 and 08:59 New York time does work (rebuild audit N6).
DAILY_WINDOW_START_HOUR = 6
DAILY_WINDOW_END_HOUR = 8  # inclusive: 08:59 is still inside


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_york_now(now: datetime | None = None) -> datetime:
    current = now or now_utc()
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(NEW_YORK)


def new_york_today(now: datetime | None = None) -> date:
    return new_york_now(now).date()


def _observed(year: int, month: int, day: int) -> date:
    actual = date(year, month, day)
    weekday = actual.weekday()  # Monday 0 .. Sunday 6
    if weekday == 5:
        return actual - timedelta(days=1)
    if weekday == 6:
        return actual + timedelta(days=1)
    return actual


def _nth_weekday(year: int, month: int, weekday: int, occurrence: int) -> date:
    current = date(year, month, 1)
    while current.weekday() != weekday:
        current += timedelta(days=1)
    return current + timedelta(days=7 * (occurrence - 1))


def _last_weekday(year: int, month: int, weekday: int) -> date:
    if month == 12:
        current = date(year, 12, 31)
    else:
        current = date(year, month + 1, 1) - timedelta(days=1)
    while current.weekday() != weekday:
        current -= timedelta(days=1)
    return current


def _easter_sunday(year: int) -> date:
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l_value = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_value) // 451
    month = (h + l_value - 7 * m + 114) // 31
    day = ((h + l_value - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def us_market_holidays(year: int) -> set[date]:
    monday, thursday = 0, 3
    return {
        _observed(year, 1, 1),
        _nth_weekday(year, 1, monday, 3),  # MLK
        _nth_weekday(year, 2, monday, 3),  # Presidents
        _last_weekday(year, 5, monday),  # Memorial
        _observed(year, 6, 19),  # Juneteenth
        _observed(year, 7, 4),  # Independence
        _nth_weekday(year, 9, monday, 1),  # Labor
        _nth_weekday(year, 11, thursday, 4),  # Thanksgiving
        _observed(year, 12, 25),  # Christmas
        _easter_sunday(year) - timedelta(days=2),  # Good Friday
    }


def is_us_trading_day(value: date) -> bool:
    if value.weekday() >= 5:
        return False
    return value not in us_market_holidays(value.year)


def previous_us_trading_day(now: datetime | None = None) -> date:
    """The last full US trading day before today in New York."""
    candidate = new_york_today(now) - timedelta(days=1)
    for _ in range(15):
        if is_us_trading_day(candidate):
            return candidate
        candidate -= timedelta(days=1)
    raise RuntimeError("no US trading day found in the last 15 days")


def in_daily_window(now: datetime | None = None) -> bool:
    hour = new_york_now(now).hour
    return DAILY_WINDOW_START_HOUR <= hour <= DAILY_WINDOW_END_HOUR


def is_first_week_of_month(now: datetime | None = None) -> bool:
    """True on days 1-7 in New York.

    The old scheduler ran the monthly conviction coherence on day 1 of the month.
    The weekly workflow runs once a week, so it runs coherence on the first weekly
    run of each month instead. The api evaluates the previous calendar month by default.
    """
    return new_york_now(now).day <= 7
