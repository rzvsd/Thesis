package com.thesis.mobile.ui.screens

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.ReportViewMapper
import com.thesis.mobile.ui.components.ThesisButton
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import org.json.JSONObject

// Bundled copy of the Phase 7 M13 MSFT proof output (filing read + financial indicators),
// generated on 2026-05-08 in fixture mode with a fixture price. Shown only as a labelled sample.
private const val SAMPLE_ASSET = "sample/deep-dive-sample-msft.json"

private fun loadSampleReport(context: Context): DeepDiveReportView? = runCatching {
    val json = context.assets.open(SAMPLE_ASSET).bufferedReader().use { it.readText() }
    ReportViewMapper.mapAnalysisReport(JSONObject(json))
}.getOrNull()

/** First-run view: a finished Deep Dive, clearly labelled as a sample, before the user has names or reports. */
@Composable
fun SampleDeepDiveScreen(
    padding: PaddingValues,
    onFollowName: () -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val report = remember { loadSampleReport(context) }
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding),
        contentPadding = PaddingValues(
            horizontal = ThesisDimens.ScreenPaddingHorizontal,
            vertical = ThesisDimens.SpacingLg
        ),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
    ) {
        item {
            InlineCallout(
                label = "SAMPLE",
                text = "This is a sample Deep Dive on Microsoft (MSFT). It was built on 8 May 2026 " +
                    "from test data and a test price, so the numbers are not current. " +
                    "It shows what you get for each name you follow. Not financial advice.",
                tint = ThesisColors.SignalWarning
            )
        }
        item {
            Text(
                text = "Sample Deep Dive: MSFT",
                style = ThesisTypography.headlineLarge.copy(fontFamily = HeadingFont),
                color = ThesisColors.TextPrimary
            )
        }
        if (report != null) {
            item { DeepDiveNativeMemo(report = report) }
        }
        item {
            ThesisButton(text = "Follow your first name", onClick = onFollowName)
        }
        item {
            ThesisButton(text = "Close sample", onClick = onDismiss, isPrimary = false)
        }
    }
}
