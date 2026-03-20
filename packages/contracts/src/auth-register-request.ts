export interface AuthRegisterRequest {
  email: string;
  password: string;
}

export const authRegisterRequestSchema = {
  $id: "AuthRegisterRequest",
  type: "object",
  additionalProperties: false,
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 8 }
  }
} as const;
