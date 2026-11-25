package com.thesis.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/** The page product-api serves for a legal document: `terms` or `privacy`. */
fun legalPageUrl(apiBaseUrl: String, slug: String): String = "${apiBaseUrl.trim().trimEnd('/')}/legal/$slug"

/**
 * Links to the Terms of Service and Privacy Policy pages served by product-api (WP-G, DESIGN-DIRECTION 5.3): an
 * optional [leadText] caption, then the two links as kit [ThesisLink]s (accent, underlined, 48 dp touch targets)
 * that wrap onto a second line when they do not fit. Start-aligned, on the form's text edge.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LegalLinks(
    apiBaseUrl: String,
    leadText: String? = null,
    modifier: Modifier = Modifier
) {
    val p = LocalThesisPalette.current
    val uriHandler = LocalUriHandler.current
    Column(modifier.fillMaxWidth()) {
        if (leadText != null) {
            Text(leadText, style = ThesisType.caption, color = p.ink2)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.l)) {
            ThesisLink(AccountCopy.TERMS, onClick = { uriHandler.openUri(legalPageUrl(apiBaseUrl, "terms")) })
            ThesisLink(AccountCopy.PRIVACY, onClick = { uriHandler.openUri(legalPageUrl(apiBaseUrl, "privacy")) })
        }
    }
}
