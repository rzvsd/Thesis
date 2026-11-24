package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.AlertRow
import com.thesis.mobile.ui.components.ArcSpinner
import com.thesis.mobile.ui.components.Avatar
import com.thesis.mobile.ui.components.BadgeSpec
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.BigQuestion
import com.thesis.mobile.ui.components.Callout
import com.thesis.mobile.ui.components.CardFooter
import com.thesis.mobile.ui.components.CardVariant
import com.thesis.mobile.ui.components.ChapterDivider
import com.thesis.mobile.ui.components.ChapterHeader
import com.thesis.mobile.ui.components.ChapterPills
import com.thesis.mobile.ui.components.ChartReadout
import com.thesis.mobile.ui.components.ChipRow
import com.thesis.mobile.ui.components.CompareColumn
import com.thesis.mobile.ui.components.CompareRow
import com.thesis.mobile.ui.components.CompareTable
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.components.CountBadge
import com.thesis.mobile.ui.components.DataRow
import com.thesis.mobile.ui.components.DayHeader
import com.thesis.mobile.ui.components.DestructiveButton
import com.thesis.mobile.ui.components.DialogAction
import com.thesis.mobile.ui.components.DockItem
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HighlightText
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.KpiGrid
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.components.KpiTile
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.LiveDot
import com.thesis.mobile.ui.components.Loadable
import com.thesis.mobile.ui.components.LoadingHairline
import com.thesis.mobile.ui.components.Meter
import com.thesis.mobile.ui.components.NoteBlock
import com.thesis.mobile.ui.components.NoteEntry
import com.thesis.mobile.ui.components.NoteMark
import com.thesis.mobile.ui.components.NotePreview
import com.thesis.mobile.ui.components.NoteSaveState
import com.thesis.mobile.ui.components.NotesTrail
import com.thesis.mobile.ui.components.NumberField
import com.thesis.mobile.ui.components.PagerDots
import com.thesis.mobile.ui.components.PasswordField
import com.thesis.mobile.ui.components.PlanCard
import com.thesis.mobile.ui.components.PressableCard
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.QuietBackground
import com.thesis.mobile.ui.components.RefreshArc
import com.thesis.mobile.ui.components.ReportChange
import com.thesis.mobile.ui.components.ReportDock
import com.thesis.mobile.ui.components.ReportTopBar
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.RunBar
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SecondaryButton
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SegmentedControl
import com.thesis.mobile.ui.components.SheetActionRow
import com.thesis.mobile.ui.components.SheetHandle
import com.thesis.mobile.ui.components.SinceLastReport
import com.thesis.mobile.ui.components.SinceLastReportModel
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.SkeletonChart
import com.thesis.mobile.ui.components.SkeletonHero
import com.thesis.mobile.ui.components.SkeletonKpiGrid
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.SourceInfo
import com.thesis.mobile.ui.components.SourceLink
import com.thesis.mobile.ui.components.SourceSheetContent
import com.thesis.mobile.ui.components.Stage
import com.thesis.mobile.ui.components.StageProgress
import com.thesis.mobile.ui.components.StageStatus
import com.thesis.mobile.ui.components.StateCrossfade
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.StatusSquare
import com.thesis.mobile.ui.components.TapeItem
import com.thesis.mobile.ui.components.TapeRow
import com.thesis.mobile.ui.components.TertiaryButton
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisBottomBar
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisCheckbox
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisDialogContent
import com.thesis.mobile.ui.components.ThesisDivider
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisLink
import com.thesis.mobile.ui.components.ThesisRadio
import com.thesis.mobile.ui.components.ThesisSheetContent
import com.thesis.mobile.ui.components.ThesisSnackbar
import com.thesis.mobile.ui.components.ThesisSwitch
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.components.TickerField
import com.thesis.mobile.ui.components.TickerRow
import com.thesis.mobile.ui.components.TickerSuggestion
import com.thesis.mobile.ui.components.ToggleRow
import com.thesis.mobile.ui.components.Upshot
import com.thesis.mobile.ui.components.defaultBottomBarItems
import com.thesis.mobile.ui.components.ledeText
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.alertCategoryColor
import kotlinx.coroutines.delay

/*
 * Kit component sheets (section 3): one GalleryScope function per family, rendered by KitComponentRenders in both
 * themes at 1.0x, 1.3x and 2.0x. Pressed specimens hold a PressInteraction.Press in their interaction source.
 * Sample copy follows the spec's voice (sentence case, conclusions, real-looking figures).
 */

/** An interaction source that is pressed for the whole render. */
@Composable
internal fun pressedSource(): MutableInteractionSource {
    val source = remember { MutableInteractionSource() }
    // The interaction flow has no replay: wait a frame so the press collector is subscribed before emitting.
    LaunchedEffect(source) {
        delay(PRESS_AFTER_MS)
        source.emit(PressInteraction.Press(Offset.Zero))
    }
    return source
}

private const val PRESS_AFTER_MS = 50L

private val noop: () -> Unit = {}

@Composable
private fun Caption(text: String) {
    Text(text, style = ThesisType.caption, color = LocalThesisPalette.current.muted)
}

object KitComponentSheets {

    @OptIn(ExperimentalLayoutApi::class)
    val atoms: @Composable GalleryScope.() -> Unit = {
        Specimen("Eyebrow / Kicker", "muted eyebrow, accent kicker") {
            Eyebrow("Revenue, FY2025")
            Kicker("Chapter two")
        }
        Specimen("StatusSquare / StatusBadge", "favourable, unfavourable, neutral, attention, unknown") {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Tone.entries.forEach { StatusSquare(it) }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusBadge("On track", Tone.Favourable)
                StatusBadge("At risk", Tone.Unfavourable)
                StatusBadge("Watching", Tone.Neutral)
                StatusBadge("Drifting", Tone.Attention)
                StatusBadge("No data", Tone.Unknown)
            }
        }
        Specimen("NoteMark / CountBadge / LiveDot / Avatar", "Avatar: plain and clickable") {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                NoteMark()
                CountBadge(3)
                CountBadge("12 new")
                LiveDot()
                Avatar("RB")
                Avatar("RB", onClick = noop)
            }
        }
        Specimen("Meter", "neutral 0.62, subject 0.81, tone unfavourable 0.28") {
            Meter(0.62f, contentDescription = "62 of 100")
            Meter(0.81f, subject = true, contentDescription = "81 of 100")
            Meter(0.28f, tone = Tone.Unfavourable, contentDescription = "28 of 100")
        }
        Specimen("PagerDots / ArcSpinner", "page 2 of 4") {
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.CenterVertically) {
                PagerDots(4, 1)
                ArcSpinner()
            }
        }
        Specimen("ThesisDivider / ChapterDivider", "full, inset 52, chapter") {
            ThesisDivider()
            ThesisDivider(startInset = LeadingRowDividerInset)
            ChapterDivider()
        }
    }

    val buttons: @Composable GalleryScope.() -> Unit = {
        Specimen("PrimaryButton", "default / pressed / disabled / loading / commit with icon") {
            PrimaryButton("Run the report", noop)
            PrimaryButton("Run the report", noop, interactionSource = pressedSource())
            PrimaryButton("Run the report", noop, enabled = false)
            PrimaryButton("Run the report", noop, loading = true)
            PrimaryButton("Run Deep Dive", noop, leadingIcon = ThesisIcons.DeepDive, commit = true)
        }
        Specimen("SecondaryButton", "default / pressed / disabled / loading") {
            SecondaryButton("Compare", noop)
            SecondaryButton("Compare", noop, interactionSource = pressedSource())
            SecondaryButton("Compare", noop, enabled = false)
            SecondaryButton("Compare", noop, loading = true)
        }
        Specimen("TertiaryButton", "default / pressed / disabled") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TertiaryButton("Not now", noop)
                TertiaryButton("Not now", noop, interactionSource = pressedSource())
                TertiaryButton("Not now", noop, enabled = false)
            }
        }
        Specimen("DestructiveButton", "default / pressed / disabled") {
            DestructiveButton("Delete account", noop)
            DestructiveButton("Delete account", noop, interactionSource = pressedSource())
            DestructiveButton("Delete account", noop, enabled = false)
        }
        Specimen("TextAction / ThesisLink", "default / pressed / disabled") {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                TextAction("See all", noop)
                TextAction("See all", noop, interactionSource = pressedSource())
                TextAction("See all", noop, enabled = false)
            }
            ThesisLink("Terms of service", noop)
        }
        Specimen("ThesisIconButton (.iconbtn)", "default / pressed / disabled") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ThesisIconButton(ThesisIcons.Share, "Share", noop)
                ThesisIconButton(ThesisIcons.Share, "Share", noop, interactionSource = pressedSource())
                ThesisIconButton(ThesisIcons.Share, "Share", noop, enabled = false)
                ThesisIconButton(ThesisIcons.Overflow, "More options", noop)
            }
        }
        Specimen("ThesisButton (deprecated wrapper)", "primary / secondary") {
            @Suppress("DEPRECATION")
            com.thesis.mobile.ui.components.ThesisButton("Continue", noop)
            @Suppress("DEPRECATION")
            com.thesis.mobile.ui.components.ThesisButton("Maybe later", noop, isPrimary = false)
        }
    }

    val headers: @Composable GalleryScope.() -> Unit = {
        Specimen("ScreenHeader", "eyebrow, title, deck, meta / refreshing / compact") {
            ScreenHeader(
                title = "Today",
                eyebrow = "Tuesday 24 November",
                deck = "Rates eased overnight; two of your names report this week.",
                meta = "Updated 06:15",
            )
            ScreenHeader(title = "Names", meta = "Refreshing", refreshing = true)
            ScreenHeader(title = "Research", compact = true)
        }
        Specimen("SectionHeader", "with and without action") {
            SectionHeader("Your names", "Two need a look", deck = "Margins narrowed at both.", actionLabel = "See all", onAction = noop)
            SectionHeader("Markets", "Calm before CPI")
        }
        Specimen("ChapterHeader", "full / small") {
            ChapterHeader(
                numeral = 2,
                label = "The business",
                title = "Services now carry the margin",
                lede = ledeText("Services grew 14%", " while hardware was flat, lifting gross margin to 46.2%.", LocalThesisPalette.current),
                badges = listOf(BadgeSpec("Improving", Tone.Favourable), BadgeSpec("High confidence", Tone.Neutral)),
                source = "10-K FY2025 · filed 31 Oct 2025",
            )
            ChapterHeader(numeral = 3, label = "Risks", title = "Concentration in one market", small = true)
        }
        Specimen("DayHeader") { DayHeader("Yesterday") }
    }

    val chips: @Composable GalleryScope.() -> Unit = {
        Specimen("ThesisChip", "default / selected / pressed / disabled / count / icon") {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ThesisChip("All", selected = false, onClick = noop)
                ThesisChip("At risk", selected = true, onClick = noop, count = 2)
                ThesisChip("Pressed", selected = false, onClick = noop, interactionSource = pressedSource())
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ThesisChip("Disabled", selected = false, onClick = noop, enabled = false)
                ThesisChip("Filter", selected = false, onClick = noop, leadingIcon = ThesisIcons.Small.Filter)
            }
        }
        Specimen("ChipRow (DD chip nav)", "horizontal, gutter padding") {
            run {
                ChipRow {
                    item { ThesisChip("Overview", true, noop) }
                    item { ThesisChip("Business", false, noop) }
                    item { ThesisChip("Numbers", false, noop) }
                    item { ThesisChip("Risks", false, noop) }
                    item { ThesisChip("Valuation", false, noop) }
                }
            }
        }
        Specimen("SegmentedControl", "2 and 3 options") {
            SegmentedControl(listOf("Names", "Notes"), 0, {})
            SegmentedControl(listOf("1M", "6M", "1Y"), 2, {})
        }
        Specimen("ChapterPills", "second selected") {
            ChapterPills(listOf("I · Verdict", "II · Business", "III · Numbers", "IV · Risks"), 1, {})
        }
    }

    val cards: @Composable GalleryScope.() -> Unit = {
        Specimen("ThesisCard", "plain with footer / not seen / selected") {
            ThesisCard(
                eyebrow = "Gross margin",
                title = "Margins held despite a weaker mix",
                footer = CardFooter("10-Q Q3 FY2025", "Open source", noop),
            ) {
                Text("Gross margin was 46.2%, up 40 bps on the year.", style = ThesisType.body, color = LocalThesisPalette.current.ink2)
            }
            ThesisCard(variant = CardVariant.NotSeen, eyebrow = "Segment detail", title = "Not reported this quarter")
            ThesisCard(variant = CardVariant.Selected, eyebrow = "Compare pick", title = "Microsoft")
        }
        Specimen("PressableCard", "default / pressed") {
            PressableCard(onClick = noop, eyebrow = "Deep Dive · AAPL", title = "Services now carry the margin")
            PressableCard(onClick = noop, eyebrow = "Deep Dive · MSFT", title = "Cloud growth is slowing", interactionSource = pressedSource())
        }
        Specimen("Upshot / Callout / BigQuestion") {
            Upshot(ledeText("Hold, with a closer eye on China.", " Services keep the margin up; the risk is one market.", LocalThesisPalette.current))
            Callout("Figures are from the latest 10-K unless a chart says otherwise.")
            BigQuestion("Can services growth outrun the hardware cycle?")
        }
        Specimen("PlanCard", "selected / not selected") {
            PlanCard("Annual", "$79.99", "per year", selected = true, onSelect = noop, saving = "Save 33%")
            PlanCard("Monthly", "$9.99", "per month", selected = false, onSelect = noop)
        }
        Specimen("EmptyState / ErrorState") {
            EmptyState("No names yet.", how = "Follow a company to see it here.", icon = ThesisIcons.Names, actionLabel = "Add a name", onAction = noop, primaryAction = true)
            ErrorState("This didn't load", cause = "The server took too long to answer.", onRetry = noop)
        }
        Specimen("InlineBanner", "neutral / attention / error") {
            InlineBanner("You're offline. Showing saved reports.")
            InlineBanner("Two filings are late.", tone = BannerTone.Attention, actionLabel = "See", onAction = noop)
            InlineBanner("Sign-in expired.", tone = BannerTone.Error, actionLabel = "Sign in", onAction = noop)
        }
    }

    val data: @Composable GalleryScope.() -> Unit = {
        val kpis = listOf(
            KpiSpec("Revenue, FY2025", "$391.0bn", "+2.0%", Tone.Favourable, "vs FY2024"),
            KpiSpec("Gross margin", "46.2%", "+40 bps", Tone.Favourable, "vs FY2024"),
            KpiSpec("Free cash flow", "$108.8bn", "−9.2%", Tone.Unfavourable, "vs FY2024"),
            KpiSpec("Net cash", "$49.6bn", null, Tone.Neutral, "at 28 Sep 2025"),
        )
        Specimen("KpiTile", "default / pressed (clickable)") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KpiTile(kpis[0], Modifier.weight(1f), onClick = noop)
                KpiTile(kpis[1], Modifier.weight(1f), onClick = noop, interactionSource = pressedSource())
            }
        }
        Specimen("KpiGrid", "2 columns below 560 dp") { KpiGrid(kpis, onItemClick = {}) }
        Specimen("RowGroup + DataRow", "plain / delta / sub / pressed") {
            RowGroup {
                row { DataRow("Revenue", "$391.0bn", delta = "+2.0%", deltaTone = Tone.Favourable) }
                row { DataRow("Operating margin", "31.5%", delta = "−60 bps", deltaTone = Tone.Unfavourable, sub = "Operating income ÷ revenue") }
                row { DataRow("Shares out", "15.1bn", onClick = noop, interactionSource = pressedSource()) }
            }
        }
        Specimen("TickerRow", "comfortable / with note and live / compact / pressed") {
            RowGroup {
                row(LeadingRowDividerInset) {
                    TickerRow("AAPL", Tone.Favourable, noop, company = "Apple", line2 = "Services carry the margin", figure = "$229.87", figureCaption = "+0.8%", figureCaptionTone = Tone.Favourable, stateLabel = "On track")
                }
                row(LeadingRowDividerInset) {
                    TickerRow("NVDA", Tone.Attention, noop, company = "Nvidia", line2 = "Supply is the constraint", figure = "$141.02", figureCaption = "−2.1%", figureCaptionTone = Tone.Unfavourable, stateLabel = "Drifting", hasNote = true, live = true)
                }
                row(LeadingRowDividerInset) { TickerRow("MSFT", Tone.Neutral, noop, company = "Microsoft", figure = "\$415.10", figureCaption = "+0.3%", figureCaptionTone = Tone.Favourable, compact = true) }
                row(LeadingRowDividerInset) { TickerRow("AMZN", Tone.Unknown, noop, company = "Amazon", interactionSource = pressedSource()) }
            }
        }
        Specimen("ActionRow / SheetActionRow", "with caption, external / destructive, disabled") {
            RowGroup {
                row(LeadingRowDividerInset) { ActionRow(ThesisIcons.History, "History", noop, caption = "Every report you have run") }
                row(LeadingRowDividerInset) { ActionRow(ThesisIcons.OpenExternal, "Read the 10-K", noop, external = true) }
            }
            SheetActionRow(ThesisIcons.Share, "Share", noop)
            SheetActionRow(ThesisIcons.Remove, "Remove from names", noop, destructive = true)
            SheetActionRow(ThesisIcons.ExportPdf, "Export PDF", noop, enabled = false)
        }
        Specimen("AlertRow", "new / expanded / swipe background") {
            val p = LocalThesisPalette.current
            RowGroup {
                row(LeadingRowDividerInset) {
                    AlertRow(alertCategoryColor("earnings", p), "Earnings on Thursday", "Consensus expects EPS of $1.60; your note flags services growth.", "2h", noop, ticker = "AAPL", onTickerClick = noop, isNew = true)
                }
                row(LeadingRowDividerInset) {
                    AlertRow(alertCategoryColor("risk", p), "Thesis drift: margins", "Gross margin fell two quarters in a row, below the range your thesis assumed. The last report called this the key risk.", "Yesterday", noop, ticker = "NVDA", expanded = true)
                }
            }
            Box(Modifier.fillMaxWidth().height(64.dp)) { QuietBackground() }
        }
        Specimen("ToggleRow", "on / off / disabled") {
            RowGroup {
                row { ToggleRow("Morning pulse", true, {}, sub = "Daily at 6:30 AM ET") }
                row { ToggleRow("Drift alerts", false, {}) }
                row { ToggleRow("Price alerts", false, {}, sub = "Coming soon", enabled = false) }
            }
        }
    }

    val controls: @Composable GalleryScope.() -> Unit = {
        Specimen("ThesisSwitch / ThesisCheckbox / ThesisRadio", "on / off / disabled on / disabled off / pressed") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                ThesisSwitch(true, {})
                ThesisSwitch(false, {})
                ThesisSwitch(true, {}, enabled = false)
                ThesisSwitch(false, {}, enabled = false)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                ThesisCheckbox(true, {})
                ThesisCheckbox(false, {})
                ThesisCheckbox(true, {}, enabled = false)
                ThesisCheckbox(false, {}, enabled = false)
                ThesisCheckbox(false, {}, interactionSource = pressedSource())
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                ThesisRadio(true, {})
                ThesisRadio(false, {})
                ThesisRadio(true, {}, enabled = false)
                ThesisRadio(false, {}, enabled = false)
                ThesisRadio(false, {}, interactionSource = pressedSource())
            }
        }
        Specimen("ThesisTextField", "empty with helper / filled / error / disabled") {
            ThesisTextField("", {}, "Email", placeholder = "you@example.com", helper = "We send the morning pulse here.")
            ThesisTextField("razvan@example.com", {}, "Email")
            ThesisTextField("razvan@", {}, "Email", error = "Enter a full email address.")
            ThesisTextField("razvan@example.com", {}, "Email", enabled = false)
        }
        Specimen("TickerField", "with suggestions") {
            TickerField(
                "AA",
                {},
                onSearch = noop,
                suggestions = listOf(
                    TickerSuggestion("AAPL", "Apple", inYourNames = true),
                    TickerSuggestion("AAL", "American Airlines"),
                ),
                actionLabel = "Search",
            )
        }
        Specimen("NumberField / PasswordField", "unit / error") {
            NumberField("2.5", {}, "Rate shock", unit = "%", helper = "Applied to the 10-year yield.")
            PasswordField("hunter22", {}, error = "At least 10 characters.")
        }
    }

    val overlays: @Composable GalleryScope.() -> Unit = {
        Specimen("ThesisSheetContent", "handle, title, actions") {
            Column {
                SheetHandle()
                ThesisSheetContent(title = "AAPL") {
                    SheetActionRow(ThesisIcons.Notes, "Add a note", noop)
                    SheetActionRow(ThesisIcons.Compare, "Compare", noop)
                    SheetActionRow(ThesisIcons.Remove, "Remove from names", noop, destructive = true)
                }
            }
        }
        Specimen("SourceSheetContent") {
            SourceSheetContent(
                SourceInfo(
                    metric = "Operating margin",
                    definition = "Operating income as a share of revenue.",
                    form = "10-K",
                    period = "FY2025",
                    filed = "31 Oct 2025",
                    derivation = "Operating income ÷ revenue",
                    inputs = listOf("Operating income" to "$123.2bn", "Revenue" to "$391.0bn"),
                    evidence = listOf(SourceLink("Item 7, MD&A", noop)),
                ),
            )
        }
        Specimen("ThesisDialogContent", "normal / destructive") {
            ThesisDialogContent(
                title = "Leave without saving?",
                body = "Your note has changes that are not saved yet.",
                confirm = DialogAction("Keep editing", noop),
                dismiss = DialogAction("Leave", noop),
            )
            ThesisDialogContent(
                title = "Delete your account?",
                body = "Your names, notes and reports are removed. This cannot be undone.",
                confirm = DialogAction("Delete", noop),
                dismiss = DialogAction("Cancel", noop),
                destructive = true,
            )
        }
        Specimen("ThesisSnackbar", "message / with action") {
            ThesisSnackbar("Note saved")
            ThesisSnackbar("AAPL quieted for 24 h", actionLabel = "Undo")
        }
    }

    val bars: @Composable GalleryScope.() -> Unit = {
        Specimen("ThesisTopBar", "brand / back + title (collapsed) / actions") {
            ThesisTopBar(actions = { ThesisIconButton(ThesisIcons.Search, "Search", noop) })
            ThesisTopBar(title = "Settings", onBack = noop, collapsed = true)
            ThesisTopBar(title = "Compare", subtitle = "AAPL vs MSFT", onBack = noop, titleAlwaysVisible = true, actions = {
                ThesisIconButton(ThesisIcons.Share, "Share", noop)
            })
        }
        Specimen("ReportTopBar", "following / not following") {
            ReportTopBar("AAPL", noop, following = true, onFollowChange = {}, onOverflow = noop)
            ReportTopBar("MSFT", noop, following = false, onFollowChange = {}, onOverflow = noop)
        }
        Specimen("ThesisBottomBar", "Today selected, Inbox has new") {
            ThesisBottomBar(defaultBottomBarItems(inboxHasNew = true), selectedKey = defaultBottomBarItems().first().key, onSelect = {})
        }
        Specimen("RunBar", "default / loading / disabled") {
            RunBar("Run Deep Dive", noop, caption = "About 2 minutes · 3 left this month")
            RunBar("Run Deep Dive", noop, loading = true)
            RunBar("Run Deep Dive", noop, enabled = false, caption = "No reports left this month")
        }
        Specimen("ReportDock") {
            ReportDock(listOf(DockItem("Notes", noop, badge = "1"), DockItem("Sources", noop), DockItem("Share", noop)))
        }
    }

    val loading: @Composable GalleryScope.() -> Unit = {
        Specimen("Skeletons", "hero / KPI grid / card / row / chart") {
            SkeletonHero()
            SkeletonKpiGrid()
            SkeletonCard()
            SkeletonRow()
            SkeletonChart()
        }
        Specimen("LoadingHairline", "active / idle") {
            LoadingHairline(active = true)
            LoadingHairline(active = false)
        }
        Specimen("StateCrossfade", "loading / empty / failed / ready") {
            StateCrossfade<String>(Loadable.Loading) { Text(it) }
            StateCrossfade<String>(Loadable.Empty("Nothing in your inbox.")) { Text(it) }
            StateCrossfade<String>(Loadable.Failed("No connection."), onRetry = noop) { Text(it) }
            StateCrossfade(Loadable.Ready("Ready: the content itself.")) { Text(it, style = ThesisType.body, color = LocalThesisPalette.current.ink) }
        }
        Specimen("RefreshArc", "pulled 40% / armed / refreshing") {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                RefreshArc(progress = { 0.4f }, refreshing = false)
                RefreshArc(progress = { 1f }, refreshing = false)
                RefreshArc(progress = { 1f }, refreshing = true)
            }
        }
    }

    val compareModel = CompareTableModel(
        columns = listOf(
            CompareColumn("FY Sep-25", "10-K · 31 Oct 2025", subject = true),
            CompareColumn("FY Sep-24", "10-K · 1 Nov 2024"),
            CompareColumn("FY Sep-23", "10-K · 3 Nov 2023"),
        ),
        rows = listOf(
            CompareRow("Revenue", listOf("391.0", "383.3", "383.3"), unit = "\$bn", delta = "+2.0%", deltaTone = Tone.Favourable),
            CompareRow("Gross margin", listOf("46.2", "45.8", "44.1"), unit = "%", delta = "+40", deltaTone = Tone.Favourable),
            CompareRow("Operating margin", listOf("31.5", "32.1", "29.8"), unit = "%", delta = "−60", deltaTone = Tone.Unfavourable),
            CompareRow("Peer median", listOf("24.0", "23.1", "—"), unit = "%", median = true),
        ),
        labelHeader = "Metric",
        deltaHeader = "Change, bps",
    )

    val report: @Composable GalleryScope.() -> Unit = {
        Specimen("CompareTable", "pinned labels, subject column, delta, median row") {
            CompareTable(compareModel, onCellClick = { _, _ -> })
        }
        Specimen("HighlightText", "lead band / drop cap") {
            HighlightText("Services now carry the margin.", "Hardware was flat for the year, but services grew 14% and lifted gross margin to 46.2%.")
            HighlightText("Apple's next leg depends on China.", "Greater China fell 8% while every other region grew, and it is still a fifth of sales. The report treats this as the single risk that could undo the thesis.", dropCap = true)
        }
        Specimen("NoteBlock", "empty / saving / saved / failed") {
            NoteBlock("", {}, filing = "10-K FY2025")
            NoteBlock("Services margin is the thesis. Watch China.", {}, filing = "10-K FY2025", saveState = NoteSaveState.Saving, onCopy = noop, onShare = noop)
            NoteBlock("Services margin is the thesis. Watch China.", {}, filing = "10-K FY2025", saveState = NoteSaveState.Saved, savedAgo = "2 min ago", onCopy = noop, onShare = noop)
            NoteBlock("Services margin is the thesis. Watch China.", {}, filing = "10-K FY2025", saveState = NoteSaveState.Failed, onRetry = noop)
        }
        Specimen("NotePreview") {
            NotePreview("Services margin is the thesis. If it falls below 70% two quarters running, I am wrong. Watching China and the DOJ case.", noop, filing = "10-K FY2025")
        }
        Specimen("NotesTrail", "newest empty, older note offers carry forward") {
            NotesTrail(
                entries = listOf(
                    NoteEntry("q1", "10-Q Q1 FY2026", "30 Jan 2026", "", "Hold: services still carry the margin."),
                    NoteEntry("fy25", "10-K FY2025", "31 Oct 2025", "Services margin is the thesis. If it falls below 70% two quarters running, I am wrong. Watching China and the DOJ case, plus the iPhone cycle into the autumn.", "Hold, with a closer eye on China."),
                ),
                onCarryForward = {},
            ) { NoteBlock(it.text, {}, filing = it.filing) }
        }
        Specimen("StageProgress", "done / current / waiting") {
            StageProgress(
                listOf(
                    Stage("Reading the 10-K", StageStatus.Done),
                    Stage("Checking the numbers", StageStatus.Current, caption = "Usually under a minute"),
                    Stage("Writing the report", StageStatus.Waiting),
                ),
            )
        }
        Specimen("TapeRow", "pre-market tape") {
            run {
                TapeRow(
                    listOf(
                        TapeItem("S&P 500", "5,948.71", "+0.4%", Tone.Favourable),
                        TapeItem("10Y", "4.21%", "−3 bps", Tone.Neutral),
                        TapeItem("Brent", "$73.10", "−1.2%", Tone.Unfavourable),
                    ),
                    caption = "Pre-market · as of 06:15",
                    onClick = noop,
                )
            }
        }
        Specimen("SinceLastReport", "with changes / first report") {
            SinceLastReport(
                SinceLastReportModel(
                    previousView = "Buy: services growth outruns hardware.",
                    previousFiling = "10-K FY2024 · 1 Nov 2024",
                    currentView = "Hold: services still lead, China is the risk.",
                    currentFiling = "10-K FY2025 · 31 Oct 2025",
                    changes = listOf(
                        ReportChange("Greater China sales", "Down 8%", up = false, tone = Tone.Unfavourable, whyItMatters = "a fifth of revenue"),
                        ReportChange("Services gross margin", "Up 120 bps", up = true, tone = Tone.Favourable, whyItMatters = "the core of the thesis"),
                    ),
                    drift = BadgeSpec("Drifting", Tone.Attention),
                ),
                onChangeClick = {},
            )
            SinceLastReport(null)
        }
        Specimen("ChartReadout", "now / scrubbing") {
            ChartReadout("58", "24 Nov 2025", change = "+6 since 1 Nov", changeTone = Tone.Unfavourable)
            ChartReadout("52", "3 Nov 2025", change = "+0", scrubbing = true)
        }
    }

    val all: Map<String, @Composable GalleryScope.() -> Unit> = linkedMapOf(
        "atoms" to atoms,
        "buttons" to buttons,
        "headers" to headers,
        "chips" to chips,
        "cards" to cards,
        "data" to data,
        "controls" to controls,
        "overlays" to overlays,
        "bars" to bars,
        "loading" to loading,
        "report" to report,
    )
}
