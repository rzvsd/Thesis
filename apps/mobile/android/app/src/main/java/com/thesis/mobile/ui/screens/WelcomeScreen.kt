package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.ui.copy.ProductCopy
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun WelcomeScreen(
    onContinue: () -> Unit,
    onLoginClick: () -> Unit = {}
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ThesisColors.DarkBackground)
    ) {
        // Abstract Background Blobs
        Box(
            modifier = Modifier
                .size(300.dp)
                .align(Alignment.TopStart)
                .padding(start = 24.dp, top = 24.dp)
                .blur(100.dp)
                .background(ThesisColors.AccentBlue.copy(alpha = 0.1f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(250.dp)
                .align(Alignment.BottomEnd)
                .padding(end = 24.dp, bottom = 48.dp)
                .blur(80.dp)
                .background(ThesisColors.SignalPositive.copy(alpha = 0.05f), CircleShape)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = ThesisDimens.SpacingXxl, vertical = 64.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top: Brand Identity
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                // Logo Mark
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(ThesisColors.AccentBlueLight, ThesisColors.AccentBlueDark)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "T",
                        style = ThesisTypography.displayLarge.copy(fontSize = 48.sp),
                        color = Color.White
                    )
                }

                Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))

                // Title
                Text(
                    text = "Thesis",
                    style = ThesisTypography.displayLarge.copy(fontSize = 52.sp),
                    color = ThesisColors.TextPrimaryDark,
                    letterSpacing = (-1).sp
                )
                
                // Tagline
                Text(
                    text = "Every position needs one",
                    style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.AccentBlue
                )
            }

            // Middle: Benefit Stack
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
                BenefitCard(
                    icon = Icons.Default.Newspaper,
                    title = "Morning Pulse",
                    description = "What moved overnight, before markets open"
                )
                BenefitCard(
                    icon = Icons.Default.Search,
                    title = "Deep Dive",
                    description = ProductCopy.deepDiveTagline
                )
                BenefitCard(
                    icon = Icons.Default.AutoAwesome,
                    title = "Your Names",
                    description = "Follow what matters to you across everything"
                )
            }

            // Bottom: Actions
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Button(
                    onClick = onContinue,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(64.dp),
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.Transparent
                    ),
                    contentPadding = PaddingValues()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(ThesisColors.AccentBlueLight, ThesisColors.AccentBlueDark)
                                ),
                                shape = CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Get Started",
                            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White
                        )
                    }
                }

                Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))

                Row(
                    modifier = Modifier.clickable { onLoginClick() },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Already have an account? ",
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextSecondaryDark
                    )
                    Text(
                        text = "Log in",
                        style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                        color = ThesisColors.AccentBlue
                    )
                }
            }
        }
    }
}

@Composable
private fun BenefitCard(icon: ImageVector, title: String, description: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CircleShape)
            .background(ThesisColors.DarkSurfaceHigh)
            .border(1.dp, ThesisColors.DarkBorder, CircleShape)
            .padding(vertical = ThesisDimens.SpacingLg, horizontal = ThesisDimens.SpacingXxl),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(ThesisColors.DarkSurface)
                .border(1.dp, ThesisColors.DarkBorder, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = ThesisColors.AccentBlue,
                modifier = Modifier.size(24.dp)
            )
        }
        
        Spacer(modifier = Modifier.width(ThesisDimens.SpacingXxl))
        
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.TextPrimaryDark
            )
            Text(
                text = description,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondaryDark,
                lineHeight = 20.sp
            )
        }
    }
}
