package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.thesis.mobile.billing.RevenueCatBilling
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.SubscriptionOfferView
import com.thesis.mobile.ui.components.ProvidePageBackground
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

private const val SAMPLE_TITLE = "AAPL filed its 10-Q"
private const val SAMPLE_BODY = "3 things changed since the last Deep Dive."

// Keep in step with the API tier rules (product-api watchlistLimitForTier and the Pro gates).
private val proAdds = listOf(
    "Follow up to 50 names (Free: 3)",
    "The full \"what changed\" on every filing alert, by push and email",
    "Earnings War Room for the names you follow",
    "Scenario Stress, What-If, Opposite Case and Conviction timeline",
    "PDF and investment memo export"
)

/**
 * The one paywall. Shows a real filing-change alert headline for one of the user's own names
 * (a sample when there is none yet) and what Pro adds.
 */
@Composable
fun PaywallScreen(
    alerts: List<AlertLedgerItemView>,
    watchlist: List<String>,
    offers: List<SubscriptionOfferView>,
    actionInFlight: Boolean,
    onPurchase: (String) -> Unit,
    onRestore: () -> Unit,
    onRefreshOffers: () -> Unit,
    onDismiss: () -> Unit
) {
    LaunchedEffect(Unit) { onRefreshOffers() }

    val followed = watchlist.map { it.uppercase() }.toSet()
    val filingAlerts = alerts.filter { it.notificationType == "filing_change" }
    val alert = filingAlerts.firstOrNull { it.ticker?.uppercase() in followed } ?: filingAlerts.firstOrNull()
    val monthly = offers.firstOrNull { it.packageType == "MONTHLY" }
    val yearly = offers.firstOrNull { it.packageType == "ANNUAL" }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        // A Dialog is its own window, so it gets its own page-background cache in its own coordinates (2.7).
        ProvidePageBackground {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .pageBackground(LocalThesisPalette.current)
                    .verticalScroll(rememberScrollState())
                    .padding(ThesisDimens.ScreenPaddingHorizontal),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) {
                        Text("Not now", color = ThesisColors.TextMuted)
                    }
                }
                Text(
                    text = "Know what changed in every filing",
                    style = ThesisTypography.headlineLarge.copy(fontFamily = HeadingFont, fontWeight = FontWeight.Normal),
                    color = ThesisColors.TextPrimary
                )

                LockedAlertCard(
                    title = alert?.title ?: SAMPLE_TITLE,
                    body = alert?.body ?: SAMPLE_BODY,
                    isSample = alert == null
                )

                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    Text(
                        text = "PRO ADDS",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextMuted
                    )
                    proAdds.forEach { line ->
                        Text(text = "- $line", style = ThesisTypography.bodyMedium, color = ThesisColors.TextSecondary)
                    }
                }

                if (offers.isEmpty()) {
                    Text(
                        text = if (RevenueCatBilling.isEnabled()) {
                            "Loading plans..."
                        } else {
                            "Subscriptions are not available in this build."
                        },
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
                monthly?.let { offer ->
                    Button(
                        onClick = { onPurchase("MONTHLY") },
                        enabled = !actionInFlight,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = ThesisColors.Primary,
                            contentColor = ThesisColors.TextInverse
                        )
                    ) {
                        Text(planLabel("Monthly", offer.price))
                    }
                }
                yearly?.let { offer ->
                    OutlinedButton(
                        onClick = { onPurchase("YEARLY") },
                        enabled = !actionInFlight,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
                    ) {
                        Text(planLabel("Yearly", offer.price), color = ThesisColors.Primary)
                    }
                }
                if (RevenueCatBilling.isEnabled()) {
                    TextButton(onClick = onRestore, enabled = !actionInFlight, modifier = Modifier.fillMaxWidth()) {
                        Text("Restore purchase", color = ThesisColors.TextMuted)
                    }
                }
            }
        }
    }
}

private fun planLabel(name: String, price: String): String =
    if (price.isBlank()) name else "$name · $price"

@Composable
private fun LockedAlertCard(title: String, body: String, isSample: Boolean) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(ThesisColors.Surface, shape)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Text(
            text = if (isSample) "EXAMPLE FILING ALERT" else "YOUR FILING ALERT",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.Primary
        )
        Text(
            text = title,
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(text = body, style = ThesisTypography.bodyMedium, color = ThesisColors.TextSecondary)
        Text(
            text = "What changed is in Pro.",
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}
