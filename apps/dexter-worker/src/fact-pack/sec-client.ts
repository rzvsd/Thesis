// Small HTTP client for SEC EDGAR JSON (www.sec.gov and data.sec.gov).
// SEC fair-access rules: a User-Agent that names the caller, and at most 10 requests a second per client.
// This client sends SEC_USER_AGENT, waits at least 125 ms between request starts (about 8 a second),
// gives each attempt 10 s, and retries twice with backoff on 429, 5xx and network errors.

export const DEFAULT_SEC_USER_AGENT = "Thesis research contact@example.com";

export const SEC_URLS = {
  tickers: "https://www.sec.gov/files/company_tickers.json",
  companyFacts: (cik10: string) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`,
  submissions: (cik10: string) => `https://data.sec.gov/submissions/CIK${cik10}.json`,
  // Filing document in the EDGAR archive. The CIK in the path has no leading zeros; the accession no dashes.
  archive: (cik10: string, accession: string, document?: string) => {
    const base = `https://www.sec.gov/Archives/edgar/data/${Number.parseInt(cik10, 10)}/${accession.replace(/-/g, "")}`;
    return document ? `${base}/${document}` : `${base}/${accession}-index.htm`;
  }
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SecClientOptions {
  fetchImpl?: FetchLike;
  userAgent?: string;
  timeoutMs?: number;
  retries?: number;
  /** Minimum gap between request starts. 125 ms = 8 requests a second. */
  minIntervalMs?: number;
  /** Base backoff; attempt n waits base * 2^n (or Retry-After, capped at 5 s). */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Aborts every pending and later request (the pipeline's time box). */
  signal?: AbortSignal;
}

export class SecHttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string
  ) {
    super(`SEC request failed with status ${status} for ${url}`);
    this.name = "SecHttpError";
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

export class SecClient {
  private readonly fetchImpl: FetchLike;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly minIntervalMs: number;
  private readonly backoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly signal?: AbortSignal;
  private nextSlot = 0;
  /** Requests sent, retries included. Tests and logs read it. */
  requestCount = 0;

  constructor(options: SecClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    const agent = options.userAgent?.trim();
    this.userAgent = agent && agent.length > 0 ? agent : DEFAULT_SEC_USER_AGENT;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retries = options.retries ?? 2;
    this.minIntervalMs = options.minIntervalMs ?? 125;
    this.backoffMs = options.backoffMs ?? 500;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? (() => Date.now());
    this.signal = options.signal;
  }

  /** Waits for the next free slot so request starts are at least minIntervalMs apart. */
  private async throttle(): Promise<void> {
    const now = this.now();
    const start = Math.max(now, this.nextSlot);
    this.nextSlot = start + this.minIntervalMs;
    if (start > now) await this.sleep(start - now);
  }

  /** One request. For an ok answer the body is read and parsed here, while the per-attempt timeout and the
   *  time-box abort still apply: both are only removed once the body is consumed. */
  private async attempt(url: string): Promise<{ response: Response; json?: unknown }> {
    await this.throttle();
    if (this.signal?.aborted) throw new Error("SEC request aborted");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    this.signal?.addEventListener("abort", onAbort, { once: true });
    this.requestCount += 1;
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: { "user-agent": this.userAgent, accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) return { response };
      return { response, json: await response.json() };
    } finally {
      clearTimeout(timer);
      this.signal?.removeEventListener("abort", onAbort);
    }
  }

  /** GET a JSON document. Throws SecHttpError on a final non-2xx answer, or the last network error. */
  async getJson<T>(url: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (this.signal?.aborted) throw new Error("SEC request aborted");
      let wait = this.backoffMs * 2 ** attempt;
      try {
        const { response, json } = await this.attempt(url);
        if (response.ok) return json as T;
        lastError = new SecHttpError(response.status, url);
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) throw lastError;
        wait = Math.min(retryAfterMs(response) ?? wait, 5_000);
        // Free the connection before the next attempt.
        await response.body?.cancel().catch(() => undefined);
      } catch (error) {
        if (error instanceof SecHttpError && error.status !== 429 && error.status < 500) throw error;
        lastError = error;
      }
      if (attempt < this.retries) await this.sleep(wait);
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
