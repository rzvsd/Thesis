package com.thesis.mobile.ui.today

import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.MarketTapeParser
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.ui.copy.TodayCopy
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The Pulse brief built from the real 2026-04-25 issue (`src/test/resources/fixtures/pulse`): chapters exist only
 * where the issue has content, no machine residue reaches the reader, pipeline notes go to Sources, and a missing
 * section never turns into invented prose (5.7, principle 11).
 */
class PulseBriefTest {

    private val pulse: PulseReportView by lazy { readPulse("fixtures/pulse/pulse_latest_2026-04-25.json") }
    private val brief: PulseBrief by lazy { PulseBrief.from(pulse, listOf("AAPL", "MSFT", "NVDA")) }

    @Test
    fun theRealIssueHasTheChaptersItHasContentFor() {
        assertEquals(
            listOf(ChapterKind.Markets, ChapterKind.Changed, ChapterKind.Names, ChapterKind.Headlines, ChapterKind.Sources),
            brief.chapters.map { it.kind },
        )
        assertTrue(brief.partial)
        assertTrue(brief.chapter(ChapterKind.Markets)!!.partial)
    }

    @Test
    fun theMorningLineAndLeadConclusionAreSentencesOfTheIssue() {
        assertEquals("US risk assets were broadly higher on the day.", brief.morningLine)
        assertEquals("Macro pressure is elevated: CPI-U All Items (high), Treasury 10Y (medium).", brief.leadConclusion)
        assertFalse(brief.leadConclusion == brief.morningLine)
    }

    @Test
    fun marketsCarriesTheWholeTapeInReadingOrder() {
        val markets = brief.chapter(ChapterKind.Markets)!!
        assertEquals(
            listOf("SP500", "DJIA", "NASDAQCOM", "DGS10", "DGS2", "VIXCLS", "DTWEXBGS", "DCOILWTICO", "BAMLH0A0HYM2"),
            markets.tape.map { it.id },
        )
        // The cross-asset sentence repeats the rows; the pipeline sentence is a coverage note, not news.
        assertTrue(markets.paragraphs.none { it.text.contains("Cross-asset") || it.text.contains("live path") })
    }

    @Test
    fun noMachineResidueReachesTheReader() {
        // Links are the only place raw identifiers may appear.
        val text = brief.asText("Pulse").lines().filterNot { it.contains("http") }.joinToString("\n")
        listOf("(filing_posted)", "[medium]", "[high]", "_", "2026-04-25", "usd_per_barrel", "Coverage note:").forEach { residue ->
            assertFalse("\"$residue\" in:\n$text", text.contains(residue))
        }
        brief.chapters.flatMap { c -> listOf(c.title) + c.paragraphs.map { it.text } + c.items + c.names.map { it.sentence } }
            .forEach { line ->
                assertFalse(line, Regex("\\b[a-z]+_[a-z]+\\b").containsMatchIn(line))
                assertFalse(line, line.contains("[") || line.contains("(filing"))
            }
    }

    @Test
    fun whatChangedReadsTheEventsAsSentences() {
        val changed = brief.chapter(ChapterKind.Changed)!!
        val texts = changed.paragraphs.map { it.text }
        assertTrue(texts.toString(), "AAPL filed a new 8-K." in texts)
        assertTrue(texts.toString(), "CPI update published." in texts)
    }

    @Test
    fun yourNamesQuoteTheSentenceThatNamesThem() {
        val names = brief.chapter(ChapterKind.Names)!!
        assertEquals(listOf("AAPL", "MSFT"), names.names.map { it.ticker })
        assertEquals("AAPL filed a new 8-K.", names.names.first().sentence)
        assertEquals(TodayCopy.namesInBrief(2), names.title)
    }

    @Test
    fun headlinesAndSourcesKeepTheirLinks() {
        val headlines = brief.chapter(ChapterKind.Headlines)!!.headlines
        assertEquals("Apple investor update confirms release cadence.", headlines.single().title)
        assertEquals("https://investor.apple.com/investor-relations/", headlines.single().url)
        val sources = brief.chapter(ChapterKind.Sources)!!
        assertTrue(sources.sources.any { it.url == "https://fred.stlouisfed.org/series/SP500" })
        assertTrue(sources.sources.any { it.url == "https://www.sec.gov/AAPL" })
        assertEquals(sources.sources.size, sources.sources.map { it.url }.distinct().size)
        assertTrue(sources.notes.toString(), sources.notes.any { it.startsWith("Sector ETF leadership") })
        assertTrue(sources.notes.toString(), sources.notes.any { it == "Market tape incomplete" })
    }

    @Test
    fun aMissingSectionIsNotReplacedByInventedProse() {
        val bare = PulseReportView(reportId = "r", generatedAt = "2026-04-25T14:09:09Z", sections = emptyList())
        val b = PulseBrief.from(bare, listOf("AAPL"))
        assertTrue(b.chapters.isEmpty())
        assertEquals("", b.morningLine)
        assertEquals(TodayCopy.briefChapters(0), b.leadConclusion)
        assertEquals(null, b.upshot)
    }

    @Test
    fun signalAndNoiseAndTheUpshotComeFromTheirSections() {
        val p = pulse.copy(
            sections = pulse.sections + listOf(
                SectionView("signal_vs_noise", "Signal vs noise", "Signal: Yields fell four days running. Noise: The VIX drop."),
                SectionView("upshot", "Upshot", "Rates did the work."),
            ),
        )
        val b = PulseBrief.from(p, emptyList())
        val changed = b.chapter(ChapterKind.Changed)!!
        assertEquals("Yields fell four days running.", changed.signal)
        assertEquals("The VIX drop.", changed.noise)
        assertEquals("Rates did the work.", b.upshot)
        assertEquals(null, b.chapter(ChapterKind.Names))
    }

    // ---- fixture -----------------------------------------------------------------------------------------------

    private fun readPulse(path: String): PulseReportView {
        val json = JSONObject(readFixture(path))
        val sections = json.getJSONObject("sections")
        // The client's order (ProductApiClient.parsePulseReport): its preferred keys first, then the rest as sent.
        val preferred = listOf(
            "macro_stress", "macro_stress_context", "official_macro_pressure", "market_moves", "macro_releases",
            "rates_fx_commodities", "news_summary", "uncertainty_flags", "watchlist_overlay",
        )
        val keys = (preferred + sections.keys().asSequence().toList()).distinct().filter { sections.has(it) }
        return PulseReportView(
            reportId = json.getString("report_id"),
            generatedAt = json.getString("generated_at"),
            cycleEnd = json.optString("cycle_end"),
            tape = MarketTapeParser.parse(json.optJSONObject("market_tape")),
            sections = keys.map { key ->
                val s = sections.getJSONObject(key)
                val ev = s.optJSONArray("evidence")
                SectionView(
                    sectionId = s.optString("section_id", key),
                    title = s.optString("title", key),
                    body = s.optString("body"),
                    status = s.optString("status").ifBlank { null },
                    evidence = (0 until (ev?.length() ?: 0)).map { i ->
                        val e = ev!!.getJSONObject(i)
                        EvidenceView(e.optString("source_name"), e.optString("excerpt"), e.optString("url").ifBlank { null })
                    },
                )
            },
        ).also { assertNotNull(it.tape) }
    }

    private fun readFixture(path: String): String {
        javaClass.classLoader?.getResourceAsStream(path)?.use { return it.readBytes().toString(Charsets.UTF_8) }
        val candidates = listOf(
            File("src/test/resources/$path"),
            File("app/src/test/resources/$path"),
            File("../app/src/test/resources/$path"),
        )
        val file = candidates.firstOrNull { it.isFile } ?: error("fixture $path not found (cwd ${File(".").absolutePath})")
        return file.readText()
    }
}
