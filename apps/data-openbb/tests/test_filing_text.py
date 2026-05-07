import unittest

from src.filing_text import extract_reviewed_filing_sections, normalize_filing_text


class FilingTextExtractionTests(unittest.TestCase):
    def test_normalize_filing_text_strips_tags_and_collapses_space(self):
        raw = "<html><body>Item 2. Management&nbsp;Discussion\n\n and Analysis</body></html>"
        self.assertEqual(
            normalize_filing_text(raw),
            "Item 2. Management Discussion and Analysis"
        )

    def test_extract_reviewed_sections_returns_bounded_excerpts(self):
        raw = """
        <h2>Item 2. Management's Discussion and Analysis</h2>
        Revenue grew because services improved.
        <h2>Item 1A. Risk Factors</h2>
        Risk language stayed focused on supply chain pressure.
        <h2>Liquidity and Capital Resources</h2>
        Cash and debt remained manageable.
        <h2>Segment Information</h2>
        Segment revenue shifted toward services.
        """
        sections = extract_reviewed_filing_sections(raw, max_chars=120)
        by_family = {section.family: section for section in sections}

        self.assertFalse(by_family["mda"].omitted)
        self.assertIn("Management's Discussion", by_family["mda"].excerpt)
        self.assertFalse(by_family["risk_factors"].omitted)
        self.assertFalse(by_family["liquidity"].omitted)
        self.assertFalse(by_family["segments"].omitted)
        self.assertLessEqual(len(by_family["mda"].excerpt), 120)

    def test_missing_sections_are_omission_forward(self):
        sections = extract_reviewed_filing_sections("Item 2. Management discussion only.")
        missing = [section for section in sections if section.omitted]

        self.assertGreaterEqual(len(missing), 1)
        self.assertTrue(all(section.reason == "section_not_found" for section in missing))


if __name__ == "__main__":
    unittest.main()
