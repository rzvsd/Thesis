package com.thesis.mobile.ui.today

import androidx.compose.runtime.Immutable
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.MarketTapeFamily
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.ui.copy.TodayCopy
import java.time.Instant
import java.time.LocalDate

/*
 * The Pulse brief model (docs/app-redesign/DESIGN-DIRECTION.md 5.7): one Pulse issue read into the brief's
 * chapters (Markets, What changed, Your names, Watch, Headlines, Sources), its morning line and its lead
 * conclusion. Home (5.6 block 6) shows the same chapters as rows. Built once per issue, off the composition's hot
 * path (`remember(pulse, watchlist)`); nothing here is invented: a chapter exists only when the issue has content
 * for it, and when a section is missing the brief has no prose in its place (principle 11).
 */

enum class ChapterKind { Markets, Changed, Names, Watch, Headlines, Sources }

/** A story paragraph: the lead phrase (highlighted) and the rest. [lead] is empty for a plain paragraph. */
@Immutable
data class Paragraph(val lead: String, val rest: String) {
    val text: String get() = listOf(lead, rest).filter { it.isNotBlank() }.joinToString(" ")
}

/** A followed name the issue mentions, with the sentence that mentions it. */
@Immutable
data class NameMention(val ticker: String, val sentence: String)

/** A headline row: what was published, by whom and when, and where it opens. */
@Immutable
data class Headline(val title: String, val source: String?, val at: Instant?, val url: String?)

/**
 * A source the issue cites, opening in the browser. [detail] tells apart two sources with the same [label] ("SEC
 * EDGAR · AAPL 8-K" and "SEC EDGAR · MSFT 8-K"); null when the label alone is unique.
 */
@Immutable
data class SourceRef(val label: String, val url: String, val at: Instant?, val detail: String? = null) {
    /** The row title: the label, qualified by [detail] when two sources share it. */
    val title: String get() = if (detail == null) label else "$label · $detail"
}

@Immutable
data class PulseChapter(
    val kind: ChapterKind,
    /** The kicker ("Markets"). */
    val label: String,
    /** The headline: a sentence from the issue, or a generated one when the issue has only rows. */
    val title: String,
    /** Coverage of this chapter's inputs is incomplete (a "Partial coverage" badge). */
    val partial: Boolean = false,
    val paragraphs: List<Paragraph> = emptyList(),
    val tape: List<TapeLine> = emptyList(),
    val names: List<NameMention> = emptyList(),
    val items: List<String> = emptyList(),
    /** Headlines: the one the chapter headline quotes ([title]) is [leadHeadline]; the rest are rows. */
    val headlines: List<Headline> = emptyList(),
    val leadHeadline: Headline? = null,
    val sources: List<SourceRef> = emptyList(),
    /** Coverage notes in reader copy, each a sentence (Sources chapter), never mixed into the story. */
    val notes: List<String> = emptyList(),
    val signal: String? = null,
    val noise: String? = null,
) {
    /**
     * The chapter in one sentence for a row under a headline that already says [shown] (Home's Today's Pulse: the
     * lead conclusion is the What changed headline). The title when it differs, else the chapter's next sentence;
     * null when the chapter has nothing else to say (the row is then left out rather than repeat the headline).
     */
    fun rowSentence(shown: String?): String? {
        // Under the row title "Watch", "3 events to watch" says little: the first event, and how many follow.
        if (kind == ChapterKind.Watch && items.isNotEmpty() && title == TodayCopy.watchHeadline(items.size)) {
            return TodayCopy.watchRow(items.first(), items.size - 1)
        }
        // Under the row title "Your names", "2 of your names are in this issue" leaves the reader to open the Pulse
        // to learn which: the row names them ("AAPL and MSFT are in this issue").
        if (kind == ChapterKind.Names && names.isNotEmpty() && title == TodayCopy.namesInBrief(names.size)) {
            return TodayCopy.namesRow(names.map { it.ticker })
        }
        if (title != shown) return title
        val next = paragraphs.firstOrNull()?.text?.let { PulseText.sentences(it).firstOrNull() }
            ?: items.firstOrNull()
            ?: names.firstOrNull()?.let { "${it.ticker}: ${it.sentence}" }
            ?: headlines.firstOrNull()?.title
        return next?.takeIf { it != shown }
    }

    /** This chapter with its headline replaced by its next sentence (that sentence leaves the paragraphs). */
    internal fun promoteNextSentence(fallback: String): PulseChapter {
        val first = paragraphs.firstOrNull() ?: return copy(title = fallback)
        val sentences = PulseText.sentences(first.text)
        val head = sentences.firstOrNull() ?: return copy(title = fallback)
        val rest = sentences.drop(1)
        val remaining = buildList {
            if (rest.isNotEmpty()) {
                val (lead, tail) = PulseText.leadAndRest(rest)
                add(Paragraph(lead, tail))
            }
            addAll(paragraphs.drop(1))
        }
        return copy(title = head, paragraphs = remaining)
    }
}

@Immutable
data class PulseBrief(
    val reportId: String,
    /** The morning line: one sentence, the hero line of the brief and Home's header title. */
    val morningLine: String,
    /** The issue's lead conclusion (Home's Today's Pulse headline), never the morning line again. */
    val leadConclusion: String,
    val generatedAt: Instant?,
    /** When the tape's data was retrieved (a time), else null. */
    val dataRetrievedAt: Instant?,
    /** The market day the tape describes. */
    val dataDay: LocalDate?,
    val chapters: List<PulseChapter>,
    val upshot: String?,
    /** Any input of the issue is incomplete. */
    val partial: Boolean,
) {
    fun chapter(kind: ChapterKind): PulseChapter? = chapters.firstOrNull { it.kind == kind }

    /**
     * The hero carries the "Partial coverage" badge only when no chapter carries it: an incomplete chapter says so
     * in its own header, and the same caveat twice within one screen is noise (rubric V3).
     */
    val heroPartial: Boolean get() = partial && chapters.none { it.partial }

    /** Plain text of the brief ("Copy as text"): the morning line, then each chapter's headline and content. */
    fun asText(heading: String): String = buildString {
        appendLine(heading)
        appendLine()
        appendLine(morningLine)
        chapters.forEachIndexed { i, c ->
            appendLine()
            appendLine("${(i + 1).toString().padStart(2, '0')} ${c.label}")
            appendLine(c.title)
            c.tape.forEach { appendLine("${it.name}\t${it.level}\t${it.delta}") }
            c.paragraphs.forEach { appendLine(it.text) }
            c.names.forEach { appendLine("${it.ticker}: ${it.sentence}") }
            c.items.forEach { appendLine("· $it") }
            c.leadHeadline?.let { h -> listOfNotNull(h.source, h.url).joinToString(" · ").ifBlank { null }?.let(::appendLine) }
            c.headlines.forEach { h -> appendLine(listOfNotNull(h.title, h.source).joinToString(" · ")) }
            c.signal?.let { appendLine("${TodayCopy.SIGNAL}: $it") }
            c.noise?.let { appendLine("${TodayCopy.NOISE}: $it") }
            c.sources.forEach { appendLine("${it.title}: ${it.url}") }
            if (c.notes.isNotEmpty()) appendLine(TodayCopy.COVERAGE)
            c.notes.forEach { appendLine(it) }
        }
        upshot?.let {
            appendLine()
            appendLine("${TodayCopy.UPSHOT}: $it")
        }
    }.trimEnd()

    companion object {
        /** Section keys, matched against the section id and title (lower case, `_` read as a space). */
        private val MorningKeys = listOf("morning line", "morning_line")
        private val TapeKeys = listOf("market tape", "market_tape")
        private val ChangedKeys = listOf("what changed", "what_changed", "interesting")
        private val MacroKeys = listOf("macro stress", "macro_stress")
        private val MovesKeys = listOf("market moves", "market_moves", "canonical events", "canonical_events")
        private val NamesKeys = listOf("portfolio radar", "portfolio_radar", "your names", "watchlist")
        private val WatchKeys = listOf("what to watch", "what_to_watch", "calendar", "earnings calendar")
        private val NewsKeys = listOf("news summary", "news_summary", "headlines", "news")
        private val SignalKeys = listOf("signal vs noise", "signal_vs_noise")
        private val UpshotKeys = listOf("upshot", "bottom line", "bottom_line", "takeaway")
        private val FlagKeys = listOf("uncertainty flags", "uncertainty_flags")

        private val IncompleteStatus = setOf("data_incomplete", "data_unavailable", "partial", "failed", "incomplete")

        fun isPartial(section: SectionView?): Boolean = section?.status?.trim()?.lowercase() in IncompleteStatus

        /** Builds the brief of [pulse] for a reader following [watchlist]. */
        fun from(pulse: PulseReportView, watchlist: List<String>): PulseBrief {
            val sections = pulse.sections
            fun find(keys: List<String>): SectionView? = sections.firstOrNull { matches(it, keys) }
            fun findAll(keys: List<String>): List<SectionView> = sections.filter { matches(it, keys) }

            val morning = find(MorningKeys)
            val tapeSection = find(TapeKeys)
            val changed = findAll(ChangedKeys)
            val macro = find(MacroKeys)
            val moves = findAll(MovesKeys)
            val namesSection = find(NamesKeys)
            val watch = findAll(WatchKeys)
            val news = find(NewsKeys)
            val signalNoise = find(SignalKeys)
            val upshotSection = find(UpshotKeys)
            val flags = find(FlagKeys)

            val coverageNotes = mutableListOf<String>()
            val tapeLines = TapeModel.lines(pulse.tape)

            // ---- 01 Markets
            val tapeStory = PulseText.splitCoverage(PulseText.clean(pulse.tape?.summary ?: tapeSection?.body))
            coverageNotes += tapeStory.second
            val markets = if (tapeLines.isNotEmpty() || tapeStory.first.isNotEmpty()) {
                val story = tapeStory.first.filterNot { it.startsWith("Cross-asset context", ignoreCase = true) }
                PulseChapter(
                    kind = ChapterKind.Markets,
                    label = TodayCopy.CHAPTER_MARKETS,
                    title = story.firstOrNull() ?: TodayCopy.marketsFallback(tapeLines.size),
                    partial = isPartial(tapeSection) || pulse.tape?.coverageState?.lowercase() == "partial",
                    paragraphs = story.drop(1).take(2).map { Paragraph("", it) },
                    tape = tapeLines,
                )
            } else {
                null
            }

            // ---- 03 Your names (built first: What changed leaves out the events this chapter already tells)
            val mentions = nameMentions(watchlist, namesSection, sections)
            val names = if (mentions.isNotEmpty()) {
                PulseChapter(
                    kind = ChapterKind.Names,
                    label = TodayCopy.CHAPTER_NAMES,
                    title = TodayCopy.namesInBrief(mentions.size),
                    partial = isPartial(namesSection),
                    names = mentions,
                )
            } else {
                null
            }

            // ---- 02 What changed: the issue's prose as story paragraphs, the macro reading as a sentence, and the
            // event list (filings, releases) as a compact list. An event list item is never a paragraph and never
            // the headline.
            val changedSections = changed + listOfNotNull(macro) + moves
            // Prose, one block per section (a block becomes a paragraph).
            val proseBlocks = mutableListOf<List<String>>()
            val events = mutableListOf<PulseText.ListEvent>()
            changed.forEach { section ->
                val items = PulseText.listEvents(section.body)
                if (items != null) {
                    events += items
                } else {
                    val (story, notes) = PulseText.splitCoverage(PulseText.clean(section.body))
                    coverageNotes += notes
                    if (story.isNotEmpty()) proseBlocks += story
                }
            }
            val macroLine = macro?.let { macroSentence(it, coverageNotes) }
            moves.forEach { section ->
                val items = PulseText.listEvents(section.body)
                if (items != null) {
                    events += items
                } else {
                    val (story, notes) = PulseText.splitCoverage(PulseText.clean(section.body))
                    coverageNotes += notes
                    if (story.isNotEmpty()) proseBlocks += story
                }
            }
            val prose = proseBlocks.flatten().distinct()
            val storySentences = (prose + listOfNotNull(macroLine)).distinct()
            // An event a "Your names" row already tells (its ticker, or the same sentence) is left out here.
            val namedTickers = mentions.map { Regex("\\b${Regex.escape(it.ticker)}\\b") }
            val namedSentences = mentions.map { it.sentence }.toSet()
            val shown = events.distinctBy { it.text }.filterNot { e ->
                e.text in namedSentences || e.text in storySentences || namedTickers.any { it.containsMatchIn(e.text) }
            }
            val shownEvents = shown.map { it.text }
            // The count is of the list under it: the events "Your names" already tells are not counted either.
            val eventsHeadline = TodayCopy.eventsHeadline(
                filings = shown.count { it.kind?.contains("filing") == true },
                releases = shown.count { it.kind?.contains("release") == true },
                total = shown.size,
            )
            val signal = signalNoise?.body?.let { extractLabelled(it, "signal") }
            val noise = signalNoise?.body?.let { extractLabelled(it, "noise") }
            val changedFallback = eventsHeadline ?: TodayCopy.CHANGED_FALLBACK
            val whatChanged = if (storySentences.isNotEmpty() || shownEvents.isNotEmpty() || signal != null || noise != null) {
                // The headline is the first sentence of prose; it is not repeated in the paragraphs. Without prose,
                // a count of the events ("2 filings and 1 macro release in this issue").
                val title = storySentences.firstOrNull() ?: changedFallback
                val paragraphs = buildList {
                    proseBlocks.forEachIndexed { i, block ->
                        val sentences = if (i == 0) block.drop(1) else block
                        if (sentences.isNotEmpty()) {
                            val (lead, rest) = PulseText.leadAndRest(sentences)
                            add(Paragraph(lead, rest))
                        }
                    }
                    if (macroLine != null && prose.isNotEmpty() && macroLine !in prose) add(Paragraph("", macroLine))
                }.distinctBy { it.text }
                PulseChapter(
                    kind = ChapterKind.Changed,
                    label = TodayCopy.CHAPTER_CHANGED,
                    title = title,
                    partial = changedSections.any(::isPartial),
                    paragraphs = paragraphs,
                    items = shownEvents,
                    signal = signal,
                    noise = noise,
                )
            } else {
                null
            }

            // ---- 04 Watch
            val watchItems = mutableListOf<String>()
            var watchTitle: String? = null
            watch.forEach { section ->
                val items = PulseText.listItems(section.body)
                if (items != null) {
                    watchItems += items
                } else {
                    val (story, notes) = PulseText.splitCoverage(PulseText.clean(section.body))
                    coverageNotes += notes
                    if (watchTitle == null && story.size > 1) {
                        watchTitle = story.first()
                        watchItems += story.drop(1)
                    } else {
                        watchItems += story
                    }
                }
            }
            val watchChapter = if (watchItems.isNotEmpty()) {
                val items = watchItems.distinct()
                // The headline is the issue's own sentence, else a count of what is on the calendar ("3 events to
                // watch"); either way every event stays in the list (one form, with or without prose).
                PulseChapter(
                    kind = ChapterKind.Watch,
                    label = TodayCopy.CHAPTER_WATCH,
                    title = watchTitle ?: TodayCopy.watchHeadline(items.size),
                    partial = watch.any(::isPartial),
                    items = items,
                )
            } else {
                null
            }

            // ---- 05 Headlines: the top headline is the chapter headline (content, not a count); the rest are rows.
            val headlines = news?.let(::headlinesOf).orEmpty()
            val headlinesChapter = headlines.firstOrNull()?.let { top ->
                PulseChapter(
                    kind = ChapterKind.Headlines,
                    label = TodayCopy.CHAPTER_HEADLINES,
                    title = top.title,
                    partial = isPartial(news),
                    leadHeadline = top,
                    headlines = headlines.drop(1),
                )
            }

            // ---- 06 Sources: every cited link, plus coverage notes and section statuses.
            val sources = qualified(
                buildList {
                    pulse.tape?.moves?.forEach { m ->
                        val url = m.sourceUrl?.trim()?.ifBlank { null } ?: return@forEach
                        add(SourceRef(m.sourceName?.trim()?.ifBlank { null } ?: m.label, url, parseInstant(m.retrievedAt)) to null)
                    }
                    sections.forEach { s -> s.evidence.forEach { e -> sourceOf(e)?.let { add(it to e.excerpt) } } }
                }.distinctBy { it.first.url },
            )
            flags?.body?.let { body ->
                val cleaned = PulseText.clean(body)
                val text = cleaned.substringAfter(":", cleaned).trim().trimEnd('.')
                if (text.isNotBlank()) coverageNotes += text.replaceFirstChar { it.uppercase() }
            }
            // Section statuses only when the issue has no flags of its own (they say the same thing).
            if (flags == null) {
                sections.filter(::isPartial).forEach { s -> coverageNotes += TodayCopy.sectionStatus(s.title.trim(), statusUnavailable(s.status)) }
            }
            val notes = PulseText.readerNotes(coverageNotes)
            val sourcesChapter = if (sources.isNotEmpty() || notes.isNotEmpty()) {
                PulseChapter(
                    kind = ChapterKind.Sources,
                    label = TodayCopy.CHAPTER_SOURCES,
                    title = if (sources.isNotEmpty()) TodayCopy.sourcesHeadline(sources.size) else notes.first(),
                    sources = sources,
                    notes = if (sources.isNotEmpty()) notes else notes.drop(1),
                )
            } else {
                null
            }

            val built = listOfNotNull(markets, whatChanged, names, watchChapter, headlinesChapter, sourcesChapter)

            // Morning line: the issue's own, else the first sentence of the tape or of what changed.
            val morningLine = listOf(
                PulseText.firstSentence(morning?.body),
                markets?.title?.takeIf { tapeStory.first.isNotEmpty() }.orEmpty(),
                storySentences.firstOrNull().orEmpty(),
            ).firstOrNull { it.isNotBlank() } ?: ""
            val leadConclusion = listOf(
                storySentences.firstOrNull().orEmpty(),
                macroLine.orEmpty(),
                markets?.title?.takeIf { tapeStory.first.isNotEmpty() }.orEmpty(),
            ).firstOrNull { it.isNotBlank() && it != morningLine } ?: TodayCopy.briefChapters(built.size)

            // A chapter whose headline became the morning line leads with its next sentence instead, so the hero and
            // chapter 01 never print the same sentence (rubric V3). Markets with nothing more to say leads with
            // its levels, read from the tape.
            val chapters = built.map { c ->
                if (morningLine.isBlank() || c.title != morningLine) return@map c
                when (c.kind) {
                    ChapterKind.Markets -> c.promoteNextSentence(TodayCopy.marketsLevels(marketsLead(tapeLines)) ?: TodayCopy.marketsFallback(tapeLines.size))
                    ChapterKind.Changed -> c.promoteNextSentence(changedFallback)
                    else -> c
                }
            }

            val upshot = upshotSection?.body?.let { PulseText.clean(it) }?.ifBlank { null }

            return PulseBrief(
                reportId = pulse.reportId,
                morningLine = morningLine,
                leadConclusion = leadConclusion,
                generatedAt = parseInstant(pulse.generatedAt),
                dataRetrievedAt = pulse.tape?.moves?.mapNotNull { parseInstant(it.retrievedAt) }?.maxOrNull(),
                dataDay = parseDay(pulse.tape?.asOf),
                chapters = chapters,
                upshot = upshot,
                partial = sections.any(::isPartial) || pulse.tape?.coverageState?.lowercase() == "partial",
            )
        }

        /** The broad index and the 10-year (else the first rate) the Markets headline reads its levels from. */
        private fun marketsLead(lines: List<TapeLine>): List<TapeLine> = listOfNotNull(
            lines.firstOrNull { it.family == MarketTapeFamily.CoreIndex },
            lines.firstOrNull { it.id.uppercase() == "DGS10" } ?: lines.firstOrNull { it.family == MarketTapeFamily.Rates },
        )

        private fun normalized(s: String?): String = s.orEmpty().lowercase().replace('_', ' ').trim()

        private fun matches(section: SectionView, keys: List<String>): Boolean {
            val id = normalized(section.sectionId)
            val title = normalized(section.title)
            return keys.any { key ->
                val k = normalized(key)
                id == k || title == k || id.contains(k) || title.contains(k)
            }
        }

        private fun statusUnavailable(status: String?): Boolean = when (status?.trim()?.lowercase()) {
            "data_unavailable", "failed" -> true
            else -> false
        }

        // "Macro pressure is elevated: CPI-U All Items (high), Treasury 10Y (medium)."
        private val MacroPressure = Regex("^(?i)(macro pressure is [a-z ]+?)\\s*:\\s*(.+?)\\.?$")

        /**
         * The macro reading as a reader's sentence: the pipeline's series labels read as words ("Macro pressure is
         * elevated, led by consumer prices and the 10-year Treasury yield."). When a label has no reader name, the
         * bare list is dropped and only the reading is kept ("Macro pressure is elevated."): no raw identifiers.
         */
        private fun macroSentence(section: SectionView, coverageNotes: MutableList<String>): String? {
            val (story, notes) = PulseText.splitCoverage(PulseText.clean(section.body))
            coverageNotes += notes
            val first = story.firstOrNull() ?: return null
            val m = MacroPressure.find(first) ?: return first
            val reading = m.groupValues[1].trim()
            val series = m.groupValues[2].split(',').map { it.trim().trimEnd('.') }.filter { it.isNotEmpty() }
            val words = series.map { TodayCopy.seriesWords(it) }
            return TodayCopy.macroPressure(reading, if (words.all { it != null }) words.filterNotNull() else emptyList())
        }

        private val FilingDoc = Regex("\\b([A-Z]{1,5})\\b.*?\\b(8-K|10-K|10-Q|6-K|20-F|S-1|DEF 14A|Form 4)\\b")

        /**
         * Qualifies sources that share a label: the ticker and form of a filing ("AAPL 8-K"), else the URL's last
         * path segment, so two "SEC EDGAR" rows say which document each one opens.
         */
        private fun qualified(refs: List<Pair<SourceRef, String?>>): List<SourceRef> {
            val counts = refs.groupingBy { it.first.label.lowercase() }.eachCount()
            return refs.map { (ref, excerpt) ->
                if ((counts[ref.label.lowercase()] ?: 0) < 2) return@map ref
                val doc = excerpt?.let { FilingDoc.find(it) }?.let { "${it.groupValues[1]} ${it.groupValues[2]}" }
                val segment = runCatching { java.net.URI(ref.url).path }.getOrNull()
                    ?.trim('/')?.substringAfterLast('/')?.ifBlank { null }
                ref.copy(detail = doc ?: segment)
            }
        }

        private fun extractLabelled(body: String, label: String): String? =
            Regex("(?i)\\b$label\\s*:\\s*([^\\n]+?)(?=\\s*\\b(?:signal|noise)\\s*:|$)")
                .find(body.replace(Regex("\\s+"), " "))
                ?.groupValues?.getOrNull(1)?.trim()?.let(PulseText::clean)?.ifBlank { null }

        private fun sourceOf(e: EvidenceView): SourceRef? {
            val url = e.url?.trim()?.ifBlank { null } ?: return null
            if (!url.startsWith("http://") && !url.startsWith("https://")) return null
            val label = e.sourceName.trim().ifBlank { PulseText.host(url) ?: url }
            return SourceRef(label, url, null)
        }

        private fun headlinesOf(news: SectionView): List<Headline> {
            val fromEvidence = news.evidence.mapNotNull { e ->
                val title = PulseText.clean(e.excerpt).ifBlank { null } ?: return@mapNotNull null
                Headline(title, e.sourceName.trim().ifBlank { null } ?: PulseText.host(e.url), null, e.url?.trim()?.ifBlank { null })
            }
            if (fromEvidence.isNotEmpty()) return fromEvidence.distinctBy { it.title }
            val items = PulseText.listItems(news.body) ?: PulseText.splitCoverage(PulseText.clean(news.body)).first
            return items.map { item ->
                // "Apple investor update (investor.apple.com)." -> title and source.
                val m = Regex("^(.*?)\\s*\\(([^()]+\\.[a-z]{2,})\\)\\.?$").find(item)
                if (m != null) Headline(m.groupValues[1].trim().trimEnd('.') + ".", m.groupValues[2], null, null)
                else Headline(item, null, null, null)
            }.distinctBy { it.title }
        }

        private fun candidatesIn(body: String?): List<String> =
            PulseText.listItems(body) ?: PulseText.splitCoverage(PulseText.clean(body)).first

        /**
         * Followed names the issue mentions: the names section's line for the ticker first, else the first sentence
         * of any section that names it (whole word).
         */
        private fun nameMentions(watchlist: List<String>, namesSection: SectionView?, sections: List<SectionView>): List<NameMention> =
            watchlist.map { it.trim().uppercase() }.filter { it.isNotBlank() }.distinct().mapNotNull { ticker ->
                val word = Regex("\\b${Regex.escape(ticker)}\\b")
                fun sentenceIn(body: String?): String? = candidatesIn(body).firstOrNull { word.containsMatchIn(it) }
                // Elsewhere, a sentence the ticker opens ("AAPL filed a new 8-K.") reads better than a list of names.
                val elsewhere = sections.filter { it !== namesSection }.flatMap { candidatesIn(it.body) }.filter { word.containsMatchIn(it) }
                val sentence = sentenceIn(namesSection?.body)
                    ?: elsewhere.firstOrNull { it.startsWith(ticker) }
                    ?: elsewhere.firstOrNull()
                sentence?.let { NameMention(ticker, withoutSubject(PulseText.oneSentence(it), ticker)) }
            }

        /**
         * The row's title is the ticker, so a sentence it opens drops it ("AAPL filed a new 8-K." under "AAPL" reads
         * "Filed a new 8-K."). Only when a verb follows (a lower-case word); "AAPL: ..." or "AAPL Inc." stay whole.
         */
        private fun withoutSubject(sentence: String, ticker: String): String {
            val m = Regex("^${Regex.escape(ticker)}\\s+(?=\\p{Ll})").find(sentence) ?: return sentence
            return sentence.substring(m.range.last + 1).replaceFirstChar { it.uppercase() }
        }
    }
}
