package com.thesis.mobile.ui.copy

/**
 * Empty and error state copy of the screens that used the old empty-state family (EmptyStateView.kt, retired in
 * the PR-1 integration). The screens now call the kit's `EmptyState` / `ErrorState` (section 3 #25, #26) with these
 * strings; each screen WP may move its entries into its own copy file in PR-3. Typographic apostrophes (U+2019).
 */
object StateCopy {
    /** Today with no pulse yet. */
    const val NO_PULSE = "No pulse yet."
    const val NO_PULSE_HOW = "Your pulse arrives each morning before the open. Check back then, or explore a company now."
    const val NO_PULSE_ACTION = "Run a Deep Dive"

    /** Research with no report opened yet. */
    const val NO_REPORTS = "No Deep Dives yet."
    val noReportsHow: String = "Search a ticker and open an evidence-backed report. Coverage: ${ProductCopy.coverage}."

    /** Today or Names with no followed names. */
    const val NO_NAMES = "No names yet."
    val noNamesHow: String = "Names you follow appear across Thesis in your morning pulse and company research. " +
        "Follow ${ProductCopy.freeWatchlistLimit} free, up to ${ProductCopy.proWatchlistLimit} with Pro."
    const val NO_NAMES_ACTION = "Add your first name"

    /** No connection. */
    const val OFFLINE_TITLE = "You’re offline"
    const val OFFLINE_CAUSE = "Reports you’ve already opened are still available. We’ll sync again when you reconnect."

    /** Today's pulse failed to load. */
    val pulseUnavailable: String = KitCopy.couldNotLoad("today’s pulse")

    /** A Deep Dive failed to open or build. */
    val deepDiveUnavailable: String = KitCopy.couldNotLoad("this Deep Dive")
}
