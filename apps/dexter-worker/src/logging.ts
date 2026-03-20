type LogLevel = "INFO" | "WARN" | "ERROR";

const serviceName = "dexter-worker";

export type LogFields = Record<string, string | number | boolean | string[] | undefined>;

export function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  console.log(
    JSON.stringify({
      level,
      service: serviceName,
      message,
      ...fields,
      timestamp: new Date().toISOString()
    })
  );
}

export function logInfo(message: string, fields: LogFields = {}): void {
  log("INFO", message, fields);
}

export function logWarn(message: string, fields: LogFields = {}): void {
  log("WARN", message, fields);
}

export function logError(message: string, fields: LogFields = {}): void {
  log("ERROR", message, fields);
}
