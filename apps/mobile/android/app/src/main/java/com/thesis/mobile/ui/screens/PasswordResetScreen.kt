package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thesis.mobile.ui.MainViewModel
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

/**
 * Two steps: request a reset code by email, then enter the code and a new password.
 * [onDone] returns to the login screen.
 */
@Composable
fun PasswordResetScreen(
    onDone: () -> Unit,
    mainViewModel: MainViewModel = viewModel()
) {
    var email by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var newPassword by rememberSaveable { mutableStateOf("") }
    var codeSent by rememberSaveable { mutableStateOf(false) }
    var busy by rememberSaveable { mutableStateOf(false) }
    var status by rememberSaveable { mutableStateOf<String?>(null) }
    var isError by rememberSaveable { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ThesisColors.Background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 64.dp),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
    ) {
        Text("Reset password", style = ThesisTypography.headlineMedium, color = ThesisColors.TextPrimary)
        Text(
            text = if (codeSent) {
                "Enter the code from the email and choose a new password (min 10 characters)."
            } else {
                "Enter your account email. We will send you a reset code."
            },
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextMuted
        )

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            enabled = !codeSent,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )

        if (codeSent) {
            OutlinedTextField(
                value = code,
                onValueChange = { code = it },
                label = { Text("Reset code") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = newPassword,
                onValueChange = { newPassword = it },
                label = { Text("New password") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth()
            )
        }

        Button(
            onClick = {
                busy = true
                status = null
                if (!codeSent) {
                    mainViewModel.requestPasswordReset(email) { error, message ->
                        busy = false
                        isError = error != null
                        status = error ?: message
                        if (error == null) codeSent = true
                    }
                } else {
                    mainViewModel.confirmPasswordReset(email, code, newPassword) { error ->
                        busy = false
                        if (error == null) {
                            onDone()
                        } else {
                            isError = true
                            status = error
                        }
                    }
                }
            },
            enabled = !busy && if (codeSent) {
                code.isNotBlank() && newPassword.length >= 10
            } else {
                email.isNotBlank()
            },
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
            colors = ButtonDefaults.buttonColors(
                containerColor = ThesisColors.Primary,
                contentColor = ThesisColors.TextInverse
            ),
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            Text(if (codeSent) "Set new password" else "Send reset code")
        }

        status?.let {
            Text(
                text = it,
                style = ThesisTypography.bodySmall,
                color = if (isError) ThesisColors.SignalNegative else ThesisColors.TextMuted
            )
        }

        if (codeSent) {
            Text(
                text = "Send a new code",
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.Primary,
                modifier = Modifier.clickable {
                    codeSent = false
                    code = ""
                    status = null
                }
            )
        }
        Text(
            text = "Back to log in",
            style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.Primary,
            modifier = Modifier.clickable { onDone() }
        )
    }
}
