package com.thesis.mobile.ui.screens

import com.thesis.mobile.ui.copy.AccountCopy

/**
 * The status line under the Auth form (DESIGN-DIRECTION 5.3): a typed result, so the screen never guesses tone or
 * mode from words in a message.
 *
 * The ViewModel still publishes plain `message` strings; [fromMessage] maps its known results (the exact sentences
 * `MainViewModel` writes) to a [Kind] and keeps everything else as a [Kind.Failed] with the message as written (the
 * API's error text). WP-INT is asked to publish an [AuthStatus] directly (HANDOFF-G), after which [fromMessage]
 * goes.
 */
data class AuthStatus(val kind: Kind, val text: String) {

    enum class Kind {
        /** Registration created: the verify step opens. */
        VerificationSent,

        /** The code was accepted: back to Log in. */
        Verified,

        /** Password reset done: back to Log in. */
        PasswordChanged,
        SignedOut,
        SessionExpired,
        AccountDeleted,
        ApiSaved,

        /** Anything else: an error from the API or the network, shown as written. */
        Failed,
    }

    enum class Tone { Neutral, Success, Error }

    val tone: Tone
        get() = when (kind) {
            Kind.Failed -> Tone.Error
            Kind.SessionExpired, Kind.SignedOut, Kind.ApiSaved -> Tone.Neutral
            else -> Tone.Success
        }

    /** The status asks the screen to show the Log in form (verified, password changed, signed out ...). */
    val opensLogIn: Boolean
        get() = kind != Kind.Failed && kind != Kind.VerificationSent && kind != Kind.ApiSaved

    companion object {
        /** Known `MainViewModel` results, by the sentence each message starts with. */
        private val Known = listOf(
            "Registration created." to Kind.VerificationSent,
            "Account verified." to Kind.Verified,
            "Password reset successful." to Kind.PasswordChanged,
            "Logged out." to Kind.SignedOut,
            "Session expired." to Kind.SessionExpired,
            "Account deleted successfully." to Kind.AccountDeleted,
            "API base URL saved." to Kind.ApiSaved,
        )

        /** Successful log-in: the app leaves Auth, so nothing is shown. */
        private const val LOGIN_SUCCESS = "Login successful."

        fun fromMessage(message: String?): AuthStatus? {
            val raw = message?.trim().orEmpty()
            if (raw.isEmpty() || raw.startsWith(LOGIN_SUCCESS)) return null
            val (prefix, kind) = Known.firstOrNull { (prefix, _) -> raw.startsWith(prefix) } ?: return AuthStatus(Kind.Failed, raw)
            // Account deletion appends the store's notice (a Google Play subscription is not cancelled): keep it.
            val rest = raw.removePrefix(prefix).trim()
            val text = when (kind) {
                Kind.VerificationSent -> AccountCopy.STATUS_VERIFICATION_SENT
                Kind.Verified -> AccountCopy.STATUS_VERIFIED
                Kind.PasswordChanged -> AccountCopy.STATUS_PASSWORD_CHANGED
                Kind.SignedOut -> AccountCopy.STATUS_SIGNED_OUT
                Kind.SessionExpired -> AccountCopy.STATUS_SESSION_EXPIRED
                Kind.AccountDeleted -> listOf(AccountCopy.STATUS_ACCOUNT_DELETED, rest).filter { it.isNotEmpty() }.joinToString(" ")
                Kind.ApiSaved -> AccountCopy.STATUS_API_SAVED
                Kind.Failed -> raw
            }
            return AuthStatus(kind, text)
        }
    }
}
