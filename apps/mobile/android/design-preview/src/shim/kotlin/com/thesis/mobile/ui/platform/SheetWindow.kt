// Preview implementation of app/.../ui/platform/SheetWindow.kt (Android: keeps a ModalBottomSheet's own dialog
// window's bar icons on the app palette). Same public API. A desktop render has no system bars: the sheet and its
// content run unchanged.
package com.thesis.mobile.ui.platform

import androidx.compose.runtime.Composable

/** Runs [sheet]; `inSheet` just runs the content. Previews draw no system bars. */
@Composable
@Suppress("UNUSED_PARAMETER")
fun SheetWindowBars(
    light: Boolean,
    statusBarLight: Boolean,
    sheet: @Composable (inSheet: @Composable (@Composable () -> Unit) -> Unit) -> Unit,
) = sheet { content -> content() }
