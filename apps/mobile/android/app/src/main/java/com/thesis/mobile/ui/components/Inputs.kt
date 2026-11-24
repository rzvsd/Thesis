package com.thesis.mobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/*
 * Inputs (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #19 and #44). A real floating label (never a separate
 * caps label), `surface` fill, 1 dp `control` border turning 2 dp `accent` on focus, `panel` radius, min height 56,
 * a helper or error line (error in `neg` with an icon, announced). Autofill hints and IME chains are set by the
 * screen through [ThesisTextField]'s modifier / keyboard options; `imePadding` comes from ThesisScreen.
 */

@Composable
private fun fieldColors(p: ThesisPalette) = OutlinedTextFieldDefaults.colors(
    focusedTextColor = p.ink,
    unfocusedTextColor = p.ink,
    disabledTextColor = p.muted,
    errorTextColor = p.ink,
    focusedContainerColor = p.surface,
    unfocusedContainerColor = p.surface,
    disabledContainerColor = p.surface2,
    errorContainerColor = p.surface,
    cursorColor = p.accent,
    errorCursorColor = p.neg,
    selectionColors = TextSelectionColors(handleColor = p.accent, backgroundColor = p.highlight),
    focusedBorderColor = p.accent,
    unfocusedBorderColor = p.control,
    disabledBorderColor = p.line,
    errorBorderColor = p.neg,
    focusedLabelColor = p.accent,
    unfocusedLabelColor = p.ink2,
    disabledLabelColor = p.muted,
    errorLabelColor = p.neg,
    focusedPlaceholderColor = p.muted,
    unfocusedPlaceholderColor = p.muted,
    disabledPlaceholderColor = p.muted,
    errorPlaceholderColor = p.muted,
    focusedTrailingIconColor = p.ink2,
    unfocusedTrailingIconColor = p.ink2,
    disabledTrailingIconColor = p.muted,
    errorTrailingIconColor = p.ink2,
    focusedSupportingTextColor = p.ink2,
    unfocusedSupportingTextColor = p.ink2,
    disabledSupportingTextColor = p.muted,
    errorSupportingTextColor = p.neg,
    focusedSuffixColor = p.ink2,
    unfocusedSuffixColor = p.ink2,
    disabledSuffixColor = p.muted,
    errorSuffixColor = p.ink2,
)

/**
 * The kit text field (#19). [error] replaces [helper] and turns the border `neg`; it is announced (liveRegion).
 */
@Composable
fun ThesisTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    helper: String? = null,
    error: String? = null,
    enabled: Boolean = true,
    singleLine: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    suffix: String? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = ThesisSpace.fieldMinHeight),
        enabled = enabled,
        textStyle = MaterialTheme.typography.bodyLarge,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        trailingIcon = trailing,
        suffix = suffix?.let { { Text(it, style = ThesisType.body) } },
        supportingText = when {
            error != null -> {
                {
                    Row(
                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.xs),
                    ) {
                        Icon(ThesisIcons.Small.Error, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconS), tint = p.neg)
                        Text(error, style = ThesisType.caption)
                    }
                }
            }
            helper != null -> {
                { Text(helper, style = ThesisType.caption) }
            }
            else -> null
        },
        isError = error != null,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        singleLine = singleLine,
        shape = ThesisShape.panel,
        colors = fieldColors(p),
    )
}

/** One suggestion under a TickerField. */
@Immutable
data class TickerSuggestion(val ticker: String, val name: String? = null, val inYourNames: Boolean = false)

/**
 * Ticker field (#19): all caps, IME Search ([onSearch]), with an optional trailing [actionLabel] button and the
 * in-window [SuggestionList] (#44) under it (no separate window, so it is IME safe).
 */
@Composable
fun TickerField(
    value: String,
    onValueChange: (String) -> Unit,
    onSearch: () -> Unit,
    modifier: Modifier = Modifier,
    label: String = "Ticker",
    placeholder: String? = "AAPL",
    error: String? = null,
    suggestions: List<TickerSuggestion> = emptyList(),
    onPickSuggestion: (TickerSuggestion) -> Unit = {},
    actionLabel: String? = null,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
        ThesisTextField(
            value = value,
            onValueChange = { onValueChange(it.uppercase()) },
            label = label,
            placeholder = placeholder,
            error = error,
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Characters,
                autoCorrect = false,
                keyboardType = KeyboardType.Ascii,
                imeAction = ImeAction.Search,
            ),
            keyboardActions = KeyboardActions(onSearch = { onSearch() }),
            trailing = actionLabel?.let {
                { TextAction(it, onSearch, Modifier.padding(end = ThesisSpace.m), enabled = value.isNotBlank()) }
            },
        )
        SuggestionList(suggestions, onPickSuggestion)
    }
}

/**
 * Number field (#19): decimal keyboard, a [unit] suffix ("%") and a validation message in [error].
 */
@Composable
fun NumberField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    unit: String? = null,
    helper: String? = null,
    error: String? = null,
    imeAction: ImeAction = ImeAction.Done,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    ThesisTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        modifier = modifier,
        helper = helper,
        error = error,
        suffix = unit,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = imeAction),
        keyboardActions = keyboardActions,
    )
}

/**
 * Password field (#19) with a visibility toggle described as "Show password" / "Hide password".
 */
@Composable
fun PasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String = "Password",
    helper: String? = null,
    error: String? = null,
    imeAction: ImeAction = ImeAction.Done,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    var visible by rememberSaveable { mutableStateOf(false) }
    ThesisTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        modifier = modifier,
        helper = helper,
        error = error,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrect = false, imeAction = imeAction),
        keyboardActions = keyboardActions,
        trailing = {
            ThesisIconButton(
                icon = if (visible) ThesisIcons.HidePassword else ThesisIcons.ShowPassword,
                contentDescription = if (visible) "Hide password" else "Show password",
                onClick = { visible = !visible },
            )
        },
    )
}

/**
 * In-window suggestion dropdown (#44): a `surface` card with `panel` radius and up to six rows (ticker, company
 * name, "In your names"). Appears with a Quick fade; rows press with the tint.
 */
@Composable
fun SuggestionList(
    suggestions: List<TickerSuggestion>,
    onPick: (TickerSuggestion) -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalThesisPalette.current
    AnimatedVisibility(
        visible = suggestions.isNotEmpty(),
        enter = fadeIn(tween(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard)),
        exit = fadeOut(tween(ThesisMotion.Quick, easing = ThesisMotion.EaseExit)),
    ) {
        Column(
            modifier
                .fillMaxWidth()
                .clip(ThesisShape.panel)
                .background(p.surface)
                .border(ThesisSpace.border, p.line, ThesisShape.panel),
        ) {
            suggestions.take(Kit.SUGGESTIONS_MAX).forEachIndexed { i, s ->
                if (i > 0) ThesisDivider(startInset = ThesisSpace.l)
                val source = remember(s.ticker) { MutableInteractionSource() }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable(source, indication = null, role = Role.Button) { onPick(s) }
                        .thesisPress(source)
                        .heightIn(min = ThesisSpace.touchMin)
                        .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.s),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(s.ticker, style = ThesisType.rowTitle, color = p.ink)
                    Spacer(Modifier.width(ThesisSpace.s))
                    Text(
                        s.name.orEmpty(),
                        modifier = Modifier.weight(1f),
                        style = ThesisType.bodySmall,
                        color = p.ink2,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (s.inYourNames) {
                        Spacer(Modifier.width(ThesisSpace.s))
                        Text("In your names", style = ThesisType.caption, color = p.muted)
                    }
                }
            }
        }
    }
}
