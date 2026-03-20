export interface AuthLoginRequest {
  email: string;
  password: string;
}

export const authLoginRequestSchema = {
  $id: "AuthLoginRequest",
  type: "object",
  additionalProperties: false,
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 8 }
  }
} as const;
