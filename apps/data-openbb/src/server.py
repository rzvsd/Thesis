from __future__ import annotations

import json
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from .service import (
        DEFAULT_PORT,
        DataOpenBBService,
        SERVICE_NAME,
        build_company_response,
        build_filing_sections_response,
        build_macro_response,
        build_market_tape_response,
        build_official_company_response,
        build_official_macro_response,
        build_official_structural_response,
        get_request_id,
        health_payload,
        internal_error_response,
        log,
        method_not_allowed_response,
        not_found_response,
        error_response,
        schema_error_response,
    )
    from .validation import SchemaValidationError
except ImportError:  # pragma: no cover - supports direct src imports in sibling tests
    from service import (
        DEFAULT_PORT,
        DataOpenBBService,
        SERVICE_NAME,
        build_company_response,
        build_filing_sections_response,
        build_macro_response,
        build_market_tape_response,
        build_official_company_response,
        build_official_macro_response,
        build_official_structural_response,
        get_request_id,
        health_payload,
        internal_error_response,
        log,
        method_not_allowed_response,
        not_found_response,
        error_response,
        schema_error_response,
    )
    from validation import SchemaValidationError


MAX_JSON_BODY_BYTES = 1_048_576


class RequestBodyTooLargeError(ValueError):
    pass


class DataOpenbbRequestHandler(BaseHTTPRequestHandler):
    server_version = SERVICE_NAME
    sys_version = ""

    def _expected_internal_token(self) -> str:
        service = getattr(self.server, "data_service", None)
        settings = getattr(service, "settings", None)
        token = getattr(settings, "internal_worker_token", None)
        if isinstance(token, str) and token:
            return token
        return os.environ.get("INTERNAL_WORKER_TOKEN", "")

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)

        if parsed.path == "/health":
            payload: dict[str, Any] = dict(health_payload())
            settings = getattr(getattr(self.server, "data_service", None), "settings", None)
            if settings is not None:
                payload["fixture_mode"] = settings.fixture_mode
            log("INFO", "Health check OK")
            self._write_json(HTTPStatus.OK, payload)
            return

        request_id = get_request_id(self.headers.get("x-request-id"))

        try:
            service = getattr(self.server, "data_service", None)

            if service is not None:
                if parsed.path == "/v1/finance/company":
                    ticker = parse_qs(parsed.query).get("ticker", [""])[0]
                    status_code, body = service.get_company_finance(ticker, request_id=request_id)
                    self._write_json(status_code, body, request_id=request_id)
                    return
                if parsed.path == "/v1/finance/macro":
                    scope = parse_qs(parsed.query).get("scope", [""])[0]
                    status_code, body = service.get_macro(scope, request_id=request_id)
                    self._write_json(status_code, body, request_id=request_id)
                    return
                if parsed.path == "/v1/official/company":
                    ticker = parse_qs(parsed.query).get("ticker", [""])[0]
                    status_code, body = service.get_official_company_truth(ticker, request_id=request_id)
                    self._write_json(status_code, body, request_id=request_id)
                    return
                if parsed.path == "/v1/official/filing-sections":
                    ticker = parse_qs(parsed.query).get("ticker", [""])[0]
                    status_code, body = service.get_filing_sections(ticker, request_id=request_id)
                    self._write_json(status_code, body, request_id=request_id)
                    return
                if parsed.path == "/v1/official/macro":
                    params = parse_qs(parsed.query)
                    scope = params.get("scope", [""])[0]
                    as_of = params.get("as_of", [""])[0]
                    status_code, body = service.get_official_macro_truth(
                        scope, as_of, request_id=request_id
                    )
                    self._write_json(status_code, body, request_id=request_id)
                    return
                if parsed.path == "/v1/official/structural":
                    params = parse_qs(parsed.query)
                    ticker = params.get("ticker", [""])[0]
                    country = params.get("country", [""])[0]
                    subject_type = params.get("subject_type", [""])[0]
                    as_of = params.get("as_of", [""])[0]
                    status_code, body = service.get_official_structural_context(
                        ticker,
                        country,
                        subject_type,
                        as_of,
                        request_id=request_id,
                    )
                    self._write_json(status_code, body, request_id=request_id)
                    return
                if parsed.path == "/v1/market/tape":
                    params = parse_qs(parsed.query)
                    scope = params.get("scope", [""])[0]
                    as_of = params.get("as_of", [""])[0]
                    status_code, body = service.get_market_tape(scope, as_of, request_id=request_id)
                    self._write_json(status_code, body, request_id=request_id)
                    return

            if parsed.path == "/v1/finance/company":
                response = build_company_response(
                    ticker=parse_qs(parsed.query).get("ticker", [""])[0],
                    request_id=request_id,
                )
            elif parsed.path == "/v1/finance/macro":
                response = build_macro_response(
                    scope=parse_qs(parsed.query).get("scope", [""])[0],
                    request_id=request_id,
                )
            elif parsed.path == "/v1/official/company":
                response = build_official_company_response(
                    ticker=parse_qs(parsed.query).get("ticker", [""])[0],
                    request_id=request_id,
                )
            elif parsed.path == "/v1/official/filing-sections":
                response = build_filing_sections_response(
                    ticker=parse_qs(parsed.query).get("ticker", [""])[0],
                    request_id=request_id,
                )
            elif parsed.path == "/v1/official/macro":
                params = parse_qs(parsed.query)
                response = build_official_macro_response(
                    scope=params.get("scope", [""])[0],
                    as_of=params.get("as_of", [""])[0],
                    request_id=request_id,
                )
            elif parsed.path == "/v1/official/structural":
                params = parse_qs(parsed.query)
                response = build_official_structural_response(
                    ticker=params.get("ticker", [""])[0],
                    country=params.get("country", [""])[0],
                    subject_type=params.get("subject_type", [""])[0],
                    as_of=params.get("as_of", [""])[0],
                    request_id=request_id,
                )
            elif parsed.path == "/v1/market/tape":
                params = parse_qs(parsed.query)
                response = build_market_tape_response(
                    scope=params.get("scope", [""])[0],
                    as_of=params.get("as_of", [""])[0],
                    request_id=request_id,
                )
            else:
                response = not_found_response(request_id)
        except SchemaValidationError as error:
            response = schema_error_response(request_id, error)
        except Exception as error:  # pragma: no cover - last-resort safety net
            response = internal_error_response(request_id, error)

        self._write_json(response.status_code, response.body, request_id=request_id)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        request_id = get_request_id(self.headers.get("x-request-id"))
        if parsed.path == "/internal/calendar/earnings":
            expected_token = self._expected_internal_token()
            if self.headers.get("x-internal-token", "") != expected_token:
                response = error_response(
                    status_code=401,
                    request_id=request_id,
                    message="internal authentication required",
                    error_code="AUTH_ERROR",
                )
                self._write_json(response.status_code, response.body, request_id=request_id)
                return

            try:
                body = self._read_json_body()
            except RequestBodyTooLargeError:
                response = error_response(
                    status_code=413,
                    request_id=request_id,
                    message="request body exceeds 1 MB limit",
                )
                self._write_json(response.status_code, response.body, request_id=request_id)
                return
            except json.JSONDecodeError:
                response = error_response(
                    status_code=422,
                    request_id=request_id,
                    message="request body must be valid JSON",
                )
                self._write_json(response.status_code, response.body, request_id=request_id)
                return

            start_date = body.get("start_date") if isinstance(body, dict) else None
            end_date = body.get("end_date") if isinstance(body, dict) else None
            if start_date is not None and not isinstance(start_date, str):
                response = error_response(
                    status_code=422,
                    request_id=request_id,
                    message="start_date must be a YYYY-MM-DD string when provided",
                )
                self._write_json(response.status_code, response.body, request_id=request_id)
                return
            if end_date is not None and not isinstance(end_date, str):
                response = error_response(
                    status_code=422,
                    request_id=request_id,
                    message="end_date must be a YYYY-MM-DD string when provided",
                )
                self._write_json(response.status_code, response.body, request_id=request_id)
                return

            service = getattr(self.server, "data_service", None) or DataOpenBBService()
            status_code, response_payload = service.get_calendar_earnings(
                start_date=start_date if isinstance(start_date, str) else None,
                end_date=end_date if isinstance(end_date, str) else None,
                request_id=request_id,
            )
            self._write_json(status_code, response_payload, request_id=request_id)
            return

        if parsed.path == "/internal/historical/sync":
            expected_token = self._expected_internal_token()
            if self.headers.get("x-internal-token", "") != expected_token:
                response = error_response(
                    status_code=401,
                    request_id=request_id,
                    message="internal authentication required",
                    error_code="AUTH_ERROR",
                )
                self._write_json(response.status_code, response.body, request_id=request_id)
                return

            try:
                body = self._read_json_body()
            except RequestBodyTooLargeError:
                response = error_response(
                    status_code=413,
                    request_id=request_id,
                    message="request body exceeds 1 MB limit",
                )
                self._write_json(response.status_code, response.body, request_id=request_id)
                return
            except json.JSONDecodeError:
                response = error_response(
                    status_code=422,
                    request_id=request_id,
                    message="request body must be valid JSON",
                )
                self._write_json(response.status_code, response.body, request_id=request_id)
                return

            include_transcripts_raw = body.get("include_transcripts") if isinstance(body, dict) else None
            if include_transcripts_raw is not None and not isinstance(include_transcripts_raw, bool):
                response = error_response(
                    status_code=422,
                    request_id=request_id,
                    message="include_transcripts must be a boolean when provided",
                )
                self._write_json(response.status_code, response.body, request_id=request_id)
                return

            service = getattr(self.server, "data_service", None) or DataOpenBBService()
            status_code, response_payload = service.run_historical_sync(
                request_id=request_id,
                include_transcripts=include_transcripts_raw if isinstance(include_transcripts_raw, bool) else None,
            )
            self._write_json(status_code, response_payload, request_id=request_id)
            return

        response = method_not_allowed_response(request_id)
        self._write_json(response.status_code, response.body, request_id=request_id)

    def do_PUT(self) -> None:  # noqa: N802
        self.do_POST()

    def do_PATCH(self) -> None:  # noqa: N802
        self.do_POST()

    def do_DELETE(self) -> None:  # noqa: N802
        self.do_POST()

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def _write_json(
        self,
        status_code: int,
        payload: dict[str, Any],
        *,
        request_id: str | None = None,
    ) -> None:
        response_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status_code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(response_bytes)))
        if request_id is not None:
            self.send_header("x-request-id", request_id)
        self.end_headers()
        self.wfile.write(response_bytes)

    def _read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("content-length", "0") or "0")
        if content_length > MAX_JSON_BODY_BYTES:
            raise RequestBodyTooLargeError("request body exceeds JSON limit")
        if content_length <= 0:
            return {}
        raw = self.rfile.read(content_length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))


def start_server(
    port: int = DEFAULT_PORT,
    data_service: DataOpenBBService | None = None,
) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("0.0.0.0", port), DataOpenbbRequestHandler)
    setattr(server, "data_service", data_service or DataOpenBBService())
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    setattr(server, "_serve_thread", thread)
    log("INFO", "Service started")
    return server


def stop_server(server: ThreadingHTTPServer) -> None:
    server.shutdown()
    server.server_close()
    thread = getattr(server, "_serve_thread", None)
    if thread is not None:
        thread.join(timeout=5)


def main() -> int:
    try:
        server = start_server()
    except Exception as error:  # pragma: no cover - startup failure path
        log("ERROR", str(error))
        return 1

    try:
        getattr(server, "_serve_thread").join()
    except KeyboardInterrupt:  # pragma: no cover - manual shutdown path
        stop_server(server)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
