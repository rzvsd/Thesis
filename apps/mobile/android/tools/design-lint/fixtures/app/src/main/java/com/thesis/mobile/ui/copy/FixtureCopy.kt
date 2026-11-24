// design-lint self-test fixture: every string literal in ui/copy is user-facing copy.
package com.thesis.mobile.ui.copy

object FixtureCopy {
    const val ok = "2 of your names need a review"
    const val rating = "Rated a buy by the model" // LINT: copy-banned-word
    const val dash = "Margins — held" // LINT: copy-em-dash
    const val bang = "Saved!" // LINT: copy-exclamation
    const val neq = "a != b is code, not copy"
    val template = "Hi $name, ${if (!seen) "new" else "seen"} items"
    const val raw = """Bullish""" // LINT: copy-banned-word
    const val allowed = "This one hold is allowlisted"
}
