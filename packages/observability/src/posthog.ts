import type { ObservabilityConfig } from "./sentry";

export function initPostHog(config: ObservabilityConfig = {}): ObservabilityConfig {
  return {
    enabled: false,
    ...config
  };
}
