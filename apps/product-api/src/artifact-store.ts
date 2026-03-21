import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { AnalysisReport, MarketPulseReport } from "../../../packages/contracts/src";

export type StoredReport = AnalysisReport | MarketPulseReport;

export interface ArtifactStore {
  writeReport(report: StoredReport): Promise<string>;
  readReport(artifactKey: string): Promise<StoredReport | undefined>;
  deleteReport(artifactKey: string): Promise<void>;
}

export class FilesystemArtifactStore implements ArtifactStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async writeReport(report: StoredReport): Promise<string> {
    const reportType = "type" in report ? report.type : "market_pulse";
    const artifactKey = `${reportType}/${report.generated_at.slice(0, 10)}/${report.report_id}.json`;
    const fullPath = resolve(this.root, artifactKey);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, JSON.stringify(report, null, 2), "utf-8");
    return artifactKey;
  }

  async readReport(artifactKey: string): Promise<StoredReport | undefined> {
    const fullPath = resolve(this.root, artifactKey);
    try {
      const content = await readFile(fullPath, "utf-8");
      return JSON.parse(content) as StoredReport;
    } catch {
      return undefined;
    }
  }

  async deleteReport(artifactKey: string): Promise<void> {
    const fullPath = resolve(this.root, artifactKey);
    try {
      await unlink(fullPath);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }

      throw error;
    }
  }
}
