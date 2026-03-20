const service = "product-api";

type LogLevel = "INFO" | "WARN" | "ERROR";

type LogFields = Record<string, unknown>;

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  console.log(
    JSON.stringify({
      level,
      service,
      message,
      timestamp: new Date().toISOString(),
      ...fields
    })
  );
}

export function logInfo(message: string, fields: LogFields = {}): void {
  write("INFO", message, fields);
}

export function logWarn(message: string, fields: LogFields = {}): void {
  write("WARN", message, fields);
}

export function logError(message: string, fields: LogFields = {}): void {
  write("ERROR", message, fields);
}
