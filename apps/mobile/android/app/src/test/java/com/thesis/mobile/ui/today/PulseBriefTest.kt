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
        // The macro reading in reader words, never the raw series labels ("CPI-U All Items, Treasury 10Y").
        assertEquals(
            "Macro pressure is elevated, led by consumer prices and the 10-year Treasury yield.",
            brief.leadConclusion,
        )
        assertFalse(brief.leadConclusion == brief.morningLine)
    }

    @Test
    fun theMorningLineIsNotRepeatedAsAChapterHeadline() {
        // The issue's only markets sentence became the morning line: Markets leads with its levels instead.
        val markets = brief.chapter(ChapterKind.Markets)!!
        assertFalse(markets.title == brief.morningLine)
        assertTrue(markets.title, markets.title.startsWith("S&P 500 "))
        brief.chapters.forEach { assertFalse(it.title, it.title == brief.morningLine) }
    }

    @Test
    fun partialCoverageIsSaidOnceOnTheIncompleteChapter() {
        assertTrue(brief.chapter(ChapterKind.Markets)!!.partial)
        assertFalse(brief.heroPartial)
    }

    @Test
    fun aHomeRowNeverRepeatsTheHeadlineAboveIt() {
        val p = pulse.copy(
            sections = listOf(
                SectionView("what_changed", "What changed", "Ten-year yields fell for a fourth session. The curve steepened."),
                SectionView("what_to_watch", "What to watch", "1. Durable goods orders, Wed 08:30. 2. FOMC minutes, Wed 14:00."),
            ) + pulse.sections,
        )
        val b = PulseBrief.from(p, emptyList())
        val changed = b.chapter(ChapterKind.Changed)!!
        assertEquals("Ten-year yields fell for a fourth session.", changed.title)
        assertEquals("The curve steepened.", changed.rowSentence(changed.title))
        assertEquals(changed.title, changed.rowSentence("Something else."))
        // A list with no sentence of its own is headed by a count, and every event stays in the list.
        val watch = b.chapter(ChapterKind.Watch)!!
        assertEquals(TodayCopy.watchHeadline(2), watch.title)
        assertEquals("2 events to watch", watch.title)
        assertEquals(listOf("Durable goods orders, Wed 08:30.", "FOMC minutes, Wed 14:00."), watch.items)
        // Home's row under "Watch" names the first event rather than repeating the count.
        assertEquals("Durable goods orders, Wed 08:30; 1 more.", watch.rowSentence(b.leadConclusion))
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
        listOf(
            "(filing_posted)", "[medium]", "[high]", "_", "2026-04-25", "usd_per_barrel", "Coverage note:", "Coverage:",
            "live path", "this run", "this cycle", "CPI-U All Items",
        ).forEach { residue ->
            assertFalse("\"$residue\" in:\n$text", text.contains(residue))
        }
        brief.chapters.flatMap { c -> listOf(c.title) + c.paragraphs.map { it.text } + c.items + c.names.map { it.sentence } }
            .forEach { line ->
                assertFalse(line, Regex("\\b[a-z]+_[a-z]+\\b").containsMatchIn(line))
                assertFalse(line, line.contains("[") || line.contains("(filing"))
            }
    }

    @Test
    fun whatChangedListsTheEventsAndNeverLeadsWithOne() {
        val changed = brief.chapter(ChapterKind.Changed)!!
        // The headline is the issue's prose (the macro reading), not an event fragment or a list of series labels.
        assertEquals("Macro pressure is elevated, led by consumer prices and the 10-year Treasury yield.", changed.title)
        // Events are a compact list, never story paragraphs; the two filings are told by Your names.
        assertTrue(changed.paragraphs.toString(), changed.paragraphs.isEmpty())
        assertEquals(listOf("CPI update published."), changed.items)
    }

    @Test
    fun noWhatChangedLineRepeatsAYourNamesReason() {
        val changed = brief.chapter(ChapterKind.Changed)!!
        val reasons = brief.chapter(ChapterKind.Names)!!.names.map { it.sentence }
        val lines = changed.paragraphs.flatMap { PulseText.sentences(it.text) } + changed.items + changed.title
        lines.forEach { line -> assertFalse("\"$line\" repeats a Your names reason", line in reasons) }
        // A reader following nothing sees the filings in What changed instead.
        val unfollowed = PulseBrief.from(pulse, emptyList()).chapter(ChapterKind.Changed)!!
        assertEquals(listOf("AAPL filed a new 8-K.", "MSFT filed a new 8-K.", "CPI update published."), unfollowed.items)
    }

    @Test
    fun anIssueWithOnlyEventsLeadsWithACountOfThem() {
        val events = pulse.sections.first { it.sectionId == "canonical_events" }
        val b = PulseBrief.from(pulse.copy(sections = listOf(events)), emptyList())
        val changed = b.chapter(ChapterKind.Changed)!!
        assertEquals("2 filings and 1 macro release in this issue", changed.title)
        assertEquals(3, changed.items.size)
        assertTrue(changed.items.none { it == changed.title })
    }

    @Test
    fun yourNamesQuoteTheSentenceThatNamesThem() {
        val names = brief.chapter(ChapterKind.Names)!!
        assertEquals(listOf("AAPL", "MSFT"), names.names.map { it.ticker })
        // The row's title is the ticker: the sentence it opens does not repeat it.
        assertEquals("Filed a new 8-K.", names.names.first().sentence)
        assertEquals(TodayCopy.namesInBrief(2), names.title)
    }

    @Test
    fun headlinesAndSourcesKeepTheirLinks() {
        val headlines = brief.chapter(ChapterKind.Headlines)!!
        // The chapter headline is the top story itself (content, not a count); its link stays on the chapter.
        assertEquals("Apple investor update confirms release cadence.", headlines.title)
        assertEquals("https://investor.apple.com/investor-relations/", headlines.leadHeadline!!.url)
        assertTrue(headlines.headlines.isEmpty())
        val sources = brief.chapter(ChapterKind.Sources)!!
        assertTrue(sources.sources.any { it.url == "https://fred.stlouisfed.org/series/SP500" })
        assertTrue(sources.sources.any { it.url == "https://www.sec.gov/AAPL" })
        assertEquals(sources.sources.size, sources.sources.map { it.url }.distinct().size)
        // Two sources with one label say which document each opens.
        assertEquals(
            listOf("SEC EDGAR · AAPL 8-K", "SEC EDGAR · MSFT 8-K"),
            sources.sources.filter { it.label == "SEC EDGAR" }.map { it.title },
        )
        assertEquals(sources.sources.size, sources.sources.map { it.title }.distinct().size)
    }

    @Test
    fun theSourcesHeadlineIsAPlainCount() {
        val sources = brief.chapter(ChapterKind.Sources)!!
        assertEquals("This issue cites ${sources.sources.size} references", sources.title)
        assertFalse(sources.title.contains("every", ignoreCase = true))
    }

    @Test
    fun coverageNotesAreReaderSentencesWithoutRepeats() {
        val notes = brief.chapter(ChapterKind.Sources)!!.notes
        // "Sector leadership was unavailable" and "Sector ETF leadership is not available" say the same thing.
        assertEquals(1, notes.count { it.contains("leadership") })
        assertTrue(notes.toString(), "Sector leadership was not available for this issue." in notes)
        assertTrue(notes.toString(), "Market tape data is incomplete." in notes)
        notes.forEach { note ->
            assertTrue(note, note.endsWith("."))
            assertTrue(note, note.first().isUpperCase())
            listOf("live path", "this run", "this cycle", "Coverage", "optional in M").forEach { assertFalse(note, note.contains(it)) }
        }
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
