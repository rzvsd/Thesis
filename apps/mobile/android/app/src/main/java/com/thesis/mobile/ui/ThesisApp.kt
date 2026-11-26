package com.thesis.mobile.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.format.DateFormat
import androidx.activity.OnBackPressedDispatcher
import androidx.activity.OnBackPressedDispatcherOwner
import androidx.activity.compose.LocalOnBackPressedDispatcherOwner
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thesis.mobile.BuildConfig
import com.thesis.mobile.LaunchTarget
import com.thesis.mobile.ui.components.ProvidePageBackground
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.components.showThesisSnackbar
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.platform.ThesisBackHandler
import com.thesis.mobile.ui.screens.AuthScreen
import com.thesis.mobile.ui.screens.DeleteAccountSection
import com.thesis.mobile.ui.screens.OnboardingScreen
import com.thesis.mobile.ui.screens.PasswordResetScreen
import com.thesis.mobile.ui.screens.SampleDeepDiveScreen
import com.thesis.mobile.ui.screens.createPulsePdfExport
import com.thesis.mobile.ui.screens.shareExport
import com.thesis.mobile.ui.shell.LocalScreenChrome
import com.thesis.mobile.ui.shell.SHARED_AXIS_SHIFT
import com.thesis.mobile.ui.shell.ScreenChrome
import com.thesis.mobile.ui.shell.ShellPlatform
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.shell.rememberScreenChrome
import com.thesis.mobile.ui.shell.sharedAxisX
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisTheme
import java.time.Clock
import java.time.ZoneId

/**
 * Which top-level surface is showing: the app shell needs a session, Onboarding and sign-in do not. Sign-in
 * covers Auth and Password reset, which move between each other on the shared X axis (4.5).
 */
private enum class AppSurface { Onboarding, SignIn, Shell }

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
    // Status bar icons over a HeroBand at rest (2.7): the shell reports its visible page; Onboarding, Auth and
    // Password reset report through their own ScreenChrome (HeroUnderBars), by surface key.
    var shellOverHero by remember { mutableStateOf(false) }
    val surfaceChromes = remember { mutableStateMapOf<String, ScreenChrome>() }

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
            // An action published with this message ("Deep Dive ready." → Open) rides on the snackbar (8 s).
            val action = uiState.activeMessageAction
            val result = snackbarHostState.showThesisSnackbar(message, action?.label)
            mainViewModel.clearMessage()
            if (result == SnackbarResult.ActionPerformed && action != null) mainViewModel.onMessageAction(action)
        }
    }

    val appearance = uiState.appearance
    // Device clock, zone and 12/24 h setting for every date and time the app shows (2.4).
    val fmt = remember(context) {
        Fmt(Clock.systemDefaultZone(), ZoneId.systemDefault(), DateFormat.is24HourFormat(context))
    }
    val surface = when {
        uiState.showWelcome -> AppSurface.Onboarding
        uiState.tokens == null -> AppSurface.SignIn
        else -> AppSurface.Shell
    }
    // Status bar icons (2.7, 5.1): light over a HeroBand at rest in both themes, else the theme's. The shell
    // reports its page in front; Onboarding, Auth and Password reset report through their own ScreenChrome.
    val surfaceKey = when (surface) {
        AppSurface.Onboarding -> SURFACE_ONBOARDING
        AppSurface.SignIn -> if (showPasswordReset) SURFACE_PASSWORD_RESET else SURFACE_AUTH
        AppSurface.Shell -> null
    }
    // A surface's chrome registers after its first composition (SurfaceChrome's DisposableEffect), so the first
    // composition after a switch (Auth → Password reset, Onboarding → Auth) finds no entry: keep the last value
    // until it registers, so a switch between two HeroBand surfaces never turns the icons dark for one frame.
    // Not state: only this composition reads it, and writing it must not recompose.
    val lastSurfaceOverHero = remember { BooleanArray(1) }
    val overHero = if (surfaceKey == null) {
        shellOverHero
    } else {
        surfaceChromes[surfaceKey]?.overHero ?: lastSurfaceOverHero[0]
    }
    lastSurfaceOverHero[0] = overHero
    // The theme ORs the in-app toggle with the system animator scale (4.8) and owns the system-bar call.
    ThesisTheme(
        mode = appearance.themeMode,
        upDown = appearance.upDown,
        reduceMotion = appearance.reduceMotion,
        statusBarOverHero = overHero
    ) {
        // One window-sized page background for every surface (2.7); the shell reuses it.
        CompositionLocalProvider(LocalFmt provides fmt) {
            ProvidePageBackground {
                Box(Modifier.fillMaxSize().pageBackground(LocalThesisPalette.current)) {
                    // Onboarding → Auth → App: 300 ms crossfade, no slide (4.5); 150 ms under reduced motion (4.8).
                    val reducedMotion = LocalReducedMotion.current
                    Crossfade(
                        targetState = surface,
                        animationSpec = ThesisMotion.timed(
                            reduced = false,
                            durationMillis = if (reducedMotion) ThesisMotion.Quick else ThesisMotion.Screen
                        ),
                        label = "surface"
                    ) { current ->
                        when (current) {
                            // Onboarding, Auth and Password reset own their insets (the HeroBand runs under the
                            // status bar, 2.7; the form keeps clear of the navigation bar and the keyboard).
                            AppSurface.Onboarding -> SurfaceChrome(SURFACE_ONBOARDING, surfaceChromes) {
                                OnboardingScreen(onComplete = mainViewModel::completeWelcome)
                            }
                            AppSurface.SignIn -> SignInFlow(
                                showPasswordReset = showPasswordReset,
                                onShowPasswordReset = { showPasswordReset = it },
                                uiState = uiState,
                                mainViewModel = mainViewModel,
                                surfaceChromes = surfaceChromes
                            )
                            // The shell applies its own insets (each entry's Scaffold padding, consumeWindowInsets,
                            // imePadding) and its own back handling (predictive back, paywall).
                            AppSurface.Shell -> LoggedInApp(
                                uiState = uiState,
                                mainViewModel = mainViewModel,
                                snackbarHostState = snackbarHostState,
                                context = context,
                                onStatusBarOverHero = { shellOverHero = it }
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Auth ↔ Password reset: shared-axis X, the same spec as a push and a pop in the shell (4.5). */
@Composable
private fun SignInFlow(
    showPasswordReset: Boolean,
    onShowPasswordReset: (Boolean) -> Unit,
    uiState: UiState,
    mainViewModel: MainViewModel,
    surfaceChromes: MutableMap<String, ScreenChrome>
) {
    val reducedMotion = LocalReducedMotion.current
    val shiftPx = with(LocalDensity.current) { SHARED_AXIS_SHIFT.roundToPx() }
    AnimatedContent(
        targetState = showPasswordReset,
        modifier = Modifier.fillMaxSize(),
        transitionSpec = { sharedAxisX(forward = targetState, reducedMotion = reducedMotion, shiftPx = shiftPx) },
        label = "sign-in"
    ) { reset ->
        if (reset) {
            SurfaceChrome(SURFACE_PASSWORD_RESET, surfaceChromes) {
                // Only the visible Password reset handles back (not one that is leaving).
                ThesisBackHandler(enabled = showPasswordReset) { onShowPasswordReset(false) }
                PasswordResetScreen(onDone = { onShowPasswordReset(false) }, mainViewModel = mainViewModel)
            }
        } else {
            SurfaceChrome(SURFACE_AUTH, surfaceChromes) {
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
                    onForgotPassword = { onShowPasswordReset(true) },
                    showDeveloperOptions = BuildConfig.DEBUG,
                    // The ViewModel's typed result (5.3), never a guess from the message's words.
                    status = uiState.authStatus
                )
            }
        }
    }
}

private const val SURFACE_ONBOARDING = "onboarding"
private const val SURFACE_AUTH = "auth"
private const val SURFACE_PASSWORD_RESET = "password-reset"

/**
 * Gives a surface outside the shell its own [ScreenChrome] (registered under [key] in [chromes]), so a screen that
 * opens on a HeroBand can declare it with `HeroUnderBars(collapsed)` and the status bar follows (2.7).
 */
@Composable
private fun SurfaceChrome(key: String, chromes: MutableMap<String, ScreenChrome>, content: @Composable () -> Unit) {
    val chrome = rememberScreenChrome()
    DisposableEffect(key, chrome) {
        chromes[key] = chrome
        onDispose { if (chromes[key] === chrome) chromes.remove(key) }
    }
    CompositionLocalProvider(LocalScreenChrome provides chrome, content = content)
}

@Composable
private fun LoggedInApp(
    uiState: UiState,
    mainViewModel: MainViewModel,
    snackbarHostState: SnackbarHostState,
    context: Context,
    onStatusBarOverHero: (Boolean) -> Unit
) {
    val navigator = mainViewModel.navigator
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
        shareText = { fileName, text -> shareText(context, fileName, text) },
        deleteAccountSection = { DeleteAccountSection(mainViewModel) },
        isResumed = rememberIsResumed(),
        backScope = { covered, content -> CoveredBackScope(covered, content) },
        onStatusBarOverHero = onStatusBarOverHero
    )

    ThesisShell(
        state = uiState,
        navigator = navigator,
        actions = mainViewModel,
        platform = platform,
        snackbarHostState = snackbarHostState
    )
}

/** True while the Activity is RESUMED: the War Room auto-refresh pauses when the app goes to the background. */
@Composable
private fun rememberIsResumed(): Boolean {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var resumed by remember(lifecycle) { mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, _ ->
            resumed = lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    return resumed
}

/**
 * Back handlers inside [content] register with the Activity's dispatcher only while [covered] is false; while it
 * is true they register with a detached dispatcher that nothing calls. The shell wraps the report base layer in
 * this, so the report WebView's "back within the page" handler (registered after the shell's own) cannot take a
 * system back meant for a screen, modal or paywall drawn over the report. Always the same provider node, so
 * toggling [covered] moves the handlers between dispatchers without rebuilding the WebView.
 */
@Composable
private fun CoveredBackScope(covered: Boolean, content: @Composable () -> Unit) {
    val activityOwner = LocalOnBackPressedDispatcherOwner.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val detachedOwner = remember(lifecycleOwner) {
        object : OnBackPressedDispatcherOwner {
            override val onBackPressedDispatcher: OnBackPressedDispatcher = OnBackPressedDispatcher()
            override val lifecycle: Lifecycle get() = lifecycleOwner.lifecycle
        }
    }
    val provided = if (covered || activityOwner == null) detachedOwner else activityOwner
    CompositionLocalProvider(LocalOnBackPressedDispatcherOwner provides provided) {
        content()
    }
}

/**
 * Hands [text] to the system share sheet as a plain-text document named [fileName] (the notes export, 5.22; a note
 * from Name). The chooser lets the person save it to Files or send it on.
 */
private fun shareText(context: Context, fileName: String, text: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, fileName)
        putExtra(Intent.EXTRA_TITLE, fileName)
        putExtra(Intent.EXTRA_TEXT, text)
    }
    val chooser = Intent.createChooser(send, fileName).apply {
        if (context !is Activity) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(chooser) }
}
