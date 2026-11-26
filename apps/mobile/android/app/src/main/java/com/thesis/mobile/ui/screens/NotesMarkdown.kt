package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.ui.format.Fmt
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * You > Your notes > "Export my notes" (DESIGN-DIRECTION 5.22): every cached note as one Markdown file, grouped by
 * ticker, newest first, each note under its filing period and date and the report's verdict sentence.
 *
 * Tickers are ordered by their newest note (the name you wrote about last comes first), notes inside a ticker
 * newest first. Dates always carry the year (an export outlives the year it was made in). Blank notes are left out.
 * A note is the user's plain text: lines that Markdown would read as structure (a heading, a quote, a list item, a
 * rule, a fence) are escaped, so a note can never break the ticker and report headings around it.
 * Pure: the caller hands the text to the system share sheet or a `CreateDocument` picker.
 */
object NotesMarkdown {

    /** Notes without a ticker are grouped under this heading. */
    const val NO_TICKER = "Other notes"

    private val DateFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.US)
    private val FileDateFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US)

    /** The export's file name: `thesis-notes-2026-11-25.md`. */
    fun fileName(today: LocalDate): String = "thesis-notes-${today.format(FileDateFormat)}.md"

    /** The note count and the number of tickers they are on (for the row caption). */
    fun counts(notes: List<NoteTrailEntry>): Pair<Int, Int> {
        val kept = notes.filter { it.text.isNotBlank() }
        return kept.size to kept.map { tickerOf(it) }.distinct().size
    }

    /**
     * The Markdown document. [today] dates the export; [zone] turns each note's `updatedAt` into a calendar date.
     */
    fun build(notes: List<NoteTrailEntry>, today: LocalDate, zone: ZoneId): String {
        val kept = notes.filter { it.text.isNotBlank() }
        val (count, names) = counts(kept)
        val groups = kept
            .groupBy { tickerOf(it) }
            .mapValues { (_, entries) -> entries.sortedByDescending { instantOf(it) ?: Instant.MIN } }
            .entries
            .sortedWith(
                compareByDescending<Map.Entry<String, List<NoteTrailEntry>>> { e -> instantOf(e.value.first()) ?: Instant.MIN }
                    .thenBy { it.key },
            )
        return buildString {
            append("# Thesis notes\n\n")
            append("Exported ${today.format(DateFormat)} · ")
            append(Fmt.count(count, "note", "notes")).append(" on ").append(Fmt.count(names, "name", "names"))
            append("\n")
            groups.forEach { (ticker, entries) ->
                append("\n## ").append(ticker).append("\n")
                entries.forEach { note ->
                    append("\n### ").append(headingOf(note, zone)).append("\n\n")
                    note.verdict?.trim()?.takeIf { it.isNotEmpty() }?.let { verdict ->
                        append("> ").append(oneLine(verdict)).append("\n\n")
                    }
                    append(noteBody(note.text)).append("\n")
                }
            }
        }
    }

    private fun tickerOf(note: NoteTrailEntry): String =
        note.ticker?.trim()?.uppercase()?.takeIf { it.isNotEmpty() } ?: NO_TICKER

    private fun instantOf(note: NoteTrailEntry): Instant? =
        note.updatedAt?.let { runCatching { Instant.parse(it) }.getOrNull() }

    /** "FY2025 report · 24 Nov 2026"; without a period "Report · 24 Nov 2026"; without a date the period alone. */
    private fun headingOf(note: NoteTrailEntry, zone: ZoneId): String {
        val period = note.filingPeriod?.trim()?.takeIf { it.isNotEmpty() }
        val report = if (period != null) "$period report" else "Report"
        val date = instantOf(note)?.atZone(zone)?.toLocalDate()?.format(DateFormat)
        return if (date != null) "$report · $date" else report
    }

    /**
     * The note's text with every line escaped by [escapeLine]. The note's own line breaks survive: a line followed
     * by another non-blank line ends with a backslash, Markdown's hard break (a lone newline would be a soft break,
     * so "Buy below 180" / "Trim above 240" would run together as one paragraph). It is visible in a plain-text reader
     * and survives editors that strip trailing spaces. Blank lines stay paragraph breaks.
     */
    internal fun noteBody(text: String): String {
        val lines = text.trim().replace("\r\n", "\n").replace('\r', '\n').lines().map { line ->
            if (line.isBlank()) "" else escapeLine(line)
        }
        return lines.mapIndexed { i, line ->
            val next = lines.getOrNull(i + 1)
            if (line.isNotEmpty() && !next.isNullOrEmpty()) withHardBreak(line) else line
        }.joinToString("\n")
    }

    /**
     * [line] followed by a hard break. A run of n backslashes the note already ends with is doubled (shown as
     * written) before the break's own backslash, so it neither swallows the break nor disappears.
     */
    private fun withHardBreak(line: String): String {
        val trailing = line.length - line.trimEnd('\\').length
        return line + "\\".repeat(trailing + 1)
    }

    /** Leading `#`, `>`, `+`, a code fence, `-`/`*` list markers and rules, and `=`/`-` underlines. */
    private val BlockMarker = Regex("""^(\s{0,3})(#|>|[-+*](?=\s|$)|`{3}|~{3}|[-*_=](?=(\s*[-*_=]){2,}\s*$)|=+\s*$)""")

    /** An ordered-list marker: digits then `.` or `)` and a space (or the end of the line). */
    private val OrderedMarker = Regex("""^(\s{0,3}\d{1,9})([.)])(?=\s|$)""")

    /**
     * One note line, with a leading Markdown block marker backslash-escaped (`\#`, `\>`, `\-`, `1\.`): Markdown
     * renders the character as written, and a plain-text reader still sees the note almost unchanged.
     */
    internal fun escapeLine(line: String): String {
        OrderedMarker.find(line)?.let { m -> return m.groupValues[1] + "\\" + m.groupValues[2] + line.substring(m.range.last + 1) }
        BlockMarker.find(line)?.let { m -> return m.groupValues[1] + "\\" + line.substring(m.groupValues[1].length) }
        return line
    }

    /** A verdict quoted on one line (a newline would end the Markdown quote). */
    private fun oneLine(text: String): String = text.lines().joinToString(" ") { it.trim() }.trim()
}
