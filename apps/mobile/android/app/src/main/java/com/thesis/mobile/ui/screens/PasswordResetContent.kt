package com.thesis.mobile.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.PasswordField
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisScreen
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.copy.PASSWORD_MIN_LENGTH
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.ThesisSpace

/** True when [password] meets the reset rule (at least [PASSWORD_MIN_LENGTH] characters). */
fun meetsPasswordRule(password: String): Boolean = password.length >= PASSWORD_MIN_LENGTH

/**
 * Password reset (DESIGN-DIRECTION 5.4): a top bar with back, the ScreenHeader "Reset your password", then two
 * steps. Step 1: the account email and "Send reset code". Step 2: the code and the new password, whose rule shows
 * as helper text and updates as the user types ("At least 10 characters, 4 to go"); "Set new password" is enabled
 * once the rule holds; "Send a new code" asks for another code for the same email and "Use another email" goes back
 * to step 1 to correct it. The status line is announced (liveRegion).
 *
 * The in-flight flag is plain `remember`, not saveable: the ViewModel's callback writes to this composition's
 * state, so after a rotation a restored `busy = true` would never be cleared.
 *
 * Pure (renders in design-preview). The Android entry point is [PasswordResetScreen], which passes the ViewModel's
 * calls: [onRequestCode] answers `(error, message)`, [onConfirm] answers `error` (null on success, after which the
 * caller returns to Auth, which shows the result). [onBack] returns to Auth.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PasswordResetContent(
    onBack: () -> Unit,
    onRequestCode: (email: String, onResult: (error: String?, message: String?) -> Unit) -> Unit,
    onConfirm: (email: String, code: String, newPassword: String, onResult: (error: String?) -> Unit) -> Unit,
    initialEmail: String = "",
    initialCodeSent: Boolean = false,
) {
    var email by rememberSaveable { mutableStateOf(initialEmail) }
    var code by rememberSaveable { mutableStateOf("") }
    var newPassword by rememberSaveable { mutableStateOf("") }
    var codeSent by rememberSaveable { mutableStateOf(initialCodeSent) }
    var busy by remember { mutableStateOf(false) }
    var status by rememberSaveable { mutableStateOf<String?>(null) }
    var isError by rememberSaveable { mutableStateOf(false) }

    val requestCode = {
        if (!busy && email.isNotBlank()) {
            busy = true
            status = null
            onRequestCode(email) { error, message ->
                busy = false
                isError = error != null
                status = error ?: message
                if (error == null) codeSent = true
            }
        }
    }
    val canConfirm = !busy && code.isNotBlank() && meetsPasswordRule(newPassword)
    val confirm = {
        if (canConfirm) {
            busy = true
            status = null
            onConfirm(email, code, newPassword) { error ->
                busy = false
                if (error != null) {
                    isError = true
                    status = error
                }
            }
        }
    }

    val scroll = rememberScrollState()
    val collapsed by rememberTopBarCollapsed(scroll)
    ThesisScreen(
        topBar = { ThesisTopBar(title = AccountCopy.RESET_TITLE, onBack = onBack, collapsed = collapsed) },
        collapsed = collapsed,
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                .padding(top = padding.calculateTopPadding()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                Modifier
                    .widthIn(max = ThesisSpace.contentMaxWidth)
                    .fillMaxWidth()
                    .padding(horizontal = ThesisSpace.gutter)
                    .padding(top = ThesisSpace.headerTop, bottom = ThesisSpace.x3),
                verticalArrangement = Arrangement.spacedBy(ThesisSpace.l),
            ) {
                ResetHeader(codeSent = codeSent, email = email)
                Spacer(Modifier.height(ThesisSpace.s))
                ThesisTextField(
                    // Read-only on step 2: shown with the deck's break points, so a long address wraps at "@" or
                    // "." (2.0x on 360 dp) instead of mid-word or cut off. Editable, it is the address as typed.
                    value = if (codeSent) breakableEmail(email) else email,
                    onValueChange = { email = it },
                    label = AccountCopy.EMAIL,
                    modifier = Modifier.autofill(AutofillHint.Email) { email = it },
                    placeholder = AccountCopy.EMAIL_PLACEHOLDER,
                    enabled = !codeSent,
                    singleLine = !codeSent,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.None,
                        autoCorrectEnabled = false,
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(onDone = { requestCode() }),
                )
                if (codeSent) {
                    ThesisTextField(
                        value = code,
                        onValueChange = { code = it.trim() },
                        label = AccountCopy.RESET_CODE,
                        keyboardOptions = KeyboardOptions(
                            capitalization = KeyboardCapitalization.None,
                            autoCorrectEnabled = false,
                            keyboardType = KeyboardType.Ascii,
                            imeAction = ImeAction.Next,
                        ),
                    )
                    PasswordField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        modifier = Modifier.autofill(AutofillHint.NewPassword) { newPassword = it },
                        label = AccountCopy.RESET_NEW_PASSWORD,
                        helper = AccountCopy.passwordHelper(newPassword.length),
                        imeAction = ImeAction.Done,
                        keyboardActions = KeyboardActions(onDone = { confirm() }),
                    )
                    PrimaryButton(
                        text = AccountCopy.RESET_SET,
                        onClick = confirm,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = canConfirm || busy,
                        loading = busy,
                    )
                    // Text actions on the text edge (T4), side by side while they fit.
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.xl)) {
                        TextAction(AccountCopy.RESET_SEND_AGAIN, requestCode, enabled = !busy)
                        TextAction(
                            AccountCopy.RESET_OTHER_EMAIL,
                            onClick = {
                                codeSent = false
                                code = ""
                                newPassword = ""
                                status = null
                            },
                            enabled = !busy,
                        )
                    }
                } else {
                    PrimaryButton(
                        text = AccountCopy.RESET_SEND,
                        onClick = requestCode,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = email.isNotBlank() || busy,
                        loading = busy,
                    )
                }
                status?.let { text ->
                    InlineBanner(text = text, tone = if (isError) BannerTone.Error else BannerTone.Neutral)
                }
                Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.safeDrawing))
            }
        }
    }
}

/** The header; its step eyebrow and deck change with a `Base` crossfade (4.4, text value change). */
@Composable
private fun ResetHeader(codeSent: Boolean, email: String) {
    val reduced = LocalReducedMotion.current
    AnimatedContent(
        targetState = codeSent,
        transitionSpec = {
            val duration = if (reduced) ThesisMotion.Quick else ThesisMotion.Base
            fadeIn(ThesisMotion.timed(reduced = false, durationMillis = duration)) togetherWith
                fadeOut(ThesisMotion.timed(reduced = false, durationMillis = ThesisMotion.Quick))
        },
        label = "reset-step",
    ) { sent ->
        ScreenHeader(
            title = AccountCopy.RESET_TITLE,
            eyebrow = if (sent) AccountCopy.RESET_STEP_CODE else AccountCopy.RESET_STEP_EMAIL,
            deck = if (sent) AccountCopy.resetDeckCode(breakableEmail(email)) else AccountCopy.RESET_DECK_EMAIL,
        )
    }
}

/**
 * [email] with a zero-width break opportunity after the `@` and before each `.`, so an address wider than the line
 * (2.0x on 360 dp) breaks as "maya.chen@" / "example.com" instead of mid-word. Display only (the deck and the
 * read-only step-2 field); the `email` state keeps the address as typed, and the zero-width space is not drawn.
 */
internal fun breakableEmail(email: String): String =
    email.trim().replace("@", "@\u200B").replace(".", "\u200B.")
