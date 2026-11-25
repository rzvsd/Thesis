package com.thesis.mobile.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.platform.thesisCardShadow
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisSurface
import com.thesis.mobile.ui.theme.ThesisType

/*
 * Cards and callouts (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #12, #13, #24, #26, #40, #46): the Deep Dive
 * card (surface, 1 dp line, 14 dp radius, padding 16, gap 12, bottom-only soft shadow in light), the upshot,
 * plain callout, big question, empty and error states and inline banners.
 */

/** Card looks (#12). */
enum class CardVariant {
    Plain,

    /** "Not seen yet": transparent, 1.5 dp dashed `line2`, dashed-ring tag, muted copy (an honest absence). */
    NotSeen,

    /** Selected (plan cards, compare picks): 1 dp `ink` border and a check in the eyebrow row. */
    Selected,
}

/** DD card foot: hairline, source caption on the left, a text action on the right. */
@Immutable
data class CardFooter(
    val source: String? = null,
    val actionLabel: String? = null,
    val onAction: (() -> Unit)? = null,
)

/** A 1.5 dp (by default) dashed rounded border, as Deep Dive's "Not seen yet" card and nodata box. */
fun Modifier.dashedBorder(color: Color, radius: Dp, width: Dp = ThesisSpace.borderStrong): Modifier = drawBehind {
    val stroke = width.toPx()
    drawRoundRect(
        color = color,
        topLeft = Offset(stroke / 2f, stroke / 2f),
        size = Size(size.width - stroke, size.height - stroke),
        cornerRadius = CornerRadius(radius.toPx()),
        style = Stroke(
            width = stroke,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(Kit.dash.toPx(), Kit.dashGap.toPx())),
        ),
    )
}

/** The light-theme Deep Dive card shadow (`0 10px 28px -20px`, ink @ 35%); nothing in dark. */
internal fun Modifier.kitCardShadow(p: ThesisPalette, radius: Dp = ThesisShape.CardRadius): Modifier = thesisCardShadow(
    enabled = p.cardShadow,
    color = p.ink.copy(alpha = ThesisSurface.CARD_SHADOW_ALPHA),
    cornerRadius = radius,
    offsetY = ThesisSurface.cardShadowOffsetY,
    blur = ThesisSurface.cardShadowBlur,
    spread = -ThesisSurface.cardShadowInsetX,
)

/** Card container: shadow (light), clip, fill and border for [variant]. */
internal fun Modifier.cardContainer(p: ThesisPalette, variant: CardVariant): Modifier {
    val shape = ThesisShape.card
    return when (variant) {
        CardVariant.Plain -> kitCardShadow(p).clip(shape).background(p.surface).border(ThesisSpace.border, p.line, shape)
        CardVariant.Selected -> kitCardShadow(p).clip(shape).background(p.surface).border(ThesisSpace.border, p.ink, shape)
        CardVariant.NotSeen -> dashedBorder(p.line2, ThesisShape.CardRadius).clip(shape)
    }
}

/**
 * The kit card (#12). Slots: [eyebrow] (with a check when [CardVariant.Selected], the dashed "NOT SEEN YET" tag
 * when [CardVariant.NotSeen]), [title] (`cardTitle`, a conclusion sentence, heading), [content] and an optional
 * [footer]. Padding 16, gap 12. Content cards never get their own glow.
 */
@Composable
fun ThesisCard(
    modifier: Modifier = Modifier,
    variant: CardVariant = CardVariant.Plain,
    eyebrow: String? = null,
    eyebrowColor: Color = Color.Unspecified,
    title: String? = null,
    footer: CardFooter? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    val p = LocalThesisPalette.current
    Column(modifier.fillMaxWidth().cardContainer(p, variant)) {
        CardBody(variant, eyebrow, eyebrowColor, title, footer, content)
    }
}

@Composable
private fun CardBody(
    variant: CardVariant,
    eyebrow: String?,
    eyebrowColor: Color,
    title: String?,
    footer: CardFooter?,
    content: @Composable ColumnScope.() -> Unit,
) {
    val p = LocalThesisPalette.current
    Column(
        Modifier
            .fillMaxWidth()
            .padding(ThesisSpace.cardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.cardInnerGap),
    ) {
        if (variant == CardVariant.NotSeen) DashedTag("Not seen yet")
        if (eyebrow != null || variant == CardVariant.Selected) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Eyebrow(eyebrow.orEmpty(), Modifier.weight(1f), color = eyebrowColor)
                if (variant == CardVariant.Selected) {
                    Icon(
                        ThesisIcons.Small.Check,
                        contentDescription = "Selected",
                        modifier = Modifier.size(ThesisSpace.iconS),
                        tint = p.ink,
                    )
                }
            }
        }
        if (title != null) {
            Text(
                title,
                modifier = Modifier.semantics { heading() },
                style = ThesisType.cardTitle,
                color = if (variant == CardVariant.NotSeen) p.ink2 else p.ink,
            )
        }
        content()
        if (footer != null) CardFoot(footer)
    }
}

@Composable
private fun CardFoot(footer: CardFooter) {
    val p = LocalThesisPalette.current
    Column {
        ThesisDivider()
        // DD card foot: 8 dp under the hairline, the card's 16 dp padding below. The action's 48 dp touch area
        // overhangs the line (TextActionImpl inlineTouch) instead of making the foot 48 dp tall.
        Row(
            Modifier.fillMaxWidth().padding(top = ThesisSpace.s),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                footer.source.orEmpty(),
                modifier = Modifier.weight(1f),
                style = ThesisType.caption,
                color = p.muted,
            )
            if (footer.actionLabel != null && footer.onAction != null) {
                Spacer(Modifier.width(ThesisSpace.m))
                TextActionImpl(footer.actionLabel, footer.onAction, trailing = true, inlineTouch = true)
            }
        }
    }
}

/**
 * A standalone clickable card (#40): [ThesisCard] plus the kit press (tint + 0.97 scale), no border change, no
 * haptic. [onLongClick] opens the context sheet (with the `longPress()` haptic, which the caller performs).
 * [onBoundsCaptured] receives the card's window bounds just before [onClick], for the container transform.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PressableCard(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onLongClick: (() -> Unit)? = null,
    onClickLabel: String? = null,
    contentDescription: String? = null,
    onBoundsCaptured: ((Rect) -> Unit)? = null,
    variant: CardVariant = CardVariant.Plain,
    eyebrow: String? = null,
    eyebrowColor: Color = Color.Unspecified,
    title: String? = null,
    footer: CardFooter? = null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
    content: @Composable ColumnScope.() -> Unit = {},
) {
    val p = LocalThesisPalette.current
    var bounds by remember { mutableStateOf(Rect.Zero) }
    Column(
        modifier
            .fillMaxWidth()
            .then(if (onBoundsCaptured != null) Modifier.onGloballyPositioned { bounds = it.boundsInWindow() } else Modifier)
            .combinedClickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClickLabel = onClickLabel,
                onLongClick = onLongClick,
                onClick = {
                    onBoundsCaptured?.invoke(bounds)
                    onClick()
                },
            )
            .then(if (contentDescription != null) Modifier.semantics { this.contentDescription = contentDescription } else Modifier)
            .thesisPress(interactionSource, scale = true, shape = ThesisShape.card)
            .cardContainer(p, variant),
    ) {
        CardBody(variant, eyebrow, eyebrowColor, title, footer, content)
    }
}

/**
 * The upshot (#13, DD `.upshot`): `callout` fill, `panel` radius, a 3 dp accent bar inside the left edge, the
 * kicker [label] and `story` text in ink.
 */
@Composable
fun Upshot(text: AnnotatedString, modifier: Modifier = Modifier, label: String = "The upshot") {
    val p = LocalThesisPalette.current
    Column(
        modifier
            .fillMaxWidth()
            .clip(ThesisShape.panel)
            .background(p.callout)
            .drawBehind { drawRect(p.accent, size = Size(ThesisSpace.accentBar.toPx(), size.height)) }
            .padding(
                start = ThesisSpace.accentBar + ThesisSpace.xl,
                end = ThesisSpace.xl,
                top = ThesisSpace.l,
                bottom = ThesisSpace.l,
            ),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
    ) {
        Kicker(label)
        Text(text, style = ThesisType.story, color = p.ink)
    }
}

@Composable
fun Upshot(text: String, modifier: Modifier = Modifier, label: String = "The upshot") =
    Upshot(AnnotatedString(text), modifier, label)

/** Plain callout (#13): `surface2`, 1 dp `line`, `panel` radius, `bodySmall` ink2. */
@Composable
fun Callout(text: String, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Text(
        text,
        modifier = modifier
            .fillMaxWidth()
            .clip(ThesisShape.panel)
            .background(p.surface2)
            .border(ThesisSpace.border, p.line, ThesisShape.panel)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.m),
        style = ThesisType.bodySmall,
        color = p.ink2,
    )
}

/** The big question (#13): a card with a gold eyebrow and a `subhead` question. */
@Composable
fun BigQuestion(question: String, modifier: Modifier = Modifier, eyebrow: String = "The big question") {
    val p = LocalThesisPalette.current
    ThesisCard(modifier, eyebrow = eyebrow, eyebrowColor = p.accent) {
        Text(question, style = ThesisType.subhead, color = p.ink)
    }
}

/**
 * Paywall plan (#46): the Selected card variant as a radio button: plan [name] (`cardTitle`), [price]
 * (`statValue`), [period] caption and an optional saving badge.
 */
@Composable
fun PlanCard(
    name: String,
    price: String,
    period: String,
    selected: Boolean,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier,
    saving: String? = null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val variant = if (selected) CardVariant.Selected else CardVariant.Plain
    Column(
        modifier
            .fillMaxWidth()
            .selectable(selected, interactionSource = interactionSource, indication = null, role = Role.RadioButton, onClick = onSelect)
            .thesisPress(interactionSource, scale = true, shape = ThesisShape.card)
            .cardContainer(p, variant)
            .padding(ThesisSpace.cardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(name, Modifier.weight(1f), style = ThesisType.cardTitle, color = p.ink)
            if (selected) {
                Icon(ThesisIcons.Small.Check, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconS), tint = p.ink)
            }
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
            Text(price, Modifier.alignByBaseline(), style = ThesisType.statValue, color = p.ink)
            Text(period, Modifier.alignByBaseline(), style = ThesisType.caption, color = p.muted)
        }
        if (saving != null) StatusBadge(saving, p.accent)
    }
}

/**
 * Empty state (#24) inside a card: optional 20 dp line [icon] (muted), a `subhead` [sentence] saying what will be
 * here, a `body` ink2 [how] line saying how to get it, and at most one button. Sentence case only.
 */
@Composable
fun EmptyState(
    sentence: String,
    modifier: Modifier = Modifier,
    how: String? = null,
    icon: ImageVector? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    primaryAction: Boolean = false,
) {
    val p = LocalThesisPalette.current
    ThesisCard(modifier) {
        if (icon != null) Icon(icon, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconM), tint = p.muted)
        Text(sentence, style = ThesisType.subhead, color = p.ink)
        if (how != null) Text(how, style = ThesisType.body, color = p.ink2)
        if (actionLabel != null && onAction != null) {
            if (primaryAction) PrimaryButton(actionLabel, onAction) else SecondaryButton(actionLabel, onAction)
        }
    }
}

/**
 * Error state (#26): a card with a `subhead` [title] ("Couldn’t load your names", [KitCopy.couldNotLoad]), the
 * [cause] in plain words and a "Try again" secondary button. Announced politely.
 */
@Composable
fun ErrorState(
    title: String,
    modifier: Modifier = Modifier,
    cause: String? = null,
    retryLabel: String = KitCopy.TRY_AGAIN,
    onRetry: (() -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    ThesisCard(modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
        Text(title, style = ThesisType.subhead, color = p.ink)
        if (cause != null) Text(cause, style = ThesisType.body, color = p.ink2)
        if (onRetry != null) SecondaryButton(retryLabel, onRetry, leadingIcon = ThesisIcons.Small.Retry)
    }
}

/** Inline banner tones (#26). */
enum class BannerTone { Neutral, Attention, Error }

/**
 * Inline banner (#26): a `surface2` row with a 1 dp `line` border, a 16 dp icon, caption text and an optional text action. It never
 * replaces content that is already loaded. Announced politely.
 */
@Composable
fun InlineBanner(
    text: String,
    modifier: Modifier = Modifier,
    tone: BannerTone = BannerTone.Neutral,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    val (icon, tint) = when (tone) {
        BannerTone.Neutral -> ThesisIcons.Small.Info to p.ink2
        BannerTone.Attention -> ThesisIcons.Small.Attention to p.warn
        BannerTone.Error -> ThesisIcons.Small.Error to p.neg
    }
    Row(
        modifier
            .fillMaxWidth()
            .clip(ThesisShape.panel)
            .background(p.surface2)
            // A 1 dp line, as the plain Callout has: in light, surface2 on bg is 1.03:1 and draws no container.
            .border(ThesisSpace.border, p.line, ThesisShape.panel)
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }
            .padding(start = ThesisSpace.m, end = ThesisSpace.m),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconS), tint = tint)
        Text(
            text,
            modifier = Modifier.weight(1f).padding(vertical = ThesisSpace.m),
            style = ThesisType.caption,
            color = if (tone == BannerTone.Error) p.ink else p.ink2,
        )
        if (actionLabel != null && onAction != null) TextAction(actionLabel, onAction, trailing = true)
    }
}
