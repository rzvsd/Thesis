import { readFileSync } from "node:fs";

import type { MarketPulseReport } from "../../../packages/contracts/src";

import { writeMarketPulseArtifacts } from "./market-pulse-render";

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function main(): void {
  const inputPath = readArg("--input");
  const htmlPath = readArg("--html");
  const pdfPath = readArg("--pdf");

  if (!inputPath || (!htmlPath && !pdfPath)) {
    throw new Error(
      "Usage: node market-pulse-render-cli.js --input <report.json> [--html <report.html>] [--pdf <report.pdf>]"
    );
  }

  const report = JSON.parse(readFileSync(inputPath, "utf8")) as MarketPulseReport;
  writeMarketPulseArtifacts(report, {
    htmlPath,
    pdfPath
  });

  if (htmlPath) {
    console.log(`Wrote HTML to ${htmlPath}`);
  }
  if (pdfPath) {
    console.log(`Wrote PDF to ${pdfPath}`);
  }
}

main();
