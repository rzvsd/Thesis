export interface AuthGoogleRequest {
  id_token: string;
}

export const authGoogleRequestSchema = {
  $id: "AuthGoogleRequest",
  type: "object",
  additionalProperties: false,
  required: ["id_token"],
  properties: {
    id_token: {
      type: "string",
      minLength: 20
    }
  }
} as const;
