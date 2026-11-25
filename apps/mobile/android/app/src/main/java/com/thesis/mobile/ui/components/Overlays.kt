package com.thesis.mobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.SnackbarData
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.util.lerp
import androidx.compose.ui.window.Dialog
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.platform.ThesisBackHandler
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisSurface
import com.thesis.mobile.ui.theme.ThesisType
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.abs
import kotlin.math.roundToInt

/*
 * Sheets, the dock panel, dialogs and snackbars (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #20 to #23).
 * Content enters with a crossfade and an 8 dp rise (`Enter`); no stagger, no blur. On M3 1.2 a ThesisSheet is a
 * separate window with unreliable IME insets, so any panel with a text field is a DockPanel.
 */

/** Entrance of sheet / panel content: fade + [ThesisMotion.EnterOffset] rise over `Enter`. Instant when reduced. */
private fun Modifier.enterRise(): Modifier = composed {
    val reduced = LocalReducedMotion.current
    val progress = remember { Animatable(if (reduced) 1f else 0f) }
    LaunchedEffect(Unit) { if (!reduced) progress.animateTo(1f, ThesisMotion.enter()) }
    val rise = with(LocalDensity.current) { ThesisMotion.EnterOffset.toPx() }
    graphicsLayer {
        alpha = progress.value
        translationY = (1f - progress.value) * rise
    }
}

/** Drag handle: 36 x 4 `line2` pill. */
@Composable
fun SheetHandle(modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Box(modifier.fillMaxWidth().padding(vertical = ThesisSpace.m), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(ThesisSpace.dragHandleWidth, ThesisSpace.dragHandleHeight)
                .clip(ThesisShape.pill)
                .background(p.line2),
        )
    }
}

/**
 * The body of a sheet: an optional `subhead` [title] (heading) and the [content], padded 16 with the entrance rise.
 * Used by [ThesisSheet] and [DockPanel]; galleries render it on its own.
 */
@Composable
fun ThesisSheetContent(
    modifier: Modifier = Modifier,
    title: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val p = LocalThesisPalette.current
    Column(
        modifier
            .fillMaxWidth()
            .enterRise()
            .padding(start = ThesisSpace.l, end = ThesisSpace.l, bottom = ThesisSpace.l),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
    ) {
        if (title != null) {
            Text(title, modifier = Modifier.semantics { heading() }, style = ThesisType.subhead, color = p.ink)
        }
        content()
    }
}

/**
 * Bottom sheet (#20): M3 ModalBottomSheet with the `sheet` shape, `surface` container, `scrim`, the 36 x 4 handle and
 * a `subhead` [title]. Menus, sources and pickers; never a text field (use [DockPanel]).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ThesisSheet(
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null,
    sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    content: @Composable ColumnScope.() -> Unit,
) {
    val p = LocalThesisPalette.current
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        modifier = modifier,
        sheetState = sheetState,
        shape = ThesisShape.sheet,
        containerColor = p.surface,
        contentColor = p.ink,
        tonalElevation = 0.dp,
        scrimColor = p.scrim,
        dragHandle = { SheetHandle() },
    ) {
        ThesisSheetContent(title = title, content = content)
    }
}

/** DockPanel heights. */
enum class DockDetent { Half, Full }

/**
 * In-window panel anchored to the bottom (#21), for anything with a text field (notes over the report). Detents 45%
 * and 85% of the available height; drag the handle between them (or down past Half to close). The content behind
 * stays visible and scrollable (no scrim). Back closes it first. When a field inside gains focus the panel moves to
 * [DockDetent.Full]. Place it as the last child of a full-size Box.
 */
@Composable
fun DockPanel(
    visible: Boolean,
    onDismiss: () -> Unit,
    detent: DockDetent,
    onDetentChange: (DockDetent) -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    ThesisBackHandler(enabled = visible, onBack = onDismiss)
    BoxWithConstraints(modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        val fullPx = constraints.maxHeight.toFloat()
        val target = if (detent == DockDetent.Full) Kit.DOCK_DETENT_FULL else Kit.DOCK_DETENT_HALF
        val fraction by animateFloatAsState(
            target,
            if (reduced) ThesisMotion.timed(true, 0) else ThesisMotion.spatialSlow(),
            label = "dockDetent",
        )
        var drag by remember { mutableFloatStateOf(0f) }
        val dragState = rememberDraggableState { delta -> drag += delta }
        AnimatedVisibility(
            visible = visible,
            enter = if (reduced) fadeIn(tween(0)) else slideInVertically(ThesisMotion.enter()) { it / 4 } + fadeIn(ThesisMotion.enter()),
            exit = if (reduced) fadeOut(tween(0)) else slideOutVertically(tween(ThesisMotion.Base, easing = ThesisMotion.EaseExit)) { it / 4 } +
                fadeOut(tween(ThesisMotion.Quick, easing = ThesisMotion.EaseExit)),
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .layout { measurable, constraints ->
                        val h = (fullPx * fraction - drag).coerceIn(0f, fullPx).roundToInt()
                        val placeable = measurable.measure(constraints.copy(minHeight = h, maxHeight = h))
                        layout(placeable.width, h) { placeable.place(0, 0) }
                    }
                    .clip(ThesisShape.sheet)
                    .background(p.surface.copy(alpha = ThesisSurface.DOCK_PANEL_ALPHA))
                    .border(ThesisSpace.border, p.line, ThesisShape.sheet)
                    .windowInsetsPadding(WindowInsets.navigationBars),
            ) {
                SheetHandle(
                    Modifier.draggable(
                        state = dragState,
                        orientation = Orientation.Vertical,
                        onDragStopped = {
                            val now = fraction - drag / fullPx
                            drag = 0f
                            when {
                                now < Kit.DOCK_DETENT_HALF * 0.6f -> onDismiss()
                                abs(now - Kit.DOCK_DETENT_FULL) < abs(now - Kit.DOCK_DETENT_HALF) -> onDetentChange(DockDetent.Full)
                                else -> onDetentChange(DockDetent.Half)
                            }
                        },
                    ),
                )
                ThesisSheetContent(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .onFocusChanged { if (it.hasFocus && detent != DockDetent.Full) onDetentChange(DockDetent.Full) },
                    title = title,
                    content = content,
                )
            }
        }
    }
}

/** One dialog button. */
data class DialogAction(val label: String, val onClick: () -> Unit, val enabled: Boolean = true)

/**
 * The dialog card itself (#22): `dialog` radius, `surface`, `subhead` title, `body` ink2 text and right-aligned
 * actions (a tertiary dismiss and a primary, or a destructive confirm whose disabled state is visibly muted).
 */
@Composable
fun ThesisDialogContent(
    title: String,
    confirm: DialogAction,
    modifier: Modifier = Modifier,
    body: String? = null,
    dismiss: DialogAction? = null,
    destructive: Boolean = false,
    content: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    Column(
        modifier
            .widthIn(max = ThesisSpace.contentMaxWidth)
            .fillMaxWidth()
            .clip(ThesisShape.dialog)
            .background(p.surface)
            .border(ThesisSpace.border, p.line, ThesisShape.dialog)
            .padding(start = ThesisSpace.xxl, end = ThesisSpace.l, top = ThesisSpace.xxl, bottom = ThesisSpace.s),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
    ) {
        Text(
            title,
            modifier = Modifier.padding(end = ThesisSpace.s).semantics { heading() },
            style = ThesisType.subhead,
            color = p.ink,
        )
        if (body != null) Text(body, modifier = Modifier.padding(end = ThesisSpace.s), style = ThesisType.body, color = p.ink2)
        content?.invoke(this)
        Row(
            Modifier.fillMaxWidth().padding(top = ThesisSpace.xs),
            horizontalArrangement = Arrangement.spacedBy(ThesisSpace.xs, Alignment.End),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (dismiss != null) TertiaryButton(dismiss.label, dismiss.onClick, enabled = dismiss.enabled)
            if (destructive) {
                DestructiveButton(confirm.label, confirm.onClick, enabled = confirm.enabled)
            } else {
                PrimaryButton(confirm.label, confirm.onClick, enabled = confirm.enabled)
            }
        }
    }
}

/**
 * Dialog (#22): [ThesisDialogContent] in a window, entering with scale 0.96 + 8 dp rise + fade over 220 ms
 * (`EaseEnter`). Destructive confirms are required before Remove / Delete (with the `reject()` haptic at the
 * call site when the user confirms a destructive action).
 */
@Composable
fun ThesisDialog(
    onDismissRequest: () -> Unit,
    title: String,
    confirm: DialogAction,
    body: String? = null,
    dismiss: DialogAction? = DialogAction("Cancel", onDismissRequest),
    destructive: Boolean = false,
    content: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val reduced = LocalReducedMotion.current
    Dialog(onDismissRequest = onDismissRequest) {
        val progress = remember { Animatable(if (reduced) 1f else 0f) }
        LaunchedEffect(Unit) {
            if (!reduced) progress.animateTo(1f, tween(ThesisMotion.Dialog, easing = ThesisMotion.EaseEnter))
        }
        val rise = with(LocalDensity.current) { ThesisMotion.EnterOffset.toPx() }
        ThesisDialogContent(
            title = title,
            confirm = confirm,
            body = body,
            dismiss = dismiss,
            destructive = destructive,
            content = content,
            modifier = Modifier.graphicsLayer {
                val t = progress.value
                alpha = t
                val s = lerp(ThesisMotion.DialogScaleFrom, 1f, t)
                scaleX = s
                scaleY = s
                translationY = (1f - t) * rise
            },
        )
    }
}

/**
 * The snackbar itself (#23): `ink` container, `surface` text, the action in the accent that reads on ink, `panel`
 * radius. Announced politely.
 */
@Composable
fun ThesisSnackbar(
    message: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: () -> Unit = {},
) {
    val p = LocalThesisPalette.current
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = ThesisSpace.touchMin)
            .clip(ThesisShape.panel)
            .background(p.ink)
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }
            .padding(start = ThesisSpace.l, end = ThesisSpace.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            message,
            modifier = Modifier.weight(1f).padding(vertical = ThesisSpace.m),
            style = ThesisType.body,
            color = p.surface,
        )
        if (actionLabel != null) {
            Spacer(Modifier.size(ThesisSpace.s))
            TextAction(
                actionLabel,
                onAction,
                Modifier.padding(horizontal = ThesisSpace.s),
                style = ThesisType.button.copy(color = MaterialTheme.colorScheme.inversePrimary),
                trailing = true,
            )
        }
    }
}

/**
 * The shell's snackbar host (#23): one at a time, 16 dp from the edges (the shell places it above the bottom bar),
 * each one rising 12 dp and fading in over 220 ms. Show messages with [showThesisSnackbar].
 */
@Composable
fun ThesisSnackbarHost(hostState: SnackbarHostState, modifier: Modifier = Modifier) {
    val reduced = LocalReducedMotion.current
    SnackbarHost(hostState, modifier.padding(ThesisSpace.l)) { data: SnackbarData ->
        val progress = remember(data) { Animatable(if (reduced) 1f else 0f) }
        LaunchedEffect(data) {
            if (!reduced) progress.animateTo(1f, tween(ThesisMotion.Dialog, easing = ThesisMotion.EaseEnter))
        }
        val rise = with(LocalDensity.current) { ThesisMotion.SnackbarOffset.toPx() }
        ThesisSnackbar(
            message = data.visuals.message,
            actionLabel = data.visuals.actionLabel,
            onAction = { data.performAction() },
            modifier = Modifier.graphicsLayer {
                alpha = progress.value
                translationY = (1f - progress.value) * rise
            },
        )
    }
}

/**
 * Shows [message] for 4 s, or 8 s when it has an [actionLabel] (section 3 #23), and returns how it ended.
 */
suspend fun SnackbarHostState.showThesisSnackbar(message: String, actionLabel: String? = null): SnackbarResult {
    val duration = if (actionLabel != null) Kit.SNACKBAR_ACTION_MS else Kit.SNACKBAR_MS
    return withTimeoutOrNull(duration) {
        showSnackbar(message = message, actionLabel = actionLabel, duration = SnackbarDuration.Indefinite)
    } ?: SnackbarResult.Dismissed
}

