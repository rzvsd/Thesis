package com.thesis.mobile.ui.screens

import com.thesis.mobile.ui.components.legalPageUrl
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.copy.PASSWORD_MIN_LENGTH
import com.thesis.mobile.ui.format.Fmt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/** The rules behind the account screens (WP-G): status mapping, password and delete gates, prices, captions. */
class AccountRulesTest {

    // ---- AuthStatus -----------------------------------------------------------------------------------------------

    @Test
    fun `known view-model results map to a typed status with reworded copy`() {
        val sent = AuthStatus.fromMessage("Registration created. Verify the code sent to a@b.c")!!
        assertEquals(AuthStatus.Kind.VerificationSent, sent.kind)
        assertEquals(AccountCopy.STATUS_VERIFICATION_SENT, sent.text)
        assertEquals(AuthStatus.Tone.Success, sent.tone)
        assertFalse(sent.opensLogIn)

        val verified = AuthStatus.fromMessage("Account verified. You can login now.")!!
        assertEquals(AuthStatus.Kind.Verified, verified.kind)
        assertTrue(verified.opensLogIn)

        assertEquals(AuthStatus.Kind.PasswordChanged, AuthStatus.fromMessage("Password reset successful. Log in.")!!.kind)
        assertEquals(AuthStatus.Tone.Neutral, AuthStatus.fromMessage("Logged out.")!!.tone)
        assertEquals(AuthStatus.Tone.Neutral, AuthStatus.fromMessage("Session expired. Please log in again.")!!.tone)
        val api = AuthStatus.fromMessage("API base URL saved.")!!
        assertEquals(AuthStatus.Kind.ApiSaved, api.kind)
        assertFalse(api.opensLogIn)
    }

    @Test
    fun `account deletion keeps the store notice`() {
        val deleted = AuthStatus.fromMessage("Account deleted successfully. Cancel your subscription in Google Play.")!!
        assertEquals(AuthStatus.Kind.AccountDeleted, deleted.kind)
        assertEquals("${AccountCopy.STATUS_ACCOUNT_DELETED} Cancel your subscription in Google Play.", deleted.text)
        assertEquals(AccountCopy.STATUS_ACCOUNT_DELETED, AuthStatus.fromMessage("Account deleted successfully.")!!.text)
    }

    @Test
    fun `log-in success and empty messages show nothing, anything else is an error as written`() {
        assertNull(AuthStatus.fromMessage(null))
        assertNull(AuthStatus.fromMessage("  "))
        assertNull(AuthStatus.fromMessage("Login successful."))
        val failed = AuthStatus.fromMessage(" Invalid email or password ")!!
        assertEquals(AuthStatus.Kind.Failed, failed.kind)
        assertEquals("Invalid email or password", failed.text)
        assertEquals(AuthStatus.Tone.Error, failed.tone)
        assertFalse(failed.opensLogIn)
    }

    // ---- Password and delete gates --------------------------------------------------------------------------------

    @Test
    fun `password rule and its live helper`() {
        assertFalse(meetsPasswordRule("a".repeat(PASSWORD_MIN_LENGTH - 1)))
        assertTrue(meetsPasswordRule("a".repeat(PASSWORD_MIN_LENGTH)))
        assertEquals(AccountCopy.PASSWORD_RULE, AccountCopy.passwordHelper(0))
        assertEquals("${AccountCopy.PASSWORD_RULE}, 4 to go", AccountCopy.passwordHelper(PASSWORD_MIN_LENGTH - 4))
        assertEquals(AccountCopy.RESET_LONG_ENOUGH, AccountCopy.passwordHelper(PASSWORD_MIN_LENGTH))
    }

    @Test
    fun `delete is confirmed only by the exact word`() {
        assertTrue(deleteConfirmed("DELETE"))
        assertTrue(deleteConfirmed("  DELETE "))
        assertFalse(deleteConfirmed("delete"))
        assertFalse(deleteConfirmed("DELET"))
        assertFalse(deleteConfirmed(""))
    }

    // ---- Paywall prices -------------------------------------------------------------------------------------------

    @Test
    fun `store prices parse whatever the currency format`() {
        assertEquals(7.99, parseStorePrice("$7.99")!!, 1e-9)
        assertEquals(7.99, parseStorePrice("7,99 €")!!, 1e-9)
        assertEquals(1299.0, parseStorePrice("1.299,00 kr")!!, 1e-9)
        assertEquals(1299.0, parseStorePrice("$1,299.00")!!, 1e-9)
        assertEquals(1200.0, parseStorePrice("¥1,200")!!, 1e-9)
        assertNull(parseStorePrice(""))
        assertNull(parseStorePrice("Free"))
    }

    @Test
    fun `yearly saving is shown only when both prices are known and it is a real saving`() {
        assertEquals(37, yearlySavingPercent("$7.99", "$59.99"))
        assertEquals(17, yearlySavingPercent("9,99 €", "99,99 €"))
        assertNull(yearlySavingPercent("", "$59.99"))
        assertNull(yearlySavingPercent("$4.99", "$59.88"))
        assertNull(yearlySavingPercent("$4.99", "$79.99"))
    }

    // ---- Captions and links ---------------------------------------------------------------------------------------

    @Test
    fun `quiet-until shows a future time and date, nothing once it has passed`() {
        val zone = ZoneId.of("UTC")
        val now = Instant.parse("2026-11-25T12:00:00Z")
        val fmt = Fmt(Clock.fixed(now, zone), zone, is24h = true)
        assertEquals("14:30, 25 Nov", quietUntilLabel("2026-11-25T14:30:00Z", fmt, now, zone))
        assertNull(quietUntilLabel("2026-11-25T11:00:00Z", fmt, now, zone))
        assertNull(quietUntilLabel("not a time", fmt, now, zone))
    }

    @Test
    fun `billing period end reads as a short date`() {
        val zone = ZoneId.of("UTC")
        val fmt = Fmt(Clock.fixed(Instant.parse("2026-11-25T12:00:00Z"), zone), zone, is24h = true)
        assertEquals("24 Dec", periodEndLabel("2026-12-24T00:00:00Z", fmt, zone))
        assertEquals("3 Jan 2027", periodEndLabel("2027-01-03", fmt, zone))
        assertEquals("soon", periodEndLabel("soon", fmt, zone))
        assertNull(periodEndLabel(" ", fmt, zone))
    }

    @Test
    fun `notification families read in sentence case`() {
        assertEquals("Earnings preview", AccountCopy.notificationFamily("earnings_preview"))
        assertEquals("War Room", AccountCopy.notificationFamily("earnings_war_room"))
        assertEquals("Some new family", AccountCopy.notificationFamily("SOME_NEW_FAMILY"))
    }

    @Test
    fun `legal pages hang off the API base`() {
        assertEquals("https://api.test/v1/legal/terms", legalPageUrl(" https://api.test/v1/ ", "terms"))
        assertEquals("https://api.test/legal/privacy", legalPageUrl("https://api.test", "privacy"))
    }

    @Test
    fun `onboarding cascade runs each element in order and ends at rest`() {
        assertEquals(0f, cascadeAt(0f, 0), 1e-6f)
        assertEquals(1f, cascadeAt(1f, 3), 1e-6f)
        // Part-way, an earlier element is always further along than a later one.
        val mid = 0.4f
        assertTrue(cascadeAt(mid, 0) > cascadeAt(mid, 1))
        assertTrue(cascadeAt(mid, 1) > cascadeAt(mid, 3))
        assertEquals(ONBOARDING_PAGE_COUNT, 5)
    }
}
