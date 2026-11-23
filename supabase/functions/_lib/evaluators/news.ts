// The news store (rebuild branch audit NG8). Headlines used to live only inside one Pulse request: no history,
// no way to tell a stale feed from a quiet day, and nothing to fall back on when the 06:30 fetch failed.
// The news job (jobs/data/run_news.py) now posts what it read a few times a day, and the Pulse job reads the
// stored headlines of its window back.
//
// What may be stored is narrow on purpose. A row is a headline, its source, its link, its time and the tickers
// it names. There is no column for article text. A publisher headline ("headline_link_only") is cut to 120
// characters here as well as in the job, which is the "very short extract" limit of Romanian Law 8/1996
// art. 94^1. The table has the same limit as a check constraint.
import { logInfo } from "../../_shared/log.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { type EvalMeta, type EvalResult, ok, validation } from "./result.ts";
import type { NewsItemRow, NewsRights, NewsSourceCheck } from "./types.ts";
import { isPlainRecord } from "./util.ts";

export const newsIngestLimit = 2_000;
export const newsListLimit = 500;
export const headlineLinkMaxChars = 120;
export const officialTitleMaxChars = 300;
// A source that answers but whose newest item is older than this is called stale.
export const staleAfterDays = 10;

const articleIdPattern = /^[0-9a-f]{64}$/;
const sourceKeyPattern = /^[a-z0-9][a-z0-9-]{1,39}$/;
const tickerPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;
const errorCodePattern = /^[A-Z_]{3,40}$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function isoTime(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

// At most `limit` characters, cut at a word and ended with an ellipsis. Same rule as clip_headline in the job.
export function clipHeadline(title: string, limit = headlineLinkMaxChars): string {
  if (title.length <= limit) return title;
  let cut = title.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  if (space > 0) cut = cut.slice(0, space);
  return cut.replace(/[ ,;:\-–—]+$/, "") + "…";
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

// One posted article (the job's CanonicalNewsArticle) as a row, or undefined when it cannot be stored.
export function newsRowFromArticle(entry: unknown, seenAt: string): NewsItemRow | undefined {
  if (!isPlainRecord(entry)) return undefined;
  const articleId = typeof entry.article_id === "string" ? entry.article_id.trim().toLowerCase() : "";
  const sourceKey = typeof entry.source_key === "string" ? entry.source_key.trim() : "";
  const sourceName = text(entry.source, 80);
  const url = httpUrl(entry.url);
  const publishedAt = isoTime(entry.published_at);
  const rights: NewsRights | undefined =
    entry.rights === "official_public" || entry.rights === "headline_link_only" ? entry.rights : undefined;
  let title = text(entry.title, officialTitleMaxChars);
  if (
    !articleIdPattern.test(articleId) || !sourceKeyPattern.test(sourceKey) || !sourceName || !url ||
    !publishedAt || !rights || !title || entry.is_approved_source !== true
  ) {
    return undefined;
  }
  if (rights === "headline_link_only") title = clipHeadline(title);
  const tickers: string[] = [];
  if (Array.isArray(entry.tickers_mentioned)) {
    for (const raw of entry.tickers_mentioned) {
      const ticker = typeof raw === "string" ? raw.trim().toUpperCase() : "";
      if (tickerPattern.test(ticker) && !tickers.includes(ticker) && tickers.length < 5) tickers.push(ticker);
    }
  }
  return { articleId, sourceKey, sourceName, url, title, publishedAt, rights, tickers, seenAt };
}

function sourceCheck(entry: unknown, checkedAt: string): NewsSourceCheck | undefined {
  if (!isPlainRecord(entry)) return undefined;
  const sourceKey = typeof entry.source === "string" ? entry.source.trim() : "";
  if (!sourceKeyPattern.test(sourceKey) || typeof entry.ok !== "boolean") return undefined;
  const count = typeof entry.article_count === "number" && Number.isFinite(entry.article_count)
    ? Math.max(0, Math.trunc(entry.article_count))
    : 0;
  const errorCode = typeof entry.error_code === "string" && errorCodePattern.test(entry.error_code)
    ? entry.error_code
    : undefined;
  return {
    sourceKey,
    checkedAt,
    ok: entry.ok,
    articleCount: count,
    ...(entry.ok ? {} : { errorCode: errorCode ?? "INTERNAL_ERROR" }),
    ...(isoTime(entry.newest_item_at) ? { newestItemAt: isoTime(entry.newest_item_at) } : {}),
  };
}

// The stored row in the job's article shape, so the Pulse reads stored and fresh headlines the same way.
export function articleFromNewsRow(row: NewsItemRow): Record<string, unknown> {
  return {
    article_id: row.articleId,
    source: row.sourceName,
    source_key: row.sourceKey,
    rights: row.rights,
    url: row.url,
    title: row.title,
    published_at: row.publishedAt,
    retrieved_at: row.seenAt,
    body_text: row.title,
    tickers_mentioned: row.tickers,
    is_approved_source: true,
  };
}

// POST /internal/news/ingest. body: { items: CanonicalNewsArticle[], sources?: [{ source, ok, article_count,
// error_code?, newest_item_at? }] }. Items that cannot be stored are counted, not refused as a whole.
export async function ingestNews(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  if (!Array.isArray(body.items)) return validation("items must be an array.");
  if (body.items.length > newsIngestLimit) {
    return validation(`items must have at most ${newsIngestLimit} entries.`);
  }
  if (body.sources !== undefined && !Array.isArray(body.sources)) {
    return validation("sources must be an array.");
  }

  const nowIso = deps.now().toISOString();
  const rows = new Map<string, NewsItemRow>();
  let invalid = 0;
  for (const entry of body.items) {
    const row = newsRowFromArticle(entry, nowIso);
    if (!row) {
      invalid += 1;
      continue;
    }
    // One link once per request: an upsert cannot touch the same row twice.
    if (!rows.has(row.articleId)) rows.set(row.articleId, row);
  }
  const checks: NewsSourceCheck[] = [];
  for (const entry of (body.sources as unknown[] | undefined) ?? []) {
    const check = sourceCheck(entry, nowIso);
    if (check && !checks.some((c) => c.sourceKey === check.sourceKey)) checks.push(check);
  }

  const stored = await deps.store.upsertNewsItems([...rows.values()]);
  await deps.store.recordNewsSourceChecks(checks);
  const counts = {
    stored,
    invalid,
    sources_ok: checks.filter((c) => c.ok).length,
    sources_failed: checks.filter((c) => !c.ok).length,
  };
  await appendAudit(deps.store, "news.ingested", {
    request_id: meta.requestId,
    route: meta.route,
    ...counts,
  });
  logInfo("News ingested", counts);
  return ok({ status: "ok", ...counts });
}

// GET /internal/news?since=<iso>&until=<iso>&limit=<n>. Stored headlines published in the span, newest first.
export async function listNews(deps: EvaluatorDeps, query: URLSearchParams): Promise<EvalResult> {
  const until = query.get("until") ? isoTime(query.get("until")) : deps.now().toISOString();
  const since = isoTime(query.get("since"));
  if (!since || !until) return validation("since and until must be ISO 8601 date-times.");
  if (Date.parse(since) > Date.parse(until)) return validation("since must not be after until.");
  const rawLimit = Number(query.get("limit") ?? newsListLimit);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.trunc(rawLimit)), newsListLimit)
    : newsListLimit;
  const rows = await deps.store.listNewsItems({ since, until, limit });
  return ok({ since, until, items: rows.map(articleFromNewsRow) });
}

// GET /internal/news/sources. How each source did at its last check, with "stale" worked out here.
export async function listNewsSources(deps: EvaluatorDeps): Promise<EvalResult> {
  const now = deps.now().getTime();
  const sources = (await deps.store.listNewsSourceStatus()).map((s) => {
    const newest = s.newestItemAt ? Date.parse(s.newestItemAt) : NaN;
    return {
      source: s.sourceKey,
      last_checked_at: s.lastCheckedAt,
      last_ok_at: s.lastOkAt ?? null,
      last_error_code: s.lastErrorCode ?? null,
      last_article_count: s.lastArticleCount,
      newest_item_at: s.newestItemAt ?? null,
      consecutive_failures: s.consecutiveFailures,
      // Answers, but has published nothing for a long time: the feed moved or stopped, not a quiet day.
      stale: s.consecutiveFailures === 0 && Number.isFinite(newest) &&
        now - newest > staleAfterDays * 86_400_000,
    };
  });
  return ok({ sources });
}
