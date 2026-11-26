package com.thesis.mobile.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import com.thesis.mobile.billing.RevenueCatBilling
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.SubscriptionOfferView
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.CardFooter
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.LegalLinks
import com.thesis.mobile.ui.components.PlanCard
import com.thesis.mobile.ui.components.RunBar
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisScreen
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.shell.HeroUnderBars
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.roundToInt

/** The store's package types, and what [PaywallScreen]'s `onPurchase` is called with for each. */
private const val PACKAGE_MONTHLY = "MONTHLY"
private const val PACKAGE_ANNUAL = "ANNUAL"
private const val PURCHASE_MONTHLY = "MONTHLY"
private const val PURCHASE_YEARLY = "YEARLY"

/** How long the paywall waits for the store's plans before it says they did not load and offers Try again. */
const val PAYWALL_OFFERS_WAIT_MILLIS = 10_000L

/**
 * The paywall (DESIGN-DIRECTION 5.23): a full-screen page, not a `Dialog`. A HeroBand opens it (eyebrow "Thesis
 * Pro", `display` "Read deeper", the one-sentence promise); then what Pro adds as plain sentences with 16 dp checks,
 * the two plans as PlanCards (Yearly selected by default, "Saves X% vs monthly" only when both prices are known) and
 * "Restore purchases", so the Yearly price is on the first screen; then a real filing alert for one of the user's
 * names (an example when there is none yet) and the legal caption. "Continue" is the sticky RunBar. While plans
 * load, skeleton cards stand in for them; when none arrive within [offersWaitMillis], an error banner says so and "Try again" asks the store again ([onRefreshOffers]).
 *
 * [padding]: the modal stack's frame padding when the shell hosts it as `Destination.Paywall` (its bar shows the
 * way back). Null when the paywall is drawn on its own over the shell: it then draws its own top bar (back =
 * [onDismiss]) and takes every touch, so nothing under it reacts. [billingEnabled]: whether this build has a store.
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
    onDismiss: () -> Unit,
    padding: PaddingValues? = null,
    apiBaseUrl: String? = null,
    billingEnabled: Boolean = RevenueCatBilling.isEnabled(),
    offersWaitMillis: Long = PAYWALL_OFFERS_WAIT_MILLIS,
) {
    LaunchedEffect(Unit) { onRefreshOffers() }
    val p = LocalThesisPalette.current

    // Plans that never arrive (store down, no network) end the skeletons with an error and a retry, not forever.
    var offersAttempt by remember { mutableIntStateOf(0) }
    var offersStalled by remember { mutableStateOf(false) }
    val offersReady by rememberUpdatedState(offers.isNotEmpty())
    LaunchedEffect(offersAttempt, billingEnabled) {
        offersStalled = false
        if (billingEnabled) {
            val arrived = withTimeoutOrNull(offersWaitMillis) { snapshotFlow { offersReady }.first { it } }
            offersStalled = arrived == null
        }
    }

    val followed = watchlist.map { it.uppercase() }.toSet()
    val filingAlerts = alerts.filter { it.notificationType == "filing_change" }
    val alert = filingAlerts.firstOrNull { it.ticker?.uppercase() in followed } ?: filingAlerts.firstOrNull()
    val monthly = offers.firstOrNull { it.packageType == PACKAGE_MONTHLY }
    val yearly = offers.firstOrNull { it.packageType == PACKAGE_ANNUAL }
    var choice by rememberSaveable { mutableStateOf<String?>(null) }
    val selected = when (choice) {
        PACKAGE_MONTHLY -> monthly ?: yearly
        PACKAGE_ANNUAL -> yearly ?: monthly
        else -> yearly ?: monthly
    }
    val saving = if (monthly != null && yearly != null) yearlySavingPercent(monthly.price, yearly.price) else null

    val scroll = rememberScrollState()
    var heroHeightPx by remember { mutableIntStateOf(0) }
    val barPx by rememberUpdatedState(with(LocalDensity.current) { ThesisSpace.topBar.roundToPx() })
    val collapsed by remember { derivedStateOf { heroHeightPx > 0 && scroll.value >= heroHeightPx - barPx } }
    val standalone = padding == null
    HeroUnderBars(collapsed = collapsed)

    // Drawn on its own over the shell (until it moves onto the modal stack, HANDOFF-G 3): it rises in like a modal
    // (fade + 32 dp, `Enter`; nothing moves under reduced motion) instead of cutting in.
    val reduced = LocalReducedMotion.current
    val rise = remember { Animatable(if (standalone && !reduced) 0f else 1f) }
    LaunchedEffect(Unit) { rise.animateTo(1f, ThesisMotion.enter()) }
    val riseOffsetPx = with(LocalDensity.current) { ThesisMotion.ModalOffset.toPx() }

    ThesisScreen(
        // Drawn on its own over the shell: take every touch, so the page under it never reacts, and read as its own
        // pane (TalkBack announces it and keeps its reading order inside it).
        modifier = if (standalone) {
            Modifier
                .graphicsLayer {
                    alpha = rise.value
                    translationY = (1f - rise.value) * riseOffsetPx
                }
                .semantics {
                    paneTitle = AccountCopy.PAYWALL_EYEBROW
                    isTraversalGroup = true
                }
                .pointerInput(Unit) { detectTapGestures { } }
        } else {
            Modifier
        },
        topBar = if (standalone) {
            { ThesisTopBar(title = AccountCopy.PAYWALL_EYEBROW, onBack = onDismiss, collapsed = collapsed, overHero = true) }
        } else {
            null
        },
        bottomBar = {
            RunBar(
                label = AccountCopy.PAYWALL_CONTINUE,
                onClick = {
                    selected?.let { onPurchase(if (it.packageType == PACKAGE_ANNUAL) PURCHASE_YEARLY else PURCHASE_MONTHLY) }
                },
                visible = selected != null,
                enabled = selected != null && !actionInFlight,
                loading = actionInFlight,
            )
        },
        collapsed = collapsed,
    ) { scaffold ->
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(scroll),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            HeroBand(modifier = Modifier.onSizeChanged { heroHeightPx = it.height }, underTopBar = true) {
                Eyebrow(AccountCopy.PAYWALL_EYEBROW)
                Text(
                    AccountCopy.PAYWALL_TITLE,
                    modifier = Modifier.semantics { heading() },
                    style = ThesisType.capped(ThesisType.display),
                    color = LocalThesisPalette.current.ink,
                )
                Text(AccountCopy.PAYWALL_PROMISE, style = ThesisType.heroLine, color = LocalThesisPalette.current.ink)
            }
            Column(
                Modifier
                    .widthIn(max = ThesisSpace.contentMaxWidth)
                    .fillMaxWidth()
                    .padding(horizontal = ThesisSpace.gutter)
                    .padding(top = ThesisSpace.xxl, bottom = ThesisSpace.x3),
                verticalArrangement = Arrangement.spacedBy(ThesisSpace.x3),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    Kicker(AccountCopy.PAYWALL_ADDS, modifier = Modifier.semantics { heading() })
                    AccountCopy.PRO_ADDS.forEach { line -> BenefitLine(line) }
                }

                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    Kicker(AccountCopy.PAYWALL_PLANS, modifier = Modifier.semantics { heading() })
                    when {
                        !billingEnabled -> Text(AccountCopy.PAYWALL_UNAVAILABLE, style = ThesisType.body, color = p.ink2)
                        offers.isEmpty() && offersStalled -> InlineBanner(
                            text = AccountCopy.PAYWALL_PLANS_STALLED,
                            tone = BannerTone.Error,
                            actionLabel = AccountCopy.PAYWALL_PLANS_RETRY,
                            onAction = {
                                onRefreshOffers()
                                offersAttempt++
                            },
                        )
                        offers.isEmpty() -> {
                            SkeletonCard(bodyLines = 1)
                            SkeletonCard(bodyLines = 1)
                        }
                        else -> {
                            yearly?.let { offer ->
                                PlanCard(
                                    name = AccountCopy.PAYWALL_YEARLY,
                                    price = offer.price,
                                    period = AccountCopy.PAYWALL_PER_YEAR,
                                    selected = selected == offer,
                                    onSelect = { choice = PACKAGE_ANNUAL },
                                    saving = saving?.let { AccountCopy.paywallSaving(Fmt.pct(it.toDouble(), dp = 0)) },
                                )
                            }
                            monthly?.let { offer ->
                                PlanCard(
                                    name = AccountCopy.PAYWALL_MONTHLY,
                                    price = offer.price,
                                    period = AccountCopy.PAYWALL_PER_MONTH,
                                    selected = selected == offer,
                                    onSelect = { choice = PACKAGE_MONTHLY },
                                )
                            }
                        }
                    }
                }

                // After the plans, so the first screen reaches the Yearly price (412 x 915 dp): the example shows what
                // "what changed" looks like for whoever reads on before choosing.
                ThesisCard(
                    eyebrow = if (alert == null) AccountCopy.PAYWALL_ALERT_SAMPLE else AccountCopy.PAYWALL_ALERT_YOURS,
                    title = alert?.title?.let(AccountCopy::keepFormsTogether) ?: AccountCopy.PAYWALL_SAMPLE_TITLE,
                    footer = CardFooter(source = AccountCopy.PAYWALL_ALERT_FOOT),
                ) {
                    Text(alert?.body?.let(AccountCopy::keepFormsTogether) ?: AccountCopy.PAYWALL_SAMPLE_BODY, style = ThesisType.body, color = p.ink2)
                }

                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                    // With the store's terms, on the text edge (T4): below the plans it sat on the first screen's
                    // fold, cut by the RunBar's top edge at 412 x 915 dp.
                    if (billingEnabled) TextAction(AccountCopy.PAYWALL_RESTORE, onRestore, enabled = !actionInFlight)
                    Text(AccountCopy.PAYWALL_LEGAL, style = ThesisType.caption, color = p.muted)
                    if (apiBaseUrl != null) LegalLinks(apiBaseUrl = apiBaseUrl)
                }
            }
            // The RunBar (when shown) already sits above the navigation bar; otherwise clear it here.
            Spacer(Modifier.height(scaffold.calculateBottomPadding()))
            if (selected == null) Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.safeDrawing))
        }
    }
}

/**
 * One "What Pro adds" line: a check (ink2) and a plain sentence. The check is the 20 dp symbol at its own optical
 * size (at 16 dp its strokes thinned to hairlines) and sits centred on the sentence's first line, whatever the font
 * scale: its box is one body line tall.
 */
@Composable
private fun BenefitLine(text: String) {
    val p = LocalThesisPalette.current
    val firstLine = with(LocalDensity.current) { ThesisType.body.lineHeight.toDp() }
    Row(verticalAlignment = Alignment.Top) {
        Box(Modifier.height(firstLine), contentAlignment = Alignment.Center) {
            Icon(
                ThesisIcons.Small.Check,
                contentDescription = null,
                modifier = Modifier.size(ThesisSpace.iconM),
                tint = p.ink2,
            )
        }
        Spacer(Modifier.width(ThesisSpace.s))
        Text(text, style = ThesisType.body, color = p.ink)
    }
}

/**
 * Whole-percent saving of [yearly] against twelve months of [monthly], from the store's formatted prices
 * ("$7.99", "7,99 €", "1.299,00 kr"). Null when either price cannot be read or the saving is not in 1..95 %:
 * nothing is shown rather than a guess.
 */
fun yearlySavingPercent(monthly: String, yearly: String): Int? {
    val m = parseStorePrice(monthly) ?: return null
    val y = parseStorePrice(yearly) ?: return null
    if (m <= 0.0 || y <= 0.0) return null
    val percent = ((1.0 - y / (m * 12.0)) * 100.0).roundToInt()
    return percent.takeIf { it in 1..95 }
}

/** The amount in a store's formatted price, whatever its currency sign and separators; null when there is none. */
fun parseStorePrice(price: String): Double? {
    val token = Regex("""\d[\d.,   ]*""").find(price)?.value?.trim() ?: return null
    val digits = token.filter { it.isDigit() || it == '.' || it == ',' }
    val lastDot = digits.lastIndexOf('.')
    val lastComma = digits.lastIndexOf(',')
    val decimalAt = maxOf(lastDot, lastComma)
    // A separator followed by exactly three digits with no other kind of separator is a thousands separator.
    val decimals = if (decimalAt >= 0) digits.length - decimalAt - 1 else 0
    val onlyOneKind = lastDot < 0 || lastComma < 0
    val isDecimal = decimalAt >= 0 && !(onlyOneKind && decimals == 3)
    val normalised = if (isDecimal) {
        digits.substring(0, decimalAt).filter { it.isDigit() } + "." + digits.substring(decimalAt + 1)
    } else {
        digits.filter { it.isDigit() }
    }
    return normalised.toDoubleOrNull()
}
