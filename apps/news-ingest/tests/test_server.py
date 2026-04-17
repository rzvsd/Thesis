from __future__ import annotations

import json
import threading
import unittest
import urllib.error
import urllib.request

from news_ingest.server import build_http_server


class ServerEndpointTests(unittest.TestCase):
    def test_health_endpoint_returns_compact_ok_payload(self) -> None:
        server = build_http_server(port=0, host="127.0.0.1")
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        try:
            port = server.server_address[1]
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health") as response:
                payload = response.read().decode("utf8")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

        self.assertEqual(payload, '{"status":"ok"}')
        self.assertEqual(json.loads(payload), {"status": "ok"})

    def test_first_party_context_endpoint_rejects_unknown_domain(self) -> None:
        server = build_http_server(port=0, host="127.0.0.1")
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        try:
            port = server.server_address[1]
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/v1/first-party/context",
                data=json.dumps(
                    {
                        "ticker": "AAPL",
                        "url": "https://example.com/aapl-earnings",
                        "event_id": "event-aapl-earnings",
                    }
                ).encode("utf8"),
                headers={"content-type": "application/json"},
                method="POST",
            )
            with self.assertRaises(urllib.error.HTTPError) as raised:
                urllib.request.urlopen(request)
            payload = raised.exception.read().decode("utf8")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

        self.assertEqual(raised.exception.code, 422)
        parsed = json.loads(payload)
        self.assertFalse(parsed["ok"])
        self.assertEqual(parsed["error_code"], "SOURCE_REJECTED")


if __name__ == "__main__":
    unittest.main()
