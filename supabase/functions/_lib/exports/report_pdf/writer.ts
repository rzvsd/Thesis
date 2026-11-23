// Minimal PDF writer and text helpers (Type1 base fonts, no embedding).
// Ported from apps/product-api/src/report-pdf.ts (M4). Logic kept as is; only plumbing changed.
import { fontResources, pageHeight, pageWidth, PdfFontKey, PdfPageContent, PdfRgb } from "./theme.ts";

export function renderSimplePdf(pages: PdfPageContent[]): Uint8Array {
  const encoder = new TextEncoder();
  const objects = new Map<number, string>();
  const catalogObjectId = 1;
  const pagesObjectId = 2;
  let nextObjectId = 3;
  const fontObjectIds = new Map<PdfFontKey, number>();

  for (const fontKey of Object.keys(fontResources) as PdfFontKey[]) {
    fontObjectIds.set(fontKey, nextObjectId);
    objects.set(
      nextObjectId,
      `<< /Type /Font /Subtype /Type1 /BaseFont /${fontResources[fontKey].baseFont} >>`,
    );
    nextObjectId += 1;
  }

  objects.set(catalogObjectId, `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  const pageObjectIds: number[] = [];
  pages.forEach((page, index) => {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    const commands: string[] = [];
    page.draw(commands, index + 1, pages.length);
    const contentStream = commands.join("\n");
    pageObjectIds.push(pageObjectId);

    const resourceEntries = (Object.keys(fontResources) as PdfFontKey[])
      .map((fontKey) => `/${fontResources[fontKey].resource} ${fontObjectIds.get(fontKey)} 0 R`)
      .join(" ");

    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << ${resourceEntries} >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.set(
      contentObjectId,
      `<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream`,
    );
  });

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects.set(pagesObjectId, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  const maxObjectId = nextObjectId - 1;
  const offsets: number[] = new Array(maxObjectId + 1).fill(0);
  // Parts plus a running byte count: the old code measured the whole string each time (quadratic).
  const parts: string[] = ["%PDF-1.4\n"];
  let byteLength = encoder.encode(parts[0]).length;
  const append = (text: string) => {
    parts.push(text);
    byteLength += encoder.encode(text).length;
  };

  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    const objectBody = objects.get(objectId);
    if (!objectBody) {
      throw new Error(`Missing PDF object ${objectId}.`);
    }
    offsets[objectId] = byteLength;
    append(`${objectId} 0 obj\n${objectBody}\nendobj\n`);
  }

  const xrefOffset = byteLength;
  append(`xref\n0 ${maxObjectId + 1}\n`);
  append("0000000000 65535 f \n");
  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    append(`${(offsets[objectId] ?? 0).toString().padStart(10, "0")} 00000 n \n`);
  }
  append(
    `trailer\n<< /Size ${maxObjectId + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );
  return encoder.encode(parts.join(""));
}

export function appendText(
  commands: string[],
  x: number,
  y: number,
  fontSize: number,
  text: string,
  color: PdfRgb,
  font: PdfFontKey,
  tracking = 0,
): void {
  commands.push("BT");
  commands.push(`${colorToCommand(color)} rg`);
  commands.push(`/${fontResources[font].resource} ${fontSize} Tf`);
  if (tracking !== 0) {
    commands.push(`${roundPdfNumber(tracking)} Tc`);
  }
  commands.push(`1 0 0 1 ${roundPdfNumber(x)} ${roundPdfNumber(y)} Tm`);
  commands.push(`(${escapePdfText(text)}) Tj`);
  commands.push("ET");
}

export function appendRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor?: PdfRgb,
  strokeColor?: PdfRgb,
  lineWidth = 0.8,
): void {
  commands.push("q");
  if (fillColor) {
    commands.push(`${colorToCommand(fillColor)} rg`);
  }
  if (strokeColor) {
    commands.push(`${colorToCommand(strokeColor)} RG`);
    commands.push(`${roundPdfNumber(lineWidth)} w`);
  }
  commands.push(
    `${roundPdfNumber(x)} ${roundPdfNumber(y)} ${roundPdfNumber(width)} ${roundPdfNumber(height)} re`,
  );
  if (fillColor && strokeColor) {
    commands.push("B");
  } else if (fillColor) {
    commands.push("f");
  } else if (strokeColor) {
    commands.push("S");
  }
  commands.push("Q");
}

export function appendLine(
  commands: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: PdfRgb,
  lineWidth = 0.8,
): void {
  commands.push("q");
  commands.push(`${colorToCommand(color)} RG`);
  commands.push(`${roundPdfNumber(lineWidth)} w`);
  commands.push(`${roundPdfNumber(x1)} ${roundPdfNumber(y1)} m`);
  commands.push(`${roundPdfNumber(x2)} ${roundPdfNumber(y2)} l`);
  commands.push("S");
  commands.push("Q");
}

export function appendCircle(
  commands: string[],
  centerX: number,
  centerY: number,
  radius: number,
  fill: PdfRgb,
  stroke: PdfRgb,
): void {
  const control = radius * 0.552284749831;
  commands.push("q");
  commands.push(`${colorToCommand(fill)} rg`);
  commands.push(`${colorToCommand(stroke)} RG`);
  commands.push("0.5 w");
  commands.push(`${roundPdfNumber(centerX)} ${roundPdfNumber(centerY + radius)} m`);
  commands.push(
    `${roundPdfNumber(centerX + control)} ${roundPdfNumber(centerY + radius)} ${
      roundPdfNumber(centerX + radius)
    } ${roundPdfNumber(centerY + control)} ${roundPdfNumber(centerX + radius)} ${roundPdfNumber(centerY)} c`,
  );
  commands.push(
    `${roundPdfNumber(centerX + radius)} ${roundPdfNumber(centerY - control)} ${
      roundPdfNumber(centerX + control)
    } ${roundPdfNumber(centerY - radius)} ${roundPdfNumber(centerX)} ${roundPdfNumber(centerY - radius)} c`,
  );
  commands.push(
    `${roundPdfNumber(centerX - control)} ${roundPdfNumber(centerY - radius)} ${
      roundPdfNumber(centerX - radius)
    } ${roundPdfNumber(centerY - control)} ${roundPdfNumber(centerX - radius)} ${roundPdfNumber(centerY)} c`,
  );
  commands.push(
    `${roundPdfNumber(centerX - radius)} ${roundPdfNumber(centerY + control)} ${
      roundPdfNumber(centerX - control)
    } ${roundPdfNumber(centerY + radius)} ${roundPdfNumber(centerX)} ${roundPdfNumber(centerY + radius)} c`,
  );
  commands.push("B");
  commands.push("Q");
}

export function wrapText(text: string, maxWidth: number, fontSize: number, font: PdfFontKey): string[] {
  const normalized = sanitizeInline(text);
  if (!normalized) {
    return [""];
  }
  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize, font) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  }
  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [normalized];
}

export function estimateTextWidth(text: string, fontSize: number, font: PdfFontKey, tracking = 0): number {
  const factor = font === "mono" ? 0.6 : font === "display" ? 0.56 : font === "bodyBold" ? 0.54 : 0.5;
  const safe = sanitizeInline(text);
  return safe.length * fontSize * factor + Math.max(0, safe.length - 1) * tracking;
}

export function colorToCommand(color: PdfRgb): string {
  return color.map((entry) => entry.toFixed(3)).join(" ");
}

export function roundPdfNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export function escapePdfText(value: string): string {
  return sanitizeInline(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function sanitizeInline(value: string | undefined): string {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shortenText(text: string, maxLength: number): string {
  const safe = sanitizeInline(text);
  if (safe.length <= maxLength) {
    return safe;
  }
  const trimmed = safe.slice(0, maxLength - 1);
  const breakIndex = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, breakIndex > 32 ? breakIndex : maxLength - 1).trim()}.`;
}

export function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const safe = sanitizeInline(value);
    if (safe.length > 0) {
      return safe;
    }
  }
  return "";
}

export function humanizeInlineWord(value: string): string {
  return sanitizeInline(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`)
    .join(" ");
}

export function hasAtLeastOneValue(values: Array<number | undefined>): boolean {
  return values.some(isFiniteNumber);
}

export function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

export function formatReportDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatPrice(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function formatFinancialAmount(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value.toFixed(1)}M`;
}

export function formatPct(value: number | undefined, digits = 1): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPct(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function computeMove(value: number | undefined, spot: number | undefined): number | undefined {
  if (value === undefined || spot === undefined || spot === 0) {
    return undefined;
  }
  return (value - spot) / spot;
}
