package com.thesis.mobile.ui.copy

import com.thesis.mobile.ui.format.Fmt

/**
 * Copy of the account and entry screens (WP-G, DESIGN-DIRECTION 5.2 to 5.4, 5.22, 5.23): Onboarding, Auth,
 * Password reset, You and the Paywall. Sentence case, product vocabulary, typographic apostrophes (U+2019), no
 * advice words (SPEC section 4). Numbers and dates are formatted by the screens through `Fmt`.
 */
object AccountCopy {

    // ---- Shared ------------------------------------------------------------------------------------------------

    const val BRAND = "Thesis"
    const val DISCLAIMER = "Thesis is a research tool, not financial advice."
    const val LEGAL_LEAD = "By creating an account or logging in, you agree to the"
    const val TERMS = "Terms of Service"
    const val PRIVACY = "Privacy Policy"
    const val PASSWORD_RULE = "At least $PASSWORD_MIN_LENGTH characters"

    // ---- Onboarding (5.2) ----------------------------------------------------------------------------------------

    const val ONBOARDING_CONTINUE = "Continue"
    const val ONBOARDING_START = "Get started"
    const val ONBOARDING_SKIP = "Skip"

    const val ONBOARDING_DESK_EYEBROW = "Thesis"
    const val ONBOARDING_DESK_TITLE = "A private research desk"
    const val ONBOARDING_DESK_LEDE = "Company research from SEC filings, written plainly, for the names you own and watch."

    const val ONBOARDING_PULSE_EYEBROW = "Pulse"
    const val ONBOARDING_PULSE_TITLE = "Know what changed before the open"
    const val ONBOARDING_PULSE_LEDE = "Each morning: how markets closed, what moved, and what your names filed overnight."
    const val ONBOARDING_PULSE_FRAGMENT_EYEBROW = "The morning line"
    const val ONBOARDING_PULSE_FRAGMENT =
        "Stocks rose for a third day as yields eased, and two of your names filed overnight."

    const val ONBOARDING_DIVE_EYEBROW = "Deep Dive"
    const val ONBOARDING_DIVE_TITLE = "One report for every filing"
    const val ONBOARDING_DIVE_LEDE = "Every 10-K and 10-Q from ${ProductCopy.coverage}, read in chapters, with the " +
        "filing\u2019s own figures beside each finding."
    const val ONBOARDING_DIVE_CHAPTER = "Business"
    const val ONBOARDING_DIVE_CHAPTER_TITLE = "How Apple makes money"
    const val ONBOARDING_DIVE_CHAPTER_LEAD = "Services carry the margin."
    const val ONBOARDING_DIVE_CHAPTER_REST = "iPhone is still half of revenue; services earn about twice the gross " +
        "margin of hardware."

    const val ONBOARDING_NAMES_EYEBROW = "Your names"
    const val ONBOARDING_NAMES_TITLE = "Follow what you own and watch"
    const val ONBOARDING_NAMES_LEDE = "Follow ${ProductCopy.freeWatchlistLimit} names free, up to " +
        "${ProductCopy.proWatchlistLimit} with Pro. Each one shows whether its thesis still holds up."
    const val ONBOARDING_NAMES_FRAGMENT_DESCRIPTION =
        "Example: Apple, thesis intact, score 72. Nvidia, thesis moved from intact to watch, score 58."

    const val ONBOARDING_ADVICE_EYEBROW = "Before you start"
    const val ONBOARDING_ADVICE_TITLE = "Research, not advice"
    const val ONBOARDING_ADVICE_LEDE = "Thesis explains what companies report and how it changed. Decisions stay " +
        "with you, and your notes stay on this device until you export them."

    // ---- Auth (5.3) ----------------------------------------------------------------------------------------------

    const val AUTH_TAGLINE = "Company research from SEC filings, written plainly."
    const val AUTH_MODE_LOG_IN = "Log in"
    const val AUTH_MODE_CREATE = "Create account"
    const val EMAIL = "Email"
    const val EMAIL_PLACEHOLDER = "you@example.com"
    const val PASSWORD = "Password"
    const val LOG_IN = "Log in"
    const val CREATE_ACCOUNT = "Create account"
    const val FORGOT_PASSWORD = "Forgot password?"
    const val VERIFY_KICKER = "Verify your email"
    const val VERIFY_CODE = "Code from the email"
    const val VERIFY = "Verify email"
    const val VERIFY_OTHER_EMAIL = "Use another email"
    const val CONFIGURE_API = "Configure API"
    const val API_BASE_URL = "API base URL"
    const val SAVE_API_URL = "Save URL"

    fun verifyLede(email: String): String =
        if (email.isBlank()) "Enter the code we sent to your email to finish creating your account."
        else "Enter the code we sent to $email to finish creating your account."

    // Status lines (AuthStatus): the ViewModel's results, reworded.
    const val STATUS_VERIFICATION_SENT = "Your account is created. Enter the code from the email to verify it."
    const val STATUS_VERIFIED = "Your email is verified. Log in to continue."
    const val STATUS_PASSWORD_CHANGED = "Your password is changed. Log in with the new one."
    const val STATUS_SIGNED_OUT = "You’re logged out."
    const val STATUS_SESSION_EXPIRED = "Your session ended. Log in again."
    const val STATUS_ACCOUNT_DELETED = "Your account is deleted."
    const val STATUS_API_SAVED = "API base URL saved."

    // ---- Password reset (5.4) ------------------------------------------------------------------------------------

    const val RESET_TITLE = "Reset your password"
    const val RESET_STEP_EMAIL = "Step 1 of 2"
    const val RESET_STEP_CODE = "Step 2 of 2"
    const val RESET_DECK_EMAIL = "Enter your account email and we’ll send you a reset code."
    const val RESET_SEND = "Send reset code"
    const val RESET_CODE = "Reset code"
    const val RESET_NEW_PASSWORD = "New password"
    const val RESET_SET = "Set new password"
    const val RESET_SEND_AGAIN = "Send a new code"
    const val RESET_LONG_ENOUGH = "Long enough"

    fun resetDeckCode(email: String): String = "Enter the code we sent to ${email.trim()} and choose a new password."

    /** Live helper under the new password: the rule, then how many characters are still missing. */
    fun passwordHelper(length: Int): String = when {
        length <= 0 -> PASSWORD_RULE
        length < PASSWORD_MIN_LENGTH -> "$PASSWORD_RULE, ${PASSWORD_MIN_LENGTH - length} to go"
        else -> RESET_LONG_ENOUGH
    }

    // ---- You / Settings (5.22) -----------------------------------------------------------------------------------

    const val YOU_TITLE = "You"
    const val PLAN_FREE = "Free plan"
    const val PLAN_PRO = "Pro plan"

    const val SECTION_APPEARANCE = "Appearance"
    const val THEME = "Theme"
    val THEME_OPTIONS = listOf("Auto", "Light", "Dark")
    const val UP_DOWN = "Up and down colours"
    val UP_DOWN_OPTIONS = listOf("Classic", "Colour-blind")
    const val UP_DOWN_CLASSIC_SUB = "Green for up, red for down"
    const val UP_DOWN_COLOUR_BLIND_SUB = "Blue for up, clay for down"
    const val UP_DOWN_TOGGLE = "Colour-blind colours"
    const val REDUCE_MOTION = "Reduce motion"
    const val REDUCE_MOTION_SUB = "Also on when the system turns animations off"

    const val SECTION_NOTIFICATIONS = "Notifications"
    const val NOTIFICATIONS_MASTER = "Notifications"
    const val NOTIFICATIONS_MASTER_SUB = "Filing changes, earnings and your morning Pulse"
    const val NOTIFICATIONS_OFF_SUB = "Applies when notifications are on"
    const val SYSTEM_NOTIFICATIONS = "System notification settings"
    const val SYSTEM_NOTIFICATIONS_SUB = "Sound, badges and the lock screen"

    fun quietUntil(formatted: String): String = "Quiet until $formatted"

    const val SECTION_SECURITY = "Security"
    const val APP_LOCK = "App lock"
    const val APP_LOCK_SUB = "Asks for your fingerprint after 5 minutes away"

    const val SECTION_PORTFOLIO = "Portfolio"
    const val IMPORT_HOLDINGS = "Import holdings"
    const val IMPORT_HOLDINGS_SUB = "Follow the names in a CSV file"

    const val SECTION_NOTES = "Your notes"
    const val EXPORT_NOTES = "Export my notes"
    const val NOTES_NONE = "None yet"
    const val NOTES_NONE_SUB = "Notes you write on a report can be exported here as a Markdown file"

    fun exportNotesSub(notes: Int, names: Int): String =
        "${Fmt.count(notes, "note", "notes")} on ${Fmt.count(names, "name", "names")}, as a Markdown file"

    const val SECTION_SUBSCRIPTION = "Subscription"
    const val PLAN = "Plan"
    const val PLAN_VALUE_FREE = "Free"
    const val PLAN_VALUE_PRO = "Pro"
    const val DEEP_DIVES_TODAY = "Deep Dives today"
    const val UNLIMITED = "Unlimited"
    const val NAMES_LIMIT = "Names you can follow"
    const val SEE_PRO = "See Pro"
    const val SEE_PRO_SUB = "Follow up to ${ProductCopy.proWatchlistLimit} names and read what changed in every filing"
    const val MANAGE_SUBSCRIPTION = "Manage subscription"
    const val MANAGE_SUBSCRIPTION_SUB = "In Google Play"
    const val RESTORE_PURCHASES = "Restore purchases"
    const val REFRESH_PLAN = "Refresh plan status"
    const val GOOGLE_PLAY_SUBSCRIPTIONS = "https://play.google.com/store/account/subscriptions"

    fun deepDivesLeft(left: Int, limit: Int): String = "$left of $limit left"
    fun periodEnds(date: String): String = "Current period ends $date"

    const val FEEDBACK = "Thinking of cancelling?"
    const val FEEDBACK_SUB = "Tell us why, so Pro gets better"
    val FEEDBACK_FLOWS = listOf("Cancel", "Downgrade")
    const val FEEDBACK_MESSAGE = "Anything else (optional)"
    const val FEEDBACK_SEND = "Send feedback"

    /** Reason codes the API accepts, with their labels. */
    val FEEDBACK_REASONS = listOf(
        "cancel_price" to "Price",
        "cancel_low_value" to "Not enough value",
        "cancel_too_noisy" to "Too many alerts",
        "cancel_other" to "Something else",
    )

    const val SECTION_REVIEW = "Monthly review"
    const val REVIEW_PRO_TITLE = "Your monthly review is part of Pro"
    const val REVIEW_PRO_BODY = "Once a month, patterns across your names: overlap, contradictions, and conviction the evidence no longer carries."
    const val REVIEW_EMPTY = "Your first monthly review is not ready yet."
    const val REVIEW_EMPTY_HOW = "It appears after a month of following names."
    const val REVIEW_REFRESH = "Refresh"

    const val SECTION_LEGAL = "Help and legal"
    const val LICENCES = "Open-source licences"
    const val LICENCES_SUB = "Newsreader typeface, SIL Open Font License 1.1"

    const val SECTION_ACCOUNT = "Account"
    const val LOG_OUT = "Log out"

    const val SECTION_DEVELOPER = "Developer"

    /** Sentence-case label of a notification family (the API's type key). */
    fun notificationFamily(type: String): String = when (type) {
        "earnings_preview" -> "Earnings preview"
        "contrarian_alert" -> "Thesis drift"
        "kill_switch" -> "Kill switch"
        "freshness_decay" -> "Report freshness"
        "morning_exception_briefing" -> "Morning briefing"
        "earnings_war_room" -> "War Room"
        "weekly_digest" -> "Weekly digest"
        "market_pulse_ready" -> "Pulse ready"
        "pulse_email" -> "Pulse by email"
        else -> type.replace('_', ' ').trim().lowercase().replaceFirstChar { it.titlecase() }
    }

    // ---- Delete account (5.22) -----------------------------------------------------------------------------------

    const val DELETE_ACCOUNT = "Delete account"
    const val DELETE_TITLE = "Delete your account?"
    const val DELETE_BODY = "This permanently deletes your account, names, notes, alerts, devices and all other " +
        "personal data. It can’t be undone."
    const val DELETE_PLAY_NOTE = "Deleting your account does not cancel a Google Play subscription. Cancel it in " +
        "Google Play, under Payments and subscriptions."
    const val DELETE_CONFIRM_WORD = "DELETE"
    const val DELETE_CONFIRM_LABEL = "Type $DELETE_CONFIRM_WORD to confirm"
    const val DELETE_CONFIRM = "Delete permanently"
    const val DELETE_CANCEL = "Cancel"

    // ---- Paywall (5.23) ------------------------------------------------------------------------------------------

    const val PAYWALL_EYEBROW = "Thesis Pro"
    const val PAYWALL_TITLE = "Read deeper"
    const val PAYWALL_PROMISE = "Know what changed in every filing of every name you follow."
    const val PAYWALL_ALERT_YOURS = "Your filing alert"
    const val PAYWALL_ALERT_SAMPLE = "Example filing alert"
    const val PAYWALL_SAMPLE_TITLE = "AAPL filed its 10-Q"
    const val PAYWALL_SAMPLE_BODY = "3 things changed since the last Deep Dive."
    const val PAYWALL_ALERT_FOOT = "What changed is in Pro"
    const val PAYWALL_ADDS = "What Pro adds"
    const val PAYWALL_PLANS = "Choose a plan"
    const val PAYWALL_YEARLY = "Yearly"
    const val PAYWALL_MONTHLY = "Monthly"
    const val PAYWALL_PER_YEAR = "per year"
    const val PAYWALL_PER_MONTH = "per month"
    const val PAYWALL_CONTINUE = "Continue"
    const val PAYWALL_RESTORE = "Restore purchases"
    const val PAYWALL_UNAVAILABLE = "Subscriptions are not available in this build."
    const val PAYWALL_LEGAL = "Billed through Google Play. Renews automatically until you cancel in Google Play, under " +
        "Payments and subscriptions."

    fun paywallSaving(percent: String): String = "Saves $percent vs monthly"

    /** What Pro adds. Keep in step with the API tier rules (product-api watchlistLimitForTier and the Pro gates). */
    val PRO_ADDS = listOf(
        "Follow up to ${ProductCopy.proWatchlistLimit} names (Free: ${ProductCopy.freeWatchlistLimit})",
        "The full “what changed” on every filing alert, by push and email",
        "Earnings War Room for the names you follow",
        "Scenario Stress, What-If, Opposite Case and the conviction timeline",
        "PDF and investment memo export",
    )
}

/** The password rule of Password reset (and the API): at least this many characters. */
const val PASSWORD_MIN_LENGTH = 10
