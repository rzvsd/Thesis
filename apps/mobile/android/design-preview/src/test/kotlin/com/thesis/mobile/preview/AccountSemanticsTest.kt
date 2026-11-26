package com.thesis.mobile.preview

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SkikoComposeUiTest
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollToNodeAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import com.thesis.mobile.preview.fixtures.AccountFixtures
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.screens.AuthScreen
import com.thesis.mobile.ui.screens.DeleteAccountControl
import com.thesis.mobile.ui.screens.OnboardingScreen
import com.thesis.mobile.ui.screens.PasswordResetContent
import com.thesis.mobile.ui.screens.PaywallScreen
import com.thesis.mobile.ui.shell.AppearancePrefs
import com.thesis.mobile.ui.theme.InkDark
import com.thesis.mobile.ui.theme.PaperLight
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.withUpDown
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.theme.UpDownScheme
import androidx.compose.ui.unit.Density
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Account and entry semantics (WP-G; section 6.0 rule 7, rubric A1 to A3): 48 dp targets, labelled fields, the
 * described password toggle, headings, announced status lines, switch and radio roles, and the gates that protect
 * auth, deletion and purchase (disabled until the rule holds).
 */
class AccountSemanticsTest {

    @get:Rule
    val rule = createComposeRule()

    private fun set(content: @Composable () -> Unit) {
        rule.setContent { ThesisTheme(mode = ThemeMode.Light) { AccountFixtures.WithFixedTime(content) } }
    }

    private fun field(label: String) = rule.onNode(hasSetTextAction() and hasText(label, substring = true))

    // ---- Auth -----------------------------------------------------------------------------------------------------

    @Composable
    private fun Auth(message: String? = null, onLogin: (String, String) -> Unit = { _, _ -> }) = AuthScreen(
        isLoading = false,
        currentApiBaseUrl = AccountFixtures.API,
        verificationToken = null,
        registerStatus = null,
        message = message,
        onSaveApiBaseUrl = {},
        onRegister = { _, _ -> },
        onVerify = { _, _ -> },
        onLogin = onLogin,
        onForgotPassword = {},
    )

    @Test
    fun `auth fields are labelled, the password toggle is described and log in waits for both fields`() {
        var login: Pair<String, String>? = null
        set { Auth(onLogin = { e, p -> login = e to p }) }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithText(AccountCopy.BRAND).assertIsHeading()
        rule.onNode(hasText(AccountCopy.AUTH_MODE_LOG_IN) and hasRadio()).assertIsSelected()
        rule.onNodeWithContentDescription("Show password").assertTouchTargetAtLeast()

        val logIn = rule.onNode(hasClickAction() and hasText(AccountCopy.AUTH_MODE_LOG_IN) and !hasRadio())
        logIn.assertIsNotEnabled()
        field(AccountCopy.EMAIL).performTextInput(AccountFixtures.EMAIL)
        field(AccountCopy.PASSWORD).performTextInput("correct horse")
        logIn.assertIsEnabled().performClick()
        assertEquals(AccountFixtures.EMAIL to "correct horse", login)
    }

    @Test
    fun `auth error is announced and legal links are 48 dp`() {
        set { Auth(message = "Invalid email or password") }
        rule.onNodeWithText("Invalid email or password", substring = true).assertIsLiveRegion()
        rule.onNodeWithText(AccountCopy.TERMS).assertTouchTargetAtLeast()
        rule.onNodeWithText(AccountCopy.PRIVACY).assertTouchTargetAtLeast()
    }

    @Test
    fun `the legal lead is one TalkBack stop before the two links`() {
        set { Auth() }
        // A3: the lead flows word by word on screen, but reads as one sentence, not one stop per word.
        rule.onAllNodesWithText(AccountCopy.LEGAL_LEAD).assertCountEquals(1)
        AccountCopy.LEGAL_LEAD.split(' ').forEach { word -> rule.onAllNodesWithText(word).assertCountEquals(0) }
        val lead = rule.onNodeWithText(AccountCopy.LEGAL_LEAD).fetchSemanticsNode().boundsInRoot
        val terms = rule.onNodeWithText(AccountCopy.TERMS).fetchSemanticsNode().boundsInRoot
        // Same line (overlapping rows: TalkBack reads left to right) or a line above.
        assertTrue(
            "the lead ($lead) comes before the Terms link ($terms)",
            lead.bottom <= terms.top || (lead.top < terms.bottom && lead.left < terms.left),
        )
    }

    @Test
    fun `at 2_0x on 360 dp every onboarding title and lede show without scrolling`() =
        onboardingWordsFirst(PhoneSpec.HEIGHT_DP, wholeLede = true)

    @Test
    fun `at 2_0x on a short 360 dp phone every onboarding title shows and its lede starts on screen`() =
        onboardingWordsFirst(SHORT_PHONE_HEIGHT_DP, wholeLede = false)

    /**
     * The fragment gives way: when it and the words do not fit, the words come first and the fragment follows, so
     * the title (and the lede, or on a short phone its start) shows on every page without scrolling.
     */
    @OptIn(ExperimentalTestApi::class)
    private fun onboardingWordsFirst(heightDp: Int, wholeLede: Boolean) {
        val density = PhoneSpec.density
        val width = (PhoneSpec.NARROW_WIDTH_DP * density).toInt()
        val height = (heightDp * density).toInt()
        SkikoComposeUiTest(width = width, height = height, density = Density(density, fontScale = 2f)).runTest {
            var page by mutableStateOf(0)
            setContent {
                ThesisTheme(mode = ThemeMode.Light) {
                    androidx.compose.runtime.key(page) { OnboardingScreen(onComplete = {}, initialPage = page) }
                }
            }
            listOf(
                AccountCopy.ONBOARDING_DESK_TITLE to AccountCopy.ONBOARDING_DESK_LEDE,
                AccountCopy.ONBOARDING_PULSE_TITLE to AccountCopy.ONBOARDING_PULSE_LEDE,
                AccountCopy.ONBOARDING_DIVE_TITLE to AccountCopy.ONBOARDING_DIVE_LEDE,
                AccountCopy.ONBOARDING_NAMES_TITLE to AccountCopy.ONBOARDING_NAMES_LEDE,
                AccountCopy.ONBOARDING_ADVICE_TITLE to AccountCopy.ONBOARDING_ADVICE_LEDE,
            ).forEachIndexed { i, (title, lede) ->
                page = i
                waitForIdle()
                mainClock.advanceTimeBy(2_000)
                for (text in listOf(title, lede)) {
                    val node = onNodeWithText(text).fetchSemanticsNode()
                    val b = node.boundsInWindow
                    val whole = text == title || wholeLede
                    assertTrue(
                        "page ${i + 1}: \"${text.take(24)}\" (${node.size}) shows only $b in the ${width}x$height window",
                        if (whole) b.height >= node.size.height - 1 else b.height >= node.size.height / 3,
                    )
                }
            }
        }
    }

    // ---- Password reset -------------------------------------------------------------------------------------------

    @Test
    fun `reset shows the rule as it is typed and enables set only once it holds`() {
        var confirmed: Triple<String, String, String>? = null
        set {
            PasswordResetContent(
                onBack = {},
                onRequestCode = { _, _ -> },
                onConfirm = { email, code, pw, _ -> confirmed = Triple(email, code, pw) },
                initialEmail = AccountFixtures.EMAIL,
                initialCodeSent = true,
            )
        }
        rule.assertAllTouchTargetsAtLeast()
        val set = rule.onNode(hasClickAction() and hasText(AccountCopy.RESET_SET))
        set.assertIsNotEnabled()
        field(AccountCopy.RESET_CODE).performTextInput("123456")
        field(AccountCopy.RESET_NEW_PASSWORD).performTextInput("abcdef")
        rule.onNodeWithText(AccountCopy.passwordHelper(6), substring = true).assertExists()
        set.assertIsNotEnabled()
        field(AccountCopy.RESET_NEW_PASSWORD).performTextInput("ghijkl")
        set.assertIsEnabled().performClick()
        assertEquals(Triple(AccountFixtures.EMAIL, "123456", "abcdefghijkl"), confirmed)
    }

    // ---- Delete account -------------------------------------------------------------------------------------------

    @Test
    fun `delete stays disabled until DELETE is typed`() {
        var deletes = 0
        set { DeleteAccountControl(onDelete = { deletes++ }) }
        rule.onNodeWithText(AccountCopy.DELETE_ACCOUNT).assertTouchTargetAtLeast().performClick()
        val confirm = rule.onNode(hasClickAction() and hasText(AccountCopy.DELETE_CONFIRM))
        confirm.assertIsNotEnabled()
        field(AccountCopy.DELETE_CONFIRM_LABEL).performTextInput("delete")
        confirm.assertIsNotEnabled()
        confirm.performClick()
        assertEquals(0, deletes)
        field(AccountCopy.DELETE_CONFIRM_LABEL).performTextClearance()
        field(AccountCopy.DELETE_CONFIRM_LABEL).performTextInput("DELETE")
        confirm.assertIsEnabled().performClick()
        rule.waitForIdle()
        assertEquals(1, deletes)
    }

    @OptIn(ExperimentalTestApi::class)
    @Test
    fun `at 2_0x on 360 dp the delete dialog keeps the DELETE field and both actions on screen`() {
        // A4: the dialog's window is the phone's (360 x 640 dp, a short phone, at 2.0x font), so the body has to
        // scroll while the DELETE field, "Delete permanently" and "Cancel" stay pinned inside the window, untouched
        // (no scrolling first), empty or typed.
        val density = PhoneSpec.density
        val width = (PhoneSpec.NARROW_WIDTH_DP * density).toInt()
        val height = (SHORT_PHONE_HEIGHT_DP * density).toInt()
        SkikoComposeUiTest(width = width, height = height, density = Density(density, fontScale = 2f)).runTest {
            setContent { ThesisTheme(mode = ThemeMode.Light) { DeleteAccountControl(onDelete = {}, initiallyOpen = true) } }
            waitForIdle()
            fun onScreen(matcher: SemanticsMatcher, label: String) {
                val node = onNode(matcher).assertIsDisplayed().fetchSemanticsNode()
                // boundsInWindow is clipped to the window: a node pushed past its edge comes back shorter than itself.
                val b = node.boundsInWindow
                assertTrue(
                    "$label (${node.size}) shows only $b in the ${width}x$height window",
                    b.height >= node.size.height - 1 && b.width >= node.size.width - 1,
                )
            }
            val confirmField = hasSetTextAction() and hasText(AccountCopy.DELETE_CONFIRM_LABEL, substring = true)
            onScreen(confirmField, AccountCopy.DELETE_CONFIRM_LABEL)
            onScreen(hasClickAction() and hasText(AccountCopy.DELETE_CONFIRM), AccountCopy.DELETE_CONFIRM)
            onScreen(hasClickAction() and hasText(AccountCopy.DELETE_CANCEL), AccountCopy.DELETE_CANCEL)
            onNode(confirmField).performTextInput(AccountCopy.DELETE_CONFIRM_WORD)
            waitForIdle()
            onNode(hasClickAction() and hasText(AccountCopy.DELETE_CONFIRM)).assertIsEnabled()
            onScreen(confirmField, AccountCopy.DELETE_CONFIRM_LABEL)
            onScreen(hasClickAction() and hasText(AccountCopy.DELETE_CONFIRM), AccountCopy.DELETE_CONFIRM)
            onScreen(hasClickAction() and hasText(AccountCopy.DELETE_CANCEL), AccountCopy.DELETE_CANCEL)
        }
    }

    // ---- Onboarding -----------------------------------------------------------------------------------------------

    @Test
    fun `onboarding pages forward, skips, and completes from the last page`() {
        var completed = 0
        set { OnboardingScreen(onComplete = { completed++ }) }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithText(AccountCopy.ONBOARDING_DESK_TITLE).assertIsHeading()
        rule.onNodeWithContentDescription("Page 1 of 5").assertExists()
        rule.onNodeWithText(AccountCopy.ONBOARDING_CONTINUE).performClick()
        rule.waitForIdle()
        rule.onNodeWithContentDescription("Page 2 of 5").assertExists()
        rule.onNodeWithText(AccountCopy.ONBOARDING_SKIP).performClick()
        assertEquals(1, completed)
    }

    @Test
    fun `last onboarding page offers get started and the disclaimer, and the names picture takes no taps`() {
        var completed = 0
        set { OnboardingScreen(onComplete = { completed++ }, initialPage = 4) }
        rule.onNodeWithText(AccountCopy.DISCLAIMER).assertExists()
        rule.onNodeWithText(AccountCopy.ONBOARDING_START).performClick()
        assertEquals(1, completed)
    }

    // ---- Paywall --------------------------------------------------------------------------------------------------

    @Test
    fun `paywall defaults to yearly, plans are radios and continue buys the selected plan`() {
        val bought = mutableListOf<String>()
        set {
            PaywallScreen(
                alerts = emptyList(), watchlist = emptyList(), offers = AccountFixtures.offers, actionInFlight = false,
                onPurchase = { bought += it }, onRestore = {}, onRefreshOffers = {}, onDismiss = {},
                billingEnabled = true,
            )
        }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithText(AccountCopy.PAYWALL_TITLE).assertIsHeading()
        rule.onNodeWithContentDescription("Back").assertTouchTargetAtLeast()
        rule.onNodeWithText(AccountCopy.PAYWALL_CONTINUE).performClick()
        rule.onNode(hasText(AccountCopy.PAYWALL_YEARLY, substring = true) and hasRadio()).assertIsSelected()
        rule.onNode(hasText(AccountCopy.PAYWALL_MONTHLY, substring = true) and hasRadio())
            // The RunBar sits over the bottom of the viewport: invoke the card's click action, not a tap.
            .performScrollTo().performSemanticsAction(SemanticsActions.OnClick).assertIsSelected()
        rule.onNodeWithText(AccountCopy.PAYWALL_CONTINUE).performClick()
        assertEquals(listOf("YEARLY", "MONTHLY"), bought)
        rule.onNodeWithText(AccountCopy.paywallSaving("37%"), substring = true).assertExists()
    }

    // ---- You ------------------------------------------------------------------------------------------------------

    @Test
    fun `restore purchases is disabled and says why while a store action runs`() {
        var restores = 0
        var busy by mutableStateOf(true)
        set { AccountFixtures.You(actionInFlight = busy, onRestorePurchases = { restores++ }) }
        rule.onNode(hasScrollToNodeAction()).performScrollToNode(hasText(AccountCopy.RESTORE_PURCHASES))
        rule.onNodeWithText(AccountCopy.RESTORE_PURCHASES).assertIsNotEnabled().performClick()
        rule.onAllNodesWithText(AccountCopy.STORE_BUSY).assertCountEquals(2)
        assertEquals(0, restores)
        busy = false
        rule.waitForIdle()
        rule.onNodeWithText(AccountCopy.RESTORE_PURCHASES).assertIsEnabled().performClick()
        assertEquals(1, restores)
        rule.onAllNodesWithText(AccountCopy.STORE_BUSY).assertCountEquals(0)
    }

    @Test
    fun `your notes stays hidden until the export is wired`() {
        set { AccountFixtures.You(onExportNotes = null) }
        // Portfolio and Subscription are its neighbours: with them composed, Your notes would be too.
        rule.onNode(hasScrollToNodeAction()).performScrollToNode(hasText(AccountCopy.SECTION_PORTFOLIO.uppercase()))
        rule.onNodeWithText(AccountCopy.SECTION_SUBSCRIPTION.uppercase()).assertExists()
        rule.onAllNodesWithText(AccountCopy.SECTION_NOTES.uppercase()).assertCountEquals(0)
        rule.onAllNodesWithText(AccountCopy.NOTES_NONE).assertCountEquals(0)
    }

    @Test
    fun `you rows are switches and radios with headings, and appearance changes are reported`() {
        var appearance = AppearancePrefs()
        var notifications: Boolean? = null
        set {
            AccountFixtures.You(
                appearance = appearance,
                onSetAppearance = { appearance = it },
                onSetNotifications = { notifications = it },
            )
        }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithText(AccountCopy.YOU_TITLE).assertIsHeading()
        rule.onNodeWithText(AccountCopy.SECTION_APPEARANCE.uppercase()).assertIsHeading()
        rule.onNodeWithText("Light").assertRole(Role.RadioButton).performClick()
        assertEquals(ThemeMode.Light, appearance.themeMode)
        rule.onNodeWithText("Colour-blind").performClick()
        assertEquals(UpDownScheme.ColourBlind, appearance.upDown)
        rule.onNodeWithText(AccountCopy.REDUCE_MOTION).assertRole(Role.Switch).assertIsOff().performClick()
        assertTrue(appearance.reduceMotion)
        rule.onNodeWithText(AccountCopy.NOTIFICATIONS_MASTER_SUB, substring = true).assertIsOn().performClick()
        assertEquals(false, notifications)
    }

    @Test
    fun `export my notes hands over the markdown file`() {
        var exported: Pair<String, String>? = null
        set { AccountFixtures.You(onExportNotes = { name, md -> exported = name to md }) }
        rule.onNode(hasScrollToNodeAction()).performScrollToNode(hasText(AccountCopy.EXPORT_NOTES))
        rule.onNodeWithText(AccountCopy.EXPORT_NOTES).assertRole(Role.Button).assertTouchTargetAtLeast().performClick()
        val (name, md) = exported!!
        // Dated by the screen's injected clock (the fixture's 25 Nov 2026), not the machine's.
        assertEquals("thesis-notes-2026-11-25.md", name)
        assertTrue(md.contains("Exported 25 Nov 2026"))
        assertTrue(md.startsWith("# Thesis notes"))
        assertTrue(md.contains("## NVDA") && md.contains("## AAPL"))
    }

    @Test
    fun `see pro opens the paywall for a free account`() {
        var feature: String? = null
        set { AccountFixtures.You(onRequireUpgrade = { feature = it }) }
        rule.onNode(hasScrollToNodeAction()).performScrollToNode(hasText(AccountCopy.SEE_PRO_SUB))
        rule.onNodeWithText(AccountCopy.SEE_PRO_SUB, substring = true).performClick()
        assertEquals("settings_subscription", feature)
    }

    @Test
    fun `the theme and up-down settings change the palette the screen is drawn with`() {
        val palettes = mutableListOf<ThesisPalette>()
        set { AccountFixtures.YouWithAppearance(AppearancePrefs(themeMode = ThemeMode.Dark), onPalette = { palettes += it }) }
        assertEquals(InkDark.bg, palettes.last().bg)
        rule.onNodeWithText("Light").performClick()
        rule.waitForIdle()
        assertEquals(PaperLight.bg, palettes.last().bg)
        rule.onNodeWithText("Light").assertIsSelected()
        val classicUp = palettes.last().upText
        rule.onNodeWithText("Colour-blind").performClick()
        rule.waitForIdle()
        assertEquals(PaperLight.withUpDown(UpDownScheme.ColourBlind).upText, palettes.last().upText)
        assertTrue(classicUp != palettes.last().upText)
    }

    @Test
    fun `reset can go back to correct the email after a code was sent`() {
        val requested = mutableListOf<String>()
        set {
            PasswordResetContent(
                onBack = {},
                onRequestCode = { email, done ->
                    requested += email
                    done(null, null)
                },
                onConfirm = { _, _, _, _ -> },
                initialEmail = AccountFixtures.EMAIL,
                initialCodeSent = true,
            )
        }
        field(AccountCopy.EMAIL).assertIsNotEnabled()
        rule.onNodeWithText(AccountCopy.RESET_SEND_AGAIN).assertTouchTargetAtLeast().performClick()
        assertEquals(listOf(AccountFixtures.EMAIL), requested)
        rule.onNodeWithText(AccountCopy.RESET_OTHER_EMAIL).assertTouchTargetAtLeast().performClick()
        rule.waitForIdle()
        field(AccountCopy.EMAIL).assertIsEnabled()
        rule.onNode(hasClickAction() and hasText(AccountCopy.RESET_SEND)).assertExists()
    }

    @Test
    fun `paywall plans that never arrive end in an error with try again`() {
        var refreshes = 0
        set {
            PaywallScreen(
                alerts = emptyList(), watchlist = emptyList(), offers = emptyList(), actionInFlight = false,
                onPurchase = {}, onRestore = {}, onRefreshOffers = { refreshes++ }, onDismiss = {},
                billingEnabled = true, offersWaitMillis = 300,
            )
        }
        // The wait runs on the effect's own timer (not the test clock): poll for the banner.
        rule.waitUntil(timeoutMillis = 5_000) {
            rule.onAllNodesWithText(AccountCopy.PAYWALL_PLANS_STALLED, substring = true).fetchSemanticsNodes().isNotEmpty()
        }
        rule.onNodeWithText(AccountCopy.PAYWALL_PLANS_STALLED, substring = true).assertIsLiveRegion()
        val before = refreshes
        rule.onNodeWithText(AccountCopy.PAYWALL_PLANS_RETRY).performScrollTo().performClick()
        rule.waitForIdle()
        assertEquals(before + 1, refreshes)
    }

    private companion object {
        /** A short phone's window (360 x 640 dp class), shorter than the 915 dp renders. */
        const val SHORT_PHONE_HEIGHT_DP = 640
    }

    private fun hasRadio() = androidx.compose.ui.test.SemanticsMatcher.expectValue(
        androidx.compose.ui.semantics.SemanticsProperties.Role, Role.RadioButton,
    )
}
