// Reads settings from the environment. Values never get logged.

export function env(name: string): string | undefined {
  const value = Deno.env.get(name);
  return value && value.length > 0 ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing setting ${name}`);
  return value;
}
