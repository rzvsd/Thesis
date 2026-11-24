package com.thesis.mobile.ui.navigation

/**
 * Where a notification tap or a `thesis://` link asked to go. Built by `MainActivity` (which keeps the
 * `com.thesis.mobile.LaunchTarget` name as a type alias) and routed by [DeepLinkRouter]. It lives here, not in
 * `MainActivity.kt`, so the routing is plain Kotlin that design-preview compiles and tests.
 *
 * [tab] strings are unchanged: "today", "names", "research", "inbox", "you".
 */
data class LaunchTarget(
    val tab: String,
    val alertId: String? = null,
    val reportId: String? = null,
    val warRoomId: String? = null,
    val scenarioId: String? = null,
    val scenarioRunId: String? = null,
    val pulseDate: String? = null,
    val digestDate: String? = null,
    val notificationType: String? = null,
    val ticker: String? = null,
    val requestId: Long = System.nanoTime()
)
