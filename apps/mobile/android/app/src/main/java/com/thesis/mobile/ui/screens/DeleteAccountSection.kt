package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thesis.mobile.ui.MainViewModel
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

private const val CONFIRM_WORD = "DELETE"

/** "Delete account" button for the You tab. The user must type DELETE to confirm. */
@Composable
fun DeleteAccountSection(mainViewModel: MainViewModel = viewModel()) {
    var showDialog by remember { mutableStateOf(false) }
    var confirmText by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Button(
        onClick = {
            confirmText = ""
            error = null
            showDialog = true
        },
        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
        colors = ButtonDefaults.buttonColors(
            containerColor = ThesisColors.Background,
            contentColor = ThesisColors.SignalNegative
        ),
        modifier = Modifier.fillMaxWidth().height(44.dp)
    ) {
        Text("Delete account")
    }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { if (!busy) showDialog = false },
            title = { Text("Delete your account?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    Text(
                        "This permanently deletes your account, watchlist, notes, alerts, " +
                            "devices and all other personal data. This cannot be undone.",
                        style = ThesisTypography.bodyMedium
                    )
                    Text(
                        "Deleting your account does not cancel a Google Play subscription. " +
                            "Cancel it in Google Play > Payments & subscriptions.",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                    OutlinedTextField(
                        value = confirmText,
                        onValueChange = { confirmText = it },
                        label = { Text("Type $CONFIRM_WORD to confirm") },
                        singleLine = true,
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth()
                    )
                    error?.let {
                        Text(it, style = ThesisTypography.bodySmall, color = ThesisColors.SignalNegative)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        busy = true
                        error = null
                        mainViewModel.deleteAccount { message ->
                            busy = false
                            error = message
                        }
                    },
                    enabled = !busy && confirmText.trim() == CONFIRM_WORD
                ) {
                    Text("Delete permanently", color = ThesisColors.SignalNegative)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false }, enabled = !busy) {
                    Text("Cancel")
                }
            }
        )
    }
}
