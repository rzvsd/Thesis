// Legacy memo pages (reports without due diligence sections).
// Ported from apps/product-api/src/report-pdf.ts (M4). Logic kept as is; only plumbing changed.
import {
  drawChipGrid,
  drawChipRow,
  drawCompactNarrativeCard,
  drawFinancialTable,
  drawInfoCard,
  drawLabeledPanel,
  drawMetricTileStrip,
  drawPageFrame,
  drawScenarioTable,
  drawSectionHeading,
  drawStatusChip,
  drawThesisBox,
  drawValuationRange,
} from "./draw_blocks.ts";
import {
  drawCoverageNote,
  drawEvidencePanel,
  drawMarginChart,
  drawPanel,
  drawRiskList,
  drawText,
  drawTextBlock,
} from "./draw_charts.ts";
import {
  charcoal,
  contentWidth,
  divider,
  gold,
  ink,
  muted,
  pageMargin,
  pageWidth,
  panelIvory,
  panelSlate,
  ReportViewModel,
  white,
} from "./theme.ts";

export function drawExecutiveMemoPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, view, "Executive Memo", pageNumber, totalPages);

  drawPanel(commands, pageMargin, 54, contentWidth, 188, {
    fill: charcoal,
    stroke: charcoal,
    lineWidth: 0.8,
  });
  drawPanel(commands, pageMargin, 54, contentWidth, 4, { fill: gold });

  drawText(commands, pageMargin + 18, 72, "Thesis Investment Memo", {
    font: "bodyBold",
    size: 10,
    color: gold,
    tracking: 0.9,
  });
  drawText(commands, pageMargin + 18, 96, view.companyLabel, {
    font: "display",
    size: 30,
    color: white,
  });
  drawText(commands, pageMargin + 18, 128, view.subtitle, {
    font: "body",
    size: 13,
    color: [0.871, 0.882, 0.898],
  });
  drawTextBlock(commands, pageMargin + 18, 156, 308, view.heroThesis, {
    font: "body",
    size: 11,
    leading: 15,
    color: white,
    maxLines: 5,
  });

  drawChipGrid(commands, pageWidth - pageMargin - 182, 74, 164, view.signalChips);
  drawText(commands, pageWidth - pageMargin - 18, 154, view.spotPriceLabel, {
    font: "display",
    size: 24,
    color: white,
    align: "right",
  });
  drawText(commands, pageWidth - pageMargin - 18, 186, view.upsideLabel, {
    font: "bodyBold",
    size: 11,
    color: gold,
    align: "right",
  });

  drawThesisBox(
    commands,
    pageMargin,
    256,
    contentWidth,
    74,
    "Decision question",
    view.decisionQuestion,
  );

  const cardWidth = (contentWidth - 24) / 3;
  view.executiveCards.forEach((card, index) => {
    drawInfoCard(
      commands,
      pageMargin + index * (cardWidth + 12),
      346,
      cardWidth,
      126,
      card.title,
      card.body,
      card.tone,
    );
  });

  drawPanel(commands, pageMargin, 490, contentWidth, 188, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 510, "Mini valuation range", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawText(commands, pageMargin + 18, 536, "Low, base, and high-value anchors with spot context.", {
    font: "body",
    size: 9,
    color: muted,
  });
  drawValuationRange(commands, pageMargin + 18, 552, contentWidth - 36, 62, view.valuationRange, {
    lowLabel: "Low",
    midLabel: "Base",
    highLabel: "High",
    spotLabel: "Spot",
  });
  drawMetricTileStrip(commands, pageMargin + 18, 610, contentWidth - 36, view.valuationTiles);
}

export function drawThesisAndChangePage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, view, "Thesis and Change", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Thesis and Change",
    "Before, now, and implication in one editorial view.",
  );

  drawThesisBox(
    commands,
    pageMargin,
    98,
    contentWidth,
    94,
    "Central investment argument",
    view.centralArgument,
  );

  const laneWidth = (contentWidth - 24) / 3;
  drawLabeledPanel(commands, pageMargin, 210, laneWidth, 128, "Previous view", view.previousView, "neutral");
  drawLabeledPanel(
    commands,
    pageMargin + laneWidth + 12,
    210,
    laneWidth,
    128,
    "Current view",
    view.currentView,
    "gold",
  );
  drawLabeledPanel(
    commands,
    pageMargin + (laneWidth + 12) * 2,
    210,
    laneWidth,
    128,
    "Why it matters",
    view.implication,
    "warning",
  );

  drawPanel(commands, pageMargin, 356, contentWidth, 292, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 376, "What changed", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawText(
    commands,
    pageMargin + 18,
    402,
    "Three concise change notes that highlight the decision-relevant deltas.",
    {
      font: "body",
      size: 9,
      color: muted,
    },
  );

  const changeWidth = (contentWidth - 36) / 3;
  view.changeCards.forEach((card, index) => {
    drawInfoCard(
      commands,
      pageMargin + 18 + index * (changeWidth + 9),
      420,
      changeWidth,
      156,
      card.title,
      card.body,
      index === 0 ? "gold" : index === 1 ? "neutral" : "warning",
    );
  });

  drawThesisBox(
    commands,
    pageMargin + 18,
    586,
    contentWidth - 36,
    52,
    "Decision frame",
    view.decisionQuestion,
  );
}

export function drawBusinessQualityPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, view, "Business Quality", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Business Quality",
    "A scorecard view of quality, resilience, and uncertainty.",
  );

  drawChipRow(commands, pageMargin, 98, contentWidth, view.qualityChips);

  drawPanel(commands, pageMargin, 142, contentWidth, 316, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 162, "Business quality scorecard", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawText(commands, pageMargin + 18, 188, "Factor", {
    font: "bodyBold",
    size: 9,
    color: muted,
  });
  drawText(commands, pageMargin + 134, 188, "Reading", {
    font: "bodyBold",
    size: 9,
    color: muted,
  });
  drawText(commands, pageMargin + 302, 188, "Signal", {
    font: "bodyBold",
    size: 9,
    color: muted,
  });
  drawText(commands, pageMargin + 382, 188, "Evidence note", {
    font: "bodyBold",
    size: 9,
    color: muted,
  });

  let rowTop = 204;
  view.qualityRows.forEach((row, index) => {
    drawPanel(commands, pageMargin + 14, rowTop, contentWidth - 28, 48, {
      fill: index % 2 === 0 ? white : panelSlate,
      stroke: divider,
      lineWidth: 0.4,
    });
    drawText(commands, pageMargin + 24, rowTop + 18, row.factor, {
      font: "bodyBold",
      size: 9.5,
      color: ink,
    });
    drawTextBlock(commands, pageMargin + 134, rowTop + 12, 152, row.reading, {
      font: "body",
      size: 8.5,
      leading: 11,
      color: ink,
      maxLines: 3,
    });
    drawStatusChip(commands, pageMargin + 302, rowTop + 12, 66, row.signal, row.tone);
    drawTextBlock(commands, pageMargin + 382, rowTop + 12, 126, row.evidence, {
      font: "body",
      size: 8.5,
      leading: 11,
      color: muted,
      maxLines: 3,
    });
    rowTop += 48;
  });

  drawLabeledPanel(
    commands,
    pageMargin,
    476,
    contentWidth,
    74,
    "Quality context",
    view.qualityContext,
    "gold",
  );
  drawThesisBox(commands, pageMargin, 568, contentWidth, 96, "Interpretation", view.qualityInterpretation);
}

export function drawFinancialStatementPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, view, "Financial Statement Analysis", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Financial Statement Analysis",
    "Structured financial history first, chart second.",
  );

  drawFinancialTable(commands, pageMargin, 98, contentWidth, 286, view.financialYears, view.financialRows);

  drawPanel(commands, pageMargin, 404, contentWidth, 232, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 424, "Margin profile", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawText(
    commands,
    pageMargin + 18,
    450,
    "Gross margin and operating margin across reported annual periods.",
    {
      font: "body",
      size: 9,
      color: muted,
    },
  );
  drawMarginChart(commands, pageMargin + 18, 464, contentWidth - 36, 142, view.marginChart);
  drawTextBlock(commands, pageMargin + 18, 618, contentWidth - 36, view.financialNote, {
    font: "body",
    size: 9,
    leading: 12,
    color: muted,
    maxLines: 3,
  });
}

export function drawValuationPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, view, "Valuation and Scenarios", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Valuation and Scenarios",
    "A scenario framework, not a false-precision point estimate.",
  );

  drawLabeledPanel(
    commands,
    pageMargin,
    98,
    contentWidth,
    76,
    "Framework",
    view.valuationFrameworkLabel,
    "gold",
  );
  drawScenarioTable(commands, pageMargin, 194, contentWidth, 272, view.scenarioColumns);

  drawPanel(commands, pageMargin, 486, contentWidth, 170, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 506, "Valuation range", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawText(
    commands,
    pageMargin + 18,
    532,
    "Compact bridge from downside, base case, upside, and spot price.",
    {
      font: "body",
      size: 9,
      color: muted,
    },
  );
  drawValuationRange(commands, pageMargin + 18, 548, contentWidth - 36, 58, view.valuationRange, {
    lowLabel: "Bear",
    midLabel: "Base",
    highLabel: "Bull",
    spotLabel: "Spot",
  });
  drawMetricTileStrip(commands, pageMargin + 18, 606, contentWidth - 36, view.valuationTiles);
  drawThesisBox(
    commands,
    pageMargin,
    666,
    contentWidth,
    44,
    "Valuation read-through",
    view.valuationNarrative,
  );
}

export function drawEvidenceAndRiskPage(
  commands: string[],
  view: ReportViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, view, "Evidence and Risks", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Evidence, Risks, and What Would Change Our Mind",
    "The trust-building page: evidence, limits, and thesis breakers.",
  );

  drawPanel(commands, pageMargin, 98, contentWidth, 132, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 118, "Active kill-switch coverage", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawText(
    commands,
    pageMargin + 18,
    144,
    "Three conditions that would weaken the thesis fast enough to warrant a fresh read.",
    {
      font: "body",
      size: 9,
      color: muted,
    },
  );
  const visibleKillSwitches = view.killSwitchCards.slice(0, 3);
  const killSwitchWidth = (contentWidth - 18 * 2 - 9 * Math.max(visibleKillSwitches.length - 1, 0)) /
    Math.max(visibleKillSwitches.length, 1);
  visibleKillSwitches.forEach((card, index) => {
    drawCompactNarrativeCard(
      commands,
      pageMargin + 18 + index * (killSwitchWidth + 9),
      158,
      killSwitchWidth,
      56,
      card.title,
      card.body,
      card.tone,
    );
  });

  const columnWidth = (contentWidth - 16) / 2;
  drawEvidencePanel(commands, pageMargin, 246, columnWidth, 224, view.evidenceCards);
  drawCoverageNote(commands, pageMargin, 482, columnWidth, 160, view.coverageNote, view.missingInputs);
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    246,
    columnWidth,
    224,
    "Top risks",
    view.riskItems,
    "warning",
  );
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    482,
    columnWidth,
    160,
    "What would change our mind",
    view.mindChangeItems,
    "gold",
  );
}
