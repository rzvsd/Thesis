package com.thesis.mobile.ui.screens.report

import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.FilingReadView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReportQuoteTest {
    private val selection = PageSelection(quote = "Services grew faster than hardware.", chapterNumber = "04", chapterName = "Margins")

    @Test
    fun formatsTheQuoteWithChapterAndSource() {
        assertEquals(
            "> \"Services grew faster than hardware.\" (Ch. 04 Margins, AAPL 10-K FY2025)",
            ReportQuote.format(selection, "AAPL 10-K FY2025"),
        )
    }

    @Test
    fun leavesOutWhatTheSelectionDoesNotHave() {
        val cover = selection.copy(chapterNumber = "", chapterName = "")
        assertEquals("> \"Services grew faster than hardware.\" (AAPL 10-K FY2025)", ReportQuote.format(cover, "AAPL 10-K FY2025"))
        assertEquals("> \"Services grew faster than hardware.\"", ReportQuote.format(cover, " "))
        assertEquals(
            "> \"Services grew faster than hardware.\" (Ch. 04, AAPL)",
            ReportQuote.format(selection.copy(chapterName = ""), "AAPL"),
        )
    }

    @Test
    fun appendsOnItsOwnParagraph() {
        val quote = ReportQuote.format(selection, "AAPL 10-K FY2025")
        assertEquals(quote, ReportQuote.append("", quote))
        assertEquals(quote, ReportQuote.append("  \n\n", quote))
        assertEquals("My view.\n\n$quote", ReportQuote.append("My view.\n\n\n", quote))
        val twice = ReportQuote.append(ReportQuote.append("My view.", quote), quote)
        assertEquals("My view.\n\n$quote\n\n$quote", twice)
    }

    @Test
    fun clipsALongSelectionAtAWord() {
        val long = PageSelection(quote = List(200) { "word$it" }.joinToString(" "))
        val formatted = ReportQuote.format(long, "")
        val quoted = formatted.removePrefix("> \"").removeSuffix("\"")
        assertTrue(quoted.endsWith("…"))
        assertTrue(quoted.length <= ReportQuote.MAX_QUOTE_CHARS + 1)
        assertTrue(quoted.removeSuffix("…").split(' ').all { it.startsWith("word") && it.length > 4 })
    }

    @Test
    fun parsesTheScriptResult() {
        val parsed = ReportQuote.parseSelection("{\"quote\":\"  Net  sales\\nrose\\u00a07%. \",\"num\":\"06\",\"chapter\":\"Financials\"}")
        assertEquals(PageSelection("Net sales rose 7%.", "06", "Financials"), parsed)
    }

    @Test
    fun rejectsWhatIsNotASelection() {
        assertNull(ReportQuote.parseSelection(null))
        assertNull(ReportQuote.parseSelection(""))
        assertNull(ReportQuote.parseSelection("null"))
        assertNull(ReportQuote.parseSelection("\"text\""))
        assertNull(ReportQuote.parseSelection("{broken"))
        assertNull(ReportQuote.parseSelection("{\"quote\":\"   \",\"num\":\"01\",\"chapter\":\"Summary\"}"))
    }

    @Test
    fun sourceLabelNamesTickerFormAndPeriod() {
        val report = DeepDiveReportView(
            reportId = "r1",
            ticker = " aapl ",
            signalValue = null,
            confidenceLabel = null,
            confidenceScore = null,
            sections = emptyList(),
            filingRead = FilingReadView(
                form = "10-K",
                period = "FY2025",
                generationMode = "full",
                theFilingRead = "",
                whatChanged = "",
                theGood = "",
                theBad = "",
                takeaway = "",
                whatToWatchNext = "",
                topChanges = emptyList(),
                metricDeltas = emptyList(),
            ),
        )
        assertEquals("AAPL 10-K FY2025", ReportQuote.sourceLabel(report))
        assertEquals("AAPL", ReportQuote.sourceLabel(report.copy(filingRead = null)))
    }
}
