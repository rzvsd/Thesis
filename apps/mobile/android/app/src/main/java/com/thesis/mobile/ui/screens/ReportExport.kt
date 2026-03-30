package com.thesis.mobile.ui.screens

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.thesis.mobile.model.DeepDiveReportView
import java.io.File
import java.io.FileOutputStream

internal data class ExportArtifact(
    val file: File,
    val mimeType: String,
    val chooserTitle: String
)

internal enum class ReportExportType {
    FULL_REPORT,
    INVESTMENT_MEMO
}

internal fun createPdfExport(
    context: Context,
    report: DeepDiveReportView,
    type: ReportExportType
): ExportArtifact {
    val document = PdfDocument()
    val page = document.startPage(PdfDocument.PageInfo.Builder(1080, 1920, 1).create())
    val canvas = page.canvas

    canvas.drawColor(Color.parseColor("#0B111B"))

    val titlePaint = Paint().apply {
        color = Color.WHITE
        textSize = 44f
        isFakeBoldText = true
        isAntiAlias = true
    }
    val bodyPaint = Paint().apply {
        color = Color.parseColor("#D8DEE9")
        textSize = 28f
        isAntiAlias = true
    }
    val labelPaint = Paint().apply {
        color = Color.parseColor("#8EA4BF")
        textSize = 24f
        isFakeBoldText = true
        isAntiAlias = true
    }

    var y = 90f
    val left = 60f
    val maxWidth = 960f

    val title = when (type) {
        ReportExportType.FULL_REPORT -> "Thesis Deep Dive Report"
        ReportExportType.INVESTMENT_MEMO -> "Investment Memo"
    }
    canvas.drawText(title, left, y, titlePaint)
    y += 52f

    canvas.drawText("Ticker: ${report.ticker ?: "N/A"}", left, y, labelPaint)
    y += 36f
    canvas.drawText("Signal: ${report.signalValue?.uppercase() ?: "NO_SIGNAL"}", left, y, labelPaint)
    y += 36f
    canvas.drawText(
        "Confidence: ${report.confidenceLabel?.uppercase() ?: "UNKNOWN"} (${report.confidenceScore?.let { String.format("%.2f", it) } ?: "n/a"})",
        left,
        y,
        labelPaint
    )
    y += 48f

    val thesis = report.thesisStatement?.takeIf { it.isNotBlank() }
        ?: report.sections.firstOrNull { it.body.isNotBlank() }?.body
        ?: "No thesis statement available."

    canvas.drawText("Thesis", left, y, labelPaint)
    y += 34f
    y = drawWrappedText(canvas, thesis, left, y, maxWidth, bodyPaint)
    y += 24f

    if (type == ReportExportType.FULL_REPORT) {
        report.sections.take(6).forEach { section ->
            if (y > 1760f) return@forEach
            canvas.drawText(section.title, left, y, labelPaint)
            y += 34f
            val sectionBody = section.body.ifBlank { "No content." }
            y = drawWrappedText(canvas, sectionBody, left, y, maxWidth, bodyPaint)
            y += 18f
        }
    } else {
        report.valuation?.let { valuation ->
            canvas.drawText("Valuation Summary", left, y, labelPaint)
            y += 34f
            val valuationText = buildString {
                append("Fair value mid: ${valuation.fairValueMid?.let { String.format("%.2f", it) } ?: "n/a"}")
                append("\n")
                append("Spot price: ${valuation.spotPrice?.let { String.format("%.2f", it) } ?: "n/a"}")
                append("\n")
                append("Implied upside: ${valuation.impliedUpsidePct?.let { String.format("%.2f%%", it) } ?: "n/a"}")
            }
            y = drawWrappedText(canvas, valuationText, left, y, maxWidth, bodyPaint)
            y += 18f
        }

        canvas.drawText("Reasoning", left, y, labelPaint)
        y += 34f
        val reasons = report.signalReasons.take(4).joinToString(separator = "\n• ", prefix = "• ")
            .ifBlank { "• Evidence-backed synthesis not available in this report." }
        y = drawWrappedText(canvas, reasons, left, y, maxWidth, bodyPaint)
    }

    val disclaimerPaint = Paint().apply {
        color = Color.parseColor("#8EA4BF")
        textSize = 20f
        isAntiAlias = true
    }
    canvas.drawText(
        "This is a research summary, not financial advice. Always do your own research.",
        left,
        1860f,
        disclaimerPaint
    )

    document.finishPage(page)

    val outputDir = File(context.cacheDir, "exports").apply { mkdirs() }
    val filename = when (type) {
        ReportExportType.FULL_REPORT -> "deep-dive-${report.reportId}-${System.currentTimeMillis()}.pdf"
        ReportExportType.INVESTMENT_MEMO -> "investment-memo-${report.reportId}-${System.currentTimeMillis()}.pdf"
    }
    val output = File(outputDir, filename)
    FileOutputStream(output).use { stream ->
        document.writeTo(stream)
    }
    document.close()

    return ExportArtifact(
        file = output,
        mimeType = "application/pdf",
        chooserTitle = if (type == ReportExportType.FULL_REPORT) "Share Deep Dive PDF" else "Share Investment Memo"
    )
}

internal fun createShareCard(context: Context, report: DeepDiveReportView): ExportArtifact {
    val bitmap = Bitmap.createBitmap(1080, 1080, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(Color.parseColor("#0B111B"))

    val titlePaint = Paint().apply {
        color = Color.WHITE
        textSize = 56f
        isFakeBoldText = true
        isAntiAlias = true
    }
    val labelPaint = Paint().apply {
        color = Color.parseColor("#8EA4BF")
        textSize = 30f
        isAntiAlias = true
    }
    val bodyPaint = Paint().apply {
        color = Color.parseColor("#D8DEE9")
        textSize = 36f
        isAntiAlias = true
    }

    val left = 72f
    var y = 120f
    canvas.drawText(report.ticker ?: "Ticker", left, y, titlePaint)
    y += 56f
    canvas.drawText("Thesis Signal: ${report.signalValue?.uppercase() ?: "NO_SIGNAL"}", left, y, labelPaint)
    y += 48f
    canvas.drawText(
        "Confidence: ${report.confidenceLabel?.uppercase() ?: "UNKNOWN"}",
        left,
        y,
        labelPaint
    )
    y += 72f

    val summary = report.thesisStatement?.takeIf { it.isNotBlank() }
        ?: report.sections.firstOrNull { it.body.isNotBlank() }?.body
        ?: "No summary available."
    drawWrappedText(canvas, summarizeForCard(summary), left, y, 936f, bodyPaint)

    canvas.drawText("Thesis App", left, 1010f, labelPaint)

    val outputDir = File(context.cacheDir, "exports").apply { mkdirs() }
    val output = File(outputDir, "share-card-${report.reportId}-${System.currentTimeMillis()}.png")
    FileOutputStream(output).use { stream ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
    }

    return ExportArtifact(
        file = output,
        mimeType = "image/png",
        chooserTitle = "Share Thesis Card"
    )
}

internal fun shareExport(context: Context, artifact: ExportArtifact) {
    val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.fileprovider",
        artifact.file
    )
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = artifact.mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, artifact.chooserTitle))
}

private fun drawWrappedText(
    canvas: Canvas,
    text: String,
    left: Float,
    startY: Float,
    maxWidth: Float,
    paint: Paint
): Float {
    val words = text.replace("\n", " \n ").split(Regex("\\s+"))
    var y = startY
    val lineHeight = paint.textSize + 10f
    val lineBuilder = StringBuilder()

    fun flushLine() {
        if (lineBuilder.isNotEmpty()) {
            canvas.drawText(lineBuilder.toString().trim(), left, y, paint)
            lineBuilder.clear()
            y += lineHeight
        }
    }

    words.forEach { word ->
        if (word == "\n") {
            flushLine()
            return@forEach
        }
        val candidate = if (lineBuilder.isEmpty()) word else "${lineBuilder} $word"
        if (paint.measureText(candidate) <= maxWidth) {
            lineBuilder.clear()
            lineBuilder.append(candidate)
        } else {
            flushLine()
            lineBuilder.append(word)
        }
    }
    flushLine()
    return y
}

private fun summarizeForCard(text: String): String {
    val normalized = text.replace(Regex("\\s+"), " ").trim()
    if (normalized.length <= 180) {
        return normalized
    }
    return normalized.take(177).trimEnd() + "..."
}

