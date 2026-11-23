// What an evaluator returns. The feature module turns it into a JSON Response.

export interface EvalResult {
  status: number;
  body: unknown;
}

// Per-request facts that go into audit rows (never emails or tokens).
export interface EvalMeta {
  requestId: string;
  route: string;
}

export function ok(body: unknown, status = 200): EvalResult {
  return { status, body };
}

export function fail(status: number, error: string, errorMessage: string): EvalResult {
  return { status, body: { error, error_message: errorMessage } };
}

export function validation(errorMessage: string): EvalResult {
  return fail(422, "validation_failed", errorMessage);
}
