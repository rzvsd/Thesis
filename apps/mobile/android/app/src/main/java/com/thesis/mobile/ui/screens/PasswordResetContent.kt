package com.thesis.mobile.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import com.thesis.mobile.ui.components.TertiaryButton
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
 * once the rule holds, and "Send a new code" asks for another code for the same email. The status line is
 * announced (liveRegion).
 *
 * Pure (renders in design-preview). The Android entry point is [PasswordResetScreen], which passes the ViewModel's
 * calls: [onRequestCode] answers `(error, message)`, [onConfirm] answers `error` (null on success, after which the
 * caller returns to Auth, which shows the result). [onBack] returns to Auth.
 */
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
    var busy by rememberSaveable { mutableStateOf(false) }
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
                    value = email,
                    onValueChange = { email = it },
                    label = AccountCopy.EMAIL,
                    modifier = Modifier.autofill(AutofillHint.Email) { email = it },
                    placeholder = AccountCopy.EMAIL_PLACEHOLDER,
                    enabled = !codeSent,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.None,
                        autoCorrect = false,
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
                            autoCorrect = false,
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
                    TertiaryButton(AccountCopy.RESET_SEND_AGAIN, requestCode, enabled = !busy)
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
            deck = if (sent) AccountCopy.resetDeckCode(email) else AccountCopy.RESET_DECK_EMAIL,
        )
    }
}
