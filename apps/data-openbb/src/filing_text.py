from __future__ import annotations

import html
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class FilingSectionExcerpt:
    family: str
    heading: str
    excerpt: str
    omitted: bool = False
    reason: str | None = None


SECTION_PATTERNS: dict[str, list[str]] = {
    "mda": [
        r"item\s+2\.?\s+management['’]s\s+discussion\s+and\s+analysis",
        r"management['’]s\s+discussion\s+and\s+analysis"
    ],
    "risk_factors": [
        r"item\s+1a\.?\s+risk\s+factors",
        r"risk\s+factors"
    ],
    "liquidity": [
        r"liquidity\s+and\s+capital\s+resources",
        r"capital\s+resources"
    ],
    "segments": [
        r"segment\s+information",
        r"business\s+segments",
        r"reportable\s+segments"
    ]
}


def normalize_filing_text(raw_text: str) -> str:
    """Collapse SEC HTML/text into bounded comparison-friendly plain text."""
    unescaped = html.unescape(raw_text)
    without_tags = re.sub(r"<[^>]+>", " ", unescaped)
    return re.sub(r"\s+", " ", without_tags).strip()


def _find_heading(text: str, patterns: list[str]) -> re.Match[str] | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match
    return None


def extract_reviewed_filing_sections(
    raw_text: str,
    *,
    max_chars: int = 900
) -> list[FilingSectionExcerpt]:
    text = normalize_filing_text(raw_text)
    excerpts: list[FilingSectionExcerpt] = []

    for family, patterns in SECTION_PATTERNS.items():
        match = _find_heading(text, patterns)
        if not match:
            excerpts.append(
                FilingSectionExcerpt(
                    family=family,
                    heading=family,
                    excerpt="",
                    omitted=True,
                    reason="section_not_found"
                )
            )
            continue

        start = match.start()
        excerpt = text[start:start + max_chars].strip()
        excerpts.append(
            FilingSectionExcerpt(
                family=family,
                heading=match.group(0),
                excerpt=excerpt
            )
        )

    return excerpts
