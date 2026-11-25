package com.thesis.mobile.preview.fixtures

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionInsightFindingView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.SubscriptionOfferView
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.screens.DeleteAccountControl
import com.thesis.mobile.ui.screens.SettingsScreen
import com.thesis.mobile.ui.shell.AppearancePrefs
import androidx.compose.foundation.layout.PaddingValues
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/** Fixture data for the account and entry screens (WP-G): You, Paywall, Auth, Password reset, Delete account. */
object AccountFixtures {
    val zone: ZoneId = ZoneId.of("America/New_York")
    val now: Instant = Instant.parse("2026-11-25T12:30:00Z")
    val fmt = Fmt(Clock.fixed(now, zone), zone, is24h = true)

    const val API = "https://api.example.invalid"
    const val EMAIL = "maya.chen@example.com"

    val freeProfile = UserProfileView(
        userId = "u-1", email = EMAIL, tier = "FREE", billingPeriodEnd = null,
        watchlistLimit = 3, dailyDeepDiveLimit = 1, deepDivesRemainingToday = 1,
    )
    val proProfile = freeProfile.copy(
        tier = "PRO", billingPeriodEnd = "2026-12-24T00:00:00Z",
        watchlistLimit = 50, dailyDeepDiveLimit = 10, deepDivesRemainingToday = 7,
    )

    val notificationPreferences = listOf(
        NotificationPreferenceView("earnings_preview", enabled = true),
        NotificationPreferenceView("contrarian_alert", enabled = true, quietUntil = "2026-11-26T14:00:00Z"),
        NotificationPreferenceView("morning_exception_briefing", enabled = false),
        NotificationPreferenceView("weekly_digest", enabled = true),
    )

    val notes = listOf(
        NoteTrailEntry("r-1", "AAPL", "Services margin is the story.", "2026-11-20T15:00:00Z", "FY2025", "Thesis intact."),
        NoteTrailEntry("r-2", "NVDA", "Watch the China line.", "2026-11-24T02:30:00Z", "Q3 FY2026", null),
        NoteTrailEntry("r-3", "AAPL", "Buyback pace slowed.", "2026-11-22T12:00:00Z", null, null),
    )

    val insights = listOf(
        ConvictionInsightCardView(
            insightId = "i-1",
            periodStart = "2026-10-01",
            periodEnd = "2026-10-31",
            insightType = "monthly_coherence",
            status = "ready",
            title = "Two of your names lean on the same customer",
            summary = "Apple and Broadcom both count on iPhone volumes; a soft cycle would test both theses at once.",
            findings = listOf(
                ConvictionInsightFindingView("overlap", "Shared exposure", "AAPL and AVGO: iPhone units drive both.", listOf("AAPL", "AVGO")),
                ConvictionInsightFindingView("drift", "Conviction ahead of evidence", "NVDA: your note is firmer than the last two filings.", listOf("NVDA")),
            ),
            generatedAt = "2026-11-01T09:00:00Z",
        ),
    )

    val offers = listOf(
        SubscriptionOfferView(packageType = "MONTHLY", identifier = "pro_monthly", title = "Thesis Pro monthly", price = "$7.99"),
        SubscriptionOfferView(packageType = "ANNUAL", identifier = "pro_annual", title = "Thesis Pro yearly", price = "$59.99"),
    )

    val filingAlert = AlertLedgerItemView(
        id = "a-1",
        notificationType = "filing_change",
        category = "filings",
        route = "report",
        title = "NVDA filed its 10-Q",
        body = "4 things changed since your last Deep Dive, including data-centre revenue guidance.",
        detailLocked = true,
        reasonCode = "filing_change",
        reasonText = "You follow NVDA",
        deliveryState = "delivered",
        ticker = "NVDA",
        createdAt = "2026-11-25T11:05:00Z",
        updatedAt = "2026-11-25T11:05:00Z",
    )

    /** Pins dates and times (LocalFmt) to [now] in New York, so renders and tests do not depend on the clock. */
    @Composable
    fun WithFixedTime(content: @Composable () -> Unit) {
        CompositionLocalProvider(LocalFmt provides fmt, content = content)
    }

    /** You with fixture data; the render and semantics tests override what they look at. */
    @Composable
    fun You(
        pro: Boolean = false,
        appearance: AppearancePrefs = AppearancePrefs(),
        onSetAppearance: (AppearancePrefs) -> Unit = {},
        notesList: List<NoteTrailEntry> = notes,
        onExportNotes: ((String, String) -> Unit)? = { _, _ -> },
        onSetNotifications: (Boolean) -> Unit = {},
        notificationsEnabled: Boolean = true,
        onRequireUpgrade: (String) -> Unit = {},
        showDeveloperOptions: Boolean = false,
        padding: PaddingValues = PaddingValues(),
    ) {
        WithFixedTime {
            SettingsScreen(
                padding = padding,
                currentApiBaseUrl = API,
                profile = if (pro) proProfile else freeProfile,
                convictionInsights = if (pro) insights else emptyList(),
                convictionInsightsError = null,
                subscriptionOffers = offers,
                subscriptionActionInFlight = false,
                notificationsEnabled = notificationsEnabled,
                biometricSupported = true,
                biometricLockEnabled = false,
                notificationPreferences = notificationPreferences,
                onSetNotifications = onSetNotifications,
                onSetBiometricLockEnabled = {},
                onSetNotificationPreference = { _, _ -> },
                onSaveApiBaseUrl = {},
                onSyncTier = {},
                onRefreshConvictionInsights = {},
                onRequireUpgrade = onRequireUpgrade,
                onRefreshOffers = {},
                onStartPurchase = {},
                onRestorePurchases = {},
                onSubmitSubscriptionFeedback = { _, _, _, _ -> },
                onLogout = {},
                showDeveloperOptions = showDeveloperOptions,
                deleteAccountSection = { DeleteAccountControl(onDelete = {}) },
                appearance = appearance,
                onSetAppearance = onSetAppearance,
                notes = notesList,
                onExportNotes = onExportNotes,
                onImportHoldings = {},
            )
        }
    }
}
