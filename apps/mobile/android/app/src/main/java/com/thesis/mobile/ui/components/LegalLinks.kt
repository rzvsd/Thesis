package com.thesis.mobile.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

private fun legalPageUrl(apiBaseUrl: String, slug: String): String = "${apiBaseUrl.trim().trimEnd('/')}/legal/$slug"

/** Links to the Terms of Service and Privacy Policy pages served by product-api. */
@Composable
fun LegalLinks(
    apiBaseUrl: String,
    leadText: String? = null,
    modifier: Modifier = Modifier
) {
    val uriHandler = LocalUriHandler.current
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
    ) {
        if (leadText != null) {
            Text(
                text = leadText,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted,
                textAlign = TextAlign.Center
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)) {
            LegalLink("Terms of Service") { uriHandler.openUri(legalPageUrl(apiBaseUrl, "terms")) }
            LegalLink("Privacy Policy") { uriHandler.openUri(legalPageUrl(apiBaseUrl, "privacy")) }
        }
    }
}

@Composable
private fun LegalLink(label: String, onClick: () -> Unit) {
    Text(
        text = label,
        style = ThesisTypography.bodySmall.copy(fontWeight = FontWeight.Medium),
        color = ThesisColors.Primary,
        modifier = Modifier.clickable(onClick = onClick)
    )
}
