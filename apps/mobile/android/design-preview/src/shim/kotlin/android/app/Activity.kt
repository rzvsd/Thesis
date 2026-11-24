// Minimal stand-in for android.app.Activity so ThesisTheme.kt compiles on the JVM.
// Never instantiated: LocalView.isInEditMode is true in the desktop preview, so the
// status-bar SideEffect that casts to Activity never runs.
package android.app

open class Window {
    var statusBarColor: Int = 0
    var navigationBarColor: Int = 0
}

open class Activity {
    val window: Window = Window()
}
