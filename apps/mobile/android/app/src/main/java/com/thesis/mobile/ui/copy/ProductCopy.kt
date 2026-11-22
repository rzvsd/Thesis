package com.thesis.mobile.ui.copy

/**
 * Consumer-facing product claims. Keep every value true for the live product:
 * change it here when coverage or tier limits change.
 */
object ProductCopy {
    /** Live Deep Dive coverage. */
    const val coverage = "S&P 500 companies"
    const val deepDiveTagline = "Evidence-backed research on $coverage"

    /** Watchlist limits per tier. The server profile value wins once it is loaded. */
    const val freeWatchlistLimit = 5
    const val proWatchlistLimit = 20
}
