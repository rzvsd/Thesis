package com.thesis.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
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
 * [leadText] caption, then "[termsLabel] and [privacyLabel]" as kit [ThesisLink]s (accent, underlined, 48 dp touch
 * targets), so the lead and the links read as one sentence ("... you agree to the Terms of Service and Privacy
 * Policy"). The line wraps between its parts when it does not fit. Start-aligned, on the text edge.
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
    Column(modifier.fillMaxWidth()) {
        if (leadText != null) {
            Text(leadText, style = ThesisType.caption, color = p.ink2)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
            ThesisLink(termsLabel, onClick = { uriHandler.openUri(legalPageUrl(apiBaseUrl, "terms")) })
            // Same 48 dp line as the links, so "and" sits on their baseline.
            Box(Modifier.heightIn(min = ThesisSpace.touchMin), contentAlignment = Alignment.CenterStart) {
                Text(LEGAL_JOIN, style = ThesisType.bodySmall, color = p.ink2)
            }
            ThesisLink(privacyLabel, onClick = { uriHandler.openUri(legalPageUrl(apiBaseUrl, "privacy")) })
        }
    }
}
