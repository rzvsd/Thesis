// Preview stand-ins for app/.../ui/screens/ReportExport.kt and HoldingsCsvImport.kt, which use
// android.graphics.pdf, FileProvider and the Activity Result API. Exports are no-ops in previews.
package com.thesis.mobile.ui.screens

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.ui.theme.ThesisColors
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

// Same constructor as the real class, so a direct ReportExporter(...) call that compiles here compiles in CI too.
@Suppress("UNUSED_PARAMETER")
internal class ReportExporter(
    scope: kotlinx.coroutines.CoroutineScope,
    context: Context,
    onFailed: () -> Unit,
) {
    fun fullReport(report: DeepDiveReportView) = Unit
    fun memo(report: DeepDiveReportView) = Unit
    fun shareCard(report: DeepDiveReportView) = Unit
}

@Composable
internal fun rememberReportExporter(onFailed: () -> Unit): ReportExporter {
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    return androidx.compose.runtime.remember(scope) { ReportExporter(scope, Context(), onFailed) }
}

// ---- Stand-ins for DeepDiveWebPage.kt (android.webkit.WebView). The preview draws a labelled
// placeholder where the WebView-hosted Deep Dive 2.0 report would load.

internal class DeepDivePagePrinter {
    // As the real one: loading until the page reports it has finished.
    internal var isLoading: Boolean = true
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
