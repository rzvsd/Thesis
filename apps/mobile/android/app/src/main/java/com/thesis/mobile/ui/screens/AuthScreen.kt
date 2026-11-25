package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.ui.components.LegalLinks
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.copy.ProductCopy
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.theme.ThesisTypography
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Log in, create account and verify (DESIGN-DIRECTION 5.3), extracted from `ThesisApp.kt` unchanged in look.
 * Pure: the password-reset screen and the debug API switch are the caller's ([onForgotPassword],
 * [showDeveloperOptions] = `BuildConfig.DEBUG`). The root paints no background; the app root does.
 */
@Composable
fun AuthScreen(
    isLoading: Boolean,
    currentApiBaseUrl: String,
    verificationToken: String?,
    registerStatus: String?,
    message: String?,
    onSaveApiBaseUrl: (String) -> Unit,
    onRegister: (String, String) -> Unit,
    onVerify: (email: String, code: String) -> Unit,
    onLogin: (String, String) -> Unit,
    onForgotPassword: () -> Unit,
    showDeveloperOptions: Boolean = false
) {
    var apiBaseUrl by rememberSaveable(currentApiBaseUrl) { mutableStateOf(currentApiBaseUrl) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var verifyToken by rememberSaveable { mutableStateOf(verificationToken ?: "") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    var isLoginMode by rememberSaveable { mutableStateOf(true) }
    var showApiConfig by rememberSaveable { mutableStateOf(false) }
    var showVerificationPanel by rememberSaveable {
        mutableStateOf(!verificationToken.isNullOrBlank() || !registerStatus.isNullOrBlank())
    }

    LaunchedEffect(verificationToken) {
        if (!verificationToken.isNullOrBlank()) {
            verifyToken = verificationToken
        }
    }

    LaunchedEffect(registerStatus, verificationToken) {
        if (!registerStatus.isNullOrBlank() || !verificationToken.isNullOrBlank()) {
            isLoginMode = false
            showVerificationPanel = true
        }
    }

    LaunchedEffect(message) {
        val normalized = message?.lowercase().orEmpty()
        if ("verified" in normalized) {
            isLoginMode = true
            showVerificationPanel = false
            verifyToken = ""
        }
    }

    val statusColor = when {
        message.isNullOrBlank() -> ThesisColors.TextMuted
        message.contains("success", ignoreCase = true) ||
            message.contains("verified", ignoreCase = true) ||
            message.contains("saved", ignoreCase = true) ||
            message.contains("created", ignoreCase = true) -> ThesisColors.SignalPositive
        else -> ThesisColors.SignalNegative
    }

    val tfShape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    val tfColors = OutlinedTextFieldDefaults.colors(
        focusedContainerColor = ThesisColors.Surface,
        unfocusedContainerColor = ThesisColors.Surface,
        focusedBorderColor = ThesisColors.Primary,
        unfocusedBorderColor = ThesisColors.Border,
        focusedTextColor = ThesisColors.TextPrimary,
        unfocusedTextColor = ThesisColors.TextPrimary,
        cursorColor = ThesisColors.Primary,
        focusedLabelColor = ThesisColors.Primary,
        unfocusedLabelColor = ThesisColors.TextMuted,
        focusedPlaceholderColor = ThesisColors.TextMuted.copy(alpha = 0.6f),
        unfocusedPlaceholderColor = ThesisColors.TextMuted.copy(alpha = 0.6f)
    )

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 48.dp),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            item {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(top = 32.dp, bottom = 16.dp)
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
                        text = "Financial intelligence",
                        style = ThesisTypography.bodyLarge,
                        color = ThesisColors.TextMuted
                    )
                }
            }

            item {
                AuthValueCard()
            }

            if (showDeveloperOptions) item {
                Column {
                    Text(
                        text = "CONFIGURE API",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.Primary,
                        modifier = Modifier.clickable { showApiConfig = !showApiConfig }
                    )
                    if (showApiConfig) {
                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                        OutlinedTextField(
                            value = apiBaseUrl,
                            onValueChange = { apiBaseUrl = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("API Base URL") },
                            singleLine = true,
                            shape = tfShape,
                            colors = tfColors
                        )
                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                        Button(
                            onClick = { onSaveApiBaseUrl(apiBaseUrl) },
                            enabled = !isLoading,
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = ThesisColors.SurfaceElevated,
                                contentColor = ThesisColors.TextPrimary
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp)
                        ) {
                            Text("Save URL", style = ThesisTypography.labelLarge)
                        }
                    }
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
                    Text(
                        text = "EMAIL",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextMuted
                    )
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("you@example.com", color = ThesisColors.TextMuted.copy(alpha = 0.5f)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        singleLine = true,
                        shape = tfShape,
                        colors = tfColors
                    )
                    Text(
                        text = "PASSWORD",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextMuted
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Enter password", color = ThesisColors.TextMuted.copy(alpha = 0.5f)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                        shape = tfShape,
                        colors = tfColors,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = null,
                                    tint = ThesisColors.TextMuted
                                )
                            }
                        }
                    )
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
                    if (isLoginMode) {
                        Button(
                            onClick = { onLogin(email, password) },
                            enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = ThesisColors.Primary,
                                contentColor = ThesisColors.TextInverse,
                                disabledContainerColor = ThesisColors.Primary.copy(alpha = 0.3f)
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
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "Don't have an account? ",
                                style = ThesisTypography.bodyMedium,
                                color = ThesisColors.TextMuted
                            )
                            Text(
                                text = "Register",
                                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.Primary,
                                modifier = Modifier.clickable { isLoginMode = false }
                            )
                        }
                        Text(
                            text = "Forgot password?",
                            style = ThesisTypography.bodyMedium,
                            color = ThesisColors.Primary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(onClick = onForgotPassword)
                        )
                    } else {
                        Button(
                            onClick = { onRegister(email, password) },
                            enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = ThesisColors.Primary,
                                contentColor = ThesisColors.TextInverse,
                                disabledContainerColor = ThesisColors.Primary.copy(alpha = 0.3f)
                            )
                        ) {
                            Text(
                                text = "Register",
                                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "Already have an account? ",
                                style = ThesisTypography.bodyMedium,
                                color = ThesisColors.TextMuted
                            )
                            Text(
                                text = "Log in",
                                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.Primary,
                                modifier = Modifier.clickable { isLoginMode = true }
                            )
                        }
                    }
                }
            }

            if (!registerStatus.isNullOrBlank()) {
                item {
                    Text(
                        text = "Status: $registerStatus",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.Primary
                    )
                }
            }
            if (!message.isNullOrBlank()) {
                item {
                    Text(
                        text = message,
                        style = ThesisTypography.bodySmall,
                        color = statusColor,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            if (showVerificationPanel) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                        HorizontalDivider(color = ThesisColors.Border)
                        Text(
                            text = "VERIFY ACCOUNT",
                            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextMuted
                        )
                        OutlinedTextField(
                            value = verifyToken,
                            onValueChange = { verifyToken = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Code from the email") },
                            singleLine = true,
                            shape = tfShape,
                            colors = tfColors
                        )
                        Button(
                            onClick = { onVerify(email, verifyToken) },
                            enabled = !isLoading,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = ThesisColors.SurfaceElevated,
                                contentColor = ThesisColors.TextPrimary
                            )
                        ) {
                            Text("Verify Account")
                        }
                    }
                }
            }

            item {
                LegalLinks(
                    apiBaseUrl = currentApiBaseUrl,
                    leadText = "By creating an account or logging in, you agree to the"
                )
            }

            item {
                Spacer(modifier = Modifier.height(32.dp))
                Text(
                    text = "THIS IS A RESEARCH TOOL, NOT FINANCIAL ADVICE",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted.copy(alpha = 0.3f),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun AuthValueCard() {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Text(
            text = "WHAT YOU GET",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextMuted
        )
        AuthBenefitRow(
            icon = Icons.Default.Newspaper,
            title = "Morning Pulse",
            description = "What moved overnight before markets open."
        )
        HorizontalDivider(color = ThesisColors.Border)
        AuthBenefitRow(
            icon = Icons.Default.Search,
            title = "Deep Dive",
            description = "${ProductCopy.deepDiveTagline}."
        )
        HorizontalDivider(color = ThesisColors.Border)
        AuthBenefitRow(
            icon = Icons.Default.AutoAwesome,
            title = "My Names",
            description = "Follow what matters across everything."
        )
    }
}

@Composable
private fun AuthBenefitRow(
    icon: ImageVector,
    title: String,
    description: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = ThesisColors.Primary,
            modifier = Modifier.padding(top = 2.dp)
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
        ) {
            Text(
                text = title,
                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
            Text(
                text = description,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }
    }
}
