package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.ui.components.LegalLinks
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.copy.ProductCopy
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.theme.ThesisTypography
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * You / Settings, extracted from `ThesisApp.kt` (DESIGN-DIRECTION 6.1), unchanged in look. Pure: purchases,
 * the system notification settings Intent, the debug API switch and the delete-account section come from the
 * caller, so design-preview can render it.
 */
@Composable
fun SettingsScreen(
    padding: PaddingValues,
    currentApiBaseUrl: String,
    profile: UserProfileView?,
    convictionInsights: List<ConvictionInsightCardView>,
    convictionInsightsError: String?,
    subscriptionOffers: List<com.thesis.mobile.model.SubscriptionOfferView>,
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
    onRefreshOffers: () -> Unit,
    onStartPurchase: (preferredType: String?) -> Unit,
    onRestorePurchases: () -> Unit,
    onSubmitSubscriptionFeedback: (String, String, String, Boolean) -> Unit,
    onLogout: () -> Unit,
    /** Opens the system notification settings for the app (an Intent; the caller owns it). */
    onOpenSystemNotificationSettings: () -> Unit = {},
    /** False when no Activity is available to host the store sheet. */
    canStartPurchase: Boolean = true,
    /** `BuildConfig.DEBUG`: shows the API base URL switch. */
    showDeveloperOptions: Boolean = false,
    /** The delete-account button and dialog (`DeleteAccountSection`, Android-only). */
    deleteAccountSection: @Composable () -> Unit = {}
) {
    var baseUrl by rememberSaveable(currentApiBaseUrl) { mutableStateOf(currentApiBaseUrl) }
    var subscriptionFeedbackFlow by rememberSaveable { mutableStateOf("cancel") }
    var subscriptionFeedbackCode by rememberSaveable { mutableStateOf("cancel_price") }
    var subscriptionFeedbackMessage by rememberSaveable { mutableStateOf("") }
    val switchColors = androidx.compose.material3.SwitchDefaults.colors(
        checkedThumbColor = ThesisColors.Primary,
        checkedTrackColor = ThesisColors.Primary.copy(alpha = 0.2f),
        uncheckedThumbColor = ThesisColors.TextMuted,
        uncheckedTrackColor = ThesisColors.SurfaceElevated
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding),
        contentPadding = PaddingValues(
            horizontal = ThesisDimens.ScreenPaddingHorizontal,
            vertical = ThesisDimens.SpacingLg
        ),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXl)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                Text(
                    text = Phase4Copy.youHeadline,
                    style = ThesisTypography.headlineLarge.copy(
                        fontFamily = HeadingFont,
                        fontWeight = FontWeight.Normal
                    ),
                    color = ThesisColors.TextPrimary
                )
                Text(
                    text = Phase4Copy.youSubtitle,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextMuted
                )
            }
        }
        item {
            MonthlyCoherenceSection(
                isPro = profile?.tier.equals("PRO", ignoreCase = true),
                insights = convictionInsights,
                errorMessage = convictionInsightsError,
                onRefresh = onRefreshConvictionInsights,
                onRequireUpgrade = onRequireUpgrade
            )
        }
        item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
            ) {
                Text(
                    text = "DATA TRUST",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = "Freshness and degraded-feed warnings stay visible across Today, Names, Research, and Inbox. Thesis marks missing evidence instead of inventing certainty.",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextPrimary
                )
            }
        }
        item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
            ) {
                Text(
                    text = "NOTIFICATIONS",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Push Notifications",
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextPrimary
                    )
                    Switch(
                        checked = notificationsEnabled,
                        onCheckedChange = onSetNotifications,
                        colors = switchColors
                    )
                }

                if (biometricSupported) {
                    HorizontalDivider(color = ThesisColors.Border)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Biometric Lock",
                                style = ThesisTypography.bodyMedium,
                                color = ThesisColors.TextPrimary
                            )
                            Text(
                                text = "Require fingerprint after 5 min idle",
                                style = ThesisTypography.bodySmall,
                                color = ThesisColors.TextMuted
                            )
                        }
                        Switch(
                            checked = biometricLockEnabled,
                            onCheckedChange = onSetBiometricLockEnabled,
                            colors = switchColors
                        )
                    }
                }

                if (notificationsEnabled) {
                    HorizontalDivider(color = ThesisColors.Border)
                    notificationPreferences.forEach { preference ->
                        NotificationPreferenceRow(
                            type = preference.type,
                            enabled = preference.enabled,
                            quietUntil = preference.quietUntil,
                            notificationsEnabled = notificationsEnabled,
                            onToggle = { enabled -> onSetNotificationPreference(preference.type, enabled) },
                            switchColors = switchColors
                        )
                    }
                }

                Button(
                    onClick = onOpenSystemNotificationSettings,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.SurfaceElevated,
                        contentColor = ThesisColors.TextMuted
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                ) {
                    Text("System Notification Settings", style = ThesisTypography.labelLarge)
                }
            }
        }
        item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
            ) {
                Text(
                    text = "SUBSCRIPTION",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Tier", style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
                    Text(
                        text = profile?.tier ?: "FREE",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.Primary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
                            .background(ThesisColors.Primary.copy(alpha = 0.1f))
                            .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs)
                    )
                }
                val deepDiveLimit = profile?.dailyDeepDiveLimit ?: 1
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Deep Dives", style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
                    Text(
                        if (deepDiveLimit < 0) "Unlimited" else "${profile?.deepDivesRemainingToday ?: 0} / $deepDiveLimit today",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Names limit", style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
                    Text("${profile?.watchlistLimit ?: ProductCopy.freeWatchlistLimit}", style = ThesisTypography.bodySmall, color = ThesisColors.TextMuted)
                }
                if (!profile?.billingPeriodEnd.isNullOrBlank()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Billing period end", style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
                        Text(profile?.billingPeriodEnd ?: "", style = ThesisTypography.bodySmall, color = ThesisColors.TextMuted)
                    }
                }
                HorizontalDivider(color = ThesisColors.Border)
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    Button(
                        onClick = { if (canStartPurchase) onStartPurchase("MONTHLY") },
                        enabled = canStartPurchase && !subscriptionActionInFlight,
                        modifier = Modifier.weight(1f).height(40.dp),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = ThesisColors.Primary,
                            contentColor = ThesisColors.TextInverse
                        )
                    ) {
                        Text("Monthly", style = ThesisTypography.labelLarge)
                    }
                    Button(
                        onClick = { if (canStartPurchase) onStartPurchase("YEARLY") },
                        enabled = canStartPurchase && !subscriptionActionInFlight,
                        modifier = Modifier.weight(1f).height(40.dp),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = ThesisColors.Primary,
                            contentColor = ThesisColors.TextInverse
                        )
                    ) {
                        Text("Yearly", style = ThesisTypography.labelLarge)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    OutlinedButton(
                        onClick = onSyncTier,
                        enabled = !subscriptionActionInFlight,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        border = androidx.compose.foundation.BorderStroke(
                            ThesisDimens.BorderWidth,
                            ThesisColors.Border
                        )
                    ) {
                        Text("Refresh", color = ThesisColors.TextMuted)
                    }
                    OutlinedButton(
                        onClick = onRestorePurchases,
                        enabled = !subscriptionActionInFlight,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        border = androidx.compose.foundation.BorderStroke(
                            ThesisDimens.BorderWidth,
                            ThesisColors.Border
                        )
                    ) {
                        Text("Restore", color = ThesisColors.TextMuted)
                    }
                }
                if (subscriptionOffers.isNotEmpty()) {
                    Text(
                        text = "Available offers: ${subscriptionOffers.joinToString { it.title }}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
                TextButton(onClick = onRefreshOffers, enabled = !subscriptionActionInFlight) {
                    Text("Refresh offers", color = ThesisColors.Primary)
                }

                HorizontalDivider(color = ThesisColors.Border)
                Text(
                    text = "FEEDBACK",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = "Tell us why you might cancel or downgrade so we can improve the Pro value.",
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    OutlinedButton(
                        onClick = { subscriptionFeedbackFlow = "cancel" },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        border = androidx.compose.foundation.BorderStroke(
                            ThesisDimens.BorderWidth,
                            if (subscriptionFeedbackFlow == "cancel") ThesisColors.Primary else ThesisColors.Border
                        )
                    ) {
                        Text(
                            "Cancel",
                            color = if (subscriptionFeedbackFlow == "cancel") ThesisColors.Primary else ThesisColors.TextMuted
                        )
                    }
                    OutlinedButton(
                        onClick = { subscriptionFeedbackFlow = "downgrade" },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        border = androidx.compose.foundation.BorderStroke(
                            ThesisDimens.BorderWidth,
                            if (subscriptionFeedbackFlow == "downgrade") ThesisColors.Primary else ThesisColors.Border
                        )
                    ) {
                        Text(
                            "Downgrade",
                            color = if (subscriptionFeedbackFlow == "downgrade") ThesisColors.Primary else ThesisColors.TextMuted
                        )
                    }
                }

                val feedbackOptions = listOf(
                    "cancel_price" to "Price",
                    "cancel_low_value" to "Low value",
                    "cancel_too_noisy" to "Too noisy",
                    "cancel_other" to "Other"
                )
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    feedbackOptions.take(2).forEach { (code, label) ->
                        OutlinedButton(
                            onClick = { subscriptionFeedbackCode = code },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            border = androidx.compose.foundation.BorderStroke(
                                ThesisDimens.BorderWidth,
                                if (subscriptionFeedbackCode == code) ThesisColors.Primary else ThesisColors.Border
                            )
                        ) {
                            Text(
                                label,
                                color = if (subscriptionFeedbackCode == code) ThesisColors.Primary else ThesisColors.TextMuted
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    feedbackOptions.drop(2).forEach { (code, label) ->
                        OutlinedButton(
                            onClick = { subscriptionFeedbackCode = code },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            border = androidx.compose.foundation.BorderStroke(
                                ThesisDimens.BorderWidth,
                                if (subscriptionFeedbackCode == code) ThesisColors.Primary else ThesisColors.Border
                            )
                        ) {
                            Text(
                                label,
                                color = if (subscriptionFeedbackCode == code) ThesisColors.Primary else ThesisColors.TextMuted
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = subscriptionFeedbackMessage,
                    onValueChange = { subscriptionFeedbackMessage = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Optional context") },
                    minLines = 2,
                    maxLines = 4,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = ThesisColors.SurfaceElevated,
                        unfocusedContainerColor = ThesisColors.SurfaceElevated,
                        focusedBorderColor = ThesisColors.Primary,
                        unfocusedBorderColor = ThesisColors.Border,
                        focusedTextColor = ThesisColors.TextPrimary,
                        unfocusedTextColor = ThesisColors.TextPrimary,
                        cursorColor = ThesisColors.Primary,
                        focusedLabelColor = ThesisColors.Primary,
                        unfocusedLabelColor = ThesisColors.TextMuted
                    )
                )

                Button(
                    onClick = {
                        onSubmitSubscriptionFeedback(
                            subscriptionFeedbackCode,
                            "settings_subscription_${subscriptionFeedbackFlow}",
                            subscriptionFeedbackMessage,
                            true
                        )
                        subscriptionFeedbackMessage = ""
                    },
                    enabled = !subscriptionActionInFlight,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.SurfaceElevated,
                        contentColor = ThesisColors.TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth().height(40.dp)
                ) {
                    Text("Submit Feedback", style = ThesisTypography.labelLarge)
                }
            }
        }
        if (showDeveloperOptions) item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
            ) {
                Text(
                    text = "DEVELOPER",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                OutlinedTextField(
                    value = baseUrl,
                    onValueChange = { baseUrl = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("API Base URL") },
                    singleLine = true,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = ThesisColors.SurfaceElevated,
                        unfocusedContainerColor = ThesisColors.SurfaceElevated,
                        focusedBorderColor = ThesisColors.Primary,
                        unfocusedBorderColor = ThesisColors.Border,
                        focusedTextColor = ThesisColors.TextPrimary,
                        unfocusedTextColor = ThesisColors.TextPrimary,
                        cursorColor = ThesisColors.Primary,
                        focusedLabelColor = ThesisColors.Primary,
                        unfocusedLabelColor = ThesisColors.TextMuted
                    )
                )
                Button(
                    onClick = { onSaveApiBaseUrl(baseUrl) },
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.SurfaceElevated,
                        contentColor = ThesisColors.TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth().height(40.dp)
                ) {
                    Text("Save API URL")
                }
            }
        }
        item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
            ) {
                Text(
                    text = "ABOUT",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = "This is a research summary, not financial advice. Always do your own research.",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextPrimary
                )
                LegalLinks(apiBaseUrl = currentApiBaseUrl)
            }
        }
        item {
            Button(
                onClick = onLogout,
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = ThesisColors.SignalNegative.copy(alpha = 0.16f),
                    contentColor = ThesisColors.SignalNegative
                ),
                modifier = Modifier.fillMaxWidth().height(44.dp)
            ) {
                Text("Logout")
            }
        }
        item {
            deleteAccountSection()
        }
    }
}

@Composable
private fun NotificationPreferenceRow(
    type: String,
    enabled: Boolean,
    quietUntil: String?,
    notificationsEnabled: Boolean,
    onToggle: (Boolean) -> Unit,
    switchColors: androidx.compose.material3.SwitchColors
) {
    val label = Phase4Copy.notificationFamilyLabel(type)
    val quietUntilLabel = quietUntil?.let(::formatNotificationQuietUntil)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
            if (!notificationsEnabled) {
                Text(
                    Phase4Copy.notificationGlobalOffNote,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            } else if (enabled && quietUntilLabel != null) {
                Text(
                    Phase4Copy.notificationQuietUntilNote(quietUntilLabel),
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            }
        }
        Switch(
            checked = enabled,
            onCheckedChange = onToggle,
            colors = switchColors
        )
    }
}

private fun formatNotificationQuietUntil(raw: String): String? {
    val parsed = runCatching { Instant.parse(raw) }.getOrNull() ?: return null
    if (!parsed.isAfter(Instant.now())) {
        return null
    }
    return parsed
        .atZone(ZoneId.of("America/New_York"))
        .format(DateTimeFormatter.ofPattern("MMM d, HH:mm z"))
}
