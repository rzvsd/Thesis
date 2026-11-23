"""In-process rate limiting and retries with exponential backoff.

The old data-openbb service kept its rate limit counters in Redis. A workflow run is
one process, so a simple in-process limiter is enough here.
"""

from __future__ import annotations

import random
import threading
import time
from dataclasses import dataclass, field
from typing import Callable, TypeVar

T = TypeVar("T")

RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})


class RetryableError(Exception):
    """A failure worth another try (429, 5xx, network error, timeout)."""

    def __init__(self, message: str, *, retry_after: float | None = None, status: int = 0) -> None:
        super().__init__(message)
        self.retry_after = retry_after
        self.status = status


class DeadlineExceeded(Exception):
    """The step ran out of its time budget."""


@dataclass
class RateLimiter:
    """At most `per_minute` calls per rolling minute, plus a minimum spacing between calls."""

    per_minute: int = 60
    min_interval_seconds: float = 0.0
    clock: Callable[[], float] = time.monotonic
    sleep: Callable[[float], None] = time.sleep
    _calls: list[float] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def acquire(self) -> None:
        with self._lock:
            while True:
                now = self.clock()
                self._calls = [stamp for stamp in self._calls if now - stamp < 60.0]
                wait = 0.0
                if self._calls and self.min_interval_seconds > 0:
                    wait = max(wait, self._calls[-1] + self.min_interval_seconds - now)
                if self.per_minute > 0 and len(self._calls) >= self.per_minute:
                    wait = max(wait, self._calls[0] + 60.0 - now)
                if wait <= 0:
                    self._calls.append(now)
                    return
                self.sleep(wait)


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 4
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 30.0
    jitter: float = 0.25

    def delay_for(self, attempt: int, retry_after: float | None = None) -> float:
        """Delay before attempt number `attempt + 1` (attempt counts from 1)."""
        if retry_after is not None and retry_after >= 0:
            return min(retry_after, self.max_delay_seconds)
        delay = min(self.base_delay_seconds * (2 ** (attempt - 1)), self.max_delay_seconds)
        if self.jitter:
            delay += random.uniform(0, delay * self.jitter)
        return min(delay, self.max_delay_seconds)


def call_with_retry(
    func: Callable[[], T],
    *,
    policy: RetryPolicy = RetryPolicy(),
    deadline: float | None = None,
    clock: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], None] = time.sleep,
    on_retry: Callable[[int, float, Exception], None] | None = None,
) -> T:
    """Run func; retry RetryableError with exponential backoff until attempts or the deadline run out."""
    attempt = 0
    while True:
        attempt += 1
        if deadline is not None and clock() >= deadline:
            raise DeadlineExceeded("step time budget used up")
        try:
            return func()
        except RetryableError as error:
            if attempt >= policy.max_attempts:
                raise
            delay = policy.delay_for(attempt, error.retry_after)
            if deadline is not None and clock() + delay >= deadline:
                raise
            if on_retry is not None:
                on_retry(attempt, delay, error)
            sleep(delay)


def parse_retry_after(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        seconds = float(value.strip())
    except ValueError:
        return None
    return seconds if seconds >= 0 else None
