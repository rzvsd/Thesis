package com.thesis.mobile.ui.copy

/**
 * The ViewModel's user-facing messages (snackbars, and the text the Auth and Report screens show for a result), in
 * product vocabulary (rubric C1): Names, not watchlist; Log in, not login; no ISO dates, no internal ids or flags.
 * Living here puts them under tools/design-lint.sh's copy pass.
 *
 * A message is for something the reader needs to know or do. Success chatter ("Loaded report from history.", "War
 * Room loaded.", "Login successful.") is not sent: the page arriving is the feedback (2.9).
 */
object AppMessages {
    // ---- Account. The first sentence of each is what AuthStatus.fromMessage matches on (keep them in step).
    const val API_SAVED = "API base URL saved."
    const val REGISTERED = "Registration created. Verify your account to continue."
    const val VERIFIED = "Account verified. You can log in now."
    const val PASSWORD_RESET = "Password reset successful. Log in with your new password."
    const val LOGGED_OUT = "Logged out."
    const val ACCOUNT_DELETED = "Account deleted successfully."
    const val SESSION_EXPIRED = "Session expired. Please log in again."
    const val BIOMETRIC_UNAVAILABLE = "Fingerprint and face unlock are not set up on this device."
    const val NOTIFICATIONS_SAVED = "Notification settings saved."

    // ---- Notes and feedback
    const val OPEN_REPORT_FOR_NOTE = "Open a report to write a note on it."
    const val OPEN_REPORT_FOR_FEEDBACK = "Open a report to send feedback on it."
    const val FEEDBACK_SENT = "Thanks for the feedback."
    const val ALERT_FEEDBACK_SAVED = "Feedback on this alert saved."

    // ---- Report tools
    const val OPEN_REPORT_FOR_SCENARIO = "Open a report to run a scenario on it."
    const val CHOOSE_SCENARIO = "Choose a scenario first."
    const val SCENARIO_RUN_MISSING = "That scenario run could not be found."
    const val OPEN_REPORT_FOR_OPPOSITE_CASE = "Open a report to build its opposite case."
    const val OPPOSITE_CASE_NONE = "No opposite case built yet."
    const val OPPOSITE_CASE_OFFLINE = "The opposite case needs a connection."
    const val CONVICTION_OFFLINE = "Conviction history needs a connection."
    const val REPORT_OFFLINE = "You're offline. Showing your saved copy of this report."
    const val OPEN_WAR_ROOM_FIRST = "Open a War Room first."

    // ---- Research
    const val ENTER_TICKER = "Enter a ticker first."
    const val DEEP_DIVE_READY = "Deep Dive ready."
    const val DEEP_DIVE_FAILED = "The Deep Dive could not be built."
    const val DEEP_DIVE_TIMED_OUT = "The Deep Dive took too long. Try again."
    const val REPORTS_NOT_LOADED = "One of the reports could not be loaded."

    // ---- Pulse
    const val PULSE_DATE_UNREADABLE = "That Pulse date could not be read."
    const val PULSE_PDF_FAILED = "The Pulse PDF could not be made."

    // ---- Names
    const val NAMES_OFF = "Names are not available on this account right now."
    const val IMPORT_FAILED = "The import did not finish."

    // ---- Plan
    const val PURCHASES_UNAVAILABLE = "Purchases are not available in this version of the app."
    const val NO_PLAN_OFFERED = "No plan is on offer right now."
    const val PURCHASE_DONE = "Purchase complete. Pro is on."
    const val PURCHASES_RESTORED = "Purchases restored."

    // ---- Errors with no better text from the API
    const val NO_CONNECTION = "No connection. Check your network and try again."
    const val UNEXPECTED = "Something went wrong. Try again."
}
