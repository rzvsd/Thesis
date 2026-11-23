// JSON helpers. The error shape matches the old server: { error, error_message }.

export type Json = Record<string, unknown> | unknown[];

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function apiError(
  status: number,
  error: string,
  errorMessage?: string,
  extra: Record<string, unknown> = {},
): Response {
  const body: Record<string, unknown> = { error, ...extra };
  if (errorMessage) body.error_message = errorMessage;
  return json(body, status);
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
