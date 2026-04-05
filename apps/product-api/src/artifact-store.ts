import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

import type { AnalysisReport, MarketPulseReport } from "../../../packages/contracts/src";
import type { ProductApiConfig } from "./config";

export type StoredReport = AnalysisReport | MarketPulseReport;

export interface ArtifactStore {
  writeReport(report: StoredReport): Promise<string>;
  readReport(artifactKey: string): Promise<StoredReport | undefined>;
  deleteReport(artifactKey: string): Promise<void>;
}

function toArtifactKey(report: StoredReport): string {
  const reportType = "type" in report ? report.type : "market_pulse";
  return `${reportType}/${report.generated_at.slice(0, 10)}/${report.report_id}.json`;
}

export class FilesystemArtifactStore implements ArtifactStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async writeReport(report: StoredReport): Promise<string> {
    const artifactKey = toArtifactKey(report);
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

async function toStringBody(body: unknown): Promise<string> {
  if (!body) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  if (typeof body === "object" && body !== null && "transformToString" in body) {
    const maybeFn = (body as { transformToString?: () => Promise<string> }).transformToString;
    if (typeof maybeFn === "function") {
      return maybeFn.call(body);
    }
  }
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(Buffer.from(chunk));
      }
    }
    return Buffer.concat(chunks).toString("utf-8");
  }
  return "";
}

export class S3ArtifactStore implements ArtifactStore {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  constructor(input: {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    forcePathStyle: boolean;
    keyPrefix: string;
  }) {
    this.bucket = input.bucket;
    this.keyPrefix = input.keyPrefix
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    this.client = new S3Client({
      region: input.region,
      endpoint: input.endpoint,
      forcePathStyle: input.forcePathStyle,
      credentials:
        input.accessKeyId && input.secretAccessKey
          ? {
              accessKeyId: input.accessKeyId,
              secretAccessKey: input.secretAccessKey
            }
          : undefined
    });
  }

  private keyFor(artifactKey: string): string {
    const normalized = artifactKey.trim().replace(/^\/+/, "");
    if (this.keyPrefix.length === 0) {
      return normalized;
    }
    return `${this.keyPrefix}/${normalized}`;
  }

  async writeReport(report: StoredReport): Promise<string> {
    const artifactKey = toArtifactKey(report);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keyFor(artifactKey),
        Body: JSON.stringify(report),
        ContentType: "application/json; charset=utf-8"
      })
    );
    return artifactKey;
  }

  async readReport(artifactKey: string): Promise<StoredReport | undefined> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.keyFor(artifactKey)
        })
      );
      const raw = await toStringBody(response.Body);
      if (raw.trim().length === 0) {
        return undefined;
      }
      return JSON.parse(raw) as StoredReport;
    } catch (error) {
      if (error instanceof NoSuchKey) {
        return undefined;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "NoSuchKey"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async deleteReport(artifactKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.keyFor(artifactKey)
        })
      );
    } catch (error) {
      if (
        error instanceof NoSuchKey ||
        (typeof error === "object" &&
          error !== null &&
          "name" in error &&
          error.name === "NoSuchKey")
      ) {
        return;
      }
      throw error;
    }
  }
}

export function createArtifactStore(config: ProductApiConfig): ArtifactStore {
  if (config.artifactStoreMode === "s3") {
    if (!config.artifactS3Bucket || !config.artifactS3Region) {
      throw new Error("S3 artifact storage configuration is incomplete.");
    }
    return new S3ArtifactStore({
      bucket: config.artifactS3Bucket,
      region: config.artifactS3Region,
      endpoint: config.artifactS3Endpoint,
      accessKeyId: config.artifactS3AccessKeyId,
      secretAccessKey: config.artifactS3SecretAccessKey,
      forcePathStyle: config.artifactS3ForcePathStyle,
      keyPrefix: config.artifactS3Prefix
    });
  }
  return new FilesystemArtifactStore(config.artifactRoot);
}
