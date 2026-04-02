package com.thesis.mobile.security

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.thesis.mobile.data.SessionStore

class AppLockManager(
    private val activity: FragmentActivity,
    private val sessionStore: SessionStore
) {
    private val biometricManager = BiometricManager.from(activity)
    private val authenticators =
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL

    fun isBiometricSupported(): Boolean =
        biometricManager.canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS

    fun shouldPromptForUnlock(hasAuthenticatedSession: Boolean): Boolean {
        if (!hasAuthenticatedSession) {
            return false
        }
        if (!sessionStore.isBiometricLockEnabled()) {
            return false
        }
        if (!isBiometricSupported()) {
            return false
        }
        val backgroundedAt = sessionStore.getAppBackgroundedAtMs()
        if (backgroundedAt <= 0L) {
            return false
        }
        return System.currentTimeMillis() - backgroundedAt >= LOCK_THRESHOLD_MS
    }

    fun clearBackgroundMarker() {
        sessionStore.saveAppBackgroundedAtMs(0L)
    }

    fun promptForUnlock(onResult: (Boolean) -> Unit) {
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onResult(true)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    onResult(false)
                }
            }
        )
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock Thesis")
            .setSubtitle("Confirm your identity to continue.")
            .setAllowedAuthenticators(authenticators)
            .build()
        prompt.authenticate(promptInfo)
    }

    companion object {
        const val LOCK_THRESHOLD_MS: Long = 5 * 60 * 1000L
    }
}
