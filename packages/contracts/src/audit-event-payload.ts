export interface AuditEventPayload {
  request_id?: string;
  route?: string;
  job_id?: string;
  report_id?: string;
  user_id?: string;
  ticker?: string;
  status?: string;
  reason?: string;
  error_message?: string;
}

export const auditEventPayloadSchema = {
  $id: "AuditEventPayload",
  type: "object",
  additionalProperties: false,
  properties: {
    request_id: { type: "string" },
    route: { type: "string" },
    job_id: { type: "string" },
    report_id: { type: "string" },
    user_id: { type: "string" },
    ticker: { type: "string" },
    status: { type: "string" },
    reason: { type: "string" },
    error_message: { type: "string" }
  }
} as const;
