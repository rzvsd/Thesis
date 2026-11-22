import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";

import { loadConfig, validateLiveModeConfig } from "./config";
import { trackDeepDiveLlmUsage } from "./llm-usage";
import { logError, logInfo } from "./logging";
import { runAnalysisPipeline } from "./pipeline";
import { buildDexterPulseBrief, type DexterPulseBriefRequest } from "./pulse-brief";
import { startQueueConsumer } from "./queue-consumer";
import { assertAnalysisRequest, validateAnalysisRequest } from "./schema-validation";

type HealthPayload = { status: "ok" };

async function readJsonBody<T = unknown>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    request.setEncoding("utf-8");
    request.on("data", (chunk) => {
      buffer += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(buffer || "{}") as T);
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

function hasInternalToken(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers["x-internal-token"];
  if (typeof header !== "string") {
    return false;
  }
  const providedBytes = Buffer.from(header, "utf-8");
  const expectedBytes = Buffer.from(expectedToken, "utf-8");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export function startServer(port: number = loadConfig().port): Server {
  const defaultConfig = loadConfig();
  const config = {
    ...defaultConfig,
    port
  };
  const configErrors = validateLiveModeConfig(config);
  if (configErrors.length > 0) {
    throw new Error(`Invalid configuration: ${configErrors.join("; ")}`);
  }

  const queueConsumerPromise = startQueueConsumer(config).catch((error) => {
    const message = error instanceof Error ? error.message : "Queue consumer failed to start";
    logError("Queue consumer startup failed", {
      error_message: message
    });
    return undefined;
  });

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
        const { result: report } = await trackDeepDiveLlmUsage(
          config,
          { job_id: analysisRequest.job_id, ticker: analysisRequest.ticker },
          () => runAnalysisPipeline(analysisRequest, config)
        );
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

    if (request.method === "POST" && request.url === "/internal/pulse/brief") {
      if (!hasInternalToken(request, config.internalWorkerToken)) {
        sendJson(response, 401, {
          error: "unauthorized",
          error_message: "Internal token mismatch."
        });
        return;
      }

      try {
        const body = await readJsonBody<DexterPulseBriefRequest>(request);
        const result = await buildDexterPulseBrief(body, config);
        sendJson(response, 200, result);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Pulse brief error";
        logError("Unhandled Dexter Pulse brief failure", { error_message: message });
        sendJson(response, 500, {
          error: "pulse_brief_failed",
          error_message: "Dexter Pulse brief generation failed"
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

  server.on("close", () => {
    void queueConsumerPromise.then(async (consumer) => {
      if (consumer) {
        await consumer.stop();
      }
    });
  });

  return server.listen(port);
}

if (require.main === module) {
  startServer();
}
