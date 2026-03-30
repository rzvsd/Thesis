export interface ReportNote {
  report_id: string;
  user_id: string;
  content: string;
  updated_at: string;
}

export const reportNoteSchema = {
  $id: "ReportNote",
  type: "object",
  additionalProperties: false,
  required: ["report_id", "user_id", "content", "updated_at"],
  properties: {
    report_id: { type: "string" },
    user_id: { type: "string" },
    content: { type: "string" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

