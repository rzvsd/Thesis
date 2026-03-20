export interface CreateJobRequest {
  ticker: string;
}

export const createJobRequestSchema = {
  $id: "CreateJobRequest",
  type: "object",
  additionalProperties: false,
  required: ["ticker"],
  properties: {
    ticker: {
      type: "string",
      minLength: 1,
      maxLength: 12,
      pattern: "^[A-Za-z.\\-]+$"
    }
  }
} as const;
