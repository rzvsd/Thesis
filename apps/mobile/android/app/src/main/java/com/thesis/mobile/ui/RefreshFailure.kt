package com.thesis.mobile.ui

import com.thesis.mobile.network.ProductApiException
import java.io.IOException

/**
 * Why a Today-tab refresh failed, so the app only says "offline" when the phone really is offline.
 * Before this, every failure (a timeout, a server error, a bug in the app) was shown as
 * "network is unavailable".
 */
enum class RefreshFailureKind {
    /** The request failed and the phone has no working connection. */
    OFFLINE,

    /** The phone is online but the request to the server failed (timeout, reset connection, DNS). */
    UNREACHABLE,

    /** The server answered with an error status. */
    SERVER,

    /** Something inside the app failed (parsing, caching, state). */
    APP
}

object RefreshFailure {
    private const val MAX_LOG_MESSAGE = 160

    fun classify(error: Throwable, deviceOnline: Boolean): RefreshFailureKind = when {
        error is IOException && !deviceOnline -> RefreshFailureKind.OFFLINE
        error is IOException -> RefreshFailureKind.UNREACHABLE
        error is ProductApiException -> RefreshFailureKind.SERVER
        else -> RefreshFailureKind.APP
    }

    fun cachedPulseMessage(kind: RefreshFailureKind): String = when (kind) {
        RefreshFailureKind.OFFLINE -> "You're offline. Showing your saved Pulse."
        RefreshFailureKind.UNREACHABLE -> "Couldn't reach Thesis just now. Showing your saved Pulse."
        RefreshFailureKind.SERVER,
        RefreshFailureKind.APP -> "Couldn't refresh Pulse just now. Showing your saved copy."
    }

    fun cachedMacroStressMessage(kind: RefreshFailureKind): String = when (kind) {
        RefreshFailureKind.OFFLINE -> "You're offline. Showing saved macro stress."
        RefreshFailureKind.UNREACHABLE -> "Couldn't reach Thesis just now. Showing saved macro stress."
        RefreshFailureKind.SERVER,
        RefreshFailureKind.APP -> "Couldn't refresh macro stress just now. Showing saved data."
    }

    /** Message when there is nothing saved to fall back to, or null to use the generic error text. */
    fun noCacheMessage(kind: RefreshFailureKind): String? = when (kind) {
        RefreshFailureKind.OFFLINE -> "You're offline. Connect to the internet and retry."
        RefreshFailureKind.UNREACHABLE -> "Couldn't reach Thesis just now. Please retry."
        RefreshFailureKind.SERVER,
        RefreshFailureKind.APP -> null
    }

    /**
     * One log line for logcat: the exception class, the failure kind and the first app stack frame.
     * The message is only kept for network and server errors (OkHttp and our API put no tokens or
     * user data there); for anything else it could hold response text, so it is left out.
     */
    fun logLine(area: String, error: Throwable, kind: RefreshFailureKind): String {
        val parts = mutableListOf("$area refresh failed", "kind=$kind", "error=${error.javaClass.name}")
        when (error) {
            is ProductApiException -> {
                parts += "http=${error.code}"
                error.errorCode?.let { parts += "code=${clean(it)}" }
            }
            is IOException -> error.message?.let { parts += "message=${clean(it)}" }
        }
        appFrame(error)?.let { parts += "at=$it" }
        error.cause?.let { parts += "cause=${it.javaClass.name}" }
        return parts.joinToString(" ")
    }

    private fun appFrame(error: Throwable): String? =
        error.stackTrace.firstOrNull { it.className.startsWith("com.thesis.") }
            ?.let { "${it.className.substringAfterLast('.')}.${it.methodName}:${it.lineNumber}" }

    private fun clean(text: String): String =
        text.replace(Regex("\\s+"), " ").trim().take(MAX_LOG_MESSAGE)
}
