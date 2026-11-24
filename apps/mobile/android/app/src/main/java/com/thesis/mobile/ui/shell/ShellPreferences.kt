package com.thesis.mobile.ui.shell

import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.UpDownScheme

/** Names list density (DESIGN-DIRECTION 5.10, "Comfortable · Compact, remembered per device"). */
enum class ListDensity { Comfortable, Compact }

/**
 * You > Appearance, stored per device in `SessionStore`. [reduceMotion] is the in-app toggle only; the shell ORs
 * it with the system animator scale when it provides `LocalReducedMotion` (4.8).
 *
 * Default theme: [ThemeMode.Dark] until F1's light theme ships (keeps today's look), then the owner can flip the
 * default to System in one place.
 */
data class AppearancePrefs(
    val themeMode: ThemeMode = ThemeMode.Dark,
    val upDown: UpDownScheme = UpDownScheme.Classic,
    val reduceMotion: Boolean = false,
    val namesDensity: ListDensity = ListDensity.Comfortable
) {
    companion object {
        /** Stored names, so a renamed enum constant never crashes a read. */
        fun themeModeOf(raw: String?): ThemeMode = ThemeMode.entries.firstOrNull { it.name == raw } ?: AppearancePrefs().themeMode
        fun upDownOf(raw: String?): UpDownScheme = UpDownScheme.entries.firstOrNull { it.name == raw } ?: UpDownScheme.Classic
        fun densityOf(raw: String?): ListDensity = ListDensity.entries.firstOrNull { it.name == raw } ?: ListDensity.Comfortable
    }
}
