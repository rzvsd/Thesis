package com.thesis.mobile.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.AutofillNode
import androidx.compose.ui.autofill.AutofillType
import androidx.compose.ui.composed
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalAutofill
import androidx.compose.ui.platform.LocalAutofillTree
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.LegalLinks
import com.thesis.mobile.ui.components.PasswordField
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.SecondaryButton
import com.thesis.mobile.ui.components.SegmentedControl
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisLink
import com.thesis.mobile.ui.components.ThesisScreen
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.shell.HeroUnderBars
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/** Share of the window the Auth HeroBand fills while the keyboard is closed (5.3: "about 40% height"). */
private const val HERO_HEIGHT_FRACTION = 0.4f

/**
 * Log in, create account and verify (DESIGN-DIRECTION 5.3).
 *
 * A HeroBand cover (the wordmark in `display`, the tagline in `heroLine`) fills about 40% of the window and gives
 * the room back while the keyboard is open; below it, on paper: Log in · Create account, the email and password
 * fields (labels, autofill, IME Next then Done to submit), the status line ([AuthStatus], announced, right above
 * the button it answers and brought into view above the keyboard), one ink primary button, "Forgot password?", the
 * verify step after an account is created, the legal links and the disclaimer.
 *
 * Pure: the password-reset screen and the debug API switch are the caller's ([onForgotPassword],
 * [showDeveloperOptions] = `BuildConfig.DEBUG`). [status] is the typed result; while the ViewModel only publishes
 * [message], the screen maps it with [AuthStatus.fromMessage]. [initialCreateMode] opens on Create account. Insets:
 * the band runs under the status bar and the form keeps clear of the navigation bar and the keyboard, through
 * consumption-aware insets, so a caller that already pads for them (ThesisApp's pre-login surfaces) gets no double
 * padding.
 */
@OptIn(ExperimentalFoundationApi::class)
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
    showDeveloperOptions: Boolean = false,
    status: AuthStatus? = AuthStatus.fromMessage(message),
    initialCreateMode: Boolean = false,
) {
    var apiBaseUrl by rememberSaveable(currentApiBaseUrl) { mutableStateOf(currentApiBaseUrl) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf(verificationToken.orEmpty()) }
    var createMode by rememberSaveable { mutableStateOf(initialCreateMode) }
    var showApiConfig by rememberSaveable { mutableStateOf(false) }
    var verifying by rememberSaveable {
        mutableStateOf(!verificationToken.isNullOrBlank() || !registerStatus.isNullOrBlank())
    }

    LaunchedEffect(verificationToken) {
        if (!verificationToken.isNullOrBlank()) code = verificationToken
    }
    LaunchedEffect(registerStatus, verificationToken) {
        if (!registerStatus.isNullOrBlank() || !verificationToken.isNullOrBlank()) {
            createMode = true
            verifying = true
        }
    }
    LaunchedEffect(status) {
        when {
            status == null -> Unit
            status.kind == AuthStatus.Kind.VerificationSent -> {
                createMode = true
                verifying = true
            }
            status.opensLogIn -> {
                createMode = false
                verifying = false
                code = ""
            }
        }
    }

    val canSubmit = !isLoading && email.isNotBlank() && password.isNotBlank()
    val submit = {
        if (canSubmit) {
            if (createMode) onRegister(email, password) else onLogin(email, password)
        }
    }
    val canVerify = !isLoading && email.isNotBlank() && code.isNotBlank()
    val verify = { if (canVerify) onVerify(email, code) }

    // The status line sits with the fields and the button it answers, and scrolls into view when it appears, with
    // room for the keyboard below it, so a failed log in is seen as well as announced.
    val statusRequester = remember { BringIntoViewRequester() }
    var statusHeightPx by remember { mutableIntStateOf(0) }
    val imeBottomPx by rememberUpdatedState(WindowInsets.ime.getBottom(LocalDensity.current))
    LaunchedEffect(status) {
        if (status != null) {
            withFrameNanos { }  // one frame, so the banner is laid out and measured
            statusRequester.bringIntoView(Rect(0f, 0f, 1f, (statusHeightPx + imeBottomPx).toFloat()))
        }
    }

    ThesisScreen { _ ->
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val imeOpen = WindowInsets.ime.getBottom(LocalDensity.current) > 0
            val heroMin = if (imeOpen) 0.dp else maxHeight * HERO_HEIGHT_FRACTION
            val scroll = rememberScrollState()
            var heroHeightPx by remember { mutableIntStateOf(0) }
            // The status bar leaves the band once it has scrolled away under it (2.7: light icons only over it).
            val topInsetPx by rememberUpdatedState(WindowInsets.safeDrawing.getTop(LocalDensity.current))
            val heroGone by remember {
                derivedStateOf { heroHeightPx > 0 && scroll.value >= heroHeightPx - topInsetPx }
            }
            HeroUnderBars(collapsed = heroGone)
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(scroll),
            ) {
                AuthHero(minHeight = heroMin, modifier = Modifier.onSizeChanged { heroHeightPx = it.height })
                Column(
                    Modifier
                        .fillMaxWidth()
                        .widthIn(max = ThesisSpace.contentMaxWidth)
                        .align(Alignment.CenterHorizontally)
                        .padding(horizontal = ThesisSpace.gutter)
                        .padding(top = ThesisSpace.xxl, bottom = ThesisSpace.x3),
                    verticalArrangement = Arrangement.spacedBy(ThesisSpace.l),
                ) {
                    val showVerify = verifying && createMode
                    // While verifying, the lede already says the code was sent: no second line saying it again.
                    val repeatsVerify = showVerify && status?.kind == AuthStatus.Kind.VerificationSent
                    val statusLine: @Composable () -> Unit = {
                        if (status != null && !repeatsVerify) {
                            InlineBanner(
                                text = status.text,
                                modifier = Modifier
                                    .bringIntoViewRequester(statusRequester)
                                    .onSizeChanged { statusHeightPx = it.height },
                                tone = when (status.tone) {
                                    AuthStatus.Tone.Error -> BannerTone.Error
                                    else -> BannerTone.Neutral
                                },
                            )
                        }
                    }
                    SegmentedControl(
                        options = authModeOptions(this@BoxWithConstraints.maxWidth),
                        selectedIndex = if (createMode) 1 else 0,
                        onSelect = { i ->
                            createMode = i == 1
                            if (!createMode) verifying = false
                        },
                    )
                    // The verify step opens with its kicker and lede, above the email it was sent to.
                    if (showVerify) VerifyHeading(email)
                    EmailField(value = email, onValueChange = { email = it })
                    if (showVerify) {
                        VerifyStep(
                            code = code,
                            onCodeChange = { code = it },
                            canVerify = canVerify,
                            loading = isLoading,
                            onVerify = verify,
                            onUseAnotherEmail = {
                                verifying = false
                                code = ""
                            },
                            statusLine = statusLine,
                        )
                    } else {
                        PasswordField(
                            value = password,
                            onValueChange = { password = it },
                            modifier = Modifier.autofill(
                                if (createMode) AutofillHint.NewPassword else AutofillHint.Password,
                            ) { password = it },
                            label = AccountCopy.PASSWORD,
                            helper = if (createMode) AccountCopy.PASSWORD_RULE else null,
                            imeAction = ImeAction.Done,
                            keyboardActions = KeyboardActions(onDone = { submit() }),
                        )
                        statusLine()
                        PrimaryButton(
                            text = if (createMode) AccountCopy.CREATE_ACCOUNT else AccountCopy.LOG_IN,
                            onClick = submit,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = canSubmit || isLoading,
                            loading = isLoading,
                        )
                        if (!createMode) ThesisLink(AccountCopy.FORGOT_PASSWORD, onForgotPassword)
                    }
                    if (showDeveloperOptions) {
                        DeveloperApi(
                            expanded = showApiConfig,
                            onToggle = { showApiConfig = !showApiConfig },
                            value = apiBaseUrl,
                            onValueChange = { apiBaseUrl = it },
                            enabled = !isLoading,
                            onSave = { onSaveApiBaseUrl(apiBaseUrl) },
                        )
                    }
                    Spacer(Modifier.height(ThesisSpace.s))
                    LegalLinks(apiBaseUrl = currentApiBaseUrl, leadText = AccountCopy.LEGAL_LEAD)
                    Text(AccountCopy.DISCLAIMER, style = ThesisType.caption, color = LocalThesisPalette.current.muted)
                    Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.safeDrawing))
                }
            }
        }
    }
}

/**
 * The cover: the wordmark and the tagline at the bottom of a band at least [minHeight] tall, running under the
 * status bar (consumption-aware, so it does not pad twice inside a caller that already padded).
 */
@Composable
private fun AuthHero(minHeight: Dp, modifier: Modifier = Modifier) {
    val top = ThesisSpace.x4
    val bottom = ThesisSpace.x3
    HeroBand(
        modifier = modifier,
        contentPadding = PaddingValues(start = ThesisSpace.gutter, end = ThesisSpace.gutter, top = top, bottom = bottom),
        verticalArrangement = Arrangement.Top,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(min = (minHeight - top - bottom).coerceAtLeast(0.dp)),
            verticalArrangement = Arrangement.Bottom,
        ) {
            // Inside the band: the hero palette (heroInk), not the page's.
            val p = LocalThesisPalette.current
            Spacer(Modifier.windowInsetsTopHeight(WindowInsets.safeDrawing))
            Text(
                AccountCopy.BRAND,
                modifier = Modifier.semantics { heading() },
                style = ThesisType.capped(ThesisType.display),
                color = p.ink,
            )
            Spacer(Modifier.height(ThesisSpace.m))
            Text(AccountCopy.AUTH_TAGLINE, style = ThesisType.heroLine, color = p.ink)
        }
    }
}

@Composable
private fun EmailField(value: String, onValueChange: (String) -> Unit) {
    ThesisTextField(
        value = value,
        onValueChange = onValueChange,
        label = AccountCopy.EMAIL,
        modifier = Modifier.autofill(AutofillHint.Email) { onValueChange(it) },
        placeholder = AccountCopy.EMAIL_PLACEHOLDER,
        keyboardOptions = KeyboardOptions(
            capitalization = KeyboardCapitalization.None,
            autoCorrect = false,
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Next,
        ),
    )
}

/**
 * The Log in · Create account labels. Where "Create account" does not fit half the control (2.0x on a 360 dp
 * screen: the kit segment would cut it to "Create"), the segment reads "Sign up"; the button below keeps
 * "Create account". [screenWidth] is the form's window width; the control spans it less the gutters.
 */
@Composable
private fun authModeOptions(screenWidth: Dp): List<String> {
    val controlWidth = minOf(screenWidth, ThesisSpace.contentMaxWidth) - ThesisSpace.gutter * 2
    val full = listOf(AccountCopy.AUTH_MODE_LOG_IN, AccountCopy.AUTH_MODE_CREATE)
    return if (segmentLabelsFit(full, controlWidth)) full else listOf(AccountCopy.AUTH_MODE_LOG_IN, AccountCopy.AUTH_MODE_CREATE_SHORT)
}

/** The verify step's kicker and lede (a heading for TalkBack): what to do with the email that was just sent. */
@Composable
private fun VerifyHeading(email: String) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Kicker(AccountCopy.VERIFY_KICKER, modifier = Modifier.semantics { heading() })
        Text(AccountCopy.verifyLede(email.trim()), style = ThesisType.body, color = p.ink2)
    }
}

/**
 * After "Create account": the code from the email, Verify, and a way back to the create form. A free-text field,
 * not the kit's 6-digit NumberField (5.3): the API's verification token is not guaranteed to be six digits. No
 * "Send a new code" yet: there is no resend endpoint (HANDOFF-G 13).
 */
@Composable
private fun VerifyStep(
    code: String,
    onCodeChange: (String) -> Unit,
    canVerify: Boolean,
    loading: Boolean,
    onVerify: () -> Unit,
    onUseAnotherEmail: () -> Unit,
    statusLine: @Composable () -> Unit,
) {
    ThesisTextField(
        value = code,
        onValueChange = { onCodeChange(it.trim()) },
        label = AccountCopy.VERIFY_CODE,
        keyboardOptions = KeyboardOptions(
            capitalization = KeyboardCapitalization.None,
            autoCorrect = false,
            keyboardType = KeyboardType.Ascii,
            imeAction = ImeAction.Done,
        ),
        keyboardActions = KeyboardActions(onDone = { onVerify() }),
    )
    statusLine()
    PrimaryButton(
        text = AccountCopy.VERIFY,
        onClick = onVerify,
        modifier = Modifier.fillMaxWidth(),
        enabled = canVerify || loading,
        loading = loading,
    )
    // On the text edge, like the fields above it (T4), not inset by a button's padding.
    TextAction(AccountCopy.VERIFY_OTHER_EMAIL, onUseAnotherEmail)
}

/** Debug builds only: the API base URL switch. */
@Composable
private fun DeveloperApi(
    expanded: Boolean,
    onToggle: () -> Unit,
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean,
    onSave: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        TextAction(AccountCopy.CONFIGURE_API, onToggle)
        if (expanded) {
            ThesisTextField(
                value = value,
                onValueChange = onValueChange,
                label = AccountCopy.API_BASE_URL,
                keyboardOptions = KeyboardOptions(autoCorrect = false, keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onSave() }),
            )
            SecondaryButton(AccountCopy.SAVE_API_URL, onSave, enabled = enabled)
        }
    }
}

/**
 * Autofill for a kit field (5.3: autofill hints on email and password), the Compose 1.6 way: an [AutofillNode]
 * with the field's window bounds, requested while the field (a child of this modifier) has focus. [onFill]
 * receives the value the autofill service chose. A no-op where there is no autofill service (design-preview).
 */
internal enum class AutofillHint { Email, Password, NewPassword }

@OptIn(ExperimentalComposeUiApi::class)
private fun AutofillHint.type(): AutofillType = when (this) {
    AutofillHint.Email -> AutofillType.EmailAddress
    AutofillHint.Password -> AutofillType.Password
    AutofillHint.NewPassword -> AutofillType.NewPassword
}

@OptIn(ExperimentalComposeUiApi::class)
internal fun Modifier.autofill(hint: AutofillHint, onFill: (String) -> Unit): Modifier = composed {
    val autofill = LocalAutofill.current
    val fill by rememberUpdatedState(onFill)
    val node = remember(hint) { AutofillNode(autofillTypes = listOf(hint.type()), onFill = { fill(it) }) }
    val tree = LocalAutofillTree.current
    // Registered while the field is in the composition only: a field that leaves (mode switch, verify step) takes
    // its node, and its stale bounds, with it.
    DisposableEffect(tree, node) {
        tree += node
        onDispose { tree.children.remove(node.id) }
    }
    this
        .onGloballyPositioned { node.boundingBox = it.boundsInWindow() }
        .onFocusChanged { state ->
            autofill?.run {
                if (state.isFocused || state.hasFocus) requestAutofillForNode(node) else cancelAutofillForNode(node)
            }
        }
}
