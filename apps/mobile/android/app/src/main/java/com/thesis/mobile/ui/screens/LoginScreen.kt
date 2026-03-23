package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mail
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
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
            .background(ThesisColors.DarkBackground)
    ) {
        // Ambient glow blobs (mesh background)
        Box(
            modifier = Modifier
                .size(300.dp)
                .align(Alignment.TopStart)
                .padding(16.dp)
                .blur(80.dp)
                .background(ThesisColors.AccentBlue.copy(alpha = 0.07f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(200.dp)
                .align(Alignment.BottomEnd)
                .padding(16.dp)
                .blur(64.dp)
                .background(ThesisColors.SignalPositive.copy(alpha = 0.04f), CircleShape)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Logo
            Box(contentAlignment = Alignment.Center) {
                // Glow
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .blur(40.dp)
                        .background(ThesisColors.AccentBlue.copy(alpha = 0.2f), CircleShape)
                )
                // Circle logo
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(ThesisColors.AccentBlueLight, ThesisColors.AccentBlueDark)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "T",
                        style = ThesisTypography.displayLarge.copy(
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black
                        ),
                        color = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))

            // Title
            Text(
                text = "Welcome back",
                style = ThesisTypography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.TextPrimaryDark
            )
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
            Text(
                text = "Continue your financial architecture.",
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondaryDark
            )

            Spacer(modifier = Modifier.height(40.dp))

            // Email Label
            Text(
                text = "EMAIL",
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp),
                color = ThesisColors.TextSecondaryDark,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, bottom = 6.dp)
            )
            // Email Field
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text(
                        text = "name@architecture.com",
                        color = ThesisColors.TextTertiaryDark
                    )
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Mail,
                        contentDescription = null,
                        tint = ThesisColors.AccentBlue,
                        modifier = Modifier.size(20.dp)
                    )
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                shape = CircleShape,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = ThesisColors.DarkSurfaceHigh,
                    unfocusedContainerColor = ThesisColors.DarkSurfaceHigh,
                    focusedBorderColor = ThesisColors.AccentBlue,
                    unfocusedBorderColor = ThesisColors.DarkBorder,
                    focusedTextColor = ThesisColors.TextPrimaryDark,
                    unfocusedTextColor = ThesisColors.TextPrimaryDark,
                    cursorColor = ThesisColors.AccentBlue
                )
            )

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))

            // Password label row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "PASSWORD",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp),
                    color = ThesisColors.TextSecondaryDark
                )
                Text(
                    text = "Forgot password?",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = ThesisColors.AccentBlue,
                    modifier = Modifier.clickable { }
                )
            }

            // Password Field
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text(text = "••••••••", color = ThesisColors.TextTertiaryDark)
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = ThesisColors.AccentBlue,
                        modifier = Modifier.size(20.dp)
                    )
                },
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = null,
                            tint = ThesisColors.TextTertiaryDark,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                },
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                shape = CircleShape,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = ThesisColors.DarkSurfaceHigh,
                    unfocusedContainerColor = ThesisColors.DarkSurfaceHigh,
                    focusedBorderColor = ThesisColors.AccentBlue,
                    unfocusedBorderColor = ThesisColors.DarkBorder,
                    focusedTextColor = ThesisColors.TextPrimaryDark,
                    unfocusedTextColor = ThesisColors.TextPrimaryDark,
                    cursorColor = ThesisColors.AccentBlue
                )
            )

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))

            // Log In Button
            Button(
                onClick = { onLogin(email, password) },
                enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                contentPadding = androidx.compose.foundation.layout.PaddingValues()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.linearGradient(
                                colors = listOf(ThesisColors.AccentBlueLight, ThesisColors.AccentBlueDark)
                            ),
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                    } else {
                        Text(
                            text = "Log In",
                            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White
                        )
                    }
                }
            }

            // Error message
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

            // Divider
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = ThesisColors.DarkBorder.copy(alpha = 0.5f)
                )
                Text(
                    text = "  or  ",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextTertiaryDark
                )
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = ThesisColors.DarkBorder.copy(alpha = 0.5f)
                )
            }

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))

            // Register link
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onRegisterClick() }
            ) {
                Text(
                    text = "Don't have an account? ",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextSecondaryDark
                )
                Text(
                    text = "Register",
                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    color = ThesisColors.AccentBlue
                )
            }
        }

        // Footer disclaimer
        Text(
            text = "THIS IS A RESEARCH TOOL, NOT FINANCIAL ADVICE",
            style = ThesisTypography.labelSmall.copy(letterSpacing = 1.sp),
            color = ThesisColors.TextTertiaryDark.copy(alpha = 0.4f),
            textAlign = TextAlign.Center,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp, start = 24.dp, end = 24.dp)
        )
    }
}
