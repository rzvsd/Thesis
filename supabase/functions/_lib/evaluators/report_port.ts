import { readArtifact } from "../reports/artifacts.ts";
// Ports to M2's parts: report bodies in Storage and the Deep Dive queue.
// Report metadata comes from app.reports (EvaluatorStore). The JSON body lives in Supabase Storage,
// whose layout M2 owns, so the default reader is "disabled" until M2 plugs in its reader.

export class ReportUnavailableError extends Error {
  constructor(message = "Report artifact reader is not configured.") {
    super(message);
    this.name = "ReportUnavailableError";
  }
}

export interface ReportBodyReader {
  // false while no real reader is wired. Evaluators then keep stored results instead of
  // overwriting them with "artifact unavailable".
  readonly enabled: boolean;
  read(artifactKey: string): Promise<unknown>;
}

export const disabledReportReader: ReportBodyReader = {
  enabled: false,
  read: () => Promise.reject(new ReportUnavailableError()),
};

export interface QueuedJob {
  id: string;
  reportId?: string;
}

export interface DeepDiveQueue {
  readonly enabled: boolean;
  // Queues a Deep Dive refresh for one user and ticker. Returns undefined when nothing was queued.
  queueRefresh(input: { userId: string; ticker: string; createdAt: string }): Promise<QueuedJob | undefined>;
}

export const disabledDeepDiveQueue: DeepDiveQueue = {
  enabled: false,
  queueRefresh: () => Promise.resolve(undefined),
};

// Reads report bodies from Supabase Storage (shared M1 convention). A missing object counts as unavailable.
export const storageReportReader: ReportBodyReader = {
  enabled: true,
  read: async (artifactKey) => {
    const body = await readArtifact(artifactKey);
    if (body === undefined) throw new ReportUnavailableError("Report artifact missing.");
    return body;
  },
};
