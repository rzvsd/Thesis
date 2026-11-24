package com.thesis.mobile.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thesis.mobile.BuildConfig
import com.thesis.mobile.LaunchTarget
import com.thesis.mobile.ui.screens.AuthScreen
import com.thesis.mobile.ui.screens.DeleteAccountSection
import com.thesis.mobile.ui.screens.MacroStressDashboardScreen
import com.thesis.mobile.ui.screens.OnboardingScreen
import com.thesis.mobile.ui.screens.PasswordResetScreen
import com.thesis.mobile.ui.screens.SampleDeepDiveScreen
import com.thesis.mobile.ui.screens.createPulsePdfExport
import com.thesis.mobile.ui.screens.shareExport
import com.thesis.mobile.ui.shell.ShellPlatform
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisTheme

/** Which top-level surface is showing: the app shell needs a session, Auth and Onboarding do not. */
private enum class AppSurface { Onboarding, Auth, PasswordReset, Shell }

/**
 * The Activity's content (DESIGN-DIRECTION 5.5): collects [UiState], applies launch targets, provides the
 * theme from the stored appearance, and hands the logged-in app to [ThesisShell] with the Android-only pieces.
 * Navigation lives in `MainViewModel.navigator`; this file holds no screen state beyond the auth sub-flow.
 */
@Composable
fun ThesisApp(
    launchTarget: LaunchTarget? = null,
    onLaunchHandled: () -> Unit = {},
    mainViewModel: MainViewModel = viewModel()
) {
    var uiState by remember { mutableStateOf(mainViewModel.state) }
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    var showPasswordReset by rememberSaveable { mutableStateOf(false) }

    DisposableEffect(mainViewModel) {
        mainViewModel.observe { state -> uiState = state }
        onDispose {}
    }

    // Notifications, App Links and shortcuts: routed once a session exists (DeepLinkRouter, 5.5).
    LaunchedEffect(launchTarget?.requestId, uiState.tokens) {
        val target = launchTarget ?: return@LaunchedEffect
        if (uiState.tokens == null) return@LaunchedEffect
        mainViewModel.applyLaunchTarget(target)
        onLaunchHandled()
    }

    LaunchedEffect(uiState.message, uiState.tokens) {
        val message = uiState.message
        if (!message.isNullOrBlank() && uiState.tokens != null) {
            snackbarHostState.showSnackbar(message)
            mainViewModel.clearMessage()
        }
    }

    val appearance = uiState.appearance
    ThesisTheme(
        mode = appearance.themeMode,
        upDown = appearance.upDown,
        reduceMotion = appearance.reduceMotion || remember(context) { systemAnimationsOff(context) }
    ) {
        val surface = when {
            uiState.showWelcome -> AppSurface.Onboarding
            uiState.tokens == null && showPasswordReset -> AppSurface.PasswordReset
            uiState.tokens == null -> AppSurface.Auth
            else -> AppSurface.Shell
        }
        Box(Modifier.fillMaxSize().background(ThesisColors.Background)) {
            // Onboarding → Auth → App: 300 ms crossfade, no slide (4.5).
            Crossfade(targetState = surface, animationSpec = tween(300), label = "surface") { current ->
                when (current) {
                    AppSurface.Onboarding -> PreLoginInsets {
                        OnboardingScreen(onComplete = mainViewModel::completeWelcome)
                    }
                    AppSurface.PasswordReset -> PreLoginInsets {
                        BackHandler { showPasswordReset = false }
                        PasswordResetScreen(onDone = { showPasswordReset = false }, mainViewModel = mainViewModel)
                    }
                    AppSurface.Auth -> PreLoginInsets {
                        AuthScreen(
                            isLoading = uiState.authBusy,
                            currentApiBaseUrl = uiState.apiBaseUrl,
                            verificationToken = uiState.verificationToken,
                            registerStatus = uiState.registerStatus,
                            message = uiState.message,
                            onSaveApiBaseUrl = mainViewModel::updateApiBaseUrl,
                            onRegister = mainViewModel::register,
                            onVerify = mainViewModel::verify,
                            onLogin = mainViewModel::login,
                            onForgotPassword = { showPasswordReset = true },
                            showDeveloperOptions = BuildConfig.DEBUG
                        )
                    }
                    // The shell applies its own insets (Scaffold padding, consumeWindowInsets, imePadding).
                    AppSurface.Shell -> LoggedInApp(uiState, mainViewModel, snackbarHostState, context)
                }
            }
        }
    }
}

/**
 * Onboarding, Auth and Password reset draw outside the shell. Under `enableEdgeToEdge()` the window no longer
 * resizes for the keyboard (API 30+), so these surfaces keep clear of the status bar, the navigation bar, the
 * display cutout and the IME themselves (`safeDrawing` includes the IME): the Log in button and the lower fields
 * rise above the keyboard, and Onboarding's bottom CTA clears a 48 dp 3-button navigation bar.
 */
@Composable
private fun PreLoginInsets(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
        content()
    }
}

@Composable
private fun LoggedInApp(
    uiState: UiState,
    mainViewModel: MainViewModel,
    snackbarHostState: SnackbarHostState,
    context: Context
) {
    val navigator = mainViewModel.navigator
    val paywallOpen = !uiState.paywallFeature.isNullOrBlank()

    // Enabled only while back has work, so the system back-to-home animation still plays at Today's root.
    BackHandler(enabled = paywallOpen || navigator.canGoBack) {
        if (paywallOpen) mainViewModel.dismissPaywall() else mainViewModel.onBack()
    }

    val activity = context as? Activity
    val platform = ShellPlatform(
        startPurchase = activity?.let { host -> { preferredType -> mainViewModel.startPurchase(host, preferredType) } },
        exportPulsePdf = {
            mainViewModel.exportPulsePdf { download ->
                shareExport(context, createPulsePdfExport(context, download.bytes, download.filename))
            }
        },
        openSystemNotificationSettings = {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            }
            runCatching { context.startActivity(intent) }
        },
        showDeveloperOptions = BuildConfig.DEBUG,
        sampleDeepDive = { padding, onFollowName, onDismiss ->
            SampleDeepDiveScreen(padding = padding, onFollowName = onFollowName, onDismiss = onDismiss)
        },
        macroStressDashboard = { onBack ->
            MacroStressDashboardScreen(
                current = uiState.sentimentCurrent,
                history = uiState.sentimentHistory,
                selectedRangeDays = uiState.sentimentRangeDays,
                sentimentError = uiState.sentimentError,
                onSelectRange = mainViewModel::onSelectMacroRange,
                onBack = onBack
            )
        },
        deleteAccountSection = { DeleteAccountSection(mainViewModel) }
    )

    ThesisShell(
        state = uiState,
        navigator = navigator,
        actions = mainViewModel,
        platform = platform,
        snackbarHostState = snackbarHostState
    )
}

/** System "Remove animations" (animator duration scale 0): reduce motion even with the in-app toggle off (4.8). */
private fun systemAnimationsOff(context: Context): Boolean = runCatching {
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
}.getOrDefault(false)
