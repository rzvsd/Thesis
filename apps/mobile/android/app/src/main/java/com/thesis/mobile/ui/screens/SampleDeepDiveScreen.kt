package com.thesis.mobile.ui.screens

import android.content.Context
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.ReportViewMapper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

// Bundled copy of the Phase 7 M13 MSFT proof output (filing read + financial indicators), generated on 2026-05-08
// in fixture mode with a fixture price. Shown only as a labelled sample (5.16).
private const val SAMPLE_ASSET = "sample/deep-dive-sample-msft.json"

/** The parsed sample: the report and its five-year series (from `financial_indicators.five_year_trends`). */
private class SampleData(val report: DeepDiveReportView, val fiveYear: FiveYearSeries?)

private fun loadSample(context: Context): SampleData? = runCatching {
    val json = JSONObject(context.assets.open(SAMPLE_ASSET).bufferedReader().use { it.readText() })
    SampleData(
        report = ReportViewMapper.mapAnalysisReport(json),
        fiveYear = FiveYearSeries.fromIndicatorsJson(json.optJSONObject("financial_indicators")),
    )
}.getOrNull()

/**
 * First-run view (Today's sample slot): a finished Deep Dive, clearly labelled as a sample, before the user has
 * names or reports. The asset is read on [Dispatchers.IO] with a skeleton meanwhile; the page itself is
 * [SampleDeepDiveContent] (DeepDiveScreen.kt), the classic report's layout.
 */
@Composable
fun SampleDeepDiveScreen(
    padding: PaddingValues,
    onFollowName: () -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current.applicationContext
    var sample by remember { mutableStateOf<SampleData?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        val loaded = withContext(Dispatchers.IO) { loadSample(context) }
        sample = loaded
        failed = loaded == null
    }
    SampleDeepDiveContent(
        report = sample?.report,
        fiveYear = sample?.fiveYear,
        padding = padding,
        onFollowName = onFollowName,
        onDismiss = onDismiss,
        failed = failed,
    )
}
