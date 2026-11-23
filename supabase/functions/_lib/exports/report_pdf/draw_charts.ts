// Drawing blocks: charts, panels, lists and text.
// Ported from apps/product-api/src/report-pdf.ts (M4). Logic kept as is; only plumbing changed.
import { drawInfoCard, drawStatusChip } from "./draw_blocks.ts";
import {
  charcoal,
  DetailPair,
  divider,
  EvidenceCard,
  gold,
  goldSoft,
  ink,
  MarginChartView,
  muted,
  negative,
  negativeSoft,
  pageHeight,
  panelIvory,
  panelSlate,
  PdfFontKey,
  PdfRgb,
  PdfTone,
  positive,
  positiveSoft,
  ValueSignalRow,
  warning,
  warningSoft,
  white,
} from "./theme.ts";
import {
  appendCircle,
  appendLine,
  appendRect,
  appendText,
  estimateTextWidth,
  formatPct,
  sanitizeInline,
  wrapText,
} from "./writer.ts";

export function drawMarginChart(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  chart: MarginChartView | undefined,
): void {
  if (!chart || chart.labels.length === 0) {
    drawText(commands, x, top + 12, "Comparable annual margin history is not available for this report.", {
      font: "body",
      size: 9,
      color: muted,
    });
    return;
  }

  const chartTop = top + 10;
  const chartLeft = x + 26;
  const chartWidth = width - 44;
  const chartHeight = height - 52;
  const maxValue = Math.max(
    0.4,
    ...chart.grossMargins.map((value) => value ?? 0),
    ...chart.operatingMargins.map((value) => value ?? 0),
  );

  for (let step = 0; step <= 4; step += 1) {
    const y = chartTop + chartHeight - (chartHeight / 4) * step;
    drawDivider(commands, chartLeft, y, chartLeft + chartWidth, y, 0.3);
    drawText(commands, x, y - 4, formatPct((maxValue / 4) * step, 0), {
      font: "body",
      size: 7.5,
      color: muted,
    });
  }

  const groupWidth = chartWidth / chart.labels.length;
  const barWidth = Math.min(22, (groupWidth - 18) / 2);
  chart.labels.forEach((label, index) => {
    const baseX = chartLeft + index * groupWidth + groupWidth / 2;
    const gross = chart.grossMargins[index];
    const operating = chart.operatingMargins[index];
    if (gross !== undefined) {
      const barHeight = (gross / maxValue) * (chartHeight - 12);
      drawPanel(commands, baseX - barWidth - 3, chartTop + chartHeight - barHeight, barWidth, barHeight, {
        fill: goldSoft,
        stroke: gold,
        lineWidth: 0.5,
      });
    }
    if (operating !== undefined) {
      const barHeight = (operating / maxValue) * (chartHeight - 12);
      drawPanel(commands, baseX + 3, chartTop + chartHeight - barHeight, barWidth, barHeight, {
        fill: charcoal,
        stroke: charcoal,
        lineWidth: 0.5,
      });
    }
    drawText(commands, baseX, chartTop + chartHeight + 8, label, {
      font: "body",
      size: 8,
      color: ink,
      align: "center",
    });
  });

  drawPanel(commands, x + width - 148, top + 2, 12, 12, { fill: goldSoft, stroke: gold, lineWidth: 0.5 });
  drawText(commands, x + width - 130, top + 2, "Gross margin", {
    font: "body",
    size: 8,
    color: ink,
  });
  drawPanel(commands, x + width - 68, top + 2, 12, 12, { fill: charcoal, stroke: charcoal, lineWidth: 0.5 });
  drawText(commands, x + width - 50, top + 2, "Operating margin", {
    font: "body",
    size: 8,
    color: ink,
  });
}

export function drawEvidencePanel(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  cards: EvidenceCard[],
): void {
  drawPanel(commands, x, top, width, height, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, x + 18, top + 20, "Key evidence used", {
    font: "display",
    size: 18,
    color: charcoal,
  });

  const visible = cards.slice(0, 4);
  if (visible.length === 1) {
    const soloCard = visible[0];
    if (!soloCard) {
      return;
    }
    drawInfoCard(commands, x + 18, top + 54, width - 36, 104, soloCard.title, soloCard.body, "neutral");
    drawTextBlock(
      commands,
      x + 18,
      top + 178,
      width - 36,
      "The memo uses attached evidence excerpts when they exist and does not invent them when they do not.",
      {
        font: "body",
        size: 9,
        leading: 12,
        color: muted,
        maxLines: 3,
      },
    );
    return;
  }

  const innerWidth = (width - 34) / 2;
  visible.forEach((card, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawInfoCard(
      commands,
      x + 10 + column * (innerWidth + 14),
      top + 50 + row * 90,
      innerWidth,
      78,
      card.title,
      card.body,
      row === 0 ? "neutral" : "gold",
    );
  });
}

export function drawCoverageNote(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  summary: string,
  missingInputs: string[],
): void {
  drawPanel(commands, x, top, width, height, {
    fill: panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, x + 18, top + 20, "Coverage limitations", {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawTextBlock(commands, x + 18, top + 46, width - 36, summary, {
    font: "body",
    size: 9.5,
    leading: 13,
    color: ink,
    maxLines: 4,
  });
  drawBulletList(commands, x + 18, top + 92, width - 36, missingInputs.slice(0, 4), {
    font: "body",
    size: 9,
    leading: 12,
    color: muted,
    bulletColor: gold,
  });
}

export function drawRiskList(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  title: string,
  items: string[],
  tone: PdfTone,
): void {
  const palette = tonePalette(tone);
  drawPanel(commands, x, top, width, height, {
    fill: tone === "gold" ? goldSoft : panelIvory,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, x + 18, top + 20, title, {
    font: "display",
    size: 18,
    color: charcoal,
  });
  drawBulletList(commands, x + 18, top + 48, width - 36, items.slice(0, 4), {
    font: "body",
    size: 9.5,
    leading: 14,
    color: ink,
    bulletColor: palette.stroke,
  });
}

export function drawDetailPairsPanel(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  title: string,
  pairs: DetailPair[],
  tone: PdfTone,
): void {
  const palette = tonePalette(tone);
  drawPanel(commands, x, top, width, height, {
    fill: tone === "neutral" ? panelIvory : palette.softFill,
    stroke: divider,
    lineWidth: 0.8,
  });
  drawText(commands, x + 18, top + 20, title, {
    font: "display",
    size: 18,
    color: charcoal,
  });

  let rowTop = top + 52;
  const labelColumnWidth = Math.min(108, Math.max(72, width * 0.28));
  const valueX = x + 24 + labelColumnWidth;
  const valueWidth = Math.max(54, width - labelColumnWidth - 52);
  const safePairs = pairs.length > 0
    ? pairs
    : [{ label: "Coverage note", value: "No additional structured detail was attached for this page." }];
  safePairs.slice(0, 5).forEach((pair, index) => {
    drawPanel(commands, x + 14, rowTop, width - 28, 30, {
      fill: index % 2 === 0 ? white : panelSlate,
      stroke: divider,
      lineWidth: 0.35,
    });
    drawText(commands, x + 24, rowTop + 10, pair.label, {
      font: "bodyBold",
      size: 8.8,
      color: tone === "neutral" ? ink : palette.stroke,
    });
    drawTextBlock(commands, valueX, rowTop + 8, valueWidth, pair.value, {
      font: "body",
      size: 8.5,
      leading: 10.5,
      color: ink,
      maxLines: 2,
    });
    rowTop += 30;
  });
}

export function drawValueSignalTable(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  rows: ValueSignalRow[],
): void {
  const safeRows = rows.length > 0 ? rows : [
    {
      label: "Signal coverage",
      family: "Unavailable",
      status: "Limited",
      tone: "warning" as const,
      reason: "The report did not attach a structured value-discipline breakdown.",
    },
  ];

  drawPanel(commands, x, top, width, height, {
    fill: white,
    stroke: divider,
    lineWidth: 0.5,
  });
  drawText(commands, x + 12, top + 10, "Signal", {
    font: "bodyBold",
    size: 8.5,
    color: muted,
  });
  drawText(commands, x + 188, top + 10, "Family", {
    font: "bodyBold",
    size: 8.5,
    color: muted,
  });
  drawText(commands, x + 266, top + 10, "Status", {
    font: "bodyBold",
    size: 8.5,
    color: muted,
  });
  drawText(commands, x + 330, top + 10, "Reason", {
    font: "bodyBold",
    size: 8.5,
    color: muted,
  });

  let rowTop = top + 24;
  safeRows.slice(0, 5).forEach((row, index) => {
    drawPanel(commands, x, rowTop, width, 30, {
      fill: index % 2 === 0 ? white : panelSlate,
      stroke: divider,
      lineWidth: 0.25,
    });
    drawText(commands, x + 12, rowTop + 10, row.label, {
      font: "bodyBold",
      size: 8.5,
      color: ink,
    });
    drawText(commands, x + 188, rowTop + 10, row.family, {
      font: "body",
      size: 8.2,
      color: muted,
    });
    drawStatusChip(commands, x + 246, rowTop + 4, 70, row.status, row.tone);
    drawTextBlock(commands, x + 330, rowTop + 8, width - 342, row.reason, {
      font: "body",
      size: 7.8,
      leading: 9.4,
      color: ink,
      maxLines: 2,
    });
    rowTop += 30;
  });
}

export function drawBulletList(
  commands: string[],
  x: number,
  top: number,
  width: number,
  items: string[],
  options: {
    font: PdfFontKey;
    size: number;
    leading: number;
    color: PdfRgb;
    bulletColor: PdfRgb;
  },
): number {
  let currentTop = top;
  const safeItems = items.length > 0 ? items : ["No additional detail was attached for this section."];
  for (const item of safeItems) {
    const lines = wrapText(item, width - 18, options.size, options.font);
    appendCircle(
      commands,
      x + 4.5,
      pageHeight - currentTop - 9.5,
      2.2,
      options.bulletColor,
      options.bulletColor,
    );
    lines.slice(0, 4).forEach((line, lineIndex) => {
      drawText(commands, x + 16, currentTop + lineIndex * options.leading, line, {
        font: options.font,
        size: options.size,
        color: options.color,
      });
    });
    currentTop += Math.max(options.leading, lines.slice(0, 4).length * options.leading) + 4;
  }
  return currentTop;
}

export function drawTextBlock(
  commands: string[],
  x: number,
  top: number,
  width: number,
  text: string,
  options: {
    font: PdfFontKey;
    size: number;
    leading: number;
    color: PdfRgb;
    align?: "left" | "right" | "center";
    maxLines?: number;
  },
): number {
  const lines = wrapText(text, width, options.size, options.font);
  const limited = options.maxLines ? lines.slice(0, options.maxLines) : lines;
  limited.forEach((line, index) => {
    drawText(commands, x, top + index * options.leading, line, {
      font: options.font,
      size: options.size,
      color: options.color,
      align: options.align,
    });
  });
  return top + limited.length * options.leading;
}

export function drawText(
  commands: string[],
  x: number,
  top: number,
  text: string,
  options: {
    font: PdfFontKey;
    size: number;
    color: PdfRgb;
    align?: "left" | "right" | "center";
    tracking?: number;
  },
): void {
  const safeText = sanitizeInline(text);
  const width = estimateTextWidth(safeText, options.size, options.font, options.tracking ?? 0);
  const drawX = options.align === "right" ? x - width : options.align === "center" ? x - width / 2 : x;
  appendText(
    commands,
    drawX,
    pageHeight - top - options.size,
    options.size,
    safeText,
    options.color,
    options.font,
    options.tracking ?? 0,
  );
}

export function drawPanel(
  commands: string[],
  x: number,
  top: number,
  width: number,
  height: number,
  options: {
    fill?: PdfRgb;
    stroke?: PdfRgb;
    lineWidth?: number;
  },
): void {
  appendRect(
    commands,
    x,
    pageHeight - top - height,
    width,
    height,
    options.fill,
    options.stroke,
    options.lineWidth ?? 0.8,
  );
}

export function drawDivider(
  commands: string[],
  x1: number,
  top1: number,
  x2: number,
  top2: number,
  width = 0.6,
): void {
  appendLine(commands, x1, pageHeight - top1, x2, pageHeight - top2, divider, width);
}

export function tonePalette(tone: PdfTone): {
  fill: PdfRgb;
  softFill: PdfRgb;
  stroke: PdfRgb;
  text: PdfRgb;
} {
  switch (tone) {
    case "positive":
      return { fill: positiveSoft, softFill: positiveSoft, stroke: positive, text: positive };
    case "negative":
      return { fill: negativeSoft, softFill: negativeSoft, stroke: negative, text: negative };
    case "warning":
      return { fill: warningSoft, softFill: warningSoft, stroke: warning, text: warning };
    case "gold":
      return { fill: goldSoft, softFill: goldSoft, stroke: gold, text: gold };
    case "neutral":
    default:
      return { fill: panelIvory, softFill: panelIvory, stroke: muted, text: ink };
  }
}
