// Preview stand-ins for app/.../ui/screens/ReportExport.kt and HoldingsCsvImport.kt, which use
// android.graphics.pdf, FileProvider and the Activity Result API. Exports are no-ops in previews.
package com.thesis.mobile.ui.screens

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.HoldingsImportResultView
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import java.io.File

internal data class ExportArtifact(val file: File, val mimeType: String, val chooserTitle: String)

internal enum class ReportExportType { FULL_REPORT, INVESTMENT_MEMO }

internal fun createPdfExport(context: Context, report: DeepDiveReportView, type: ReportExportType) =
    ExportArtifact(File("preview.pdf"), "application/pdf", "Preview")

internal fun createShareCard(context: Context, report: DeepDiveReportView) =
    ExportArtifact(File("preview.png"), "image/png", "Preview")

internal fun shareExport(context: Context, artifact: ExportArtifact) = Unit

internal suspend fun renderReportPdf(context: Context, report: DeepDiveReportView, type: ReportExportType) =
    createPdfExport(context, report, type)

internal suspend fun renderShareCard(context: Context, report: DeepDiveReportView) = createShareCard(context, report)

/** Idle-state replica of the real HoldingsCsvImportAction (the file picker needs an Activity). */
@Composable
fun HoldingsCsvImportAction(onImportCsv: suspend (String) -> Result<HoldingsImportResultView>) {
    OutlinedButton(
        onClick = {},
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    ) {
        Text("Import holdings (CSV)", color = ThesisColors.TextMuted)
    }
}

// ---- Stand-ins for DeepDiveWebPage.kt (android.webkit.WebView). The preview draws a labelled
// placeholder where the WebView-hosted Deep Dive 2.0 report would load.

internal class DeepDivePagePrinter {
    internal var isLoading: Boolean = false
    fun print(context: Context, ticker: String?): Boolean = false
}

internal fun isDeviceOnline(context: Context): Boolean =
    System.getProperty("preview.online", "true").toBoolean()

@Composable
internal fun rememberDeviceOnline(): androidx.compose.runtime.State<Boolean> =
    androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(isDeviceOnline(Context())) }

@Composable
internal fun DeepDiveWebPage(
    pageUrl: String,
    headers: Map<String, String>,
    backgroundColor: androidx.compose.ui.graphics.Color,
    onMainFrameFailed: (Int?) -> Unit,
    modifier: Modifier = Modifier,
    printer: DeepDivePagePrinter? = null,
    onProgress: (Int) -> Unit = {},
    onLoaded: () -> Unit = {},
    onScroll: (scrollY: Int, dy: Int) -> Unit = { _, _ -> },
    onAddToNote: ((com.thesis.mobile.ui.screens.report.PageSelection) -> Unit)? = null,
) {
    androidx.compose.foundation.layout.Box(
        modifier = modifier.then(Modifier.background(backgroundColor)),
        contentAlignment = androidx.compose.ui.Alignment.Center
    ) {
        Text("WebView: $pageUrl", color = ThesisColors.TextMuted)
    }
}
