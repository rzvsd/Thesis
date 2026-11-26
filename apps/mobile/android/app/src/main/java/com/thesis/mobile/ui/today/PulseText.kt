package com.thesis.mobile.ui.today

import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/*
 * Pulse prose clean-up (docs/app-redesign/DESIGN-DIRECTION.md 5.7, principle 11 and rubric C1): the issue's section
 * bodies are written by the pipeline and carry machine residue: raw enums in parentheses ("(filing_posted)"),
 * pressure tags ("[medium]"), ISO dates, unit words ("4.29 percent", "63.02 usd_per_barrel"), numbered lists run
 * into one paragraph and coverage notes mixed into the story. This turns a body into readable sentences and list
 * items without inventing anything: it only removes residue and reformats what is there.
 */
object PulseText {

    private val Whitespace = Regex("\\s+")
    private val SnakeParen = Regex("\\s*\\(([a-z0-9]+_)+[a-z0-9]+\\)")
    private val PressureTag = Regex("\\s*\\[(low|medium|high|elevated|moderate|none)]", RegexOption.IGNORE_CASE)
    // The same levels in parentheses after a series name ("CPI-U All Items (high), Treasury 10Y (medium)").
    private val PressureParen = Regex("\\s*\\((low|medium|high|elevated|moderate|none)\\)", RegexOption.IGNORE_CASE)
    private val IsoDayParen = Regex("\\((\\d{4})-(\\d{2})-(\\d{2})\\)")
    private val IsoMonthParen = Regex("\\((\\d{4})-(\\d{2})\\)")
    private val IsoQuarterParen = Regex("\\((\\d{4})-Q([1-4])\\)")
    private val DataIncomplete = Regex("\\b(data_incomplete|data_unavailable|source_unavailable):([a-z0-9_]+)")
    private val SnakeWord = Regex("\\b[a-z]+(_[a-z0-9]+)+\\b")
    private val ListMarker = Regex("(?:^|\\s)(\\d{1,2})\\.\\s+(?=\\S)")
    // A full stop ends a sentence, except after initials ("U.S.") and common abbreviations ("Inc.", "vs.").
    private val SentenceEnd =
        Regex("(?<=[.!?])(?<![A-Z]\\.[A-Z]\\.)(?<!\\b(?:Inc|Corp|Co|vs|Mr|Ms|Dr|St|No)\\.)\\s+(?=[A-Z0-9“\"(])")
    private val CoverageNote = Regex("^(coverage note|coverage)\\s*:\\s*", RegexOption.IGNORE_CASE)
    // Sentences about the pipeline's run rather than the markets ("... in the approved free live path for this run").
    // "Issuer filing coverage this cycle: AAPL, MSFT." is a note about what the run read, not news.
    private val PipelineNote =
        Regex("(?i)\\b(live path|for this run|in this run|this cycle's run|coverage this cycle|optional in M\\d+)\\b")
    private val UpperPrefix = Regex("^([A-Z][A-Z0-9_.]{0,30})\\s+[-–]\\s+")

    private val DayMonth = DateTimeFormatter.ofPattern("d MMM", Locale.US)
    private val MonthYear = DateTimeFormatter.ofPattern("MMM yyyy", Locale.US)

    /** One body, cleaned: residue removed, units and dates readable, whitespace collapsed. */
    fun clean(raw: String?): String {
        var s = raw?.replace(Whitespace, " ")?.trim().orEmpty()
        if (s.isEmpty()) return s
        s = s.replace(SnakeParen, "")
        s = s.replace(PressureTag, "")
        s = s.replace(PressureParen, "")
        s = s.replace(DataIncomplete) { m -> "${m.groupValues[2].replace('_', ' ')} ${incompleteWord(m.groupValues[1])}" }
        s = s.replace(IsoDayParen) { m ->
            runCatching {
                "(" + LocalDate.of(m.groupValues[1].toInt(), m.groupValues[2].toInt(), m.groupValues[3].toInt()).format(DayMonth) + ")"
            }.getOrDefault(m.value)
        }
        s = s.replace(IsoMonthParen) { m ->
            runCatching { "(" + YearMonth.of(m.groupValues[1].toInt(), m.groupValues[2].toInt()).format(MonthYear) + ")" }
                .getOrDefault(m.value)
        }
        s = s.replace(IsoQuarterParen) { m -> "(Q${m.groupValues[2]} ${m.groupValues[1]})" }
        s = s.replace(Regex("(\\d)\\s+annualized_percent\\b"), "$1% annualized")
        s = s.replace(Regex("(\\d)\\s+percent\\b"), "$1%")
        s = s.replace(Regex("(\\d(?:[\\d,]*)(?:\\.\\d+)?)\\s+usd_per_barrel\\b"), "\\$$1 a barrel")
        s = s.replace(Regex("(\\d)\\s+index\\b"), "$1")
        s = s.replace(SnakeWord) { it.value.replace('_', ' ') }
        return s.replace(Whitespace, " ").trim()
    }

    private fun incompleteWord(kind: String): String = when (kind) {
        "data_unavailable", "source_unavailable" -> "unavailable"
        else -> "incomplete"
    }

    /** Sentences of a cleaned body, duplicates removed. */
    fun sentences(text: String): List<String> =
        text.split(SentenceEnd).map { it.trim() }.filter { it.isNotEmpty() }.distinct()

    /** The first sentence of [raw], cleaned (empty when none). */
    fun firstSentence(raw: String?): String = sentences(clean(raw)).firstOrNull().orEmpty()

    /**
     * A body as a numbered list when it is one ("1. AAPL - AAPL filed a new 8-K. 2. ..."), else null. A leading
     * subject that only repeats the item ("AAPL - AAPL filed", "BLS_CPI_U_ALL_ITEMS - CPI update") is dropped.
     */
    fun listItems(raw: String?): List<String>? {
        val text = raw?.replace(Whitespace, " ")?.trim().orEmpty()
        val markers = ListMarker.findAll(text).toList()
        if (markers.size < 2 || markers.first().groupValues[1] != "1") return null
        val items = markers.mapIndexed { i, m ->
            val start = m.range.last + 1
            val end = if (i + 1 < markers.size) markers[i + 1].range.first else text.length
            text.substring(start, end).trim()
        }
        return items.map { item ->
            val prefix = UpperPrefix.find(item)
            val stripped = if (prefix != null) item.substring(prefix.range.last + 1) else item
            clean(stripped).trimEnd('.').trim().let { sentence -> if (sentence.isEmpty()) sentence else "$sentence." }
        }.filter { it.length > 1 }.distinct()
    }

    /**
     * Splits a cleaned body into story sentences and coverage notes ("Coverage note: ..."), so notes about the
     * pipeline go to the Sources chapter instead of reading as news.
     */
    fun splitCoverage(text: String): Pair<List<String>, List<String>> {
        val story = mutableListOf<String>()
        val notes = mutableListOf<String>()
        sentences(text).forEach { s ->
            when {
                CoverageNote.containsMatchIn(s) -> notes += s.replace(CoverageNote, "").trim()
                PipelineNote.containsMatchIn(s) -> notes += s
                else -> story += s
            }
        }
        return story to notes.distinct()
    }

    // An event's kind, as the pipeline tags it in parentheses: "(filing_posted)", "(macro_release_published)".
    private val EventKind = Regex("\\(([a-z]+(?:_[a-z]+)+)\\)")

    /** The kinds of a raw event list's items, in order ("filing_posted", "macro_release_published"). */
    fun eventKinds(raw: String?): List<String> = EventKind.findAll(raw.orEmpty()).map { it.groupValues[1] }.toList()

    // Pipeline wording in coverage notes, read as reader copy (principle 11: honest, but in the reader's terms).
    private val NoteRewrites = listOf(
        Regex("(?i)^issuer filing coverage (?:this cycle|for this run|in this run)\\s*:") to "Filings covered in this issue:",
        Regex("(?i)\\s+(?:are|is) optional in M\\d+ and\\b") to "",
        Regex("(?i)\\s+in the approved free live path(?: for this run)?") to " for this issue",
        Regex("(?i)\\b(?:in|for|during) (?:this|the) (?:run|cycle)\\b") to "for this issue",
        Regex("(?i)\\bthis (?:run|cycle)\\b") to "this issue",
        Regex("(?i)\\b(is|was|were|are) unavailable\\b") to "$1 not available",
        // A bare flag with no verb ("Market tape incomplete", from the issue's uncertainty flags).
        Regex("(?i)^(?!.*\\b(?:is|are|was|were)\\b)(.+?) incomplete$") to "$1 data is incomplete",
        Regex("(?i)^(?!.*\\b(?:is|are|was|were)\\b)(.+?) unavailable$") to "$1 was not available for this issue",
        Regex("(?i)\\bfor this issue for this issue\\b") to "for this issue",
    )

    // Words a note's subject is compared on: near-duplicates ("Sector leadership was not available" and "Sector ETF
    // leadership is not available") share the rest.
    private val NoteFiller = setOf(
        "a", "an", "the", "is", "was", "were", "are", "not", "available", "unavailable", "for", "this", "issue", "in",
        "of", "data", "coverage", "incomplete", "etf", "and",
    )

    /**
     * Coverage notes as the reader reads them: pipeline phrases rewritten ("in the approved free live path for this
     * run" -> "for this issue"), each a sentence with a capital and a full stop, near-duplicates dropped.
     */
    fun readerNotes(raw: List<String>): List<String> {
        val seen = mutableSetOf<Set<String>>()
        return raw.mapNotNull { note ->
            var s = note.replace(Whitespace, " ").trim().trimEnd('.').trim()
            if (s.isEmpty()) return@mapNotNull null
            NoteRewrites.forEach { (re, to) -> s = s.replace(re, to) }
            s = s.replace(Whitespace, " ").trim().trimEnd('.').replaceFirstChar { it.uppercase() } + "."
            val key = s.lowercase().split(Regex("[^a-z0-9]+")).filter { it.isNotEmpty() && it !in NoteFiller }.toSet()
            if (!seen.add(key)) null else s
        }
    }

    /**
     * A paragraph's lead phrase (the DD marker): the first sentence when the paragraph has more than one, else
     * nothing (a single sentence set in bold would read as a heading).
     */
    fun leadAndRest(sentences: List<String>): Pair<String, String> =
        if (sentences.size >= 2) sentences.first() to sentences.drop(1).joinToString(" ") else "" to sentences.joinToString(" ")

    /** Shortens [text] to its first sentence, then to [limit] characters at a word boundary with an ellipsis. */
    fun oneSentence(text: String, limit: Int = 140): String {
        val first = sentences(text).firstOrNull() ?: text
        if (first.length <= limit) return first
        val cut = first.take(limit).substringBeforeLast(' ').trimEnd(',', ';', ':')
        return "$cut…"
    }

    // Where a headline can be shortened: after a clause, before a conjunction ("..., as yields eased").
    private val ClauseBreak = Regex("[;,:](?=\\s)|\\s[—–]\\s|\\s(?=(?:as|while|after|but|although|though|and|amid)\\s)")

    /**
     * Shorter forms of [sentence] for a headline with a fixed number of lines (spec 5.6: "shortened to one
     * sentence ... max 2 lines"): the sentence itself, then the sentence cut at each clause boundary, longest first,
     * each ending with a full stop. Cuts shorter than [minLength] characters are left out (too little is left to
     * say anything). Nothing is invented: every form is a leading part of the sentence.
     */
    fun headlineForms(sentence: String, minLength: Int = 24): List<String> {
        val s = sentence.replace(Whitespace, " ").trim()
        if (s.isEmpty()) return emptyList()
        val cuts = ClauseBreak.findAll(s)
            .map { it.range.first }
            .filter { it >= minLength }
            .map { s.substring(0, it).trimEnd(' ', ',', ';', ':', '—', '–', '.') + "." }
            .sortedByDescending { it.length }
            .toList()
        return (listOf(s) + cuts).distinct()
    }

    // Where a row's short line can end besides a clause: before a trailing phrase ("... near 46% through the quarter").
    private val PhraseBreak =
        Regex("\\s(?=(?:through|for|in|on|at|to|from|over|since|despite|with|by|after|before|during|versus|vs)\\s)")

    /**
     * Shorter forms of [sentence] for a one-line row (a name's reason): [headlineForms], then the sentence cut before
     * a trailing phrase, longest first, each ending with a full stop. Every form is a leading part of the sentence
     * that still reads as a statement; nothing is invented and nothing ends mid-word or in an ellipsis.
     */
    fun rowForms(sentence: String, minLength: Int = 16): List<String> {
        val s = sentence.replace(Whitespace, " ").trim()
        if (s.isEmpty()) return emptyList()
        val phrases = PhraseBreak.findAll(s)
            .map { it.range.first }
            .filter { it >= minLength }
            .map { s.substring(0, it).trimEnd(' ', ',', ';', ':', '—', '–', '.') + "." }
        return (headlineForms(s, minLength) + phrases).distinct().sortedByDescending { it.length }
    }

    /**
     * The longest form of [text]'s first sentence ([headlineForms]) that [fits]; the shortest form when none does
     * (the Text's own line cap is then only a guard). Home measures [fits] against the real width and font scale.
     */
    fun fitHeadline(text: String, fits: (String) -> Boolean): String {
        val forms = headlineForms(sentences(clean(text)).firstOrNull() ?: text)
        return forms.firstOrNull(fits) ?: forms.lastOrNull().orEmpty()
    }

    /** The host of a URL ("www.sec.gov" -> "sec.gov"), for source captions. */
    fun host(url: String?): String? {
        val u = url?.trim()?.ifBlank { null } ?: return null
        val host = runCatching { java.net.URI(u).host }.getOrNull() ?: return null
        return host.removePrefix("www.")
    }
}
