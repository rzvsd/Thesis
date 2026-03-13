export interface AnalysisRequest {
  request_id: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  user_id?: string;
  job_id: string;
  requested_at: string;
  options?: {
    sections?: string[];
  };
}

export const analysisRequestSchema = {
  $id: "AnalysisRequest",
  type: "object",
  additionalProperties: false,
  required: ["request_id", "type", "job_id", "requested_at"],
  properties: {
    request_id: { type: "string" },
    type: { type: "string", enum: ["deep_dive", "market_pulse"] },
    ticker: { type: "string" },
    user_id: { type: "string" },
    job_id: { type: "string" },
    requested_at: { type: "string" },
    options: {
      type: "object",
      additionalProperties: false,
      properties: {
        sections: {
          type: "array",
          items: { type: "string" }
        }
      }
    }
  }
} as const;
