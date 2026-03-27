from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from src.historical_loader import (
    index_companyfacts_members,
    load_universe,
    load_xbrl_concept_map,
    map_companyfacts_to_snapshots,
    normalize_transcript_record,
)


class HistoricalLoaderMappingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        repo_root = Path(__file__).resolve().parents[3]
        fixture_path = Path(__file__).resolve().parent / "fixtures" / "historical" / "aapl_companyfacts_sample.json"
        cls.fixture_payload = json.loads(fixture_path.read_text(encoding="utf-8"))
        cls.mapping_payload = load_xbrl_concept_map(repo_root / "data" / "xbrl_concept_map.json")
        cls.universe_path = repo_root / "data" / "sp500_universe.csv"

    def test_map_companyfacts_prefers_latest_filed_and_derives_metrics(self) -> None:
        snapshots = map_companyfacts_to_snapshots(
            ticker="AAPL",
            companyfacts_payload=self.fixture_payload,
            mapping_payload=self.mapping_payload,
            retrieved_at="2026-03-26T00:00:00Z",
        )
        self.assertGreaterEqual(len(snapshots), 2)

        q4_snapshot = next(item for item in snapshots if item["period"] == "2024-Q4")
        self.assertEqual(q4_snapshot["period_type"], "quarterly")
        self.assertEqual(q4_snapshot["fiscal_year"], 2024)
        self.assertEqual(q4_snapshot["fiscal_quarter"], 4)
        self.assertEqual(q4_snapshot["data"]["revenue"], 118000.0)
        self.assertEqual(q4_snapshot["filing_date"], "2024-12-01")
        self.assertEqual(q4_snapshot["data"]["free_cash_flow"], 25000.0)
        self.assertAlmostEqual(q4_snapshot["data"]["effective_tax_rate"], 0.2, places=6)
        self.assertIn("eps_basic", q4_snapshot["missing_fields"])
        self.assertEqual(q4_snapshot["provider"], "sec_edgar")
        self.assertRegex(q4_snapshot["snapshot_id"], r"^[0-9a-f]{64}$")

    def test_map_companyfacts_uses_lower_priority_concepts_to_fill_missing_periods(self) -> None:
        payload = {
            "facts": {
                "us-gaap": {
                    "Revenues": {
                        "units": {
                            "USD": [
                                {"val": 450000, "fy": 2024, "fp": "FY", "form": "10-K", "filed": "2024-11-01"},
                            ]
                        }
                    },
                    "RevenueFromContractWithCustomerExcludingAssessedTax": {
                        "units": {
                            "USD": [
                                {"val": 118000, "fy": 2025, "fp": "Q1", "form": "10-Q", "filed": "2025-02-01"},
                            ]
                        }
                    },
                    "NetIncomeLoss": {
                        "units": {
                            "USD": [
                                {"val": 29000, "fy": 2025, "fp": "Q1", "form": "10-Q", "filed": "2025-02-01"},
                            ]
                        }
                    },
                    "Assets": {"units": {"USD": [{"val": 1, "fy": 2025, "fp": "Q1", "form": "10-Q", "filed": "2025-02-01"}]}},
                    "Liabilities": {"units": {"USD": [{"val": 1, "fy": 2025, "fp": "Q1", "form": "10-Q", "filed": "2025-02-01"}]}},
                    "OperatingIncomeLoss": {"units": {"USD": [{"val": 1, "fy": 2025, "fp": "Q1", "form": "10-Q", "filed": "2025-02-01"}]}},
                }
            }
        }

        snapshots = map_companyfacts_to_snapshots(
            ticker="AAPL",
            companyfacts_payload=payload,
            mapping_payload=self.mapping_payload,
            retrieved_at="2026-03-26T00:00:00Z",
        )

        q1_snapshot = next(item for item in snapshots if item["period"] == "2025-Q1")
        self.assertEqual(q1_snapshot["data"]["revenue"], 118000.0)

    def test_map_companyfacts_prefers_quarter_duration_over_ytd_value(self) -> None:
        payload = {
            "facts": {
                "us-gaap": {
                    "RevenueFromContractWithCustomerExcludingAssessedTax": {
                        "units": {
                            "USD": [
                                {
                                    "val": 90000,
                                    "fy": 2025,
                                    "fp": "Q2",
                                    "form": "10-Q",
                                    "filed": "2025-08-05",
                                    "start": "2025-01-01",
                                    "end": "2025-06-30",
                                },
                                {
                                    "val": 45000,
                                    "fy": 2025,
                                    "fp": "Q2",
                                    "form": "10-Q",
                                    "filed": "2025-08-05",
                                    "start": "2025-04-01",
                                    "end": "2025-06-30",
                                },
                            ]
                        }
                    },
                    "NetIncomeLoss": {
                        "units": {
                            "USD": [
                                {"val": 29000, "fy": 2025, "fp": "Q2", "form": "10-Q", "filed": "2025-08-05"},
                            ]
                        }
                    },
                    "Assets": {"units": {"USD": [{"val": 1, "fy": 2025, "fp": "Q2", "form": "10-Q", "filed": "2025-08-05"}]}},
                    "Liabilities": {"units": {"USD": [{"val": 1, "fy": 2025, "fp": "Q2", "form": "10-Q", "filed": "2025-08-05"}]}},
                    "OperatingIncomeLoss": {"units": {"USD": [{"val": 1, "fy": 2025, "fp": "Q2", "form": "10-Q", "filed": "2025-08-05"}]}},
                }
            }
        }

        snapshots = map_companyfacts_to_snapshots(
            ticker="AAPL",
            companyfacts_payload=payload,
            mapping_payload=self.mapping_payload,
            retrieved_at="2026-03-26T00:00:00Z",
        )

        q2_snapshot = next(item for item in snapshots if item["period"] == "2025-Q2")
        self.assertEqual(q2_snapshot["data"]["revenue"], 45000.0)

    def test_map_companyfacts_falls_back_per_period_when_primary_concept_is_partial(self) -> None:
        payload = {
            "facts": {
                "us-gaap": {
                    "Revenues": {
                        "units": {
                            "USD": [
                                {
                                    "fy": 2023,
                                    "fp": "FY",
                                    "form": "10-K",
                                    "filed": "2023-10-31",
                                    "val": 250000.0,
                                }
                            ]
                        }
                    },
                    "RevenueFromContractWithCustomerExcludingAssessedTax": {
                        "units": {
                            "USD": [
                                {
                                    "fy": 2024,
                                    "fp": "Q1",
                                    "form": "10-Q",
                                    "filed": "2024-02-01",
                                    "val": 90000.0,
                                }
                            ]
                        }
                    },
                    "NetIncomeLoss": {
                        "units": {
                            "USD": [
                                {
                                    "fy": 2023,
                                    "fp": "FY",
                                    "form": "10-K",
                                    "filed": "2023-10-31",
                                    "val": 50000.0,
                                },
                                {
                                    "fy": 2024,
                                    "fp": "Q1",
                                    "form": "10-Q",
                                    "filed": "2024-02-01",
                                    "val": 20000.0,
                                },
                            ]
                        }
                    },
                    "OperatingIncomeLoss": {
                        "units": {
                            "USD": [
                                {
                                    "fy": 2023,
                                    "fp": "FY",
                                    "form": "10-K",
                                    "filed": "2023-10-31",
                                    "val": 70000.0,
                                },
                                {
                                    "fy": 2024,
                                    "fp": "Q1",
                                    "form": "10-Q",
                                    "filed": "2024-02-01",
                                    "val": 25000.0,
                                },
                            ]
                        }
                    },
                    "Assets": {
                        "units": {
                            "USD": [
                                {
                                    "fy": 2023,
                                    "fp": "FY",
                                    "form": "10-K",
                                    "filed": "2023-10-31",
                                    "val": 500000.0,
                                },
                                {
                                    "fy": 2024,
                                    "fp": "Q1",
                                    "form": "10-Q",
                                    "filed": "2024-02-01",
                                    "val": 510000.0,
                                },
                            ]
                        }
                    },
                    "Liabilities": {
                        "units": {
                            "USD": [
                                {
                                    "fy": 2023,
                                    "fp": "FY",
                                    "form": "10-K",
                                    "filed": "2023-10-31",
                                    "val": 200000.0,
                                },
                                {
                                    "fy": 2024,
                                    "fp": "Q1",
                                    "form": "10-Q",
                                    "filed": "2024-02-01",
                                    "val": 205000.0,
                                },
                            ]
                        }
                    },
                }
            }
        }

        snapshots = map_companyfacts_to_snapshots(
            ticker="TEST",
            companyfacts_payload=payload,
            mapping_payload=self.mapping_payload,
            retrieved_at="2026-03-27T00:00:00Z",
        )

        fy_snapshot = next(item for item in snapshots if item["period"] == "2023-FY")
        q1_snapshot = next(item for item in snapshots if item["period"] == "2024-Q1")
        self.assertEqual(fy_snapshot["data"]["revenue"], 250000.0)
        self.assertEqual(q1_snapshot["data"]["revenue"], 90000.0)
        self.assertNotIn("revenue", q1_snapshot["missing_fields"])

    def test_normalize_transcript_record_filters_old_data(self) -> None:
        old_record = {
            "symbol": "AAPL",
            "year": 2018,
            "quarter": 4,
            "date": "2018-10-30",
            "content": "legacy transcript",
        }
        self.assertIsNone(normalize_transcript_record(old_record, min_year=2019, retrieved_at="2026-03-26T00:00:00Z"))

    def test_normalize_transcript_record_maps_current_row(self) -> None:
        record = {
            "symbol": "AAPL",
            "year": 2024,
            "quarter": "Q3",
            "date": "2024-07-29T22:00:00Z",
            "content": "Prepared remarks and question answer session",
        }
        normalized = normalize_transcript_record(record, min_year=2019, retrieved_at="2026-03-26T00:00:00Z")
        self.assertIsNotNone(normalized)
        assert normalized is not None
        self.assertEqual(normalized["ticker"], "AAPL")
        self.assertEqual(normalized["period"], "2024-Q3")
        self.assertEqual(normalized["fiscal_quarter"], 3)
        self.assertEqual(normalized["call_date"], "2024-07-29")
        self.assertTrue(normalized["word_count"] > 0)

    def test_index_companyfacts_members_finds_cik_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            zip_path = Path(tmp) / "companyfacts.zip"
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.writestr("companyfacts/CIK0000320193.json", "{}")
                archive.writestr("companyfacts/CIK0000789019.json", "{}")
            index = index_companyfacts_members(zip_path)
            self.assertIn("0000320193", index)
            self.assertIn("0000789019", index)

    def test_universe_file_loads_with_expected_columns(self) -> None:
        universe = load_universe(self.universe_path)
        self.assertGreaterEqual(len(universe), 500)
        self.assertIn(universe[0].tier, (1, 2, 3))
        self.assertEqual(len(universe[0].cik), 10)


if __name__ == "__main__":
    unittest.main()
