// design-lint self-test fixture. Each line that must be reported ends with a marker comment naming the
// pattern id(s); every other line must produce nothing. Markers live in comments, which the lint ignores.
package com.thesis.mobile.ui.screens

val a = Color(0xFF123456) // LINT: color-hex
val b = Color.White // LINT: color-white-black
val c = Color.Black.copy(alpha = 0.5f) // LINT: color-white-black copy-alpha
val d = 14.sp // LINT: sp-literal
val e = 12.5.sp // LINT: sp-literal
val f = 16.dp // LINT: dp-literal
val g = 0.5.dp // LINT: dp-literal (a numeric literal too; the 7.2 regex sees "5.dp")
val h = 0.dp
val i = Dp.Hairline
val j = RoundedCornerShape(14.dp) // LINT: shape-literal dp-literal
val k = RoundedCornerShape(ThesisShape.card)
val l = FontFamily.Serif // LINT: font-family
val m = TextStyle(fontSize = size) // LINT: font-size
val n = tween(300) // LINT: tween
val o = spring(1f, 700f) // LINT: spring
val o2 = Duration.between(a, b) // between( is not tween(
val o3 = offspring(1)
suspend fun p() { delay(10) } // LINT: delay
fun q() { postDelay(10) }
val r = @Composable { CircularProgressIndicator() } // LINT: circular-progress
val s = @Composable { AlertDialog(onDismissRequest = {}) } // LINT: alert-dialog
val t = @Composable { OutlinedButton(onClick = {}) {} } // LINT: outlined-button
val u = @Composable { AssistChip(onClick = {}, label = {}) } // LINT: assist-chip
val v = String.format("%d", 3) // LINT: string-format
val w = "%.2f".format(1.0) // LINT: printf-float
val x = rememberRipple() // LINT: ripple
val y = Icons.Default.Search // LINT: material-icons
val z = Icons.AutoMirrored.Filled.ArrowBack // LINT: material-icons
val aa = ThesisColors.AccentBlue // LINT: deprecated-colors
val ab = ThesisColors.Primary
// Comments never count: Color(0xFF000000), 16.dp, tween(300), delay(1), Color.White
/* Block comments neither: 12.sp RoundedCornerShape(8.dp)
   /* nested */ FontFamily.Serif still in the outer comment */
val ac = "https://example.com/a" // a URL's // inside a string does not start a comment
val ad = '"' // a char literal quote does not open a string
val ae = 24.dp // LINT: dp-literal
val af = "price ${value} in 16.dp" // LINT: dp-literal
