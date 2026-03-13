export interface ObservabilityConfig {
  enabled?: boolean;
  dsn?: string;
}

export function initSentry(config: ObservabilityConfig = {}): ObservabilityConfig {
  return {
    enabled: false,
    ...config
  };
}
