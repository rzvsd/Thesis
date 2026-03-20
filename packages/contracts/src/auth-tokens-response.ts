export interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  access_token_expires_at: string;
  refresh_token_expires_at: string;
}

export const authTokensResponseSchema = {
  $id: "AuthTokensResponse",
  type: "object",
  additionalProperties: false,
  required: [
    "access_token",
    "refresh_token",
    "token_type",
    "access_token_expires_at",
    "refresh_token_expires_at"
  ],
  properties: {
    access_token: { type: "string" },
    refresh_token: { type: "string" },
    token_type: { type: "string", const: "Bearer" },
    access_token_expires_at: { type: "string", format: "date-time" },
    refresh_token_expires_at: { type: "string", format: "date-time" }
  }
} as const;
