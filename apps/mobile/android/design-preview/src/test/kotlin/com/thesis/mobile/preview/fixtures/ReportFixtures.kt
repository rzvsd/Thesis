package com.thesis.mobile.preview.fixtures

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.FilingReadView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.OppositeCasePointView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.ui.components.DockItem
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.SheetHandle
import com.thesis.mobile.ui.components.ThesisSheetContent
import com.thesis.mobile.ui.copy.ReportCopy
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/** Fixtures for the Deep Dive report host renders and semantics tests (WP-C, 5.13, 5.14). */
object ReportFixtures {
    /** The shell's padding for a loaded report: the status bar on top, the gesture bar below. */
    val shellPadding = PaddingValues(top = 24.dp, bottom = 16.dp)

    val filingRead = FilingReadView(
        form = "10-K", period = "FY2025", generationMode = "full", theFilingRead = "", whatChanged = "",
        theGood = "", theBad = "", takeaway = "", whatToWatchNext = "", topChanges = emptyList(), metricDeltas = emptyList(),
    )

    val report = DeepDiveReportView(
        reportId = "rep-aapl-2025", ticker = "AAPL", generatedAt = "2026-11-20T14:00:00Z",
        issuer = IssuerView(name = "Apple Inc.", exchange = "NASDAQ"),
        thesisStatement = "Apple keeps 32.0% of its sales as operating profit.",
        signalValue = null, confidenceLabel = null, confidenceScore = null,
        sections = listOf(SectionView(sectionId = "summary", title = "Summary", body = "Sales grew 5.9% a year.")),
        filingRead = filingRead,
    )

    val earlierNote = NoteTrailEntry(
        reportId = "rep-aapl-2024", ticker = "AAPL",
        text = "Watching whether Services keeps growing faster than hardware; margin held at 31% last year.",
        updatedAt = "2026-03-03T09:00:00Z", filingPeriod = "FY2024", verdict = null,
    )

    val noteWithQuote = "Margins look durable.\n\n> \"Services grew faster than hardware.\" (Ch. 06 Financials, AAPL 10-K FY2025)"

    val history = listOf(
        ReportHistoryItem("rep-aapl-2025", "j1", "deep_dive", "AAPL", "2026-11-20T14:00:00Z"),
        ReportHistoryItem("rep-aapl-2024", "j2", "deep_dive", "AAPL", "2025-11-14T14:00:00Z"),
        ReportHistoryItem("rep-aapl-2023", "j3", "deep_dive", "AAPL", "2024-11-08T14:00:00Z"),
    )

    val watchlist = listOf("AAPL", "MSFT", "NVDA", "GOOGL", "AMZN")

    /** The Conviction sheet's data: a short journal for the ticker and a generated opposite case. */
    val convictionTimeline = listOf(
        ConvictionJournalEntryView(
            journalEntryId = "cj-3", ticker = "AAPL", eventType = "report_generated", sourceType = "report",
            sourceId = "rep-aapl-2025", eventAt = "2026-11-20T14:00:00Z", title = "Deep Dive on the FY2025 10-K",
            summary = "Operating margin held at 32.0%; Services grew faster than hardware.", reportId = "rep-aapl-2025",
        ),
        ConvictionJournalEntryView(
            journalEntryId = "cj-2", ticker = "AAPL", eventType = "freshness_decay_alert_fired", sourceType = "alert",
            sourceId = "al-1", eventAt = "2026-08-02T09:00:00Z", title = "The thesis is getting old",
            summary = "Nine months since the last report; a new 10-Q is out.",
        ),
        ConvictionJournalEntryView(
            journalEntryId = "cj-1", ticker = "AAPL", eventType = "report_generated", sourceType = "report",
            sourceId = "rep-aapl-2024", eventAt = "2025-11-14T14:00:00Z", title = "Deep Dive on the FY2024 10-K",
            summary = "Margin at 31.5%; buybacks cut the share count 2.6%.", reportId = "rep-aapl-2024",
        ),
    )

    val oppositeCase = OppositeCaseReportView(
        oppositeCaseId = "oc-1", sourceReportId = "rep-aapl-2025", ticker = "AAPL",
        thesisSummary = "Services keep margins high while hardware sales slow.",
        oppositeCaseSummary = "Services growth depends on fees regulators are already cutting; hardware is still most of the sales.",
        keyPoints = listOf(
            OppositeCasePointView("App Store fees", "Court rulings in the US and EU let developers steer buyers away from Apple's fee."),
            OppositeCasePointView("Hardware mix", "iPhone is still about half of sales, and upgrade cycles are lengthening."),
        ),
        decisiveFactors = listOf("Services take rate", "iPhone units"),
        generatedAt = "2026-11-21T10:00:00Z",
    )

    fun dock() = listOf(
        DockItem(ReportCopy.DOCK_NOTES, {}),
        DockItem(ReportCopy.DOCK_COMPARE, {}),
        DockItem(ReportCopy.DOCK_STRESS, {}),
        DockItem(ReportCopy.DOCK_CONVICTION, {}),
    )
}

/**
 * Stands in for the server-rendered page (the WebView does not run in the JVM harness): the cover in the hero
 * palette, the chapter chips and the first chapter's head, as the Deep Dive 2.0 renders (research/dd-shots).
 */
@Composable
fun StandInReportPage(modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Column(modifier.background(p.bg).verticalScroll(rememberScrollState())) {
        HeroBand {
            Eyebrow("Deep Dive · From the 10-K for fiscal 2025")
            Text("Apple Inc.", style = ThesisType.display, color = LocalThesisPalette.current.ink)
            Text(
                "AAPL · NASDAQ · Electronic computers · Fiscal year ends in September",
                style = ThesisType.body,
                color = LocalThesisPalette.current.ink2,
            )
            Text(
                "Apple keeps 32.0% of its sales as operating profit. Sales grew 5.9% a year since fiscal 2015, and the share count fell 2.2% in fiscal 2025.",
                style = ThesisType.heroLine,
                color = LocalThesisPalette.current.ink,
            )
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.m),
            horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
        ) {
            listOf("Summary", "Business", "Countries").forEach { chip ->
                Box(
                    Modifier.border(1.dp, p.line2, ThesisShape.pill).padding(horizontal = ThesisSpace.m, vertical = ThesisSpace.s),
                ) { Text(chip, style = ThesisType.label, color = p.ink2) }
            }
        }
        Column(
            Modifier.padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.x3),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
        ) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
                Text("01", style = ThesisType.heroLine.copy(fontStyle = FontStyle.Italic), color = p.accent)
                Text("SUMMARY", style = ThesisType.kicker, color = p.muted)
            }
            Text("What the filing says", style = ThesisType.title, color = p.ink)
            Text(
                "Sales reached \$416.2B in fiscal 2025, up 6.4% on the year. Services grew faster than hardware, and " +
                    "the operating margin rose half a point to 32.0%. The company bought back 2.2% of its shares.",
                style = ThesisType.story,
                color = p.ink,
            )
            Spacer(Modifier.height(400.dp))
        }
    }
}

/** A modal sheet as it sits over [behind]: the scrim, then the sheet surface at the bottom with its handle. */
@Composable
fun SheetOver(
    behind: @Composable BoxScope.() -> Unit,
    title: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val p = LocalThesisPalette.current
    Box(Modifier.fillMaxSize()) {
        behind()
        Box(Modifier.fillMaxSize().background(p.scrim))
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(p.surface, ThesisShape.sheet)
                .padding(bottom = ReportFixtures.shellPadding.calculateBottomPadding()),
        ) {
            SheetHandle(Modifier.align(Alignment.CenterHorizontally))
            ThesisSheetContent(title = title, content = content)
        }
    }
}
