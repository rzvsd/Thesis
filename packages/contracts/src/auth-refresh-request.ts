export interface AuthRefreshRequest {
  refresh_token: string;
}

export const authRefreshRequestSchema = {
  $id: "AuthRefreshRequest",
  type: "object",
  additionalProperties: false,
  required: ["refresh_token"],
  properties: {
    refresh_token: { type: "string", minLength: 16 }
  }
} as const;
