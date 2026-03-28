export interface CanonicalTranscript {
  transcript_id: string;
  ticker: string;
  period: string;
  fiscal_year: number;
  fiscal_quarter: number;
  call_date: string;
  provider: string;
  retrieved_at: string;
  body_text: string;
  word_count: number;
  is_complete: boolean;
}

export const canonicalTranscriptSchema = {
  $id: "CanonicalTranscript",
  type: "object",
  additionalProperties: false,
  required: [
    "transcript_id",
    "ticker",
    "period",
    "fiscal_year",
    "fiscal_quarter",
    "call_date",
    "provider",
    "retrieved_at",
    "body_text",
    "word_count",
    "is_complete"
  ],
  properties: {
    transcript_id: { type: "string" },
    ticker: { type: "string" },
    period: { type: "string" },
    fiscal_year: { type: "number" },
    fiscal_quarter: { type: "number" },
    call_date: { type: "string" },
    provider: { type: "string" },
    retrieved_at: { type: "string", format: "date-time" },
    body_text: { type: "string" },
    word_count: { type: "number" },
    is_complete: { type: "boolean" }
  }
} as const;
