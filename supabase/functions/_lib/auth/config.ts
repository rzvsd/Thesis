// Auth settings. Names and defaults follow apps/product-api/src/config.ts where the setting still exists.
import { env } from "../../_shared/env.ts";

export interface BootstrapConfig {
  email: string;
  password: string;
  forcePro: boolean;
}

export interface AuthConfig {
  lockoutMaxFailures: number;
  lockoutWindowSeconds: number;
  lockoutDurationSeconds: number;
  // Nominal refresh expiry we report. Supabase refresh tokens do not expire on their own on the free plan.
  refreshTokenTtlSeconds: number;
  // Must equal the dashboard's "Email OTP Expiration" (Auth > Providers > Email). One value for every email code.
  emailOtpExpirySeconds: number;
  // AUTH_EXPOSE_VERIFICATION_TOKEN: return codes in responses. Only outside production (see nonProduction()).
  exposeCodes: boolean;
  bootstrap: BootstrapConfig | null;
}

function intEnv(name: string, fallback: number): number {
  const n = Number(env(name));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const v = env(name)?.trim().toLowerCase();
  if (v === undefined) return fallback;
  return v === "1" || v === "true" || v === "yes";
}

// Fails safe: production never sets THESIS_ENV to one of these values, so a stray flag stays off there.
export function nonProduction(): boolean {
  const v = env("THESIS_ENV")?.trim().toLowerCase();
  return v === "development" || v === "test" || v === "local";
}

export function authConfig(): AuthConfig {
  const bootstrapOn = boolEnv("ADMIN_BOOTSTRAP_ENABLED", false) && nonProduction();
  const bEmail = env("ADMIN_BOOTSTRAP_EMAIL")?.trim().toLowerCase();
  const bPassword = env("ADMIN_BOOTSTRAP_PASSWORD");
  return {
    lockoutMaxFailures: intEnv("AUTH_LOCKOUT_MAX_FAILURES", 10),
    lockoutWindowSeconds: intEnv("AUTH_LOCKOUT_WINDOW_SECONDS", 15 * 60),
    lockoutDurationSeconds: intEnv("AUTH_LOCKOUT_DURATION_SECONDS", 15 * 60),
    refreshTokenTtlSeconds: intEnv("REFRESH_TOKEN_TTL_SECONDS", 30 * 24 * 60 * 60),
    emailOtpExpirySeconds: intEnv("AUTH_EMAIL_OTP_EXPIRY_SECONDS", 60 * 60),
    exposeCodes: boolEnv("AUTH_EXPOSE_VERIFICATION_TOKEN", false) && nonProduction(),
    bootstrap: bootstrapOn && bEmail && bPassword
      ? { email: bEmail, password: bPassword, forcePro: boolEnv("ADMIN_BOOTSTRAP_FORCE_PRO", true) }
      : null,
  };
}
