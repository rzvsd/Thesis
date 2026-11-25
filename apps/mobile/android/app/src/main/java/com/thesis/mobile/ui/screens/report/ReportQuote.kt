package com.thesis.mobile.ui.screens.report

import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.latestFilingPeriod
import org.json.JSONObject

/*
 * "Add to note" (docs/app-redesign/DESIGN-DIRECTION.md 5.13 item 5): a passage selected on the report page is
 * appended to this report's note as `> "quote" (Ch. 04 Margins, AAPL 10-K FY2025)`. Client only: the WebView reads
 * the selection and the nearest chapter kicker with [SelectionScript] (no JavaScript interface, no renderer change);
 * everything else here is pure and unit tested.
 */

/** What the page reported for the current selection: the text and the chapter it sits in (blank when none). */
data class PageSelection(
    val quote: String,
    val chapterNumber: String = "",
    val chapterName: String = "",
)

object ReportQuote {
    /** Longest quote kept, in characters; a longer selection is cut at a word and ends with an ellipsis. */
    const val MAX_QUOTE_CHARS = 600

    /**
     * Run with `WebView.evaluateJavascript`. Returns `{quote, num, chapter}` for the current selection: the selected
     * text and, from the `<section>` that holds the selection's start, its kicker's chapter number (`.chap em`) and
     * name (the rest of `.chap`). Reads the page only; it defines nothing on `window`.
     */
    const val SelectionScript: String =
        "(function(){" +
            "var s=window.getSelection();" +
            "var q=s?s.toString():'';" +
            "var n=s&&s.rangeCount?s.getRangeAt(0).startContainer:null;" +
            "var e=n?(n.nodeType===1?n:n.parentElement):null;" +
            "var sec=e&&e.closest?e.closest('section'):null;" +
            "var num='',name='';" +
            "if(sec){var c=sec.querySelector('.sec-kicker .chap');" +
            "if(c){var em=c.querySelector('em');num=em?em.textContent:'';" +
            "name=c.textContent.slice(num.length);}}" +
            "return {quote:q,num:num,chapter:name};" +
            "})()"

    /**
     * Parses the JSON that `evaluateJavascript` hands back for [SelectionScript]. Null when the page gave nothing
     * usable: no result, `null`, malformed JSON, or an empty selection.
     */
    fun parseSelection(json: String?): PageSelection? {
        val raw = json?.trim().orEmpty()
        if (raw.isEmpty() || raw == "null" || !raw.startsWith("{")) return null
        val obj = runCatching { JSONObject(raw) }.getOrNull() ?: return null
        val quote = obj.optString("quote").squash()
        if (quote.isEmpty()) return null
        return PageSelection(
            quote = quote,
            chapterNumber = obj.optString("num").squash(),
            chapterName = obj.optString("chapter").squash(),
        )
    }

    /**
     * Where the quote comes from, after the chapter: "AAPL 10-K FY2025" (ticker, the filing form when the report
     * names it, the latest fiscal period). Parts the report does not have are left out.
     */
    fun sourceLabel(report: DeepDiveReportView): String {
        val ticker = report.ticker?.trim()?.uppercase().orEmpty()
        val form = report.filingRead?.form?.trim().orEmpty()
        val period = report.filingRead?.period?.trim()?.ifBlank { null } ?: report.latestFilingPeriod().orEmpty()
        return listOf(ticker, form, period).filter { it.isNotEmpty() }.joinToString(" ")
    }

    /**
     * The line added to the note: `> "quote" (Ch. 04 Margins, AAPL 10-K FY2025)`. The chapter part is left out
     * when the selection is outside a chapter (the cover); the parentheses when there is no source at all.
     */
    fun format(selection: PageSelection, source: String): String {
        val chapter = when {
            selection.chapterNumber.isNotEmpty() && selection.chapterName.isNotEmpty() ->
                "Ch. ${selection.chapterNumber} ${selection.chapterName}"
            selection.chapterNumber.isNotEmpty() -> "Ch. ${selection.chapterNumber}"
            else -> selection.chapterName
        }
        val cite = listOf(chapter, source.trim()).filter { it.isNotEmpty() }.joinToString(", ")
        val quote = "> \"${clip(selection.quote.squash())}\""
        return if (cite.isEmpty()) quote else "$quote ($cite)"
    }

    /**
     * [note] with [quote] appended: on its own paragraph after any existing text (trailing blank lines trimmed), or
     * the quote alone when the note is empty.
     */
    fun append(note: String, quote: String): String {
        val body = note.trimEnd()
        return if (body.isEmpty()) quote else "$body\n\n$quote"
    }

    private fun clip(text: String): String {
        if (text.length <= MAX_QUOTE_CHARS) return text
        val cut = text.take(MAX_QUOTE_CHARS)
        val atWord = cut.substringBeforeLast(' ', cut).trimEnd(',', ';', ':', ' ')
        return "$atWord…"
    }

    /** Collapses runs of whitespace (the page's line breaks and non-breaking spaces) to single spaces. */
    private fun String.squash(): String = replace(Whitespace, " ").trim()

    private val Whitespace = Regex("[\\s\\u00A0]+")
}
