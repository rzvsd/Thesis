package com.thesis.mobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisSurface
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.heroOf

/*
 * Bars (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #3, #4, #37, #48 and 5.13). Bars draw the page bitmap in
 * window coordinates at 92% plus a hairline, so they never cut a hard rectangle through the glow.
 */

/**
 * The top bar (#3): 56 dp under the status bar. Left: back (`arrow_back`, ink, "Back") when [onBack] is set, else
 * the `THESIS` brand (eyebrow, accent). Middle: [title] (`barTitle`) and an optional [subtitle] caption, shown once
 * [collapsed] (the ScreenHeader has scrolled away) unless [titleAlwaysVisible]. Right: [actions] (at most two icon
 * actions plus the avatar on root tabs).
 *
 * At rest the bar is transparent; when [collapsed] the background bitmap @ 92% (opaque when [overHero]) and the
 * `line` hairline fade in over 200 ms, and the title crossfades. [overHero]: while a HeroBand is under it (not collapsed) the bar reads the hero
 * palette (heroInk icons, no fill) and crossfades to the page palette when it collapses.
 */
@Composable
fun ThesisTopBar(
    modifier: Modifier = Modifier,
    title: String? = null,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    collapsed: Boolean = false,
    overHero: Boolean = false,
    titleAlwaysVisible: Boolean = false,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val base = LocalThesisPalette.current
    val hero = remember(base) { heroOf(base) }
    val reduced = LocalReducedMotion.current
    val heroMode = overHero && !collapsed
    val spec = ThesisMotion.timed<Float>(reduced, ThesisMotion.Bar)
    val background by animateFloatAsState(if (collapsed) 1f else 0f, spec, label = "topBarBackground")
    val titleShown = collapsed || titleAlwaysVisible
    val titleAlpha by animateFloatAsState(
        if (titleShown) 1f else 0f,
        spec,
        label = "topBarTitle",
    )
    val colorSpec = ThesisMotion.timed<androidx.compose.ui.graphics.Color>(reduced, ThesisMotion.Bar)
    val ink by animateColorAsState(if (heroMode) hero.ink else base.ink, colorSpec, label = "topBarInk")
    val ink2 by animateColorAsState(if (heroMode) hero.ink2 else base.ink2, colorSpec, label = "topBarInk2")
    val accent by animateColorAsState(if (heroMode) hero.accent else base.accent, colorSpec, label = "topBarAccent")
    val palette = if (heroMode) hero else base

    CompositionLocalProvider(LocalThesisPalette provides palette, LocalContentColor provides ink) {
        Row(
            modifier
                .fillMaxWidth()
                // Over a HeroBand the collapsed bar is opaque: at 92% the band's title ghosts through as text.
                // The background always uses the page palette [base], never the provided hero one.
                .barBackground(
                    BarHairline.Bottom,
                    opacity = if (overHero) 1f else ThesisSurface.BAR_ALPHA,
                    palette = base,
                ) { background }
                .windowInsetsPadding(TopBarInsets)
                .heightIn(min = ThesisSpace.topBar)
                .padding(horizontal = ThesisSpace.xs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                ThesisIconButton(ThesisIcons.Back, contentDescription = "Back", onClick = onBack, tint = ink)
            } else {
                Text(
                    "THESIS",
                    modifier = Modifier.padding(horizontal = ThesisSpace.m),
                    style = ThesisType.eyebrow,
                    color = accent,
                )
            }
            Column(
                Modifier
                    .weight(1f)
                    .padding(horizontal = ThesisSpace.xs)
                    // Hidden at rest (the ScreenHeader below shows the same title): out of the semantics tree too,
                    // so TalkBack does not read a title that is not on screen.
                    .then(if (titleShown) Modifier else Modifier.clearAndSetSemantics { })
                    .graphicsLayer { alpha = titleAlpha },
            ) {
                if (title != null) {
                    Text(title, style = ThesisType.barTitle, color = ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (subtitle != null) {
                    Text(subtitle, style = ThesisType.caption, color = ink2, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, content = actions)
        }
    }
}

/**
 * The report's own bar (section 5.13): `surface` with a 1 dp `line` bottom, back, the `THESIS` eyebrow in accent
 * with the [ticker] (`barTitle`), a follow toggle (`bookmark`, filled when following; `toggle(on)` haptic) and the
 * overflow menu button.
 */
@Composable
fun ReportTopBar(
    ticker: String,
    onBack: () -> Unit,
    following: Boolean,
    onFollowChange: (Boolean) -> Unit,
    onOverflow: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    val followSource = remember { MutableInteractionSource() }
    Row(
        modifier
            .fillMaxWidth()
            .background(p.surface)
            .drawBehind { drawBarHairline(p.line, BarHairline.Bottom) }
            .windowInsetsPadding(TopBarInsets)
            .heightIn(min = ThesisSpace.topBar)
            .padding(horizontal = ThesisSpace.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ThesisIconButton(ThesisIcons.Back, contentDescription = "Back", onClick = onBack, tint = p.ink)
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            // Large font scales: the ticker keeps the room; the brand eyebrow steps aside.
            if (LocalDensity.current.fontScale <= ThesisType.MAX_DISPLAY_SCALE) {
                Text("THESIS", style = ThesisType.eyebrow, color = p.accent)
                Spacer(Modifier.width(ThesisSpace.s))
            }
            Text(ticker, style = ThesisType.capped(ThesisType.barTitle), color = p.ink, maxLines = 1)
        }
        Box(
            Modifier
                .size(ThesisSpace.touchMin)
                .toggleable(
                    value = following,
                    interactionSource = followSource,
                    indication = null,
                    role = Role.Switch,
                    onValueChange = {
                        haptics.toggle(it)
                        onFollowChange(it)
                    },
                )
                .semantics { contentDescription = if (following) "Following $ticker" else "Follow $ticker" },
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier.size(ThesisSpace.buttonVisual).thesisPress(followSource, shape = CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (following) ThesisIcons.FollowFilled else ThesisIcons.Follow,
                    contentDescription = null,
                    modifier = Modifier.size(ThesisSpace.iconL),
                    tint = if (following) p.ink else p.ink2,
                )
            }
        }
        ThesisIconButton(ThesisIcons.Overflow, contentDescription = "More options", onClick = onOverflow)
    }
}

/** One bottom-bar destination. [hasNew] shows the 6 dp accent dot (Inbox). */
@Immutable
data class BottomBarItem(
    val key: String,
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
    val hasNew: Boolean = false,
)

/**
 * The bottom bar (#4): background bitmap @ 92% with a top hairline; items are a 24 dp glyph over a `navLabel`, with
 * no indicator. Selected: the filled glyph and label in `ink`; unselected: outlined glyph and label in `muted`;
 * crossfade 150 ms. [selectedKey] = null when You (a modal destination) is open. Tabs for TalkBack.
 */
@Composable
fun ThesisBottomBar(
    items: List<BottomBarItem>,
    selectedKey: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    Row(
        modifier
            .fillMaxWidth()
            .barBackground(BarHairline.Top)
            .windowInsetsPadding(BottomBarInsets)
            .heightIn(min = ThesisSpace.bottomBar)
            .selectableGroup(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        items.forEach { item ->
            val selected = item.key == selectedKey
            val source = remember(item.key) { MutableInteractionSource() }
            val color by animateColorAsState(
                if (selected) p.ink else p.muted,
                ThesisMotion.timed(reduced, ThesisMotion.Quick),
                label = "tabColor",
            )
            Column(
                Modifier
                    .weight(1f)
                    .heightIn(min = ThesisSpace.bottomBar)
                    .selectable(
                        selected = selected,
                        interactionSource = source,
                        indication = null,
                        role = Role.Tab,
                        onClick = { onSelect(item.key) },
                    )
                    .semantics { if (item.hasNew) stateDescription = "New alerts" }
                    .thesisPress(source),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box {
                    Crossfade(
                        targetState = selected,
                        animationSpec = tween(if (reduced) 0 else ThesisMotion.Quick),
                        label = "tabGlyph",
                    ) { on ->
                        Icon(
                            if (on) item.selectedIcon else item.icon,
                            contentDescription = null,
                            modifier = Modifier.size(ThesisSpace.iconL),
                            tint = color,
                        )
                    }
                    if (item.hasNew) {
                        Box(
                            Modifier
                                .align(Alignment.TopEnd)
                                .size(ThesisSpace.newDot)
                                .clip(CircleShape)
                                .background(p.accent),
                        )
                    }
                }
                Spacer(Modifier.size(ThesisSpace.xxs))
                // Bar labels sit in a fixed 64 dp bar: they grow up to the display cap (1.3x), like the bar itself.
                Text(item.label, style = ThesisType.capped(ThesisType.navLabel), color = color, maxLines = 1)
            }
        }
    }
}

/** The four tabs (section 5.5), in order: Today, Names, Research, Inbox. */
fun defaultBottomBarItems(inboxHasNew: Boolean = false): List<BottomBarItem> = listOf(
    BottomBarItem("today", "Today", ThesisIcons.Today, ThesisIcons.TodayFilled),
    BottomBarItem("names", "Names", ThesisIcons.Names, ThesisIcons.NamesFilled),
    BottomBarItem("research", "Research", ThesisIcons.Research, ThesisIcons.ResearchFilled),
    BottomBarItem("inbox", "Inbox", ThesisIcons.Inbox, ThesisIcons.InboxFilled, hasNew = inboxHasNew),
)

/**
 * Sticky run bar (#37): background bitmap @ 92% with a top hairline, one full-width PrimaryButton and an optional
 * caption above it ("2 selected"). Slides up (`Enter`) when [visible] turns true. The button keeps its place while
 * [loading].
 */
@Composable
fun RunBar(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    visible: Boolean = true,
    caption: String? = null,
    enabled: Boolean = true,
    loading: Boolean = false,
    commit: Boolean = true,
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    AnimatedVisibility(
        visible = visible,
        modifier = modifier,
        enter = if (reduced) fadeIn(tween(0)) else slideInVertically(ThesisMotion.enter()) { it } + fadeIn(ThesisMotion.enter()),
        exit = if (reduced) fadeOut(tween(0)) else slideOutVertically(tween(ThesisMotion.Base, easing = ThesisMotion.EaseExit)) { it } +
            fadeOut(tween(ThesisMotion.Quick, easing = ThesisMotion.EaseExit)),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .barBackground(BarHairline.Top)
                .windowInsetsPadding(BottomBarInsets)
                .padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.s),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs),
        ) {
            if (caption != null) Text(caption, style = ThesisType.caption, color = p.ink2)
            PrimaryButton(label, onClick, Modifier.fillMaxWidth(), enabled = enabled, loading = loading, commit = commit)
        }
    }
}

/** One ReportDock segment; [badge] marks a Pro tool ("Pro"). */
@Immutable
data class DockItem(val label: String, val onClick: () -> Unit, val badge: String? = null)

/**
 * The report dock (#48): a floating pill row (surface @ 94%, 1 dp `line2`, 48 dp, 16 dp from the edges, above the
 * navigation inset) of outline-style segments. Hides on scroll down and shows on scroll up: the caller passes
 * [visible]; the dock moves by its height + fade with the `spatial` spring.
 */
@Composable
fun ReportDock(items: List<DockItem>, modifier: Modifier = Modifier, visible: Boolean = true) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val shown by animateFloatAsState(
        if (visible) 1f else 0f,
        if (reduced) ThesisMotion.timed(true, 0) else ThesisMotion.spatial(),
        label = "dockShown",
    )
    val travel = with(LocalDensity.current) { (ThesisSpace.touchMin + ThesisSpace.l).toPx() }
    Row(
        modifier
            .windowInsetsPadding(BottomBarInsets)
            .padding(ThesisSpace.l)
            .graphicsLayer {
                alpha = shown
                translationY = (1f - shown) * travel
            }
            .fillMaxWidth()
            .heightIn(min = ThesisSpace.touchMin)
            .clip(ThesisShape.pill)
            .background(p.surface.copy(alpha = ThesisSurface.DOCK_ALPHA))
            .border(ThesisSpace.border, p.line2, ThesisShape.pill)
            .padding(horizontal = ThesisSpace.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        items.forEach { item ->
            val source = remember(item.label) { MutableInteractionSource() }
            Row(
                Modifier
                    .weight(1f)
                    .heightIn(min = ThesisSpace.touchMin)
                    .clickable(source, indication = null, enabled = visible, role = Role.Button, onClick = item.onClick)
                    .thesisPress(source, shape = ThesisShape.pill)
                    .padding(horizontal = ThesisSpace.xs, vertical = ThesisSpace.xs),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(item.label, style = ThesisType.capped(ThesisType.button), color = p.ink, maxLines = 1)
                if (item.badge != null) {
                    Spacer(Modifier.width(ThesisSpace.xs))
                    Text(item.badge, style = ThesisType.eyebrow, color = p.accent)
                }
            }
        }
    }
}
