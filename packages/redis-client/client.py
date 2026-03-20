"""Minimal RESP-protocol Redis client with no external dependencies.

This module is the single source of truth for all raw Redis I/O used by
the M2 data-plane services (``data-openbb`` and ``news-ingest``).
"""

from __future__ import annotations

import socket
from typing import Any
from urllib.parse import urlparse


class RedisClient:
    """Lightweight Redis client using the RESP wire protocol.

    Each call opens a short-lived TCP connection (connect-per-command).
    This is intentional: the data-plane services make infrequent Redis
    calls (rate-limit checks), so connection pooling is not yet needed.
    """

    def __init__(self, redis_url: str) -> None:
        parsed = urlparse(redis_url)
        self.host = parsed.hostname or "localhost"
        self.port = parsed.port or 6379

    # ── RESP encoding / decoding ────────────────────────────────────

    def _encode(self, *parts: str) -> bytes:
        payload = [f"*{len(parts)}\r\n".encode("utf-8")]
        for part in parts:
            encoded = part.encode("utf-8")
            payload.append(f"${len(encoded)}\r\n".encode("utf-8"))
            payload.append(encoded + b"\r\n")
        return b"".join(payload)

    def _read_line(self, sock: socket.socket) -> bytes:
        data = bytearray()
        while not data.endswith(b"\r\n"):
            chunk = sock.recv(1)
            if not chunk:
                raise ConnectionError("redis connection closed")
            data.extend(chunk)
        return bytes(data[:-2])

    def _read_response(self, sock: socket.socket) -> Any:
        prefix = sock.recv(1)
        if prefix == b"+":
            return self._read_line(sock).decode("utf-8")
        if prefix == b":":
            return int(self._read_line(sock))
        if prefix == b"$":
            size = int(self._read_line(sock))
            if size == -1:
                return None
            remaining = size + 2
            data = bytearray()
            while len(data) < remaining:
                data.extend(sock.recv(remaining - len(data)))
            return bytes(data[:-2]).decode("utf-8")
        raise ConnectionError("unsupported redis response")

    # ── Public command helpers ──────────────────────────────────────

    def execute(self, *parts: str) -> Any:
        with socket.create_connection((self.host, self.port), timeout=1.0) as sock:
            sock.sendall(self._encode(*parts))
            return self._read_response(sock)

    def get(self, key: str) -> str | None:
        value = self.execute("GET", key)
        return None if value is None else str(value)

    def incr(self, key: str) -> int:
        return int(self.execute("INCR", key))

    def expire(self, key: str, seconds: int) -> None:
        self.execute("EXPIRE", key, str(seconds))

    def setex(self, key: str, seconds: int, value: str) -> None:
        self.execute("SETEX", key, str(seconds), value)
