// Preview stand-in for rememberHoldingsCsvPicker in app/.../ui/screens/HoldingsCsvImport.kt, which needs the
// Activity Result API. In previews the picker does nothing; the import panel renders its states from fixtures.
package com.thesis.mobile.ui.screens

import androidx.compose.runtime.Composable

@Composable
fun rememberHoldingsCsvPicker(onResult: (CsvPick) -> Unit): () -> Unit = {}
