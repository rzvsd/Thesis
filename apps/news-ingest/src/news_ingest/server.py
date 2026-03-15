from __future__ import annotations

import json
import os
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from news_ingest.service import SERVICE_NAME, build_news_response, log


DEFAULT_HOST = os.environ.get("HOST", "0.0.0.0")
DEFAULT_PORT = int(os.environ.get("PORT", "3004"))


def compact_json(payload: Any) -> bytes:
    return json.dumps(payload, separators=(",", ":")).encode("utf8")


def build_http_server(port: int = DEFAULT_PORT, host: str = DEFAULT_HOST) -> ThreadingHTTPServer:
    class NewsIngestHandler(BaseHTTPRequestHandler):
        server_version = f"{SERVICE_NAME}/0.1"

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)

            if parsed.path == "/health":
                log("INFO", "Health check OK")
                self.send_response(HTTPStatus.OK)
                self.send_header("content-type", "application/json")
                self.end_headers()
                self.wfile.write(compact_json({"status": "ok"}))
                return

            if parsed.path == "/v1/news":
                params = parse_qs(parsed.query)
                requested_date = params.get("date", [""])[0]
                request_id = self.headers.get("X-Request-Id") or uuid.uuid4().hex
                status_code, payload = build_news_response(requested_date, request_id=request_id)
                self.send_response(status_code)
                self.send_header("content-type", "application/json")
                self.end_headers()
                self.wfile.write(compact_json(payload))
                return

            self.send_response(HTTPStatus.NOT_FOUND)
            self.send_header("content-type", "application/json")
            self.end_headers()
            self.wfile.write(compact_json({"status": "not_found"}))

        def log_message(self, format: str, *args: object) -> None:
            return

    return ThreadingHTTPServer((host, port), NewsIngestHandler)


def main() -> None:
    server = build_http_server()
    log("INFO", "Service started")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("INFO", "Service stopping")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
