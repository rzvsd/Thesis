package com.thesis.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.ProductCopy
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.theme.ThesisSpace

/*
 * The old empty-state family, kept as thin wrappers over the kit's EmptyState and ErrorState (section 3 #25, #26)
 * so HomeScreen and DeepDiveScreen keep compiling until their WPs move to the kit in PR-3. Sentence case, no
 * gradients, no tinted icon discs.
 */

private const val MIGRATE = "Use EmptyState or ErrorState from the kit (section 3 #25, #26)."

@Deprecated(MIGRATE)
@Composable
fun NoPulseEmptyState(onRunDeepDive: () -> Unit, modifier: Modifier = Modifier) {
    EmptyState(
        sentence = "No pulse yet.",
        how = "Your pulse arrives each morning before the open. Check back then, or explore a company now.",
        icon = ThesisIcons.Pulse,
        actionLabel = "Run a Deep Dive",
        onAction = onRunDeepDive,
        modifier = modifier,
    )
}

@Deprecated(MIGRATE)
@Composable
fun NoDeepDivesEmptyState(modifier: Modifier = Modifier, actionContent: @Composable () -> Unit = {}) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        EmptyState(
            sentence = "No Deep Dives yet.",
            how = "Search a ticker and open an evidence-backed report. Coverage: ${ProductCopy.coverage}.",
            icon = ThesisIcons.Search,
        )
        actionContent()
    }
}

@Deprecated(MIGRATE)
@Composable
fun NoNamesEmptyState(onAddName: () -> Unit, modifier: Modifier = Modifier) {
    EmptyState(
        sentence = "No names yet.",
        how = "Names you follow appear across Thesis in your morning pulse and company research. " +
            "Follow ${ProductCopy.freeWatchlistLimit} free, up to ${ProductCopy.proWatchlistLimit} with Pro.",
        icon = ThesisIcons.Names,
        actionLabel = "Add your first name",
        onAction = onAddName,
        primaryAction = true,
        modifier = modifier,
    )
}

@Deprecated(MIGRATE)
@Composable
fun OfflineEmptyState(modifier: Modifier = Modifier, onRetry: (() -> Unit)? = null) {
    ErrorState(
        title = "You\u2019re offline",
        cause = "Reports you\u2019ve already opened are still available. We\u2019ll sync again when you reconnect.",
        onRetry = onRetry,
        modifier = modifier,
    )
}

@Deprecated(MIGRATE)
@Composable
fun PulseUnavailableState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    ErrorState(
        title = KitCopy.couldNotLoad("today\u2019s pulse"),
        cause = message,
        retryLabel = KitCopy.TRY_AGAIN,
        onRetry = onRetry,
        modifier = modifier,
    )
}

@Deprecated(MIGRATE)
@Composable
fun DeepDiveUnavailableState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    ErrorState(
        title = KitCopy.couldNotLoad("this Deep Dive"),
        cause = message,
        retryLabel = KitCopy.TRY_AGAIN,
        onRetry = onRetry,
        modifier = modifier,
    )
}
