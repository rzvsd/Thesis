// Due diligence pages.
// Ported from apps/product-api/src/report-pdf.ts (M4). Logic kept as is; only plumbing changed.
import {
  drawChipRow,
  drawInfoCard,
  drawLabeledPanel,
  drawMetricTileStrip,
  drawPageFrame,
  drawScenarioTable,
  drawSectionHeading,
  drawThesisBox,
  drawValuationRange,
} from "./draw_blocks.ts";
import {
  drawCoverageNote,
  drawDetailPairsPanel,
  drawEvidencePanel,
  drawPanel,
  drawRiskList,
  drawText,
  drawTextBlock,
  drawValueSignalTable,
} from "./draw_charts.ts";
import {
  charcoal,
  contentWidth,
  divider,
  DueDiligenceViewModel,
  ink,
  pageMargin,
  panelIvory,
} from "./theme.ts";

export function drawSparseDueDiligenceOverviewPage(
  commands: string[],
  model: DueDiligenceViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, model.base, "Due Diligence Overview", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Due Diligence Overview",
    "Competitive positioning and financial reality on one restrained summary page.",
  );

  drawThesisBox(
    commands,
    pageMargin,
    98,
    contentWidth,
    84,
    model.competitivePositioning.title,
    model.competitivePositioning.summary,
  );

  const columnWidth = (contentWidth - 16) / 2;
  drawLabeledPanel(
    commands,
    pageMargin,
    202,
    columnWidth,
    132,
    model.competitivePositioning.subtitle,
    model.competitivePositioning.narrative,
    "gold",
  );
  drawLabeledPanel(
    commands,
    pageMargin + columnWidth + 16,
    202,
    columnWidth,
    132,
    model.financialAnalysis.subtitle,
    model.financialAnalysis.narrative,
    "neutral",
  );

  drawPanel(commands, pageMargin, 354, contentWidth, 76, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 374, "Financial anchors", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawMetricTileStrip(commands, pageMargin + 18, 392, contentWidth - 36, model.financialMetricTiles);

  drawRiskList(
    commands,
    pageMargin,
    450,
    columnWidth,
    206,
    "Key diligence takeaways",
    [...model.competitivePositioning.bullets, ...model.financialAnalysis.bullets].slice(0, 5),
    "gold",
  );
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    450,
    columnWidth,
    206,
    "Open limitations",
    [...model.competitivePositioning.omissions, ...model.financialAnalysis.omissions].slice(0, 5),
    "warning",
  );
}

export function drawCompetitivePositioningPage(
  commands: string[],
  model: DueDiligenceViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, model.base, "Competitive Positioning", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Competitive Positioning",
    "How the company competes, where the moat sits, and what still needs proof.",
  );

  drawThesisBox(
    commands,
    pageMargin,
    98,
    contentWidth,
    82,
    model.competitivePositioning.title,
    model.competitivePositioning.summary,
  );

  const columnWidth = (contentWidth - 16) / 2;
  drawDetailPairsPanel(
    commands,
    pageMargin,
    198,
    columnWidth,
    228,
    "Positioning anchors",
    model.competitivePositioning.detailPairs,
    "gold",
  );
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    198,
    columnWidth,
    228,
    "Competitive observations",
    model.competitivePositioning.bullets,
    "neutral",
  );
  drawThesisBox(
    commands,
    pageMargin,
    446,
    contentWidth,
    96,
    "Interpretation",
    `${model.base.qualityContext}. ${model.competitivePositioning.narrative}`,
  );
  drawRiskList(
    commands,
    pageMargin,
    562,
    contentWidth,
    92,
    "Open competitive questions",
    model.competitivePositioning.omissions,
    "warning",
  );
}

export function drawValuationThesisStancePage(
  commands: string[],
  model: DueDiligenceViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, model.base, "Valuation and Thesis Stance", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Valuation and Thesis Stance",
    "How the price framework and the current stance fit together in one page.",
  );

  drawThesisBox(
    commands,
    pageMargin,
    98,
    contentWidth,
    78,
    model.valuationAndThesisStance.title,
    model.valuationAndThesisStance.summary,
  );
  drawLabeledPanel(
    commands,
    pageMargin,
    194,
    contentWidth,
    68,
    "Framework and stance",
    `${model.base.valuationFrameworkLabel}. ${model.valuationAndThesisStance.narrative}`,
    "gold",
  );
  drawScenarioTable(commands, pageMargin, 282, contentWidth, 236, model.base.scenarioColumns);
  drawValuationRange(commands, pageMargin + 18, 540, contentWidth - 36, 58, model.base.valuationRange, {
    lowLabel: "Bear",
    midLabel: "Base",
    highLabel: "Bull",
    spotLabel: "Spot",
  });
  drawMetricTileStrip(commands, pageMargin + 18, 598, contentWidth - 36, model.base.valuationTiles);
  drawRiskList(
    commands,
    pageMargin,
    648,
    contentWidth,
    52,
    "Valuation notes",
    model.valuationAndThesisStance.bullets,
    "neutral",
  );
}

export function drawSparseConvictionPage(
  commands: string[],
  model: DueDiligenceViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, model.base, "Growth Outlook and Valuation", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Growth Outlook and Valuation",
    "What the forward opportunity looks like, what valuation implies, and where limits remain.",
  );

  drawChipRow(commands, pageMargin, 98, contentWidth, model.base.signalChips);

  const leftWidth = 238;
  drawPanel(commands, pageMargin, 142, leftWidth, 272, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 162, "Growth opportunities and outlook", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawTextBlock(commands, pageMargin + 18, 188, leftWidth - 36, model.growthOpportunitiesAndOutlook.summary, {
    font: "body",
    size: 9.5,
    leading: 13,
    color: ink,
    maxLines: 5,
  });
  drawValueSignalTable(
    commands,
    pageMargin + 18,
    268,
    leftWidth - 36,
    124,
    model.valueSignalRows.slice(0, 3),
  );

  drawPanel(commands, pageMargin + leftWidth + 16, 142, contentWidth - leftWidth - 16, 272, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + leftWidth + 34, 162, "Valuation and thesis stance", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawValuationRange(
    commands,
    pageMargin + leftWidth + 34,
    198,
    contentWidth - leftWidth - 52,
    72,
    model.base.valuationRange,
    {
      lowLabel: "Bear",
      midLabel: "Base",
      highLabel: "Bull",
      spotLabel: "Spot",
    },
  );
  drawMetricTileStrip(
    commands,
    pageMargin + leftWidth + 34,
    274,
    contentWidth - leftWidth - 52,
    model.base.valuationTiles,
  );
  drawTextBlock(
    commands,
    pageMargin + leftWidth + 34,
    334,
    contentWidth - leftWidth - 52,
    model.valuationAndThesisStance.narrative,
    {
      font: "body",
      size: 9,
      leading: 12,
      color: ink,
      maxLines: 4,
    },
  );

  drawScenarioTable(commands, pageMargin, 434, contentWidth, 224, model.base.scenarioColumns);
}

export function drawFinancialAppendixPage(
  commands: string[],
  model: DueDiligenceViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, model.base, "Management and Governance", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Management and Governance",
    "Leadership quality, capital allocation, and the governance questions that still matter.",
  );

  drawThesisBox(
    commands,
    pageMargin,
    98,
    contentWidth,
    82,
    model.managementAndGovernance.title,
    model.managementAndGovernance.summary,
  );

  drawPanel(commands, pageMargin, 198, contentWidth, 76, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 218, "Management anchors", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawMetricTileStrip(commands, pageMargin + 18, 236, contentWidth - 36, model.financialMetricTiles);

  const columnWidth = (contentWidth - 16) / 2;
  drawDetailPairsPanel(
    commands,
    pageMargin,
    294,
    columnWidth,
    246,
    "Governance considerations",
    model.managementAndGovernance.detailPairs,
    "gold",
  );
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    294,
    columnWidth,
    246,
    "Open governance questions",
    model.managementAndGovernance.omissions,
    "warning",
  );

  drawThesisBox(
    commands,
    pageMargin,
    558,
    contentWidth,
    96,
    "Read-through",
    model.managementAndGovernance.narrative,
  );
}

export function drawValueDisciplinePage(
  commands: string[],
  model: DueDiligenceViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, model.base, "Growth Opportunities and Outlook", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Growth Opportunities and Outlook",
    "Where upside could come from next, and what still needs confirmation.",
  );

  drawChipRow(commands, pageMargin, 98, contentWidth, model.base.qualityChips);

  const cardWidth = (contentWidth - 24) / 3;
  drawInfoCard(
    commands,
    pageMargin,
    142,
    cardWidth,
    112,
    "Why now",
    model.growthOpportunitiesAndOutlook.detailPairs[0]?.value ?? "Limited",
    "gold",
  );
  drawInfoCard(
    commands,
    pageMargin + cardWidth + 12,
    142,
    cardWidth,
    112,
    "Current view",
    model.growthOpportunitiesAndOutlook.detailPairs[1]?.value ?? model.base.currentView,
    "neutral",
  );
  drawInfoCard(
    commands,
    pageMargin + (cardWidth + 12) * 2,
    142,
    cardWidth,
    112,
    "What must still happen",
    model.growthOpportunitiesAndOutlook.narrative,
    "warning",
  );

  drawPanel(commands, pageMargin, 274, contentWidth, 248, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, pageMargin + 18, 294, "Supporting scorecard and monitor points", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawValueSignalTable(commands, pageMargin + 18, 320, contentWidth - 36, 178, model.valueSignalRows);

  const columnWidth = (contentWidth - 16) / 2;
  drawRiskList(
    commands,
    pageMargin,
    542,
    columnWidth,
    112,
    "Supporting observations",
    model.growthOpportunitiesAndOutlook.bullets,
    "gold",
  );
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    542,
    columnWidth,
    112,
    "Missing pieces",
    model.growthOpportunitiesAndOutlook.omissions,
    "warning",
  );
}

export function drawRiskMonitoringPage(
  commands: string[],
  model: DueDiligenceViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, model.base, "Risks and Challenges", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Risks and Challenges",
    "Falsifiable risk framing and the conditions that would trigger a fresh review.",
  );

  drawThesisBox(
    commands,
    pageMargin,
    98,
    contentWidth,
    84,
    model.risksAndChallenges.title,
    model.risksAndChallenges.summary,
  );

  const columnWidth = (contentWidth - 16) / 2;
  drawRiskList(commands, pageMargin, 202, columnWidth, 208, "Top risks", model.base.riskItems, "warning");
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    202,
    columnWidth,
    208,
    "What would change our mind",
    model.base.mindChangeItems,
    "gold",
  );

  drawDetailPairsPanel(
    commands,
    pageMargin,
    430,
    columnWidth,
    200,
    "Kill-switch triggers",
    model.risksAndChallenges.detailPairs,
    "warning",
  );
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    430,
    columnWidth,
    200,
    "Monitoring notes",
    model.risksAndChallenges.bullets,
    "neutral",
  );
}

export function drawEvidenceBookPage(
  commands: string[],
  model: DueDiligenceViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, model.base, "Evidence and Coverage", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Evidence and Coverage",
    "The strongest supporting evidence, where it comes from, and what still lacks support.",
  );

  drawThesisBox(commands, pageMargin, 98, contentWidth, 84, "Evidence and coverage", model.base.coverageNote);

  const columnWidth = (contentWidth - 16) / 2;
  drawEvidencePanel(commands, pageMargin, 202, columnWidth, 248, model.base.evidenceCards);
  drawDetailPairsPanel(
    commands,
    pageMargin + columnWidth + 16,
    202,
    columnWidth,
    248,
    "Claim support",
    model.evidenceSupport,
    "gold",
  );
  drawCoverageNote(
    commands,
    pageMargin,
    470,
    columnWidth,
    160,
    model.base.coverageNote,
    model.appendixNotes,
  );
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    470,
    columnWidth,
    160,
    "Source notes",
    model.sourceNotes,
    "neutral",
  );
}

export function drawAppendixPage(
  commands: string[],
  model: DueDiligenceViewModel,
  pageNumber: number,
  totalPages: number,
): void {
  drawPageFrame(commands, model.base, "Appendix and Source Notes", pageNumber, totalPages);
  drawSectionHeading(
    commands,
    "Appendix and Source Notes",
    "Assumptions, open limitations, and report provenance in one closing reference page.",
  );

  drawThesisBox(commands, pageMargin, 98, contentWidth, 76, "Coverage truth", model.base.coverageNote);

  const columnWidth = (contentWidth - 16) / 2;
  drawDetailPairsPanel(
    commands,
    pageMargin,
    194,
    columnWidth,
    196,
    "Valuation assumptions",
    model.valuationAssumptions,
    "gold",
  );
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    194,
    columnWidth,
    196,
    "Primary sources",
    model.sourceNotes,
    "neutral",
  );
  drawRiskList(
    commands,
    pageMargin,
    410,
    columnWidth,
    210,
    "Open limitations",
    model.appendixNotes,
    "warning",
  );
  drawRiskList(
    commands,
    pageMargin + columnWidth + 16,
    410,
    columnWidth,
    210,
    "What to revisit next",
    model.base.mindChangeItems,
    "gold",
  );
}
