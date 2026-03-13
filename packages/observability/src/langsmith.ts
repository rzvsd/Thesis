import type { ObservabilityConfig } from "./sentry";

export function initLangSmith(config: ObservabilityConfig = {}): ObservabilityConfig {
  return {
    enabled: false,
    ...config
  };
}
