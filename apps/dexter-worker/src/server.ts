import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { loadConfig } from "./config";
import { logError, logInfo } from "./logging";
import { runAnalysisPipeline } from "./pipeline";
import { assertAnalysisRequest, validateAnalysisRequest } from "./schema-validation";

type HealthPayload = { status: "ok" };

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    request.setEncoding("utf-8");
    request.on("data", (chunk) => {
      buffer += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(buffer || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

export function startServer(port: number = loadConfig().port): Server {
  const defaultConfig = loadConfig();
  const config = {
    ...defaultConfig,
    port
  };

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      const payload: HealthPayload = { status: "ok" };

      logInfo("Health check OK");
      sendJson(response, 200, payload);
      return;
    }

    if (request.method === "POST" && request.url === "/v1/analyze") {
      try {
        const body = await readJsonBody(request);
        const requestErrors = validateAnalysisRequest(body);

        if (requestErrors.length > 0) {
          sendJson(response, 422, {
            error: "validation_failed",
            validation_errors: requestErrors
          });
          return;
        }

        const analysisRequest = assertAnalysisRequest(body);
        const report = await runAnalysisPipeline(analysisRequest, config);
        sendJson(response, 200, report);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown pipeline error";
        logError("Unhandled pipeline failure", { error_message: message });
        sendJson(response, 500, {
          error: "pipeline_failed",
          error_message: "Dexter pipeline failed"
        });
        return;
      }
    }

    sendJson(response, 404, { status: "not_found" });
  });

  server.on("listening", () => {
    logInfo("Service started");
  });

  server.on("error", (error) => {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    logError(message);
  });

  return server.listen(port);
}

if (require.main === module) {
  startServer();
}
