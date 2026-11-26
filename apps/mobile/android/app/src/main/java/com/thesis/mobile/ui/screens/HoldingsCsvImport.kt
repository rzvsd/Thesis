package com.thesis.mobile.ui.screens

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val MAX_CSV_BYTES = 512 * 1024
private val CSV_MIME_TYPES = arrayOf(
    "text/csv",
    "text/comma-separated-values",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel",
)

/**
 * The Android half of the holdings import (DESIGN-DIRECTION 5.10): opens the system file picker for a CSV
 * (ticker, shares, optional cost_basis; no brokerage link) and hands the text back as a [CsvPick]. The panel,
 * the progress and the per-row result live in NamesScreen's HoldingsImportPanel, which the harness renders.
 * Returns the function that opens the picker.
 */
@Composable
fun rememberHoldingsCsvPicker(onResult: (CsvPick) -> Unit): () -> Unit {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val latest by rememberUpdatedState(onResult)
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) {
            latest(CsvPick.Cancelled)
        } else {
            scope.launch {
                val csv = withContext(Dispatchers.IO) { readCsv(context, uri) }
                latest(if (csv == null) CsvPick.Unreadable else CsvPick.Text(csv))
            }
        }
    }
    return remember(launcher) { { launcher.launch(CSV_MIME_TYPES) } }
}

/** Reads at most [MAX_CSV_BYTES]; null when the file is unreadable or larger. readNBytes needs API 33 (minSdk 26). */
private fun readCsv(context: Context, uri: Uri): String? = runCatching {
    context.contentResolver.openInputStream(uri)?.use { stream ->
        val buffer = ByteArray(MAX_CSV_BYTES + 1)
        var size = 0
        while (size < buffer.size) {
            val read = stream.read(buffer, size, buffer.size - size)
            if (read < 0) break
            size += read
        }
        if (size > MAX_CSV_BYTES) null else String(buffer, 0, size, Charsets.UTF_8)
    }
}.getOrNull()
