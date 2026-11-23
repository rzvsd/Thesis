// Structured logs. Rule (N10): log user ids and job ids only, never emails, tokens or request bodies.

type Fields = Record<string, string | number | boolean | null | undefined>;

export function logInfo(message: string, fields: Fields = {}): void {
  console.log(JSON.stringify({ level: "info", message, ...fields }));
}

export function logError(message: string, fields: Fields = {}): void {
  console.error(JSON.stringify({ level: "error", message, ...fields }));
}
