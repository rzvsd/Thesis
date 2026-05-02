import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { MarketPulseReport } from "../../../packages/contracts/src";
import { buildPulseBriefHtml } from "./pulse-brief-render";

export interface MarketPulsePdfExportResult {
  buffer: Buffer;
  html: string;
}

const chromiumCandidates = [
  process.env.THESIS_PDF_CHROME_PATH,
  process.env.CHROME_BIN,
  process.env.CHROMIUM_BIN,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);

export function supportsMarketPulsePdfExport(): boolean {
  return chromiumCandidates.some((candidate) => existsSync(candidate));
}

export function buildMarketPulseReportHtml(report: MarketPulseReport): string {
  return buildPulseBriefHtml(report);
}

export function buildMarketPulsePdfExport(report: MarketPulseReport): MarketPulsePdfExportResult {
  const browserPath = resolveChromiumExecutablePath();
  if (!browserPath) {
    throw new Error("Market Pulse PDF export requires a Chromium-compatible browser executable.");
  }

  const html = buildMarketPulseReportHtml(report);
  const tempDir = mkdtempSync(join(tmpdir(), "thesis-market-pulse-"));
  const htmlPath = join(tempDir, "market-pulse.html");
  const pdfPath = join(tempDir, "market-pulse.pdf");

  try {
    writeFileSync(htmlPath, html, "utf8");
    execFileSync(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--virtual-time-budget=12000",
        `--print-to-pdf=${pdfPath}`,
        htmlPath
      ],
      {
        windowsHide: true,
        stdio: "ignore"
      }
    );
    return {
      buffer: readFileSync(pdfPath),
      html
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function writeMarketPulseArtifacts(
  report: MarketPulseReport,
  output: {
    htmlPath?: string;
    pdfPath?: string;
  }
): void {
  if (!output.htmlPath && !output.pdfPath) {
    throw new Error("At least one output path is required.");
  }

  const html = buildMarketPulseReportHtml(report);
  if (output.htmlPath) {
    mkdirSync(dirname(output.htmlPath), { recursive: true });
    writeFileSync(output.htmlPath, html, "utf8");
  }
  if (output.pdfPath) {
    const rendered = buildMarketPulsePdfExport(report);
    mkdirSync(dirname(output.pdfPath), { recursive: true });
    writeFileSync(output.pdfPath, rendered.buffer);
  }
}

function resolveChromiumExecutablePath(): string | undefined {
  return chromiumCandidates.find((candidate) => existsSync(candidate));
}
