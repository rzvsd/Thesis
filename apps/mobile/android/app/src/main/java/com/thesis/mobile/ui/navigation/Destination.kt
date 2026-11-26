package com.thesis.mobile.ui.navigation

/**
 * Every place the app can show, as a value (DESIGN-DIRECTION 4.5 "Back stack model"). There is no navigation
 * library: [com.thesis.mobile.ui.shell.AppNavigator] keeps one stack of these per bottom tab plus a global modal
 * stack, and [encode] / [Destination.decode] turn them into strings for `SavedStateHandle` (no parcelize).
 *
 * Adding a destination: add the class, give it a unique [tag], add it to [Destination.decode] and to
 * `DestinationCodecTest`. Fields are plain strings so old saved stacks keep decoding after a release.
 */
sealed interface Destination {
    /** Stable codec tag. Never rename one that has shipped: saved stacks would stop decoding. */
    val tag: String

    /** Codec fields after the tag, in order. Nulls are written as an empty marker, see [DestinationCodec]. */
    val fields: List<String?> get() = emptyList()

    /** Global modal destinations sit above every tab (You, its sub-pages, Paywall, Search). */
    val isModal: Boolean get() = false

    /**
     * True where the bottom bar hides (section 5.5: Report, ReportClassic, DeepDiveRunning and the modal stack).
     */
    val hidesBottomBar: Boolean get() = isModal

    fun encode(): String = DestinationCodec.encode(this)

    // ---- Tab roots

    data object Today : Destination { override val tag = "today" }
    data object Names : Destination { override val tag = "names" }
    data object Research : Destination { override val tag = "research" }
    data object Inbox : Destination { override val tag = "inbox" }

    // ---- Pushes inside a tab

    /**
     * The Pulse brief. [date] (YYYY-MM-DD) is a past issue; null is the latest one. [chapter] is the chapter to open
     * at (a `ChapterKind` name, from Home's chapter rows and tape); null opens at the top.
     */
    data class Pulse(val date: String? = null, val chapter: String? = null) : Destination {
        override val tag get() = "pulse"
        override val fields get() = listOf(date, chapter)
    }

    data object MacroStress : Destination { override val tag = "macro_stress" }

    data class WeeklyDigest(val date: String? = null) : Destination {
        override val tag get() = "weekly_digest"
        override val fields get() = listOf(date)
    }

    /**
     * One ticker (5.11). [pagerScope] names the list the Name pager walks through. [anchor] is where it opens:
     * [ANCHOR_NOTES] ("Your notes", to read), [ANCHOR_WRITE_NOTE] (the newest note takes focus), [ANCHOR_CHANGES]
     * ("Since the last report"), or null (the top).
     */
    data class Name(val ticker: String, val pagerScope: String? = null, val anchor: String? = null) : Destination {
        override val tag get() = "name"
        override val fields get() = listOf(ticker, pagerScope, anchor)

        companion object {
            /** The Notes view and a note search hit: Name scrolled to "Your notes", nothing focused (no keyboard). */
            const val ANCHOR_NOTES = "notes"

            /** Write a note (the board's context sheet): the newest NoteBlock takes focus, which scrolls it in. */
            const val ANCHOR_WRITE_NOTE = "write-note"

            /** A thesis drift alert: Name at its "Since the last report" block (5.21.5). */
            const val ANCHOR_CHANGES = "since-last-report"
        }
    }

    /** A stored Deep Dive report in the report host. [chapter] is the anchor to open at, when known. */
    data class Report(
        val reportId: String,
        val ticker: String? = null,
        val chapter: String? = null
    ) : Destination {
        override val tag get() = "report"
        override val fields get() = listOf(reportId, ticker, chapter)
        override val hidesBottomBar get() = true
    }

    /** The native (classic) view of a report, opened from the report host when the page cannot load. */
    data class ReportClassic(val reportId: String, val ticker: String? = null) : Destination {
        override val tag get() = "report_classic"
        override val fields get() = listOf(reportId, ticker)
        override val hidesBottomBar get() = true
    }

    /** A Deep Dive being built for [ticker]; replaced by [Report] when the job completes. */
    data class DeepDiveRunning(val ticker: String) : Destination {
        override val tag get() = "deep_dive_running"
        override val fields get() = listOf(ticker)
        override val hidesBottomBar get() = true
    }

    data class CompareReports(val reportIdA: String, val reportIdB: String) : Destination {
        override val tag get() = "compare_reports"
        override val fields get() = listOf(reportIdA, reportIdB)
    }

    data class CompareNames(val tickers: List<String>) : Destination {
        override val tag get() = "compare_names"
        override val fields get() = listOf(tickers.joinToString(","))
    }

    data class History(val filter: String? = null) : Destination {
        override val tag get() = "history"
        override val fields get() = listOf(filter)
    }

    /** An earnings War Room. A null id is a War Room notification that named no room yet. */
    data class WarRoom(val warRoomId: String?) : Destination {
        override val tag get() = "war_room"
        override val fields get() = listOf(warRoomId)
    }

    data class ScenarioStress(
        val runId: String? = null,
        val scenarioId: String? = null,
        val ticker: String? = null
    ) : Destination {
        override val tag get() = "scenario_stress"
        override val fields get() = listOf(runId, scenarioId, ticker)
    }

    // ---- Global modal stack

    data object You : Destination {
        override val tag = "you"
        override val isModal = true
    }

    /** A page inside You (Appearance, Notifications, Legal, ...). [page] is a stable key. */
    data class YouPage(val page: String) : Destination {
        override val tag get() = "you_page"
        override val fields get() = listOf(page)
        override val isModal get() = true
    }

    data class Paywall(val feature: String) : Destination {
        override val tag get() = "paywall"
        override val fields get() = listOf(feature)
        override val isModal get() = true
    }

    data object Search : Destination {
        override val tag = "search"
        override val isModal = true
    }

    companion object {
        /** Inverse of [encode]. Returns null for a string this version does not know (never throws). */
        fun decode(encoded: String): Destination? = DestinationCodec.decode(encoded)
    }
}

/** The four bottom tabs (5.5). You is not a tab: it opens from the avatar onto the modal stack. */
enum class ShellTab(val root: Destination, val launchKey: String) {
    Today(Destination.Today, "today"),
    Names(Destination.Names, "names"),
    Research(Destination.Research, "research"),
    Inbox(Destination.Inbox, "inbox");

    companion object {
        /** `LaunchTarget.tab` strings are kept unchanged ("today", "names", "research", "inbox"; "you" is modal). */
        fun fromLaunchKey(key: String?): ShellTab? = entries.firstOrNull { it.launchKey == key?.trim()?.lowercase() }
    }
}

/**
 * String form of a destination: `tag` then each field, separated by `|`. A field is `~` for null, else the
 * value with `%`, `|`, `~` and line breaks percent-escaped, so any text (a ticker list, a filter) round-trips.
 */
internal object DestinationCodec {
    private const val SEPARATOR = '|'
    private const val NULL_MARK = "~"

    fun encode(destination: Destination): String =
        (listOf(destination.tag) + destination.fields.map { it?.let(::escape) ?: NULL_MARK })
            .joinToString(SEPARATOR.toString())

    fun decode(encoded: String): Destination? = runCatching { decodeOrThrow(encoded) }.getOrNull()

    private fun decodeOrThrow(encoded: String): Destination? {
        val parts = encoded.split(SEPARATOR)
        val tag = parts.first()
        val values = parts.drop(1).map { if (it == NULL_MARK) null else unescape(it) }
        fun opt(index: Int): String? = values.getOrNull(index)
        fun req(index: Int): String = requireNotNull(values.getOrNull(index)?.takeIf { it.isNotEmpty() })
        return when (tag) {
            Destination.Today.tag -> Destination.Today
            Destination.Names.tag -> Destination.Names
            Destination.Research.tag -> Destination.Research
            Destination.Inbox.tag -> Destination.Inbox
            "pulse" -> Destination.Pulse(opt(0), opt(1))
            Destination.MacroStress.tag -> Destination.MacroStress
            "weekly_digest" -> Destination.WeeklyDigest(opt(0))
            "name" -> Destination.Name(req(0), opt(1), opt(2))
            "report" -> Destination.Report(req(0), opt(1), opt(2))
            "report_classic" -> Destination.ReportClassic(req(0), opt(1))
            "deep_dive_running" -> Destination.DeepDiveRunning(req(0))
            "compare_reports" -> Destination.CompareReports(req(0), req(1))
            "compare_names" -> Destination.CompareNames(
                opt(0).orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }
            )
            "history" -> Destination.History(opt(0))
            "war_room" -> Destination.WarRoom(opt(0))
            "scenario_stress" -> Destination.ScenarioStress(opt(0), opt(1), opt(2))
            Destination.You.tag -> Destination.You
            "you_page" -> Destination.YouPage(req(0))
            "paywall" -> Destination.Paywall(req(0))
            Destination.Search.tag -> Destination.Search
            else -> null
        }
    }

    private fun escape(value: String): String = buildString(value.length) {
        value.forEach { c ->
            when (c) {
                '%' -> append("%25")
                SEPARATOR -> append("%7C")
                '~' -> append("%7E")
                '\n' -> append("%0A")
                '\r' -> append("%0D")
                ',' -> append("%2C")
                else -> append(c)
            }
        }
    }

    private fun unescape(value: String): String {
        if ('%' !in value) return value
        val out = StringBuilder(value.length)
        var i = 0
        while (i < value.length) {
            val c = value[i]
            if (c == '%' && i + 2 <= value.lastIndex) {
                val code = value.substring(i + 1, i + 3).toIntOrNull(16)
                if (code != null) {
                    out.append(code.toChar())
                    i += 3
                    continue
                }
            }
            out.append(c)
            i++
        }
        return out.toString()
    }
}
