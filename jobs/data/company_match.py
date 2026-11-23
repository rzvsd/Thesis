"""Which companies a headline names (rebuild branch audit NG7).

The old code only found cashtags ("$AAPL"). News feeds do not write those, so tickers_mentioned was always empty.
A headline now names a company when it has
- a cashtag ("$AAPL") or an exchange tag ("NASDAQ: AAPL"), or
- the company's name from the coverage universe (fixtures/sp500_universe.csv) as whole words in the same capitals.
  Legal endings are dropped first (Inc., Corp., Company, Group, Holdings, plc, "(The)", "(Class A)"), so
  "Apple Inc." matches "Apple" and "Apple's".

Names that are also everyday words, places or other bodies are left out (AMBIGUOUS_NAMES): "Target", "Visa",
"Dow", "Nasdaq", "Block". A missed company is better than a wrong one, and cashtags still work for them.
A few well-known short names are added (ALIASES): "Google", "Disney", "JPMorgan".
"""

from __future__ import annotations

import csv
import re
from functools import lru_cache
from pathlib import Path
from typing import Callable, Mapping

from source_common import FIXTURE_ROOT

UNIVERSE_CSV = FIXTURE_ROOT / "sp500_universe.csv"
MAX_TICKERS_PER_HEADLINE = 5

_PARENTHESES = re.compile(r"\s*\([^)]*\)")
_LEGAL_ENDING = re.compile(
    r"(?:,?\s+(?:Inc\.?|Corp\.?|Corporation|Co\.?|Company|Companies|plc|Ltd\.?|L\.P\.|N\.V\.|S\.A\.|Group|Holdings"
    r"|& Co\.?|& Company))+$"
)
_CASHTAG = re.compile(r"\$([A-Z]{1,5})\b")
_EXCHANGE_TAG = re.compile(r"\b(?:NASDAQ|Nasdaq|NYSE)\s*:\s*([A-Z]{1,5})\b")

# Cleaned names that are not matched. Each is an everyday word, a place, a person's name or another body.
AMBIGUOUS_NAMES = frozenset({
    "AES", "APA", "Ball", "Block", "Booking", "Carnival", "Coherent", "Cooper", "Dover", "Dow", "Eaton", "Everest",
    "F5", "Fox", "Hartford", "Mosaic", "Nasdaq", "News", "Pool", "PPL", "Progressive", "Southern", "Tapestry",
    "Target", "TKO", "Travelers", "UDR", "Visa", "Waters", "Williams", "American International", "Old Dominion",
})

# Short names the press uses that the universe file does not carry. Only used when the ticker is in the universe.
ALIASES: Mapping[str, str] = {
    "Google": "GOOGL", "Meta": "META", "Facebook": "META", "Disney": "DIS", "JPMorgan": "JPM", "Exxon": "XOM",
    "Goldman": "GS", "Berkshire": "BRK-B", "AMD": "AMD", "Micron": "MU", "Palantir": "PLTR", "Lockheed": "LMT",
    "Chipotle": "CMG", "Robinhood": "HOOD", "UPS": "UPS", "Eli Lilly": "LLY", "Procter": "PG", "Regeneron": "REGN",
    "Marriott": "MAR", "Hilton": "HLT",
}


def _fold(text: str) -> str:
    """Curly apostrophes and dashes written the plain way, so "Lowe’s" meets "Lowe's"."""
    return text.replace("’", "'").replace("‘", "'").replace("–", "-").replace("—", "-")


def clean_company_name(name: str) -> str:
    """The name the press uses: no "(The)" or "(Class A)", no legal ending."""
    cleaned = _PARENTHESES.sub("", _fold(name)).strip()
    previous = None
    while previous != cleaned:
        previous = cleaned
        cleaned = _LEGAL_ENDING.sub("", cleaned).strip().rstrip(",")
    return cleaned


def load_universe(path: Path = UNIVERSE_CSV) -> list[tuple[str, str]]:
    """(ticker, company name) rows of the coverage universe. Empty when the file is missing."""
    if not path.exists():
        return []
    rows: list[tuple[str, str]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            ticker = str(row.get("ticker", "")).strip().upper().replace(".", "-")
            name = str(row.get("company_name", "")).strip()
            if ticker and name:
                rows.append((ticker, name))
    return rows


def name_table(universe: list[tuple[str, str]]) -> dict[str, str]:
    """Matched name -> ticker. The first ticker wins when two share classes carry one name."""
    table: dict[str, str] = {}
    known = {ticker for ticker, _ in universe}
    for ticker, name in universe:
        cleaned = clean_company_name(name)
        if len(cleaned) < 2 or cleaned in AMBIGUOUS_NAMES:
            continue
        table.setdefault(cleaned, ticker)
    for alias, ticker in ALIASES.items():
        if ticker in known:
            table.setdefault(alias, ticker)
    return table


Matcher = Callable[[str], list[str]]


def build_matcher(universe: list[tuple[str, str]]) -> Matcher:
    table = name_table(universe)
    # Longest first, so "GE Vernova" wins over a shorter name inside it.
    names = sorted(table, key=len, reverse=True)
    pattern = (
        re.compile(r"(?<![A-Za-z0-9&])(" + "|".join(re.escape(name) for name in names) + r")(?![A-Za-z0-9])")
        if names
        else None
    )

    def tickers_in(headline: str) -> list[str]:
        text = _fold(headline)
        found: list[tuple[int, str]] = []
        for match in _CASHTAG.finditer(text):
            found.append((match.start(), match.group(1)))
        for match in _EXCHANGE_TAG.finditer(text):
            found.append((match.start(), match.group(1)))
        if pattern is not None:
            for match in pattern.finditer(text):
                found.append((match.start(), table[match.group(1)]))
        tickers: list[str] = []
        for _, ticker in sorted(found):
            if ticker not in tickers:
                tickers.append(ticker)
        return tickers[:MAX_TICKERS_PER_HEADLINE]

    return tickers_in


@lru_cache(maxsize=1)
def _default_matcher() -> Matcher:
    return build_matcher(load_universe())


def tickers_in_headline(headline: str) -> list[str]:
    """Tickers of the companies the headline names, in the order they appear. At most five."""
    return _default_matcher()(headline)
