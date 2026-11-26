package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.CardFooter
import com.thesis.mobile.ui.components.DataRow
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SecondaryButton
import com.thesis.mobile.ui.components.SegmentedControl
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisSheet
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.components.ToggleRow
import com.thesis.mobile.ui.components.legalPageUrl
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.shell.AppearancePrefs
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.UpDownScheme
import com.thesis.mobile.ui.theme.withUpDown
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Segment order of the Theme control (5.22: Auto · Light · Dark). Auto follows the system setting. */
private val ThemeModeOrder = listOf(ThemeMode.System, ThemeMode.Light, ThemeMode.Dark)

/** Segment order of the up/down colours control. */
private val UpDownOrder = listOf(UpDownScheme.Classic, UpDownScheme.ColourBlind)

/** Feedback flows the API accepts (`settings_subscription_<flow>`), in the order of [AccountCopy.FEEDBACK_FLOWS]. */
private val FeedbackFlowCodes = listOf("cancel", "downgrade")
private const val FEEDBACK_FLOW_FREE = "free"

/**
 * You (DESIGN-DIRECTION 5.22), on the global modal stack: the ScreenHeader "You" with the account email and the plan
 * badge, then grouped rows under kickers: Appearance (theme, up/down colours with a two-swatch preview, reduce
 * motion), Notifications (master and per-family toggles, quiet-until captions, system settings), Security (app
 * lock), Portfolio (import holdings), Your notes (export as Markdown), Subscription (plan, Deep Dives, See Pro or
 * Manage, restore, refresh, cancellation feedback), Monthly review, Help and legal (terms, privacy, licences),
 * Account (log out, delete account) and, in debug builds, Developer.
 *
 * Pure: the caller passes purchases, the system notification settings Intent, the notes export (share sheet or
 * `CreateDocument`), the import panel and the Android-only delete-account section, so design-preview renders it.
 * [onExportNotes] receives the file name and the Markdown ([NotesMarkdown]); [onLoadNotes] asks for the cached notes.
 * Plans are chosen on the Paywall, which "See Pro" opens through [onRequireUpgrade]. [clock] dates the notes export and
 * decides whether a quiet-until time has passed (its zone also dates the billing period end), so renders and tests
 * pass a fixed one.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    padding: PaddingValues,
    currentApiBaseUrl: String,
    profile: UserProfileView?,
    convictionInsights: List<ConvictionInsightCardView>,
    convictionInsightsError: String?,
    subscriptionActionInFlight: Boolean,
    notificationsEnabled: Boolean,
    biometricSupported: Boolean,
    biometricLockEnabled: Boolean,
    notificationPreferences: List<NotificationPreferenceView>,
    onSetNotifications: (Boolean) -> Unit,
    onSetBiometricLockEnabled: (Boolean) -> Unit,
    onSetNotificationPreference: (String, Boolean) -> Unit,
    onSaveApiBaseUrl: (String) -> Unit,
    onSyncTier: () -> Unit,
    onRefreshConvictionInsights: () -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onRestorePurchases: () -> Unit,
    onSubmitSubscriptionFeedback: (String, String, String, Boolean) -> Unit,
    onLogout: () -> Unit,
    /** Opens the system notification settings for the app (an Intent; the caller owns it). */
    onOpenSystemNotificationSettings: () -> Unit = {},
    /** `BuildConfig.DEBUG`: shows the API base URL switch. */
    showDeveloperOptions: Boolean = false,
    /** The delete-account button and dialog (`DeleteAccountSection`, Android-only). */
    deleteAccountSection: @Composable () -> Unit = {},
    /** You > Appearance (spec Q2: the Auto / Light / Dark setting, Dark by default). */
    appearance: AppearancePrefs = AppearancePrefs(),
    onSetAppearance: (AppearancePrefs) -> Unit = {},
    /** The user's cached notes (`UiState.allNotes`), for Your notes. */
    notes: List<NoteTrailEntry> = emptyList(),
    onLoadNotes: () -> Unit = {},
    onExportNotes: ((fileName: String, markdown: String) -> Unit)? = null,
    /** Opens the holdings CSV import (WP-B's panel); the row is hidden while null. */
    onImportHoldings: (() -> Unit)? = null,
    clock: Clock = Clock.systemDefaultZone(),
) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    val uriHandler = LocalUriHandler.current
    val dir = LocalLayoutDirection.current
    val isPro = profile?.tier.equals("PRO", ignoreCase = true)
    var feedbackOpen by rememberSaveable { mutableStateOf(false) }
    var licencesOpen by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) { onLoadNotes() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = padding.calculateStartPadding(dir) + ThesisSpace.gutter,
            end = padding.calculateEndPadding(dir) + ThesisSpace.gutter,
            top = padding.calculateTopPadding() + ThesisSpace.headerTop,
            bottom = padding.calculateBottomPadding() + ThesisSpace.x3,
        ),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.xxl),
    ) {
        item(key = "header", contentType = "header") {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                ScreenHeader(title = AccountCopy.YOU_TITLE, deck = profile?.email?.takeIf { it.isNotBlank() })
                StatusBadge(
                    text = if (isPro) AccountCopy.PLAN_PRO else AccountCopy.PLAN_FREE,
                    color = if (isPro) p.accent else p.muted,
                )
            }
        }

        section("appearance", AccountCopy.SECTION_APPEARANCE) {
            RowGroup {
                row {
                    LabelledControl(AccountCopy.THEME) {
                        SegmentedControl(
                            options = AccountCopy.THEME_OPTIONS,
                            selectedIndex = ThemeModeOrder.indexOf(appearance.themeMode).coerceAtLeast(0),
                            onSelect = { i -> onSetAppearance(appearance.copy(themeMode = ThemeModeOrder[i])) },
                        )
                    }
                }
                row { UpDownRow(appearance.upDown) { scheme -> onSetAppearance(appearance.copy(upDown = scheme)) } }
                row {
                    ToggleRow(
                        title = AccountCopy.REDUCE_MOTION,
                        checked = appearance.reduceMotion,
                        onCheckedChange = { on -> onSetAppearance(appearance.copy(reduceMotion = on)) },
                        sub = AccountCopy.REDUCE_MOTION_SUB,
                    )
                }
            }
        }

        section("notifications", AccountCopy.SECTION_NOTIFICATIONS) {
            RowGroup {
                row {
                    ToggleRow(
                        title = AccountCopy.NOTIFICATIONS_MASTER,
                        checked = notificationsEnabled,
                        onCheckedChange = onSetNotifications,
                        sub = AccountCopy.NOTIFICATIONS_MASTER_SUB,
                    )
                }
                notificationPreferences.forEach { preference ->
                    row {
                        val quiet = preference.quietUntil?.let { quietUntilLabel(it, fmt, now = clock.instant(), zone = clock.zone) }
                        ToggleRow(
                            title = AccountCopy.notificationFamily(preference.type),
                            checked = preference.enabled,
                            onCheckedChange = { on -> onSetNotificationPreference(preference.type, on) },
                            sub = when {
                                !notificationsEnabled -> AccountCopy.NOTIFICATIONS_OFF_SUB
                                preference.enabled && quiet != null -> AccountCopy.quietUntil(quiet)
                                else -> null
                            },
                            enabled = notificationsEnabled,
                        )
                    }
                }
                row {
                    ActionRow(
                        icon = null,
                        title = AccountCopy.SYSTEM_NOTIFICATIONS,
                        onClick = onOpenSystemNotificationSettings,
                        caption = AccountCopy.SYSTEM_NOTIFICATIONS_SUB,
                        external = true,
                    )
                }
            }
        }

        if (biometricSupported) {
            section("security", AccountCopy.SECTION_SECURITY) {
                RowGroup {
                    row {
                        ToggleRow(
                            title = AccountCopy.APP_LOCK,
                            checked = biometricLockEnabled,
                            onCheckedChange = onSetBiometricLockEnabled,
                            sub = AccountCopy.APP_LOCK_SUB,
                        )
                    }
                }
            }
        }

        if (onImportHoldings != null) {
            section("portfolio", AccountCopy.SECTION_PORTFOLIO) {
                RowGroup {
                    row {
                        ActionRow(
                            icon = ThesisIcons.Document,
                            title = AccountCopy.IMPORT_HOLDINGS,
                            onClick = onImportHoldings,
                            caption = AccountCopy.IMPORT_HOLDINGS_SUB,
                        )
                    }
                }
            }
        }

        // Hidden until the caller wires the export: without it [notes] is not passed either, and "None yet" would be
        // wrong for a user who has notes.
        if (onExportNotes != null) section("notes", AccountCopy.SECTION_NOTES) {
            val (noteCount, nameCount) = remember(notes) { NotesMarkdown.counts(notes) }
            RowGroup {
                row {
                    if (noteCount == 0) {
                        DataRow(
                            label = AccountCopy.EXPORT_NOTES,
                            value = AccountCopy.NOTES_NONE,
                            sub = AccountCopy.NOTES_NONE_SUB,
                        )
                    } else {
                        ActionRow(
                            icon = ThesisIcons.Notes,
                            title = AccountCopy.EXPORT_NOTES,
                            onClick = {
                                val today = LocalDate.now(clock)
                                onExportNotes(NotesMarkdown.fileName(today), NotesMarkdown.build(notes, today, clock.zone))
                            },
                            caption = AccountCopy.exportNotesSub(noteCount, nameCount),
                        )
                    }
                }
            }
        }

        section("subscription", AccountCopy.SECTION_SUBSCRIPTION) {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                RowGroup {
                    row {
                        DataRow(
                            label = AccountCopy.PLAN,
                            value = if (isPro) AccountCopy.PLAN_VALUE_PRO else AccountCopy.PLAN_VALUE_FREE,
                            sub = profile?.billingPeriodEnd?.let { periodEndLabel(it, fmt, clock.zone) }?.let(AccountCopy::periodEnds),
                        )
                    }
                    if (profile != null) {
                        row {
                            DataRow(
                                label = AccountCopy.DEEP_DIVES_TODAY,
                                value = if (profile.dailyDeepDiveLimit < 0) {
                                    AccountCopy.UNLIMITED
                                } else {
                                    AccountCopy.deepDivesLeft(profile.deepDivesRemainingToday, profile.dailyDeepDiveLimit)
                                },
                            )
                        }
                        row { DataRow(label = AccountCopy.NAMES_LIMIT, value = Fmt.number(profile.watchlistLimit.toLong())) }
                    }
                    row {
                        if (isPro) {
                            ActionRow(
                                icon = null,
                                title = AccountCopy.MANAGE_SUBSCRIPTION,
                                onClick = { uriHandler.openUri(AccountCopy.GOOGLE_PLAY_SUBSCRIPTIONS) },
                                caption = AccountCopy.MANAGE_SUBSCRIPTION_SUB,
                                external = true,
                            )
                        } else {
                            ActionRow(
                                icon = null,
                                title = AccountCopy.SEE_PRO,
                                onClick = { onRequireUpgrade("settings_subscription") },
                                caption = AccountCopy.SEE_PRO_SUB,
                            )
                        }
                    }
                    row {
                        BusyAwareActionRow(
                            title = AccountCopy.RESTORE_PURCHASES,
                            onClick = onRestorePurchases,
                            busy = subscriptionActionInFlight,
                        )
                    }
                    row {
                        BusyAwareActionRow(
                            title = AccountCopy.REFRESH_PLAN,
                            onClick = onSyncTier,
                            busy = subscriptionActionInFlight,
                        )
                    }
                    // Every tier, as before the redesign: the only feedback channel the app has (HANDOFF-G 14). A Free
                    // account is asked why it has not moved to Pro, without the cancel or downgrade choice.
                    row {
                        ActionRow(
                            icon = null,
                            title = if (isPro) AccountCopy.FEEDBACK else AccountCopy.FEEDBACK_FREE,
                            onClick = { feedbackOpen = !feedbackOpen },
                            caption = if (isPro) AccountCopy.FEEDBACK_SUB else AccountCopy.FEEDBACK_FREE_SUB,
                        )
                    }
                }
                if (feedbackOpen) {
                    SubscriptionFeedbackCard(
                        busy = subscriptionActionInFlight,
                        isPro = isPro,
                        onSubmit = { code, flow, message ->
                            // The win-back offer is for someone leaving Pro, not for a Free account.
                            onSubmitSubscriptionFeedback(code, "settings_subscription_$flow", message, isPro)
                            feedbackOpen = false
                        },
                    )
                }
            }
        }

        section("review", AccountCopy.SECTION_REVIEW) {
            MonthlyReview(
                isPro = isPro,
                insights = convictionInsights,
                error = convictionInsightsError,
                onRefresh = onRefreshConvictionInsights,
                onSeePro = { onRequireUpgrade("conviction_intelligence") },
            )
        }

        section("legal", AccountCopy.SECTION_LEGAL) {
            RowGroup {
                row {
                    ActionRow(
                        icon = null,
                        title = AccountCopy.TERMS,
                        onClick = { uriHandler.openUri(legalPageUrl(currentApiBaseUrl, "terms")) },
                        external = true,
                    )
                }
                row {
                    ActionRow(
                        icon = null,
                        title = AccountCopy.PRIVACY,
                        onClick = { uriHandler.openUri(legalPageUrl(currentApiBaseUrl, "privacy")) },
                        external = true,
                    )
                }
                row {
                    ActionRow(
                        icon = null,
                        title = AccountCopy.LICENCES,
                        onClick = { licencesOpen = true },
                        caption = AccountCopy.LICENCES_SUB,
                    )
                }
            }
        }

        section("account", AccountCopy.SECTION_ACCOUNT) {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                // A row like every other You action: its card and the delete button below share the text edge.
                RowGroup {
                    row { ActionRow(icon = ThesisIcons.SignOut, title = AccountCopy.LOG_OUT, onClick = onLogout) }
                }
                deleteAccountSection()
            }
        }

        if (showDeveloperOptions) {
            section("developer", AccountCopy.SECTION_DEVELOPER) {
                DeveloperApi(currentApiBaseUrl = currentApiBaseUrl, onSave = onSaveApiBaseUrl)
            }
        }

        item(key = "disclaimer", contentType = "disclaimer") {
            Text(AccountCopy.DISCLAIMER, style = ThesisType.caption, color = p.muted)
        }
    }

    if (licencesOpen) {
        ThesisSheet(onDismissRequest = { licencesOpen = false }, title = AccountCopy.LICENCES) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
            ) {
                Text(Licences.NEWSREADER_TITLE, style = ThesisType.rowTitle, color = p.ink)
                Text(Licences.NEWSREADER_OFL, style = ThesisType.caption, color = p.ink2)
            }
        }
    }
}

/**
 * An [ActionRow] that stands down while a store action runs ([busy]): its title and caption turn `muted` (the
 * disabled ToggleRow's colour), TalkBack hears it as disabled, a caption says why and a tap does nothing. The kit
 * row has no `enabled` yet (HANDOFF-G 23).
 */
@Composable
private fun BusyAwareActionRow(title: String, onClick: () -> Unit, busy: Boolean) {
    if (!busy) {
        ActionRow(icon = null, title = title, onClick = onClick)
        return
    }
    val p = LocalThesisPalette.current
    CompositionLocalProvider(LocalThesisPalette provides p.copy(ink = p.muted, ink2 = p.muted)) {
        ActionRow(
            icon = null,
            title = title,
            onClick = {},
            modifier = Modifier.semantics { disabled() },
            caption = AccountCopy.STORE_BUSY,
        )
    }
}

/** One You section: its kicker (a heading for TalkBack) above [content]. */
private fun LazyListScope.section(key: String, kicker: String, content: @Composable () -> Unit) {
    item(key = key, contentType = "section") {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
            Kicker(kicker, modifier = Modifier.semantics { heading() })
            content()
        }
    }
}

/**
 * A row holding a label above a full-width control (Theme, Up and down colours). Title and sub use the ToggleRow
 * styles (`body`, `bodySmall`), so the Appearance rows read as one anatomy.
 */
@Composable
private fun LabelledControl(label: String, sub: String? = null, trailing: @Composable () -> Unit = {}, control: @Composable () -> Unit) {
    val p = LocalThesisPalette.current
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(label, style = ThesisType.body, color = p.ink)
                if (sub != null) Text(sub, style = ThesisType.bodySmall, color = p.ink2)
            }
            trailing()
        }
        control()
    }
}

/**
 * Up and down colours: a Classic · Colour-blind SegmentedControl with a two-swatch preview of the chosen scheme.
 * Where "Colour-blind" does not fit half the row (large font scales, narrow screens: A4) it falls back to a switch,
 * which keeps the whole label.
 */
@Composable
private fun UpDownRow(scheme: UpDownScheme, onSelect: (UpDownScheme) -> Unit) {
    val sub = if (scheme == UpDownScheme.ColourBlind) AccountCopy.UP_DOWN_COLOUR_BLIND_SUB else AccountCopy.UP_DOWN_CLASSIC_SUB
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        // The control spans the row less its padding.
        if (segmentLabelsFit(AccountCopy.UP_DOWN_OPTIONS, maxWidth - ThesisSpace.l * 2)) {
            LabelledControl(AccountCopy.UP_DOWN, sub = sub, trailing = { UpDownPreview(scheme) }) {
                SegmentedControl(
                    options = AccountCopy.UP_DOWN_OPTIONS,
                    selectedIndex = UpDownOrder.indexOf(scheme).coerceAtLeast(0),
                    onSelect = { i -> onSelect(UpDownOrder[i]) },
                )
            }
        } else {
            Column {
                ToggleRow(
                    title = AccountCopy.UP_DOWN_TOGGLE,
                    checked = scheme == UpDownScheme.ColourBlind,
                    onCheckedChange = { on -> onSelect(if (on) UpDownScheme.ColourBlind else UpDownScheme.Classic) },
                    sub = sub,
                )
                Row(Modifier.padding(start = ThesisSpace.l, end = ThesisSpace.l, bottom = ThesisSpace.rowPaddingV)) {
                    UpDownPreview(scheme)
                }
            }
        }
    }
}

/** The two swatches: an up figure and a down figure in [scheme]'s text colours. Decorative (the caption says it). */
@Composable
private fun UpDownPreview(scheme: UpDownScheme) {
    val p = LocalThesisPalette.current.withUpDown(scheme)
    Row(
        Modifier.clearAndSetSemantics { },
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Swatch(ThesisIcons.Small.Up, Fmt.signedPct(1.2), p.upText)
        Swatch(ThesisIcons.Small.Down, Fmt.signedPct(-0.8), p.downText)
    }
}

@Composable
private fun Swatch(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, color: androidx.compose.ui.graphics.Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconS), tint = color)
        Spacer(Modifier.width(ThesisSpace.xs))
        Text(text, style = ThesisType.tape, color = color)
    }
}

/**
 * "Thinking of cancelling?" (Pro: flow, reason and an optional note) or "Not on Pro yet?" (Free: reason and note,
 * flow `free`), sent to the API with the reason code.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SubscriptionFeedbackCard(
    busy: Boolean,
    isPro: Boolean,
    onSubmit: (code: String, flow: String, message: String) -> Unit,
) {
    var flow by rememberSaveable { mutableStateOf(0) }
    var reason by rememberSaveable { mutableStateOf(AccountCopy.FEEDBACK_REASONS.first().first) }
    var message by rememberSaveable { mutableStateOf("") }
    ThesisCard(title = if (isPro) AccountCopy.FEEDBACK else AccountCopy.FEEDBACK_FREE) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
            if (isPro) SegmentedControl(options = AccountCopy.FEEDBACK_FLOWS, selectedIndex = flow, onSelect = { flow = it })
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
                verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
            ) {
                AccountCopy.FEEDBACK_REASONS.forEach { (code, label) ->
                    ThesisChip(label = label, selected = reason == code, onClick = { reason = code }, role = Role.RadioButton)
                }
            }
            ThesisTextField(
                value = message,
                onValueChange = { message = it },
                label = AccountCopy.FEEDBACK_MESSAGE,
                singleLine = false,
            )
            SecondaryButton(
                text = AccountCopy.FEEDBACK_SEND,
                onClick = { onSubmit(reason, if (isPro) FeedbackFlowCodes[flow] else FEEDBACK_FLOW_FREE, message.trim()) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !busy,
                loading = busy,
            )
        }
    }
}

/** The monthly review (Conviction intelligence): a Pro card for Free, else the latest review or its empty state. */
@Composable
private fun MonthlyReview(
    isPro: Boolean,
    insights: List<ConvictionInsightCardView>,
    error: String?,
    onRefresh: () -> Unit,
    onSeePro: () -> Unit,
) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    if (!isPro) {
        ThesisCard(
            title = AccountCopy.REVIEW_PRO_TITLE,
            // Names what it opens: "See Pro" is already the Subscription row's action a few rows up (V3).
            footer = CardFooter(actionLabel = AccountCopy.REVIEW_PRO_ACTION, onAction = onSeePro),
        ) {
            Text(AccountCopy.REVIEW_PRO_BODY, style = ThesisType.body, color = p.ink2)
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        if (!error.isNullOrBlank()) {
            InlineBanner(text = error, tone = BannerTone.Error, actionLabel = AccountCopy.REVIEW_REFRESH, onAction = onRefresh)
        }
        val latest = insights.firstOrNull()
        if (latest == null) {
            EmptyState(
                sentence = AccountCopy.REVIEW_EMPTY,
                how = AccountCopy.REVIEW_EMPTY_HOW,
                actionLabel = AccountCopy.REVIEW_REFRESH,
                onAction = onRefresh,
            )
        } else {
            val start = runCatching { LocalDate.parse(latest.periodStart.take(10)) }.getOrNull()
            val end = runCatching { LocalDate.parse(latest.periodEnd.take(10)) }.getOrNull()
            ThesisCard(
                title = latest.title,
                footer = CardFooter(actionLabel = AccountCopy.REVIEW_REFRESH, onAction = onRefresh),
            ) {
                // The period as a plain line under the title, not in the spaced-capitals eyebrow: the section's
                // kicker is already the card's one kicker, and dates read as text (T2).
                if (start != null && end != null) {
                    Text(fmt.weekRange(start, end), style = ThesisType.bodySmall, color = p.muted)
                }
                if (latest.summary.isNotBlank()) Text(latest.summary, style = ThesisType.body, color = p.ink2)
                latest.findings.forEach { finding ->
                    Column(Modifier.heightIn(min = ThesisSpace.touchMin), verticalArrangement = Arrangement.spacedBy(ThesisSpace.xxs)) {
                        Text(finding.title, style = ThesisType.rowTitle, color = p.ink)
                        if (finding.summary.isNotBlank()) Text(finding.summary, style = ThesisType.bodySmall, color = p.ink2)
                    }
                }
            }
        }
    }
}

/** Debug builds: point the app at another product-api. */
@Composable
private fun DeveloperApi(currentApiBaseUrl: String, onSave: (String) -> Unit) {
    var baseUrl by rememberSaveable(currentApiBaseUrl) { mutableStateOf(currentApiBaseUrl) }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        ThesisTextField(
            value = baseUrl,
            onValueChange = { baseUrl = it },
            label = AccountCopy.API_BASE_URL,
            keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done),
        )
        SecondaryButton(AccountCopy.SAVE_API_URL, { onSave(baseUrl.trim()) }, enabled = baseUrl.isNotBlank())
    }
}

/**
 * "14:30, 26 Nov" for a quiet-until instant still in the future; null when it has passed or cannot be read. [now]
 * and [zone] come from the screen's injected clock (never the system's), so the caption is deterministic.
 */
internal fun quietUntilLabel(raw: String, fmt: Fmt, now: Instant, zone: ZoneId): String? {
    val until = runCatching { Instant.parse(raw) }.getOrNull() ?: return null
    if (!until.isAfter(now)) return null
    return "${fmt.time(until)}, ${fmt.shortDate(until.atZone(zone).toLocalDate())}"
}

/** The billing period end as a short date ("24 Dec"); the raw value when it is not a date the app can read. */
internal fun periodEndLabel(raw: String, fmt: Fmt, zone: ZoneId): String? {
    val trimmed = raw.trim().takeIf { it.isNotEmpty() } ?: return null
    val date = runCatching { Instant.parse(trimmed).atZone(zone).toLocalDate() }.getOrNull()
        ?: runCatching { LocalDate.parse(trimmed.take(10)) }.getOrNull()
    return date?.let(fmt::shortDate) ?: trimmed
}
