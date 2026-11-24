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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.ScenarioStressImpactView
import com.thesis.mobile.model.ScenarioStressRuleSuggestionView
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.ui.components.ThesisButton
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun ScenarioStressScreen(
    userTier: String?,
    templates: List<ScenarioStressTemplateView>,
    selectedScenarioId: String?,
    run: ScenarioStressRunView?,
    templatesError: String?,
    runError: String?,
    isLoadingTemplates: Boolean,
    isRunning: Boolean,
    watchlistCount: Int,
    onRefreshTemplates: () -> Unit,
    onSelectTemplate: (String) -> Unit,
    onRunScenario: (String?) -> Unit,
    onOpenTickerResearch: (String) -> Unit,
    onOpenRunFromRoute: (String, String?) -> Unit,
    onRequireUpgrade: (String) -> Unit
) {
    val isPro = userTier.equals("PRO", ignoreCase = true)
    val selectedTemplate = templates.firstOrNull { it.scenarioId == selectedScenarioId }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = ThesisDimens.ScreenPaddingHorizontal)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = ThesisDimens.ScreenPaddingTop,
                bottom = ThesisDimens.ScreenPaddingBottom + 96.dp
            ),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    Text(
                        text = Phase4Copy.researchStressHeadline,
                        style = ThesisTypography.headlineLarge.copy(
                            fontFamily = HeadingFont,
                            fontWeight = FontWeight.Normal
                        ),
                        color = ThesisColors.TextPrimary
                    )
                    Text(
                        text = Phase4Copy.researchStressSubtitle,
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextMuted
                    )
                    Text(
                        text = "Tracking $watchlistCount name(s).",
                        style = ThesisTypography.labelSmall,
                        color = ThesisColors.TextMuted
                    )
                }
            }

            if (!isPro) {
                item {
                    InfoCard(
                        title = "Pro Required",
                        body = Phase4Copy.researchStressProOnly
                    )
                }
                item {
                    ThesisButton(
                        text = "Upgrade to Pro",
                        onClick = { onRequireUpgrade("scenario_stress") }
                    )
                }
                return@LazyColumn
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Templates",
                        style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextPrimary
                    )
                    OutlinedButton(
                        onClick = onRefreshTemplates,
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        border = androidx.compose.foundation.BorderStroke(
                            ThesisDimens.BorderWidth,
                            ThesisColors.Border
                        )
                    ) {
                        Text(
                            text = Phase4Copy.researchStressRefreshLabel,
                            style = ThesisTypography.labelSmall,
                            color = ThesisColors.TextMuted
                        )
                    }
                }
            }

            if (isLoadingTemplates) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            color = ThesisColors.Primary,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }

            if (!templatesError.isNullOrBlank()) {
                item {
                    InfoCard(
                        title = "Templates unavailable",
                        body = templatesError
                    )
                }
            } else if (templates.isEmpty() && !isLoadingTemplates) {
                item {
                    InfoCard(
                        title = "No templates",
                        body = Phase4Copy.researchStressNoTemplates
                    )
                }
            } else {
                items(templates) { template ->
                    ScenarioTemplateCard(
                        template = template,
                        selected = template.scenarioId == selectedScenarioId,
                        onSelect = { onSelectTemplate(template.scenarioId) }
                    )
                }
            }

            item {
                ThesisButton(
                    text = if (isRunning) "Running..." else Phase4Copy.researchStressRunLabel,
                    onClick = { onRunScenario(selectedTemplate?.scenarioId) },
                    enabled = !isRunning && selectedTemplate != null
                )
            }

            if (selectedTemplate == null && templates.isNotEmpty()) {
                item {
                    Text(
                        text = Phase4Copy.researchStressSelectPrompt,
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
            }

            if (!runError.isNullOrBlank()) {
                item {
                    InfoCard(
                        title = "Run failed",
                        body = runError
                    )
                }
            }

            if (isRunning) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            color = ThesisColors.Primary,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(ThesisDimens.SpacingSm))
                        Text(
                            text = Phase4Copy.researchStressLoadingRun,
                            style = ThesisTypography.bodySmall,
                            color = ThesisColors.TextMuted
                        )
                    }
                }
            }

            if (run == null && runError.isNullOrBlank() && !isRunning) {
                item {
                    InfoCard(
                        title = "No run yet",
                        body = Phase4Copy.researchStressNoRunYet
                    )
                }
            }

            run?.let { scenarioRun ->
                item {
                    ScenarioRunHeaderCard(run = scenarioRun)
                }

                if (scenarioRun.impacts.isNotEmpty()) {
                    item {
                        Text(
                            text = "Impacted Names",
                            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextPrimary
                        )
                    }
                    items(scenarioRun.impacts) { impact ->
                        ScenarioImpactCard(
                            impact = impact,
                            onOpenTickerResearch = onOpenTickerResearch,
                            onOpenRunFromRoute = onOpenRunFromRoute
                        )
                    }
                }

                if (scenarioRun.ruleSuggestions.isNotEmpty()) {
                    item {
                        Text(
                            text = "Suggested Guardrails",
                            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextPrimary
                        )
                    }
                    items(scenarioRun.ruleSuggestions) { suggestion ->
                        ScenarioSuggestionCard(suggestion = suggestion)
                    }
                }
            }
        }
    }
}

@Composable
private fun ScenarioTemplateCard(
    template: ScenarioStressTemplateView,
    selected: Boolean,
    onSelect: () -> Unit
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    val borderColor = if (selected) ThesisColors.Primary else ThesisColors.Border
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, borderColor, shape)
            .clickable(onClick = onSelect)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Text(
            text = template.title,
            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = template.summary,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
        Text(
            text = template.hypothesis,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextSecondary
        )
    }
}

@Composable
private fun ScenarioRunHeaderCard(run: ScenarioStressRunView) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Text(
            text = run.run.summary,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextPrimary
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Impacted: ${run.run.impactedNames}/${run.run.totalNames}",
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
            Text(
                text = "Critical: ${run.run.criticalNames}",
                style = ThesisTypography.bodySmall,
                color = ThesisColors.SignalWarning
            )
        }
        Text(
            text = "As of ${run.run.asOf} | ${run.run.status.replace('_', ' ')}",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun ScenarioImpactCard(
    impact: ScenarioStressImpactView,
    onOpenTickerResearch: (String) -> Unit,
    onOpenRunFromRoute: (String, String?) -> Unit
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    val color = impactColor(impact.impactLevel)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, color.copy(alpha = 0.35f), shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = impact.ticker,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
            Text(
                text = impact.impactLevel.replace('_', ' ').uppercase(),
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = color
            )
        }
        Text(
            text = impact.rationale,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
        Text(
            text = "Break likelihood: ${impact.thesisBreakLikelihood.replace('_', ' ')} | Score ${formatScore(impact.stressScore)}",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            OutlinedButton(
                onClick = { onOpenTickerResearch(impact.ticker) },
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                border = androidx.compose.foundation.BorderStroke(ThesisDimens.BorderWidth, ThesisColors.Border)
            ) {
                Text(
                    text = Phase4Copy.researchStressOpenResearch,
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextPrimary
                )
            }
            OutlinedButton(
                onClick = { onOpenRunFromRoute(impact.route.scenarioRunId, impact.route.scenarioId) },
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                border = androidx.compose.foundation.BorderStroke(ThesisDimens.BorderWidth, ThesisColors.Border)
            ) {
                Text(
                    text = Phase4Copy.researchStressReopenRun,
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted
                )
            }
        }
    }
}

@Composable
private fun ScenarioSuggestionCard(suggestion: ScenarioStressRuleSuggestionView) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
    ) {
        Text(
            text = "${suggestion.ticker} | ${suggestion.signalType.replace('_', ' ')}",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = suggestion.conditionText,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextSecondary
        )
        Text(
            text = "Confidence ${formatScore(suggestion.confidence)} | ${suggestion.direction.replace('_', ' ')}",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
        if (suggestion.rationale.isNotBlank()) {
            Text(
                text = suggestion.rationale,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }
    }
}

@Composable
private fun InfoCard(
    title: String,
    body: String
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Text(
            text = title,
            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = body,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
@ReadOnlyComposable
private fun impactColor(level: String): Color =
    when (level.lowercase()) {
        "critical", "high" -> ThesisColors.SignalNegative
        "elevated", "watch" -> ThesisColors.SignalWarning
        else -> ThesisColors.TextMuted
    }

private fun formatScore(value: Double): String =
    String.format("%.2f", value)
