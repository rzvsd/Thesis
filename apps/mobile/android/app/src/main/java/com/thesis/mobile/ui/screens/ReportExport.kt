package com.thesis.mobile.ui.screens

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import android.text.style.MetricAffectingSpan
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import com.thesis.mobile.R
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.latestFilingPeriod
import com.thesis.mobile.ui.copy.ReportCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.screens.report.ExportBlock
import com.thesis.mobile.ui.screens.report.ExportPagination
import com.thesis.mobile.ui.screens.report.ExportSlice
import com.thesis.mobile.ui.theme.PaperLight
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

/*
 * Export (docs/app-redesign/DESIGN-DIRECTION.md 5.24). The PDF is the print look of the Deep Dive page: PaperLight
 * tokens, Newsreader for titles and story text from the bundled fonts, A4 pages with every section paginated (no
 * text is dropped at the foot of a page). The share card is the report's HeroBand: the dark band, the gold hairline
 * and the ticker in Newsreader. [renderReportPdf] and [renderShareCard] lay out, draw and encode on
 * Dispatchers.Default (CPU work, 5.13) and write the file on Dispatchers.IO; the blocking [createPdfExport] /
 * [createShareCard] stay for callers that already run off the main thread.
 */

internal data class ExportArtifact(
    val file: File,
    val mimeType: String,
    val chooserTitle: String
)

internal enum class ReportExportType {
    FULL_REPORT,
    INVESTMENT_MEMO
}

/** An export laid out, drawn and encoded, not yet written: [bytes] go to [fileName] in the exports cache. */
private class EncodedExport(
    val bytes: ByteArray,
    val fileName: String,
    val mimeType: String,
    val chooserTitle: String,
)

/** The report PDF, built on Dispatchers.Default and written on IO. Call [shareExport] with the result on the main thread. */
internal suspend fun renderReportPdf(
    context: Context,
    report: DeepDiveReportView,
    type: ReportExportType
): ExportArtifact {
    val app = context.applicationContext
    val encoded = withContext(Dispatchers.Default) { encodeReportPdf(app, report, type) }
    return withContext(Dispatchers.IO) { writeExport(app, encoded) }
}

/** The share card, drawn on Dispatchers.Default and written on IO. Call [shareExport] with the result on the main thread. */
internal suspend fun renderShareCard(context: Context, report: DeepDiveReportView): ExportArtifact {
    val app = context.applicationContext
    val encoded = withContext(Dispatchers.Default) { encodeShareCard(app, report) }
    return withContext(Dispatchers.IO) { writeExport(app, encoded) }
}

/** The Pulse PDF the API returned, written on Dispatchers.IO. Call [shareExport] with the result on the main thread. */
internal suspend fun writePulsePdfExport(context: Context, pdfBytes: ByteArray, filename: String): ExportArtifact {
    val app = context.applicationContext
    return withContext(Dispatchers.IO) { createPulsePdfExport(app, pdfBytes, filename) }
}

/**
 * The report host's exports (5.24), so the screens never hold an android.content.Context (6.0 rule 5). Runs one
 * export at a time: the render builds and writes the file off the main thread ([renderReportPdf],
 * [renderShareCard]), then the share sheet opens on the main thread; a failure calls onFailed (the "export failed"
 * notice). A tap while an export runs is ignored.
 */
internal class ReportExporter(
    private val scope: CoroutineScope,
    private val context: Context,
    private val onFailed: () -> Unit,
) {
    private var running = false

    fun fullReport(report: DeepDiveReportView) {
        launchExport { renderReportPdf(context, report, ReportExportType.FULL_REPORT) }
    }

    fun memo(report: DeepDiveReportView) {
        launchExport { renderReportPdf(context, report, ReportExportType.INVESTMENT_MEMO) }
    }

    fun shareCard(report: DeepDiveReportView) {
        launchExport { renderShareCard(context, report) }
    }

    private fun launchExport(render: suspend () -> ExportArtifact) {
        if (running) return
        running = true
        scope.launch {
            try {
                shareExport(context, render())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                onFailed()
            } finally {
                running = false
            }
        }
    }
}

/** A [ReportExporter] bound to this composition's Context and scope; [onFailed] is read when an export fails. */
@Composable
internal fun rememberReportExporter(onFailed: () -> Unit): ReportExporter {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val failed by rememberUpdatedState(onFailed)
    return remember(context, scope) { ReportExporter(scope, context) { failed() } }
}

private fun writeExport(context: Context, encoded: EncodedExport): ExportArtifact {
    val output = exportFile(context, encoded.fileName)
    FileOutputStream(output).use { stream -> stream.write(encoded.bytes) }
    return ExportArtifact(file = output, mimeType = encoded.mimeType, chooserTitle = encoded.chooserTitle)
}

// ---- PDF -------------------------------------------------------------------------------------------------------

/** A4 in PDF points (1/72 in). */
private const val PAGE_W = 595
private const val PAGE_H = 842
private const val MARGIN_X = 56f
private const val MARGIN_TOP = 64f
private const val FOOTER_H = 56f
private const val CONTENT_W = PAGE_W - 2 * MARGIN_X

/** Drawn above a block's first line. */
private enum class ExportRule { None, Gold, Hairline }

private class PdfBlock(val layout: StaticLayout, val spaceBefore: Float, val keepWithNext: Boolean, val rule: ExportRule) {
    fun measured(): ExportBlock = ExportBlock(
        lineBottoms = (0 until layout.lineCount).map { layout.getLineBottom(it).toFloat() },
        spaceBefore = spaceBefore,
        keepWithNext = keepWithNext,
    )
}

/** Blocking: builds the PDF and writes it to the cache. Prefer [renderReportPdf] on the main thread. */
internal fun createPdfExport(
    context: Context,
    report: DeepDiveReportView,
    type: ReportExportType
): ExportArtifact = writeExport(context, encodeReportPdf(context, report, type))

/** Lays out, paginates and draws the PDF, and returns its bytes (CPU only, no file). */
private fun encodeReportPdf(
    context: Context,
    report: DeepDiveReportView,
    type: ReportExportType
): EncodedExport {
    val fonts = ExportFonts(context)
    val ink = PaperLight.ink.toArgb()
    val muted = PaperLight.muted.toArgb()
    val accent = PaperLight.accent.toArgb()

    val eyebrowPaint = textPaint(fonts.sansMedium, 7.5f, accent, tracking = 0.16f)
    val titlePaint = textPaint(fonts.display, 30f, ink)
    val subPaint = textPaint(fonts.sans, 9f, muted)
    val kickerPaint = textPaint(fonts.sansMedium, 7.5f, muted, tracking = 0.14f)
    val headPaint = textPaint(fonts.display, 16f, ink)
    val bodyPaint = textPaint(fonts.text, 10.5f, ink)
    val noticePaint = textPaint(fonts.sans, 8f, muted)

    val ticker = report.ticker?.trim()?.uppercase().orEmpty()
    val blocks = mutableListOf<PdfBlock>()
    fun add(text: CharSequence, paint: TextPaint, space: Float, keep: Boolean = false, rule: ExportRule = ExportRule.None, leading: Float = 1f) {
        if (text.isBlank()) return
        blocks += PdfBlock(layout(text, paint, CONTENT_W.toInt(), leading), space, keep, rule)
    }

    val title = when (type) {
        ReportExportType.FULL_REPORT -> ReportCopy.EXPORT_REPORT_TITLE
        ReportExportType.INVESTMENT_MEMO -> ReportCopy.EXPORT_MEMO_TITLE
    }
    add(listOf(title, ticker).filter { it.isNotEmpty() }.joinToString(" · ").uppercase(), eyebrowPaint, 0f, keep = true, rule = ExportRule.Gold)
    add(report.issuer?.name?.takeIf { it.isNotBlank() } ?: ticker.ifEmpty { title }, titlePaint, 10f, keep = true, leading = 1.05f)
    add(filingLine(report), subPaint, 6f, keep = true)

    val thesis = report.thesisStatement?.takeIf { it.isNotBlank() }
        ?: report.sections.firstOrNull { it.body.isNotBlank() }?.body
        ?: ReportCopy.EXPORT_NO_SUMMARY
    add(ReportCopy.EXPORT_THESIS.uppercase(), kickerPaint, 28f, keep = true, rule = ExportRule.Hairline)
    add(thesis.trim(), textPaint(fonts.display, 15f, ink), 8f, leading = 1.25f)

    when (type) {
        ReportExportType.FULL_REPORT -> {
            var chapter = 0
            report.sections.filter { it.title.isNotBlank() || it.body.isNotBlank() }.forEach { section ->
                chapter += 1
                val number = chapter.toString().padStart(2, '0')
                add(chapterHead(number, section.title.trim(), fonts, accent), headPaint, 26f, keep = true, rule = ExportRule.Hairline)
                section.body.split(Regex("\\n\\s*\\n")).forEachIndexed { index, paragraph ->
                    add(paragraph.trim(), bodyPaint, if (index == 0) 8f else 6f, leading = 1.4f)
                }
            }
        }
        ReportExportType.INVESTMENT_MEMO -> {
            report.valuation?.let { valuation ->
                val lines = listOfNotNull(
                    valuation.fairValueMid?.let { mid ->
                        ReportCopy.modelRangeLine(
                            mid = Fmt.money(mid),
                            low = valuation.fairValueLow?.let { Fmt.money(it) },
                            high = valuation.fairValueHigh?.let { Fmt.money(it) },
                        )
                    },
                    valuation.spotPrice?.let { ReportCopy.priceAtReport(Fmt.money(it)) },
                )
                if (lines.isNotEmpty()) {
                    add(ReportCopy.EXPORT_VALUATION.uppercase(), kickerPaint, 26f, keep = true, rule = ExportRule.Hairline)
                    add(lines.joinToString("\n"), bodyPaint, 8f, leading = 1.4f)
                }
            }
            val reasons = report.signalReasons.filter { it.isNotBlank() }
            if (reasons.isNotEmpty()) {
                add(ReportCopy.EXPORT_REASONS.uppercase(), kickerPaint, 26f, keep = true, rule = ExportRule.Hairline)
                reasons.forEachIndexed { index, reason ->
                    add("•  ${reason.trim()}", bodyPaint, if (index == 0) 8f else 4f, leading = 1.4f)
                }
            }
        }
    }
    add(ReportCopy.EXPORT_NOTICE, noticePaint, 32f, rule = ExportRule.Hairline, leading = 1.3f)

    val pages = ExportPagination.paginate(
        blocks = blocks.map { it.measured() },
        firstPageTop = MARGIN_TOP,
        pageTop = MARGIN_TOP,
        pageBottom = PAGE_H - FOOTER_H - 12f,
    )

    val background = PaperLight.surface.toArgb()
    val rulePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = PaperLight.line2.toArgb() }
    val goldPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent }
    val footerPaint = textPaint(fonts.sans, 7.5f, muted)
    val footerLeft = listOf(ReportCopy.EXPORT_BRAND, title, ticker).filter { it.isNotEmpty() }.joinToString("  ·  ")

    val document = PdfDocument()
    try {
        pages.forEachIndexed { pageIndex, slices ->
            val page = document.startPage(PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, pageIndex + 1).create())
            val canvas = page.canvas
            canvas.drawColor(background)
            slices.forEach { slice -> drawSlice(canvas, blocks[slice.block], slice, rulePaint, goldPaint) }
            drawFooter(canvas, footerLeft, ReportCopy.pageOf(pageIndex + 1, pages.size), footerPaint, rulePaint)
            document.finishPage(page)
        }
        val bytes = ByteArrayOutputStream().use { stream ->
            document.writeTo(stream)
            stream.toByteArray()
        }
        return EncodedExport(
            bytes = bytes,
            fileName = when (type) {
                ReportExportType.FULL_REPORT -> "deep-dive-${report.reportId}-${System.currentTimeMillis()}.pdf"
                ReportExportType.INVESTMENT_MEMO -> "investment-memo-${report.reportId}-${System.currentTimeMillis()}.pdf"
            },
            mimeType = "application/pdf",
            chooserTitle = if (type == ReportExportType.FULL_REPORT) ReportCopy.SHARE_PDF_TITLE else ReportCopy.SHARE_MEMO_TITLE
        )
    } finally {
        document.close()
    }
}

private fun drawSlice(canvas: Canvas, block: PdfBlock, slice: ExportSlice, rulePaint: Paint, goldPaint: Paint) {
    val layout = block.layout
    val top = layout.getLineTop(slice.fromLine).toFloat()
    val bottom = layout.getLineBottom(slice.toLine - 1).toFloat()
    if (slice.fromLine == 0) {
        when (block.rule) {
            ExportRule.Gold -> canvas.drawRect(MARGIN_X, slice.y - 10f, MARGIN_X + 28f, slice.y - 9f, goldPaint)
            ExportRule.Hairline -> {
                val ruleY = slice.y - minOf(block.spaceBefore / 2f, 12f)
                if (ruleY > MARGIN_TOP) canvas.drawRect(MARGIN_X, ruleY, MARGIN_X + CONTENT_W, ruleY + 0.5f, rulePaint)
            }
            ExportRule.None -> Unit
        }
    }
    canvas.save()
    canvas.translate(MARGIN_X, slice.y - top)
    canvas.clipRect(0f, top, CONTENT_W, bottom)
    layout.draw(canvas)
    canvas.restore()
}

private fun drawFooter(canvas: Canvas, left: String, right: String, paint: TextPaint, rulePaint: Paint) {
    val ruleY = PAGE_H - FOOTER_H + 8f
    canvas.drawRect(MARGIN_X, ruleY, MARGIN_X + CONTENT_W, ruleY + 0.5f, rulePaint)
    val baseline = ruleY + 20f
    paint.textAlign = Paint.Align.LEFT
    canvas.drawText(left, MARGIN_X, baseline, paint)
    paint.textAlign = Paint.Align.RIGHT
    canvas.drawText(right, MARGIN_X + CONTENT_W, baseline, paint)
    paint.textAlign = Paint.Align.LEFT
}

/** "04  Customers & suppliers": the number in the display italic and accent, as the page's chapter kickers. */
private fun chapterHead(number: String, title: String, fonts: ExportFonts, accent: Int): CharSequence {
    val text = SpannableStringBuilder()
    text.append(number, FaceSpan(fonts.displayItalic, accent), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    if (title.isNotEmpty()) text.append("  ").append(title)
    return text
}

/** "10-K · FY2025": the filing the report reads, when it names one. */
private fun filingLine(report: DeepDiveReportView): String {
    val form = report.filingRead?.form?.trim().orEmpty()
    val period = report.filingRead?.period?.trim()?.ifBlank { null } ?: report.latestFilingPeriod().orEmpty()
    return listOf(form, period).filter { it.isNotEmpty() }.joinToString(" · ")
}

// ---- Share card ------------------------------------------------------------------------------------------------

private const val CARD = 1080
private const val CARD_PAD = 88f

/** Blocking: draws the card and writes it to the cache. Prefer [renderShareCard] on the main thread. */
internal fun createShareCard(context: Context, report: DeepDiveReportView): ExportArtifact =
    writeExport(context, encodeShareCard(context, report))

/** Draws the card and returns it as PNG bytes (CPU only, no file). */
private fun encodeShareCard(context: Context, report: DeepDiveReportView): EncodedExport {
    val fonts = ExportFonts(context)
    val bitmap = Bitmap.createBitmap(CARD, CARD, Bitmap.Config.ARGB_8888)
    try {
        val canvas = Canvas(bitmap)
        val band = Paint().apply {
            shader = LinearGradient(
                0f, 0f, 0f, CARD.toFloat(),
                PaperLight.heroBg.toArgb(), PaperLight.heroBg2.toArgb(), Shader.TileMode.CLAMP
            )
        }
        canvas.drawRect(0f, 0f, CARD.toFloat(), CARD.toFloat(), band)

        val ink = PaperLight.heroInk.toArgb()
        val ink2 = PaperLight.heroInk2.toArgb()
        val gold = PaperLight.heroAccent.toArgb()
        val width = (CARD - 2 * CARD_PAD).toInt()
        val ticker = report.ticker?.trim()?.uppercase().orEmpty()

        // Eyebrow with its gold rule, as the HeroBand's.
        val goldPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = gold }
        var y = 128f
        canvas.drawRect(CARD_PAD, y, CARD_PAD + 56f, y + 3f, goldPaint)
        y += 28f
        val eyebrow = listOf(ReportCopy.EXPORT_REPORT_TITLE, ticker).filter { it.isNotEmpty() }.joinToString(" · ")
        y = drawLayout(canvas, layout(eyebrow.uppercase(), textPaint(fonts.sansMedium, 26f, gold, tracking = 0.16f), width), y)

        y += 24f
        y = drawLayout(canvas, layout(ticker.ifEmpty { ReportCopy.EXPORT_REPORT_TITLE }, textPaint(fonts.display, 150f, ink), width, maxLines = 1), y)
        val issuer = listOfNotNull(report.issuer?.name?.takeIf { it.isNotBlank() }, filingLine(report).ifEmpty { null })
            .joinToString("  ·  ")
        if (issuer.isNotEmpty()) {
            y += 8f
            y = drawLayout(canvas, layout(issuer, textPaint(fonts.sans, 30f, ink2), width, maxLines = 2), y)
        }

        val footerTop = CARD - 168f
        val summary = report.thesisStatement?.takeIf { it.isNotBlank() }
            ?: report.sections.firstOrNull { it.body.isNotBlank() }?.body
            ?: ReportCopy.EXPORT_NO_SUMMARY
        y += 56f
        val storyPaint = textPaint(fonts.text, 42f, ink)
        val lineHeight = storyPaint.fontSpacing * 1.25f
        val maxLines = ((footerTop - 32f - y) / lineHeight).toInt().coerceIn(1, 7)
        drawLayout(canvas, layout(summary.replace(Regex("\\s+"), " ").trim(), storyPaint, width, leading = 1.25f, maxLines = maxLines), y)

        val linePaint = Paint().apply { color = PaperLight.heroLine.toArgb() }
        canvas.drawRect(CARD_PAD, footerTop, CARD - CARD_PAD, footerTop + 2f, linePaint)
        val brandPaint = textPaint(fonts.sansMedium, 28f, gold, tracking = 0.2f)
        val noticePaint = textPaint(fonts.sans, 26f, ink2).apply { textAlign = Paint.Align.RIGHT }
        val baseline = footerTop + 76f
        canvas.drawText(ReportCopy.EXPORT_BRAND, CARD_PAD, baseline, brandPaint)
        canvas.drawText(ReportCopy.EXPORT_CARD_NOTICE, CARD - CARD_PAD, baseline, noticePaint)

        val bytes = ByteArrayOutputStream().use { stream ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            stream.toByteArray()
        }
        return EncodedExport(
            bytes = bytes,
            fileName = "share-card-${report.reportId}-${System.currentTimeMillis()}.png",
            mimeType = "image/png",
            chooserTitle = ReportCopy.SHARE_CARD_TITLE,
        )
    } finally {
        bitmap.recycle()
    }
}

/** Draws [layout] with its top at [top] and the card's left padding; returns its bottom. */
private fun drawLayout(canvas: Canvas, layout: StaticLayout, top: Float): Float {
    canvas.save()
    canvas.translate(CARD_PAD, top)
    layout.draw(canvas)
    canvas.restore()
    return top + layout.height
}

// ---- Pulse, sharing, helpers -----------------------------------------------------------------------------------

internal fun createPulsePdfExport(
    context: Context,
    pdfBytes: ByteArray,
    filename: String
): ExportArtifact {
    val safeFilename = filename
        .ifBlank { "thesis-pulse-${System.currentTimeMillis()}.pdf" }
        .replace(Regex("[^A-Za-z0-9._-]"), "-")
        .let { if (it.endsWith(".pdf", ignoreCase = true)) it else "$it.pdf" }
    val output = exportFile(context, safeFilename)
    FileOutputStream(output).use { stream ->
        stream.write(pdfBytes)
    }

    return ExportArtifact(
        file = output,
        mimeType = "application/pdf",
        chooserTitle = ReportCopy.SHARE_PULSE_TITLE
    )
}

/** Opens the system share sheet for [artifact]. Main thread. */
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
    val chooser = Intent.createChooser(intent, artifact.chooserTitle)
    if (context !is android.app.Activity) chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(chooser)
}

private fun exportFile(context: Context, name: String): File {
    val outputDir = File(context.cacheDir, "exports").apply { mkdirs() }
    return File(outputDir, name)
}

/** The bundled Newsreader cuts (res/font), with the system serif when a font cannot be read, and the system sans. */
private class ExportFonts(context: Context) {
    val display: Typeface = font(context, R.font.newsreader_display, Typeface.SERIF)
    val displayItalic: Typeface = font(context, R.font.newsreader_display_italic, Typeface.create(Typeface.SERIF, Typeface.ITALIC))
    val text: Typeface = font(context, R.font.newsreader_text, Typeface.SERIF)
    val sans: Typeface = Typeface.create("sans-serif", Typeface.NORMAL)
    val sansMedium: Typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)

    private fun font(context: Context, id: Int, fallback: Typeface): Typeface =
        runCatching { ResourcesCompat.getFont(context, id) }.getOrNull() ?: fallback
}

private fun textPaint(face: Typeface, size: Float, color: Int, tracking: Float = 0f): TextPaint =
    TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = face
        textSize = size
        this.color = color
        letterSpacing = tracking
    }

private fun layout(
    text: CharSequence,
    paint: TextPaint,
    width: Int,
    leading: Float = 1f,
    maxLines: Int = Int.MAX_VALUE,
): StaticLayout = StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
    .setAlignment(Layout.Alignment.ALIGN_NORMAL)
    .setLineSpacing(0f, leading)
    .setIncludePad(false)
    .setMaxLines(maxLines)
    .setEllipsize(if (maxLines == Int.MAX_VALUE) null else TextUtils.TruncateAt.END)
    .build()

/** A typeface and colour for part of a line (TypefaceSpan(Typeface) needs API 28; minSdk is 26). */
private class FaceSpan(private val face: Typeface, private val color: Int) : MetricAffectingSpan() {
    override fun updateMeasureState(paint: TextPaint) {
        paint.typeface = face
    }

    override fun updateDrawState(paint: TextPaint) {
        paint.typeface = face
        paint.color = color
    }
}
