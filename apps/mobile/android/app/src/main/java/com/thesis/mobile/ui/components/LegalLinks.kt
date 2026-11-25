package com.thesis.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
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
 * Service and Privacy Policy"). The lead flows word by word; each link keeps its words together. A line of lead
 * words only is as tall as its text; a line holding a link is the link's 48 dp, with the words centred on it.
 * Start-aligned, on the text edge.
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
    val words = remember(leadText) { leadText?.split(' ')?.filter { it.isNotEmpty() }.orEmpty() + LEGAL_JOIN }
    // A space of the sentence's own style between items, so the flow spaces words like running text.
    val space = with(LocalDensity.current) {
        rememberTextMeasurer().measure(" ", ThesisType.bodySmall).size.width.toDp()
    }
    FlowRow(
        modifier = modifier
            .fillMaxWidth()
            // One sentence for TalkBack too: the words read in order and the two links stay their own buttons.
            .semantics { isTraversalGroup = true },
        horizontalArrangement = Arrangement.spacedBy(space),
    ) {
        val centred = Modifier.align(Alignment.CenterVertically)
        words.dropLast(1).forEach { word -> Text(word, centred, style = ThesisType.bodySmall, color = p.ink2) }
        ThesisLink(termsLabel, onClick = { uriHandler.openUri(legalPageUrl(apiBaseUrl, "terms")) }, modifier = centred)
        Text(words.last(), centred, style = ThesisType.bodySmall, color = p.ink2)
        ThesisLink(privacyLabel, onClick = { uriHandler.openUri(legalPageUrl(apiBaseUrl, "privacy")) }, modifier = centred)
    }
}
