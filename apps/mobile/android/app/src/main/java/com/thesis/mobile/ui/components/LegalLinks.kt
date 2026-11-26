package com.thesis.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisType

/** The page product-api serves for a legal document: `terms` or `privacy`. */
fun legalPageUrl(apiBaseUrl: String, slug: String): String = "${apiBaseUrl.trim().trimEnd('/')}/legal/$slug"

/** Default link labels: the titles of the two documents product-api serves. */
const val LEGAL_TERMS_LABEL = "Terms of Service"
const val LEGAL_PRIVACY_LABEL = "Privacy Policy"
private const val LEGAL_JOIN = "and"

/**
 * Links to the Terms of Service and Privacy Policy pages served by product-api (DESIGN-DIRECTION 5.3): an optional
 * [leadText], then "[termsLabel] and [privacyLabel]" as kit [ThesisLink]s (accent, underlined, 48 dp touch
 * targets), all in one flow so the lead and the links read and wrap as one sentence ("... you agree to the Terms of
 * Service and Privacy Policy"). The lead flows word by word; each link keeps its words together.
 *
 * Every line has the pitch of running text: a link takes only its text's height in the flow, and its 48 dp touch
 * area extends above and below that line (centred on it) without spacing the lines apart. For TalkBack the lead is
 * one node (the whole sentence on its first word, the other words silent), then the Terms link, "and", the Privacy
 * link, in that order (`traversalIndex`, as the 48 dp link boxes reach above the lead's line). Start-aligned, on
 * the text edge.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LegalLinks(
    apiBaseUrl: String,
    leadText: String? = null,
    modifier: Modifier = Modifier,
    termsLabel: String = LEGAL_TERMS_LABEL,
    privacyLabel: String = LEGAL_PRIVACY_LABEL,
) {
    val p = LocalThesisPalette.current
    val uriHandler = LocalUriHandler.current
    val lead = remember(leadText) { leadText?.split(' ')?.filter { it.isNotEmpty() }.orEmpty() }
    val measurer = rememberTextMeasurer()
    // A space of the sentence's own style between items, so the flow spaces words like running text.
    val space = with(LocalDensity.current) { measurer.measure(" ", ThesisType.bodySmall).size.width.toDp() }
    FlowRow(
        modifier = modifier
            .fillMaxWidth()
            // One sentence for TalkBack too: the lead, then the two links (their own buttons) in order.
            .semantics { isTraversalGroup = true },
        horizontalArrangement = Arrangement.spacedBy(space),
    ) {
        lead.forEachIndexed { i, word ->
            Text(
                word,
                modifier = if (i == 0) {
                    Modifier.clearAndSetSemantics {
                        text = AnnotatedString(leadText.orEmpty().trim())
                        traversalIndex = 0f
                    }
                } else {
                    Modifier.clearAndSetSemantics { }
                },
                style = ThesisType.bodySmall,
                color = p.ink2,
            )
        }
        ThesisLink(
            termsLabel,
            onClick = { uriHandler.openUri(legalPageUrl(apiBaseUrl, "terms")) },
            modifier = Modifier
                .textLinePitch(termsLabel, measurer)
                .semantics { traversalIndex = 1f },
        )
        Text(LEGAL_JOIN, Modifier.semantics { traversalIndex = 2f }, style = ThesisType.bodySmall, color = p.ink2)
        ThesisLink(
            privacyLabel,
            onClick = { uriHandler.openUri(legalPageUrl(apiBaseUrl, "privacy")) },
            modifier = Modifier
                .textLinePitch(privacyLabel, measurer)
                .semantics { traversalIndex = 3f },
        )
    }
}

/**
 * Reports a link to the flow at the height of its [label]'s text, not its 48 dp touch box, and centres the box on
 * that height: the box (and the click and semantics bounds, which are the box's) reaches past the line above and
 * below, while the lines keep the pitch of running text.
 */
private fun Modifier.textLinePitch(label: String, measurer: TextMeasurer): Modifier = layout { measurable, constraints ->
    val placeable = measurable.measure(constraints.copy(minHeight = 0))
    val text = measurer.measure(
        label,
        ThesisType.bodySmall,
        constraints = Constraints(maxWidth = constraints.maxWidth.coerceAtLeast(0)),
        density = this,
    ).size.height
    val height = text.coerceAtMost(placeable.height)
    layout(placeable.width, height) { placeable.place(0, (height - placeable.height) / 2) }
}
