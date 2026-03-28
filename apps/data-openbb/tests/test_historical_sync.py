from __future__ import annotations

from datetime import datetime, timezone
import unittest

from src.historical_sync import should_include_transcripts


class HistoricalSyncTests(unittest.TestCase):
    def test_should_include_transcripts_true_on_sunday_new_york(self) -> None:
        # 2026-03-29 is Sunday in America/New_York.
        now_utc = datetime(2026, 3, 29, 14, 0, 0, tzinfo=timezone.utc)
        self.assertTrue(
            should_include_transcripts(
                now_utc=now_utc,
                timezone_name="America/New_York",
                transcript_weekday=6,
            )
        )

    def test_should_include_transcripts_false_on_monday_new_york(self) -> None:
        now_utc = datetime(2026, 3, 30, 14, 0, 0, tzinfo=timezone.utc)
        self.assertFalse(
            should_include_transcripts(
                now_utc=now_utc,
                timezone_name="America/New_York",
                transcript_weekday=6,
            )
        )


if __name__ == "__main__":
    unittest.main()
