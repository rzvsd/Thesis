package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun LoginScreen(
    isLoading: Boolean,
    message: String?,
    onLogin: (String, String) -> Unit,
    onRegisterClick: () -> Unit
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ThesisColors.Background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Thesis",
                style = ThesisTypography.displayLarge.copy(
                    fontFamily = HeadingFont,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Normal,
                    letterSpacing = (-1).sp
                ),
                color = ThesisColors.TextPrimary
            )
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            Text(
                text = "Welcome back",
                style = ThesisTypography.bodyLarge,
                color = ThesisColors.TextMuted
            )

            Spacer(modifier = Modifier.height(48.dp))

            Text(
                text = "EMAIL",
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextMuted,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
            )
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text("name@example.com", color = ThesisColors.TextMuted.copy(alpha = 0.5f))
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = ThesisColors.Surface,
                    unfocusedContainerColor = ThesisColors.Surface,
                    focusedBorderColor = ThesisColors.Primary,
                    unfocusedBorderColor = ThesisColors.Border,
                    focusedTextColor = ThesisColors.TextPrimary,
                    unfocusedTextColor = ThesisColors.TextPrimary,
                    cursorColor = ThesisColors.Primary
                )
            )

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXl))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "PASSWORD",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = "Forgot password?",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.Primary,
                    modifier = Modifier.clickable { }
                )
            }
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text("Enter password", color = ThesisColors.TextMuted.copy(alpha = 0.5f))
                },
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = null,
                            tint = ThesisColors.TextMuted,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                },
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = ThesisColors.Surface,
                    unfocusedContainerColor = ThesisColors.Surface,
                    focusedBorderColor = ThesisColors.Primary,
                    unfocusedBorderColor = ThesisColors.Border,
                    focusedTextColor = ThesisColors.TextPrimary,
                    unfocusedTextColor = ThesisColors.TextPrimary,
                    cursorColor = ThesisColors.Primary
                )
            )

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))

            Button(
                onClick = { onLogin(email, password) },
                enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ThesisColors.Primary,
                    contentColor = ThesisColors.TextInverse,
                    disabledContainerColor = ThesisColors.Primary.copy(alpha = 0.3f),
                    disabledContentColor = ThesisColors.TextInverse.copy(alpha = 0.5f)
                )
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = ThesisColors.TextInverse,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = "Log In",
                        style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
                    )
                }
            }

            if (!message.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingMd))
                Text(
                    text = message,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.SignalNegative,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = ThesisColors.Border
                )
                Text(
                    text = "  or  ",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted
                )
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = ThesisColors.Border
                )
            }

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onRegisterClick() }
            ) {
                Text(
                    text = "Don't have an account? ",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = "Register",
                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.Primary
                )
            }
        }

        Text(
            text = "THIS IS A RESEARCH TOOL, NOT FINANCIAL ADVICE",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted.copy(alpha = 0.3f),
            textAlign = TextAlign.Center,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 20.dp, start = 24.dp, end = 24.dp)
        )
    }
}
