package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.DestructiveButton
import com.thesis.mobile.ui.components.DialogAction
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.ThesisDialog
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/** The delete confirmation holds only when the user typed the confirm word (case-sensitive, spaces trimmed). */
fun deleteConfirmed(typed: String): Boolean = typed.trim() == AccountCopy.DELETE_CONFIRM_WORD

/**
 * You > Account > "Delete account" (DESIGN-DIRECTION 5.22): a [DestructiveButton] that opens a [ThesisDialog]. The
 * dialog says what is deleted and that a Google Play subscription is not cancelled, and its "Delete permanently"
 * stays disabled (visibly muted) until the user types DELETE. On confirm the dialog closes (`reject()` haptic, 4.7),
 * the button shows its loading state while [onDelete] runs, and an error comes back as an announced banner under
 * it. On success the caller ends the session, so nothing more happens here.
 *
 * Pure (renders in design-preview). [onDelete] receives the error callback; the Android entry point is
 * [DeleteAccountSection].
 */
@Composable
fun DeleteAccountControl(
    onDelete: (onError: (String) -> Unit) -> Unit,
    modifier: Modifier = Modifier,
    initiallyOpen: Boolean = false,
    initialConfirmText: String = "",
) {
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    var showDialog by rememberSaveable { mutableStateOf(initiallyOpen) }
    var confirmText by rememberSaveable { mutableStateOf(initialConfirmText) }
    // Not saveable: [onDelete]'s error callback writes to this composition's state, so a `busy = true` restored
    // after a rotation would never be cleared and the button would spin for good.
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        DestructiveButton(
            text = AccountCopy.DELETE_ACCOUNT,
            onClick = {
                confirmText = ""
                error = null
                showDialog = true
            },
            loading = busy,
        )
        error?.let { InlineBanner(text = it, tone = BannerTone.Error) }
    }

    if (showDialog) {
        val confirmed = deleteConfirmed(confirmText)
        ThesisDialog(
            onDismissRequest = { showDialog = false },
            title = AccountCopy.DELETE_TITLE,
            body = AccountCopy.DELETE_BODY,
            destructive = true,
            confirm = DialogAction(
                label = AccountCopy.DELETE_CONFIRM,
                enabled = confirmed,
                onClick = {
                    // The dialog runs this after its exit; check again in case the text changed meanwhile.
                    if (deleteConfirmed(confirmText)) {
                        haptics.reject()
                        showDialog = false
                        busy = true
                        error = null
                        onDelete { message ->
                            busy = false
                            error = message
                        }
                    }
                },
            ),
            dismiss = DialogAction(AccountCopy.DELETE_CANCEL, { showDialog = false }),
        ) {
            Text(AccountCopy.DELETE_PLAY_NOTE, style = ThesisType.bodySmall, color = p.ink2)
            ThesisTextField(
                value = confirmText,
                onValueChange = { confirmText = it },
                label = AccountCopy.DELETE_CONFIRM_LABEL,
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Characters,
                    autoCorrect = false,
                    keyboardType = KeyboardType.Ascii,
                    imeAction = ImeAction.Done,
                ),
            )
        }
    }
}
