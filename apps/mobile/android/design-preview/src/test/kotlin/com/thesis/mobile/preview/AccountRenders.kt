package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thesis.mobile.preview.fixtures.AccountFixtures
import com.thesis.mobile.ui.screens.AuthScreen
import com.thesis.mobile.ui.screens.DeleteAccountControl
import com.thesis.mobile.ui.screens.OnboardingScreen
import com.thesis.mobile.ui.screens.PAYWALL_OFFERS_WAIT_MILLIS
import com.thesis.mobile.ui.screens.PasswordResetContent
import com.thesis.mobile.ui.screens.PaywallScreen
import com.thesis.mobile.ui.shell.AppearancePrefs
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.UpDownScheme
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Account and entry renders (WP-G; DESIGN-DIRECTION 5.2 to 5.4, 5.22, 5.23): every state in dark and light, the A4
 * checks (1.3x, 2.0x, 360 dp), full-page captures of the scrolling screens and the reduced-motion first frame.
 * Run alone with `-Pscreens.only='^account'`.
 */
class AccountRenders {

    private fun render(
        name: String,
        widthDp: Int = PhoneSpec.WIDTH_DP,
        heightDp: Int = PhoneSpec.HEIGHT_DP,
        fontScale: Float = 1f,
        settleMs: Long = 1_500,
        reducedMotion: Boolean = false,
        upDown: UpDownScheme = UpDownScheme.Classic,
        content: @Composable () -> Unit,
    ) {
        val files = renderScreen(
            name,
            widthDp = widthDp,
            heightDp = heightDp,
            fontScale = fontScale,
            settleMs = settleMs,
            reducedMotion = reducedMotion,
            upDown = upDown,
        ) { AccountFixtures.WithFixedTime(content) }
        files.forEach { assertTrue("${it.name} was not written", it.isFile && it.length() > 0) }
    }

    // ---- Onboarding (5.2) -----------------------------------------------------------------------------------------

    @Test fun onboardingDesk() = render("account-onboarding-1-desk") { OnboardingScreen(onComplete = {}) }
    @Test fun onboardingPulse() = render("account-onboarding-2-pulse") { OnboardingScreen(onComplete = {}, initialPage = 1) }
    @Test fun onboardingDeepDive() = render("account-onboarding-3-deep-dive") { OnboardingScreen(onComplete = {}, initialPage = 2) }
    @Test fun onboardingNames() = render("account-onboarding-4-names") { OnboardingScreen(onComplete = {}, initialPage = 3) }
    @Test fun onboardingAdvice() = render("account-onboarding-5-advice") { OnboardingScreen(onComplete = {}, initialPage = 4) }

    @Test fun onboardingScale13() =
        render("account-onboarding-3-deep-dive-scale1.3", fontScale = 1.3f) { OnboardingScreen(onComplete = {}, initialPage = 2) }

    @Test fun onboardingScale20() =
        render("account-onboarding-4-names-scale2.0", fontScale = 2f) { OnboardingScreen(onComplete = {}, initialPage = 3) }

    @Test fun onboarding360Scale20() =
        render("account-onboarding-2-pulse-360-scale2.0", widthDp = PhoneSpec.NARROW_WIDTH_DP, fontScale = 2f) {
            OnboardingScreen(onComplete = {}, initialPage = 1)
        }

    /** Mid-cascade (120 ms in): the fragment is further along than the title, the lede has not started. */
    @Test fun onboardingCascade() = render("account-onboarding-1-cascade-120ms", settleMs = 120) { OnboardingScreen(onComplete = {}) }

    /** Reduced motion: the first frame is the settled page. */
    @Test fun onboardingReduced() =
        render("account-onboarding-1-reduced-first-frame", settleMs = 0, reducedMotion = true) { OnboardingScreen(onComplete = {}) }

    // ---- Auth (5.3) -----------------------------------------------------------------------------------------------

    @Composable
    private fun Auth(
        message: String? = null,
        registerStatus: String? = null,
        createMode: Boolean = false,
        showDeveloperOptions: Boolean = false,
    ) = AuthScreen(
        isLoading = false,
        currentApiBaseUrl = AccountFixtures.API,
        verificationToken = null,
        registerStatus = registerStatus,
        message = message,
        onSaveApiBaseUrl = {},
        onRegister = { _, _ -> },
        onVerify = { _, _ -> },
        onLogin = { _, _ -> },
        onForgotPassword = {},
        showDeveloperOptions = showDeveloperOptions,
        initialCreateMode = createMode,
    )

    @Test fun authLogIn() = render("account-auth-log-in") { Auth() }
    @Test fun authCreate() = render("account-auth-create") { Auth(createMode = true) }
    @Test fun authError() = render("account-auth-error") { Auth(message = "Invalid email or password") }
    @Test fun authVerify() = render("account-auth-verify") { Auth(message = "Registration created. Verify the code sent to you.", registerStatus = "created") }
    @Test fun authVerified() = render("account-auth-verified") { Auth(message = "Account verified. You can login now.") }
    @Test fun authDeveloper() = render("account-auth-developer", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP / 2) { Auth(showDeveloperOptions = true) }
    @Test fun authScale13() = render("account-auth-scale1.3", fontScale = 1.3f) { Auth() }
    @Test fun auth360Scale20() = render("account-auth-360-scale2.0", widthDp = PhoneSpec.NARROW_WIDTH_DP, fontScale = 2f) { Auth(createMode = true) }

    // ---- Password reset (5.4) -------------------------------------------------------------------------------------

    @Test fun resetEmail() = render("account-reset-1-email") {
        PasswordResetContent(onBack = {}, onRequestCode = { _, _ -> }, onConfirm = { _, _, _, _ -> }, initialEmail = AccountFixtures.EMAIL)
    }

    @Test fun resetCode() = render("account-reset-2-code") {
        PasswordResetContent(
            onBack = {}, onRequestCode = { _, _ -> }, onConfirm = { _, _, _, _ -> },
            initialEmail = AccountFixtures.EMAIL, initialCodeSent = true,
        )
    }

    @Test fun resetCode360Scale20() = render("account-reset-2-code-360-scale2.0", widthDp = PhoneSpec.NARROW_WIDTH_DP, fontScale = 2f) {
        PasswordResetContent(
            onBack = {}, onRequestCode = { _, _ -> }, onConfirm = { _, _, _, _ -> },
            initialEmail = AccountFixtures.EMAIL, initialCodeSent = true,
        )
    }

    // ---- You (5.22) -----------------------------------------------------------------------------------------------

    private val youPage = PhoneSpec.FULL_PAGE_HEIGHT_DP + PhoneSpec.FULL_PAGE_HEIGHT_DP / 3

    @Test fun youFree() = render("account-you-free") { AccountFixtures.You() }
    @Test fun youFreeFullPage() = render("account-you-free-full", heightDp = youPage) { AccountFixtures.You() }
    @Test fun youProFullPage() = render("account-you-pro-full", heightDp = youPage) { AccountFixtures.You(pro = true, showDeveloperOptions = true) }

    /**
     * The settings drive the palette (5.22): each render runs in the opposite harness theme, and the frame follows
     * the selected Theme segment instead (file suffix = the harness theme it overrides). Colour-blind switches the
     * swatches to blue and clay; reduce motion is on in that one, and the theme around it runs reduced.
     */
    private fun youSetting(name: String, harness: PreviewTheme, prefs: AppearancePrefs) {
        val files = renderScreen(name, themes = listOf(harness)) { AccountFixtures.WithFixedTime { AccountFixtures.YouWithAppearance(prefs) } }
        files.forEach { assertTrue("${it.name} was not written", it.isFile && it.length() > 0) }
    }

    @Test fun youSetLight() = youSetting("account-you-set-light-from", PreviewTheme.DARK, AppearancePrefs(themeMode = ThemeMode.Light))
    @Test fun youSetDark() = youSetting("account-you-set-dark-from", PreviewTheme.LIGHT, AppearancePrefs(themeMode = ThemeMode.Dark))
    @Test fun youSetColourBlind() = youSetting(
        "account-you-set-light-colour-blind-from",
        PreviewTheme.DARK,
        AppearancePrefs(themeMode = ThemeMode.Light, upDown = UpDownScheme.ColourBlind, reduceMotion = true),
    )

    @Test fun youNotificationsOff() = render("account-you-notifications-off") {
        AccountFixtures.You(notificationsEnabled = false, notesList = emptyList())
    }

    @Test fun youScale13() = render("account-you-scale1.3", fontScale = 1.3f) { AccountFixtures.You() }

    @Test fun you360Scale20() =
        render("account-you-360-scale2.0-full", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = youPage * 2, fontScale = 2f) {
            AccountFixtures.You(pro = true)
        }

    @Test fun deleteDialog() = render("account-delete-dialog") {
        Box(Modifier.fillMaxSize().padding(ThesisSpace.gutter)) { DeleteAccountControl(onDelete = {}, initiallyOpen = true) }
    }

    @Test fun deleteDialogConfirmed() = render("account-delete-dialog-typed") {
        Box(Modifier.fillMaxSize().padding(ThesisSpace.gutter)) {
            DeleteAccountControl(onDelete = {}, initiallyOpen = true, initialConfirmText = "DELETE")
        }
    }

    @Test fun deleteDialog360Scale20() = render("account-delete-dialog-360-scale2.0", widthDp = PhoneSpec.NARROW_WIDTH_DP, fontScale = 2f) {
        Box(Modifier.fillMaxSize().padding(ThesisSpace.gutter)) { DeleteAccountControl(onDelete = {}, initiallyOpen = true) }
    }

    // ---- Paywall (5.23) -------------------------------------------------------------------------------------------

    @Composable
    private fun Paywall(
        billing: Boolean = true,
        offers: Boolean = true,
        ownAlert: Boolean = false,
        inFlight: Boolean = false,
        waitMillis: Long = PAYWALL_OFFERS_WAIT_MILLIS,
    ) = PaywallScreen(
        alerts = if (ownAlert) listOf(AccountFixtures.filingAlert) else emptyList(),
        watchlist = listOf("NVDA", "AAPL"),
        offers = if (offers) AccountFixtures.offers else emptyList(),
        actionInFlight = inFlight,
        onPurchase = {},
        onRestore = {},
        onRefreshOffers = {},
        onDismiss = {},
        apiBaseUrl = AccountFixtures.API,
        billingEnabled = billing,
        offersWaitMillis = waitMillis,
    )

    @Test fun paywallPlans() = render("account-paywall-plans") { Paywall() }
    @Test fun paywallPlansFull() = render("account-paywall-plans-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Paywall(ownAlert = true) }
    @Test fun paywallLoading() = render("account-paywall-loading-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Paywall(offers = false) }

    /**
     * No plans after the wait: the skeletons give way to an error banner with Try again. The wait is a real-time
     * timeout the harness's virtual frame clock never reaches, so the render waits zero: `withTimeoutOrNull(0)`
     * gives up at once and the first settled frame is the stalled state.
     */
    @Test fun paywallStalled() =
        render("account-paywall-stalled-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Paywall(offers = false, waitMillis = 0) }
    @Test fun paywallUnavailable() = render("account-paywall-unavailable-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Paywall(billing = false, offers = false) }
    @Test fun paywallPurchasing() = render("account-paywall-purchasing", settleMs = 600) { Paywall(inFlight = true) }
    @Test fun paywallScale13() = render("account-paywall-scale1.3", fontScale = 1.3f) { Paywall() }

    @Test fun paywall360Scale20() =
        render("account-paywall-360-scale2.0-full", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP * 2, fontScale = 2f) {
            Paywall(ownAlert = true)
        }
}
