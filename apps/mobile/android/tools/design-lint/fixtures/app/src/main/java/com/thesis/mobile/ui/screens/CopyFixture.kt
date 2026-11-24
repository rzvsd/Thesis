// design-lint self-test fixture for the copy check outside ui/copy: only literals passed to Text( or text =.
package com.thesis.mobile.ui.screens

@Composable
fun CopyFixture(price: Double) {
    Text("Upside is limited") // LINT: copy-banned-word
    Text(text = "A cheap entry point") // LINT: copy-banned-word copy-banned-word
    Text("Revenue grew — again") // LINT: copy-em-dash
    Text("Revenue grew — again") // LINT: copy-em-dash
    Text("Done!") // LINT: copy-exclamation
    Text("Value ${if (!ok) "a" else "b"} shown")
    Text("Targeted updates and stopwatch exits are fine as substrings? no: whole words only")
    Text("Stops and targets are different words")
    Text("Your names held steady")
    val label = "Buy now" // not passed to Text(: outside ui/copy this is not checked
    SomethingElse(title = "Sell")
    Text(label)
}
