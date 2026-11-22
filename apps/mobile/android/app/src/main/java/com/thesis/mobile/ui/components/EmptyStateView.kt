package com.thesis.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.copy.ProductCopy
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
private fun EmptyStateBase(
    icon: ImageVector,
    iconTint: Color,
    iconBackground: Color,
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    isOffline: Boolean = false,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(32.dp))
            .background(ThesisColors.DarkSurfaceHigh)
            .then(
                if (isOffline) {
                    Modifier.border(
                        width = 2.dp,
                        color = ThesisColors.SignalNegative.copy(alpha = 0.4f),
                        shape = RoundedCornerShape(32.dp)
                    )
                } else {
                    Modifier
                }
            )
            .padding(ThesisDimens.SpacingXxl)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(iconBackground),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(32.dp)
                )
            }

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))

            Text(
                text = title,
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.TextPrimaryDark,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))

            Text(
                text = message,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondaryDark,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = ThesisDimens.SpacingMd)
            )

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))
            content()
        }
    }
}

@Composable
private fun EmptyStateActionButton(
    text: String,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier.height(48.dp),
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
        contentPadding = PaddingValues()
    ) {
        Row(
            modifier = Modifier
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(ThesisColors.AccentBlueLight, ThesisColors.AccentBlueDark)
                    ),
                    shape = CircleShape
                )
                .padding(horizontal = 24.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = text,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Bold),
                color = Color.White
            )
            Spacer(modifier = Modifier.width(ThesisDimens.SpacingSm))
            Icon(
                imageVector = Icons.Default.ArrowForward,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
fun NoPulseEmptyState(
    onRunDeepDive: () -> Unit,
    modifier: Modifier = Modifier
) {
    EmptyStateBase(
        icon = Icons.Default.LightMode,
        iconTint = ThesisColors.AccentBlue,
        iconBackground = ThesisColors.AccentBlue.copy(alpha = 0.1f),
        title = "No Pulse Yet",
        message = "Your morning pulse arrives daily at 6:30 AM ET. Check back then, or explore a company now.",
        modifier = modifier
    ) {
        EmptyStateActionButton(text = "Run a Deep Dive", onClick = onRunDeepDive)
    }
}

@Composable
fun NoDeepDivesEmptyState(
    modifier: Modifier = Modifier,
    actionContent: @Composable () -> Unit = {}
) {
    EmptyStateBase(
        icon = Icons.Default.Search,
        iconTint = ThesisColors.AccentBlue,
        iconBackground = ThesisColors.AccentBlue.copy(alpha = 0.1f),
        title = "No Deep Dives Yet",
        message = "Search a ticker and open an evidence-backed report. Coverage: ${ProductCopy.coverage}.",
        modifier = modifier
    ) {
        actionContent()
    }
}

@Composable
fun NoNamesEmptyState(
    onAddName: () -> Unit,
    modifier: Modifier = Modifier
) {
    EmptyStateBase(
        icon = Icons.Default.AutoAwesome,
        iconTint = ThesisColors.AccentBlue,
        iconBackground = ThesisColors.AccentBlue.copy(alpha = 0.1f),
        title = "No Names Yet",
        message = "Names you follow appear across Thesis in your morning pulse and company research.",
        modifier = modifier
    ) {
        EmptyStateActionButton(text = "Add your first name", onClick = onAddName)
    }
}

@Composable
fun OfflineEmptyState(
    modifier: Modifier = Modifier,
    onRetry: (() -> Unit)? = null
) {
    EmptyStateBase(
        icon = Icons.Default.WifiOff,
        iconTint = ThesisColors.SignalNegative,
        iconBackground = ThesisColors.SignalNegative.copy(alpha = 0.1f),
        title = "You're Offline",
        message = "Reports you've already opened are still available. We'll sync again when you reconnect.",
        isOffline = true,
        modifier = modifier
    ) {
        if (onRetry != null) {
            EmptyStateActionButton(text = "Try again", onClick = onRetry)
        }
    }
}

@Composable
fun PulseUnavailableState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    EmptyStateBase(
        icon = Icons.Default.LightMode,
        iconTint = ThesisColors.AccentBlue,
        iconBackground = ThesisColors.AccentBlue.copy(alpha = 0.1f),
        title = "Pulse unavailable",
        message = message,
        modifier = modifier
    ) {
        EmptyStateActionButton(text = "Retry pulse", onClick = onRetry)
    }
}

@Composable
fun DeepDiveUnavailableState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    EmptyStateBase(
        icon = Icons.Default.ErrorOutline,
        iconTint = ThesisColors.SignalNegative,
        iconBackground = ThesisColors.SignalNegative.copy(alpha = 0.1f),
        title = "Deep Dive unavailable",
        message = message,
        modifier = modifier
    ) {
        EmptyStateActionButton(text = "Retry Deep Dive", onClick = onRetry)
    }
}
