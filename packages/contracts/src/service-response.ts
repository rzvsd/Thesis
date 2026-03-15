/**
 * ServiceResponse<T> — M2 canonical service-level response envelope.
 *
 * All data-plane internal endpoints must return this shape.
 * Use `ok: false` + `error_flag: true` to signal provider/source failures.
 * Never return raw provider errors or unstructured JSON to callers.
 */
export interface ServiceResponse<T> {
  /** True if the request succeeded and data is trustworthy. */
  ok: boolean;
  /** The response payload. Null on hard failure; empty array acceptable for list responses on source outage. */
  data: T | null;
  /** True when any provider/source/parser error occurred. Callers must check this even when data is present. */
  error_flag: boolean;
  /** Machine-readable error code for structured handling. */
  error_code?: "AUTH_ERROR" | "RATE_LIMIT" | "TIMEOUT" | "PROVIDER_OUTAGE" | "SCHEMA_MISMATCH" | "INTERNAL_ERROR";
  /** Human-readable error detail. Never expose raw provider error strings in production. */
  error_message?: string;
  /** Caller-supplied or server-generated request correlation ID. */
  request_id?: string;
  /** Provider/source that produced the data, if known. */
  provider?: string;
  /** ISO 8601 datetime when the data was retrieved or the response was generated. */
  retrieved_at?: string;
}

/**
 * Convenience alias for news-ingest responses, which always return an array payload.
 */
export type NewsServiceResponse = ServiceResponse<unknown[]>;

/**
 * JSON Schema for runtime validation of ServiceResponse envelopes.
 * The `data` property is intentionally permissive (object, array, or null)
 * because the caller validates payload shape against the inner contract schema.
 */
export const serviceResponseSchema = {
  $id: "ServiceResponse",
  type: "object",
  additionalProperties: false,
  required: ["ok", "data", "error_flag"],
  properties: {
    ok: { type: "boolean" },
    data: {
      oneOf: [
        { type: "object" },
        { type: "array" },
        { type: "null" }
      ]
    },
    error_flag: { type: "boolean" },
    error_code: {
      type: "string",
      enum: ["AUTH_ERROR", "RATE_LIMIT", "TIMEOUT", "PROVIDER_OUTAGE", "SCHEMA_MISMATCH", "INTERNAL_ERROR"]
    },
    error_message: { type: "string" },
    request_id: { type: "string" },
    provider: { type: "string" },
    retrieved_at: { type: "string", format: "date-time" }
  }
} as const;
