export interface CanonicalNewsArticle {
  article_id: string;
  source: string;
  url: string;
  title: string;
  published_at: string;
  retrieved_at: string;
  /** Best available normalized article text. RSS summary/excerpt acceptable in v1. */
  body_text: string;
  tickers_mentioned: string[];
  is_approved_source: boolean;
}

export const canonicalNewsArticleSchema = {
  $id: "CanonicalNewsArticle",
  type: "object",
  additionalProperties: false,
  required: [
    "article_id",
    "source",
    "url",
    "title",
    "published_at",
    "retrieved_at",
    "body_text",
    "tickers_mentioned",
    "is_approved_source"
  ],
  properties: {
    article_id: { type: "string" },
    source: { type: "string" },
    url: { type: "string" },
    title: { type: "string" },
    published_at: { type: "string" },
    retrieved_at: { type: "string" },
    body_text: { type: "string" },
    tickers_mentioned: {
      type: "array",
      items: { type: "string" }
    },
    is_approved_source: { type: "boolean" }
  }
} as const;
