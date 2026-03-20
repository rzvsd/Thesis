"""Shared Redis client for M2 data-plane services.

Provides a lightweight, zero-dependency Redis client that speaks the RESP
protocol directly over a TCP socket.  Both ``data-openbb`` and ``news-ingest``
import from here instead of maintaining their own copies.
"""

from .client import RedisClient

__all__ = ["RedisClient"]
