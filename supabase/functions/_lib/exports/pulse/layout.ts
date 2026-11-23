// Flowing layout for the Market Pulse PDF: a top-down cursor that opens a new page when a block does not fit.
// Coordinates here are measured from the top of the page; the writer works from the bottom.
import {
  appendLine,
  appendRect,
  appendText,
  estimateTextWidth,
  sanitizeInline,
  wrapText,
} from "../report_pdf/writer.ts";
import {
  divider,
  gold,
  ivory,
  muted,
  pageHeight,
  pageMargin,
  pageWidth,
  PdfFontKey,
  PdfPageContent,
  PdfRgb,
} from "../report_pdf/theme.ts";

export const contentTop = 54;
export const contentBottom = 724;
export const left = pageMargin;
export const right = pageWidth - pageMargin;
export const width = right - left;

export interface TextStyle {
  size: number;
  font: PdfFontKey;
  color: PdfRgb;
  tracking?: number;
  leading?: number;
}

export interface FrameInfo {
  dateLabel: string;
  footerLabel: string;
}

export class FlowLayout {
  readonly pages: string[][] = [[]];
  y = contentTop;

  get commands(): string[] {
    return this.pages[this.pages.length - 1];
  }

  remaining(): number {
    return contentBottom - this.y;
  }

  newPage(): void {
    this.pages.push([]);
    this.y = contentTop;
  }

  // Start a new page unless `height` points still fit on this one.
  ensure(height: number): void {
    if (this.y + height > contentBottom && this.y > contentTop) {
      this.newPage();
    }
  }

  gap(points: number): void {
    this.y = Math.min(this.y + points, contentBottom);
  }

  // Draws one line whose box starts at the current cursor. Does not move the cursor.
  textAt(
    x: number,
    top: number,
    text: string,
    style: TextStyle,
    align: "left" | "right" | "center" = "left",
  ): void {
    const tracking = style.tracking ?? 0;
    const textWidth = estimateTextWidth(text, style.size, style.font, tracking);
    const drawX = align === "right" ? x - textWidth : align === "center" ? x - textWidth / 2 : x;
    appendText(
      this.commands,
      drawX,
      pageHeight - top - style.size,
      style.size,
      text,
      style.color,
      style.font,
      tracking,
    );
    resetTracking(this.commands, tracking);
  }

  rect(
    x: number,
    top: number,
    w: number,
    h: number,
    fill?: PdfRgb,
    stroke?: PdfRgb,
    lineWidth?: number,
  ): void {
    appendRect(this.commands, x, pageHeight - top - h, w, h, fill, stroke, lineWidth);
  }

  line(x1: number, top1: number, x2: number, top2: number, color: PdfRgb, lineWidth?: number): void {
    appendLine(this.commands, x1, pageHeight - top1, x2, pageHeight - top2, color, lineWidth);
  }

  lineHeight(style: TextStyle): number {
    return style.size * (style.leading ?? 1.45);
  }

  // Wrapped paragraph; lines flow onto the next page as needed. `decorate` runs once per drawn line.
  paragraph(
    text: string,
    style: TextStyle,
    options: { indent?: number; maxWidth?: number; decorate?: (top: number, height: number) => void } = {},
  ): void {
    const indent = options.indent ?? 0;
    const maxWidth = options.maxWidth ?? width - indent;
    const lineHeight = this.lineHeight(style);
    for (const line of wrapText(text, maxWidth, style.size, style.font)) {
      this.ensure(lineHeight);
      options.decorate?.(this.y, lineHeight);
      this.textAt(left + indent, this.y, line, style);
      this.y += lineHeight;
    }
  }

  // Number of wrapped lines a paragraph needs (for keep-together checks).
  measure(text: string, style: TextStyle, maxWidth: number): number {
    return wrapText(text, maxWidth, style.size, style.font).length * this.lineHeight(style);
  }

  // Section heading in the house style: small gold caps over a hairline. Keeps `keepWith` points below it.
  heading(title: string, keepWith = 40): void {
    this.ensure(30 + keepWith);
    if (this.y > contentTop) {
      this.gap(6);
      this.line(left, this.y, right, this.y, divider, 0.6);
      this.gap(12);
    }
    this.textAt(left, this.y, sanitizeInline(title).toUpperCase(), {
      size: 9,
      font: "bodyBold",
      color: gold,
      tracking: 1.1,
    });
    this.gap(18);
  }

  subheading(title: string): void {
    this.ensure(32);
    this.textAt(left, this.y, sanitizeInline(title).toUpperCase(), {
      size: 8,
      font: "bodyBold",
      color: muted,
      tracking: 0.9,
    });
    this.gap(14);
  }

  bullet(text: string, style: TextStyle, boldLead?: string): void {
    const lineHeight = this.lineHeight(style);
    this.ensure(lineHeight);
    this.textAt(left + 4, this.y, "-", { ...style, color: gold, font: "bodyBold" });
    const body = boldLead ? `${boldLead}: ${text}` : text;
    const lines = wrapText(body, width - 16, style.size, style.font);
    lines.forEach((line, index) => {
      this.ensure(lineHeight);
      if (index === 0 && boldLead) {
        const lead = `${sanitizeInline(boldLead)}:`;
        this.textAt(left + 14, this.y, lead, { ...style, font: "bodyBold" });
        const rest = line.slice(lead.length).trim();
        const leadWidth = estimateTextWidth(`${lead} `, style.size, "bodyBold") * 1.12;
        this.textAt(left + 14 + leadWidth, this.y, rest, style);
      } else {
        this.textAt(left + 14, this.y, line, style);
      }
      this.y += lineHeight;
    });
    this.gap(3);
  }

  toPdfPages(frame: FrameInfo): PdfPageContent[] {
    return this.pages.map((content, index) => ({
      title: `Morning Brief ${index + 1}`,
      draw: (commands: string[], pageNumber: number, totalPages: number) => {
        drawPulseFrame(commands, frame, pageNumber, totalPages);
        for (const command of content) {
          commands.push(command);
        }
      },
    }));
  }
}

function drawPulseFrame(commands: string[], frame: FrameInfo, pageNumber: number, totalPages: number): void {
  appendRect(commands, 0, 0, pageWidth, pageHeight, ivory);
  const headerBaseline = pageHeight - 28;
  appendText(commands, left, headerBaseline, 9.5, "THESIS", gold, "bodyBold", 1.1);
  resetTracking(commands, 1.1);
  const centre = "MORNING BRIEF";
  appendText(
    commands,
    pageWidth / 2 - estimateTextWidth(centre, 8.5, "bodyBold", 0.6) / 2,
    headerBaseline,
    8.5,
    centre,
    muted,
    "bodyBold",
    0.6,
  );
  resetTracking(commands, 0.6);
  appendText(
    commands,
    right - estimateTextWidth(frame.dateLabel, 8.5, "body"),
    headerBaseline,
    8.5,
    frame.dateLabel,
    muted,
    "body",
  );
  appendLine(commands, left, pageHeight - 36, right, pageHeight - 36, divider);
  appendLine(commands, left, pageHeight - 740, right, pageHeight - 740, divider);
  const footerBaseline = pageHeight - 754;
  appendText(commands, left, footerBaseline, 8, frame.footerLabel, muted, "body");
  const pageLabel = `Page ${pageNumber} of ${totalPages}`;
  appendText(
    commands,
    right - estimateTextWidth(pageLabel, 8, "body"),
    footerBaseline,
    8,
    pageLabel,
    muted,
    "body",
  );
}

// Tc (character spacing) is graphics state and outlives the BT/ET block that set it, so put it back.
function resetTracking(commands: string[], tracking: number): void {
  if (tracking !== 0) {
    commands.push("0 Tc");
  }
}
