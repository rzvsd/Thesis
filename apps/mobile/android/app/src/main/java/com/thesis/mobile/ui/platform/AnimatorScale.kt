package com.thesis.mobile.ui.platform

import android.content.ContentResolver
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext

/*
 * System animator duration scale (docs/app-redesign/DESIGN-DIRECTION.md, section 4.8; playbook 3.2), observed so
 * that turning "Remove animations" on or off applies without a restart. Not @ReadOnlyComposable: it remembers an
 * observer. design-preview compiles its shim (-Dpreview.reducedMotion) instead: keep the public API identical.
 */

private fun ContentResolver.animatorScale(): Float =
    Settings.Global.getFloat(this, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)

/** The system animator duration scale (developer options / "Remove animations"); 0 means animations are off. */
@Composable
fun rememberAnimatorDurationScale(): Float {
    val resolver = LocalContext.current.contentResolver
    var scale by remember(resolver) { mutableFloatStateOf(resolver.animatorScale()) }
    DisposableEffect(resolver) {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                scale = resolver.animatorScale()
            }
        }
        resolver.registerContentObserver(
            Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, observer,
        )
        scale = resolver.animatorScale() // catch a change between remember and register
        onDispose { resolver.unregisterContentObserver(observer) }
    }
    return scale
}

/**
 * True when the system asks for no animation (animator duration scale 0). ThesisTheme ORs this with the in-app
 * "Reduce motion" setting to provide LocalReducedMotion (section 4.8).
 */
@Composable
fun rememberSystemReducedMotion(): Boolean = rememberAnimatorDurationScale() == 0f
