from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from market_time import (
    in_daily_window,
    is_first_week_of_month,
    is_us_trading_day,
    new_york_now,
    previous_us_trading_day,
)
from retry import DeadlineExceeded, RateLimiter, RetryableError, RetryPolicy, call_with_retry, parse_retry_after


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


# ------------------------------------------------------------------ trading days


@pytest.mark.parametrize(
    "value,expected",
    [
        (date(2026, 11, 26), False),  # Thanksgiving
        (date(2026, 11, 27), True),  # day after Thanksgiving is open
        (date(2026, 4, 3), False),  # Good Friday 2026
        (date(2026, 7, 3), False),  # July 4 on Saturday, observed Friday
        (date(2027, 12, 24), False),  # Christmas on Saturday, observed Friday
        (date(2026, 1, 19), False),  # MLK
        (date(2026, 5, 25), False),  # Memorial
        (date(2026, 11, 21), False),  # Saturday
        (date(2026, 11, 23), True),
    ],
)
def test_us_trading_days(value: date, expected: bool) -> None:
    assert is_us_trading_day(value) is expected


def test_previous_trading_day_on_monday_is_friday() -> None:
    assert previous_us_trading_day(utc(2026, 11, 23, 11, 30)) == date(2026, 11, 20)


def test_previous_trading_day_skips_thanksgiving() -> None:
    # Friday 2026-11-27 morning: Thursday is a holiday, so Wednesday.
    assert previous_us_trading_day(utc(2026, 11, 27, 11, 30)) == date(2026, 11, 25)


def test_previous_trading_day_uses_new_york_date() -> None:
    # 03:00 UTC Tuesday is still Monday evening in New York.
    assert previous_us_trading_day(utc(2026, 11, 24, 3, 0)) == date(2026, 11, 20)


def test_previous_trading_day_after_good_friday() -> None:
    assert previous_us_trading_day(utc(2026, 4, 6, 11, 30)) == date(2026, 4, 2)


# ------------------------------------------------------------------ time window, both DST seasons


def test_window_summer_edt() -> None:
    # July: New York is UTC-4. 10:30 UTC = 06:30 (run), 11:30 UTC = 07:30 (also in window).
    assert new_york_now(utc(2026, 7, 15, 10, 30)).hour == 6
    assert in_daily_window(utc(2026, 7, 15, 10, 30))
    assert not in_daily_window(utc(2026, 7, 15, 9, 59))
    assert not in_daily_window(utc(2026, 7, 15, 13, 0))


def test_window_winter_est() -> None:
    # January: New York is UTC-5. 10:30 UTC = 05:30 (skip), 11:30 UTC = 06:30 (run).
    assert not in_daily_window(utc(2026, 1, 14, 10, 30))
    assert in_daily_window(utc(2026, 1, 14, 11, 30))
    assert in_daily_window(utc(2026, 1, 14, 13, 59))
    assert not in_daily_window(utc(2026, 1, 14, 14, 0))


def test_first_week_of_month_in_new_york() -> None:
    # Sunday 2026-11-01 23:00 UTC is 18:00 in New York, day 1.
    assert is_first_week_of_month(utc(2026, 11, 1, 23, 0))
    assert is_first_week_of_month(utc(2026, 11, 8, 3, 0))  # still Nov 7 in New York
    assert not is_first_week_of_month(utc(2026, 11, 8, 23, 0))


# ------------------------------------------------------------------ retry and backoff


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def test_backoff_doubles_then_succeeds() -> None:
    clock = FakeClock()
    calls = {"n": 0}

    def flaky() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise RetryableError("503")
        return "ok"

    policy = RetryPolicy(max_attempts=4, base_delay_seconds=1.0, jitter=0)
    assert call_with_retry(flaky, policy=policy, clock=clock, sleep=clock.sleep) == "ok"
    assert clock.sleeps == [1.0, 2.0]


def test_retry_gives_up_after_max_attempts() -> None:
    clock = FakeClock()

    def always() -> None:
        raise RetryableError("429")

    with pytest.raises(RetryableError):
        call_with_retry(always, policy=RetryPolicy(max_attempts=3, jitter=0), clock=clock, sleep=clock.sleep)
    assert len(clock.sleeps) == 2


def test_retry_honours_retry_after_with_cap() -> None:
    policy = RetryPolicy(max_delay_seconds=30, jitter=0)
    assert policy.delay_for(1, retry_after=5) == 5
    assert policy.delay_for(1, retry_after=500) == 30
    assert parse_retry_after("7") == 7.0
    assert parse_retry_after("Wed, 21 Oct 2015 07:28:00 GMT") is None


def test_retry_stops_at_deadline() -> None:
    clock = FakeClock()

    def always() -> None:
        raise RetryableError("503")

    with pytest.raises(RetryableError):
        call_with_retry(
            always,
            policy=RetryPolicy(max_attempts=10, base_delay_seconds=4, jitter=0),
            deadline=5.0,
            clock=clock,
            sleep=clock.sleep,
        )
    assert clock.sleeps == [4.0]


def test_deadline_already_passed() -> None:
    clock = FakeClock()
    clock.now = 10
    with pytest.raises(DeadlineExceeded):
        call_with_retry(lambda: "x", deadline=5.0, clock=clock, sleep=clock.sleep)


def test_non_retryable_error_is_not_retried() -> None:
    clock = FakeClock()

    def broken() -> None:
        raise ValueError("bad")

    with pytest.raises(ValueError):
        call_with_retry(broken, clock=clock, sleep=clock.sleep)
    assert clock.sleeps == []


def test_rate_limiter_spacing_and_window() -> None:
    clock = FakeClock()
    limiter = RateLimiter(per_minute=2, min_interval_seconds=1.0, clock=clock, sleep=clock.sleep)
    limiter.acquire()
    limiter.acquire()  # waits 1 s for spacing
    limiter.acquire()  # window full: waits until the first call is 60 s old
    assert clock.sleeps[0] == pytest.approx(1.0)
    assert clock.now == pytest.approx(60.0)
