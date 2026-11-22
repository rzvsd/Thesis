package com.thesis.mobile.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.thesis.mobile.model.HoldingsImportResultView
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val MAX_CSV_BYTES = 512 * 1024
private val CSV_MIME_TYPES = arrayOf(
    "text/csv",
    "text/comma-separated-values",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel"
)

/** Manual-only holdings: the user picks a CSV (ticker, shares, optional cost_basis); no brokerage link. */
@Composable
fun HoldingsCsvImportAction(
    onImportCsv: suspend (String) -> Result<HoldingsImportResultView>
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var importing by remember { mutableStateOf(false) }
    var summary by remember { mutableStateOf<HoldingsImportResultView?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            importing = true
            failure = null
            summary = null
            val csv = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openInputStream(uri)?.use { stream ->
                        // readNBytes needs API 33 (minSdk is 26), so cap the read by hand.
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
            }
            if (csv == null) {
                failure = "Could not read that file. Pick a CSV under 512 KB."
            } else {
                onImportCsv(csv)
                    .onSuccess { summary = it }
                    .onFailure { failure = it.message ?: "Import failed." }
            }
            importing = false
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        OutlinedButton(
            onClick = { picker.launch(CSV_MIME_TYPES) },
            enabled = !importing,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
        ) {
            Text(
                if (importing) "Importing holdings..." else "Import holdings (CSV)",
                color = ThesisColors.TextMuted
            )
        }
        failure?.let {
            Text(it, style = ThesisTypography.bodyMedium, color = ThesisColors.Error)
        }
        summary?.let { result ->
            val followedNote = if (result.newlyFollowed.isEmpty()) {
                ""
            } else {
                " Now following ${result.newlyFollowed.joinToString(", ")}."
            }
            Text(
                "Imported ${result.imported.size} of ${result.rows} rows.$followedNote",
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextPrimary
            )
            result.errors.forEach { rowError ->
                val ticker = rowError.ticker?.let { " $it" } ?: ""
                Text(
                    "Line ${rowError.line}$ticker: ${rowError.message}",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.Error
                )
            }
        }
    }
}
