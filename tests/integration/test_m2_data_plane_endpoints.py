from __future__ import annotations

import json
import sys
import threading
import unittest
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_OPENBB_ROOT = ROOT / "apps" / "data-openbb"
NEWS_INGEST_SRC = ROOT / "apps" / "news-ingest" / "src"

sys.path.insert(0, str(DATA_OPENBB_ROOT))
sys.path.insert(0, str(NEWS_INGEST_SRC))

from src.server import start_server as start_data_openbb, stop_server as stop_data_openbb  # noqa: E402
from news_ingest.server import build_http_server  # noqa: E402


class M2DataPlaneIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.data_openbb = start_data_openbb(0)
        cls.data_openbb_base = f"http://127.0.0.1:{cls.data_openbb.server_address[1]}"

        cls.news_ingest = build_http_server(port=0, host="127.0.0.1")
        cls.news_thread = threading.Thread(target=cls.news_ingest.serve_forever, daemon=True)
        cls.news_thread.start()
        cls.news_ingest_base = f"http://127.0.0.1:{cls.news_ingest.server_address[1]}"

    @classmethod
    def tearDownClass(cls) -> None:
        stop_data_openbb(cls.data_openbb)
        cls.news_ingest.shutdown()
        cls.news_ingest.server_close()
        cls.news_thread.join(timeout=5)

    def request_json(self, url: str) -> tuple[int, dict[str, object]]:
        with urllib.request.urlopen(url) as response:
            return response.status, json.loads(response.read().decode("utf-8"))

    def test_company_finance_endpoint_returns_service_response(self) -> None:
        status, payload = self.request_json(
            f"{self.data_openbb_base}/v1/finance/company?ticker=AAPL"
        )
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        self.assertEqual(payload["provider"], "FMP")
        finance_data = payload["data"]
        self.assertIsInstance(finance_data, dict)
        self.assertEqual(finance_data["ticker"], "AAPL")
        self.assertEqual(finance_data["missing_fields"], [])

    def test_macro_endpoint_returns_service_response(self) -> None:
        status, payload = self.request_json(
            f"{self.data_openbb_base}/v1/finance/macro?scope=daily"
        )
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        self.assertEqual(payload["provider"], "FMP")
        macro_data = payload["data"]
        self.assertIsInstance(macro_data, dict)
        self.assertEqual(macro_data["indicator"], "us10y_treasury_yield")
        self.assertEqual(macro_data["provider"], "FMP")
        self.assertEqual(macro_data["missing_fields"], [])

    def test_news_endpoint_returns_approved_articles(self) -> None:
        status, payload = self.request_json(
            f"{self.news_ingest_base}/v1/news?date=2026-03-13"
        )
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        articles = payload["data"]
        self.assertIsInstance(articles, list)
        self.assertGreaterEqual(len(articles), 2)
        self.assertTrue(all(article["is_approved_source"] for article in articles))


if __name__ == "__main__":
    unittest.main(verbosity=2)
