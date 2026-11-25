package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.NoteTrailEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId

/** You > Your notes > "Export my notes" (DESIGN-DIRECTION 5.22): the Markdown file. */
class NotesMarkdownTest {
    private val today = LocalDate.of(2026, 11, 25)
    private val zone = ZoneId.of("America/New_York")

    private fun note(
        ticker: String?,
        text: String,
        updatedAt: String?,
        period: String? = "FY2025",
        verdict: String? = null,
        reportId: String = "r-$ticker-$updatedAt",
    ) = NoteTrailEntry(reportId, ticker, text, updatedAt, period, verdict)

    @Test
    fun `groups by ticker, newest name first, notes newest first, with period, date and verdict`() {
        val notes = listOf(
            note("aapl", "Services margin is the story.", "2026-11-20T15:00:00Z", verdict = "Thesis intact."),
            note("NVDA", "Watch the China line.\nAnd inventory.", "2026-11-24T02:30:00Z", period = "Q3 FY2026"),
            note("AAPL", "Buyback pace slowed.", "2026-11-22T12:00:00Z", period = null),
        )
        val expected = """
            # Thesis notes

            Exported 25 Nov 2026 · 3 notes on 2 names

            ## NVDA

            ### Q3 FY2026 report · 23 Nov 2026

            Watch the China line.
            And inventory.

            ## AAPL

            ### Report · 22 Nov 2026

            Buyback pace slowed.

            ### FY2025 report · 20 Nov 2026

            > Thesis intact.

            Services margin is the story.

        """.trimIndent()
        assertEquals(expected, NotesMarkdown.build(notes, today, zone))
    }

    @Test
    fun `blank notes are left out and notes without a ticker or date still export`() {
        val notes = listOf(
            note("MSFT", "   ", "2026-11-23T10:00:00Z"),
            note(null, "General reading list.", null, period = null),
            note(" msft ", "Azure growth.", "2026-11-21T10:00:00Z", verdict = "  Line one\n line two  "),
        )
        val md = NotesMarkdown.build(notes, today, zone)
        assertTrue(md.contains("2 notes on 2 names"))
        assertTrue(md.contains("## MSFT\n\n### FY2025 report · 21 Nov 2026\n\n> Line one line two\n\nAzure growth.\n"))
        assertTrue(md.contains("## ${NotesMarkdown.NO_TICKER}\n\n### Report\n\nGeneral reading list.\n"))
        // A name with a dated note comes before the undated group.
        assertTrue(md.indexOf("## MSFT") < md.indexOf("## ${NotesMarkdown.NO_TICKER}"))
        assertFalse(md.contains("   \n"))
    }

    @Test
    fun `counts skip blank notes and count names case-insensitively`() {
        val notes = listOf(
            note("aapl", "a", "2026-11-20T15:00:00Z"),
            note("AAPL", "b", "2026-11-21T15:00:00Z"),
            note("NVDA", " ", "2026-11-21T15:00:00Z"),
        )
        assertEquals(2 to 1, NotesMarkdown.counts(notes))
        assertEquals(0 to 0, NotesMarkdown.counts(emptyList()))
    }

    @Test
    fun `single note and name read in the singular`() {
        val md = NotesMarkdown.build(listOf(note("AAPL", "One.", "2026-11-20T15:00:00Z")), today, zone)
        assertTrue(md.contains("1 note on 1 name\n"))
    }

    @Test
    fun `file name carries the export date`() {
        assertEquals("thesis-notes-2026-11-25.md", NotesMarkdown.fileName(today))
        assertEquals("thesis-notes-2027-01-05.md", NotesMarkdown.fileName(LocalDate.of(2027, 1, 5)))
    }

    @Test
    fun `note lines that Markdown reads as structure are escaped, plain lines are kept`() {
        val text = "# Not a heading\n## Nor this\n> not a quote\n- not a list\n* nor this\n+ nor this\n" +
            "1. not numbered\n12) nor this\n---\n===\n```\n  # indented\n-5% margin is fine\n#hashtag\nPlain line."
        val expected = "\\# Not a heading\n\\## Nor this\n\\> not a quote\n\\- not a list\n\\* nor this\n" +
            "\\+ nor this\n1\\. not numbered\n12\\) nor this\n\\---\n\\===\n\\```\n  \\# indented\n" +
            "-5% margin is fine\n\\#hashtag\nPlain line."
        assertEquals(expected, NotesMarkdown.noteBody(text))
    }

    @Test
    fun `a note with a heading line stays under its ticker and report headings`() {
        val md = NotesMarkdown.build(listOf(note("AAPL", "# My take\n> quoted", "2026-11-20T15:00:00Z")), today, zone)
        val headings = md.lines().filter { it.startsWith("#") }
        assertEquals(listOf("# Thesis notes", "## AAPL", "### FY2025 report · 20 Nov 2026"), headings)
        assertTrue(md.contains("\\# My take\n\\> quoted"))
        assertFalse(md.lines().any { it.startsWith(">") })
    }
}
