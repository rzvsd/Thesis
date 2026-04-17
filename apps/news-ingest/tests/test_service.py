from __future__ import annotations

from contextlib import redirect_stdout
from datetime import datetime, timezone
import io
import json
import unittest
from unittest import mock

import news_ingest.service as news_service
from news_ingest.service import ApprovedSource, SourceFetchError, build_first_party_context_response, build_news_response
from news_ingest.service import RateLimitExceededError, RateLimiter, Settings


FIXTURE_DATE = "2026-03-13"
FIXTURE_NOW = datetime(2026, 3, 13, 12, 30, tzinfo=timezone.utc)


class NewsServiceTests(unittest.TestCase):
    def test_fixture_mode_normalizes_rss_and_html_sources(self) -> None:
        status_code, payload = build_news_response(FIXTURE_DATE, request_id="req-normalized", now=FIXTURE_NOW)

        self.assertEqual(status_code, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        self.assertEqual(payload["provider"], "approved-sources")

        articles = payload["data"]
        self.assertGreaterEqual(len(articles), 3)
        self.assertTrue(all(article["is_approved_source"] for article in articles))
        self.assertTrue(all(isinstance(article["body_text"], str) and article["body_text"] for article in articles))

        sources = {article["source"] for article in articles}
        self.assertIn("Reuters", sources)
        self.assertIn("Bloomberg", sources)
        self.assertIn("WSJ Markets", sources)

        wsj_article = next(article for article in articles if article["source"] == "WSJ Markets")
        self.assertIn("$NVDA", wsj_article["title"])
        self.assertEqual(wsj_article["published_at"], "2026-03-13T11:15:00Z")

    def test_source_outage_returns_empty_list_and_error_flag(self) -> None:
        def broken_loader(source: ApprovedSource, requested_date: str) -> str:
            raise SourceFetchError(f"{source.key} blocked for {requested_date}")

        status_code, payload = build_news_response(
            FIXTURE_DATE,
            request_id="req-outage",
            source_loader=broken_loader,
            now=FIXTURE_NOW,
        )

        self.assertEqual(status_code, 200)
        self.assertFalse(payload["ok"])
        self.assertTrue(payload["error_flag"])
        self.assertEqual(payload["error_code"], "PROVIDER_OUTAGE")
        self.assertEqual(payload["data"], [])

    def test_invalid_date_returns_structured_error(self) -> None:
        status_code, payload = build_news_response("2026-13-99", request_id="req-invalid", now=FIXTURE_NOW)

        self.assertEqual(status_code, 400)
        self.assertFalse(payload["ok"])
        self.assertTrue(payload["error_flag"])
        self.assertEqual(payload["data"], [])

    def test_rate_limit_returns_structured_rate_limit_error(self) -> None:
        class FakeRedisClient:
            def __init__(self) -> None:
                self.values: dict[str, int | str] = {}

            def get(self, key: str) -> str | None:
                value = self.values.get(key)
                return None if value is None else str(value)

            def incr(self, key: str) -> int:
                count = int(self.values.get(key, 0)) + 1
                self.values[key] = count
                return count

            def expire(self, key: str, seconds: int) -> None:  # noqa: ARG002
                return

            def setex(self, key: str, seconds: int, value: str) -> None:  # noqa: ARG002
                self.values[key] = value

        settings = Settings.from_env(
            {
                "NEWS_SOURCE_RATE_LIMIT_PER_MINUTE": "1",
                "RATE_LIMIT_BURST_ALLOWANCE": "1",
                "RATE_LIMIT_COOLDOWN_SECONDS": "60",
            }
        )
        limiter = RateLimiter(settings=settings, client=FakeRedisClient())
        limiter.acquire("reuters-business")
        limiter.acquire("reuters-business")

        with self.assertRaises(RateLimitExceededError):
            limiter.acquire("reuters-business")

    def test_logs_include_ingestion_method_for_each_source(self) -> None:
        output = io.StringIO()

        with redirect_stdout(output):
            status_code, payload = build_news_response(
                FIXTURE_DATE,
                request_id="req-logs",
                now=FIXTURE_NOW,
            )

        self.assertEqual(status_code, 200)
        self.assertTrue(payload["ok"])

        events = [
            json.loads(line)
            for line in output.getvalue().splitlines()
            if line.strip()
        ]
        started_events = [event for event in events if event["message"] == "Data retrieval started"]
        methods = {(event["provider"], event.get("ingestion_method")) for event in started_events}

        self.assertIn(("reuters-business", "rss"), methods)
        self.assertIn(("bloomberg-markets", "rss"), methods)
        self.assertIn(("wsj-markets", "html_fallback"), methods)

    def test_html_fallback_uses_newsplease_extractor(self) -> None:
        with mock.patch.object(
            news_service,
            "extract_html_article_with_newsplease",
            wraps=news_service.extract_html_article_with_newsplease,
        ) as wrapped:
            status_code, payload = build_news_response(
                FIXTURE_DATE,
                request_id="req-newsplease",
                now=FIXTURE_NOW,
            )

        self.assertEqual(status_code, 200)
        self.assertTrue(payload["ok"])
        self.assertGreaterEqual(wrapped.call_count, 1)

    def test_first_party_context_fetch_enforces_rights_metadata(self) -> None:
        status_code, payload = build_first_party_context_response(
            "AAPL",
            "https://investor.apple.com/investor-relations/",
            request_id="req-first-party-aapl",
            event_id="event-aapl-earnings",
            now=FIXTURE_NOW,
        )

        self.assertEqual(status_code, 200)
        self.assertTrue(payload["ok"])
        item = payload["data"]["context_items"][0]
        self.assertEqual(item["ticker"], "AAPL")
        self.assertEqual(item["fetch_state"], "fetched")
        self.assertEqual(item["rights"]["rights_class"], "first_party_public")
        self.assertEqual(item["rights"]["display_mode"], "excerpt_only")
        self.assertFalse(item["rights"]["can_store_full_text"])
        self.assertTrue(item["rights"]["can_display_excerpt"])
        self.assertTrue(item["rights"]["can_display_link"])
        self.assertEqual(item["metadata"]["full_text_stored"], False)
        self.assertGreaterEqual(len(payload["data"]["call_artifacts"]), 1)

    def test_first_party_context_fetch_works_for_second_seed_issuer(self) -> None:
        status_code, payload = build_first_party_context_response(
            "MSFT",
            "https://www.microsoft.com/en-us/investor/default",
            request_id="req-first-party-msft",
            event_id="event-msft-earnings",
            now=FIXTURE_NOW,
        )

        self.assertEqual(status_code, 200)
        self.assertTrue(payload["ok"])
        item = payload["data"]["context_items"][0]
        artifact_types = {
            artifact["artifact_type"]
            for artifact in payload["data"]["call_artifacts"]
        }
        self.assertEqual(item["ticker"], "MSFT")
        self.assertIn("earnings_release", artifact_types)
        self.assertIn("webcast", artifact_types)

    def test_first_party_context_rejects_unapproved_domain(self) -> None:
        status_code, payload = build_first_party_context_response(
            "AAPL",
            "https://example.com/aapl-earnings",
            request_id="req-first-party-reject",
            event_id="event-aapl-earnings",
            now=FIXTURE_NOW,
        )

        self.assertEqual(status_code, 422)
        self.assertFalse(payload["ok"])
        self.assertTrue(payload["error_flag"])
        self.assertEqual(payload["error_code"], "SOURCE_REJECTED")
        self.assertEqual(payload["data"]["context_items"], [])


if __name__ == "__main__":
    unittest.main()
