import { createServer, type Server } from "node:http";

const serviceName = "news-ingest";
const defaultPort = Number(process.env.PORT ?? "3004");
type HealthPayload = { status: "ok" };

function log(level: "INFO" | "ERROR", message: string): void {
  console.log(
    JSON.stringify({
      level,
      service: serviceName,
      message,
      timestamp: new Date().toISOString()
    })
  );
}

export function startServer(port: number = defaultPort): Server {
  const server = createServer((request, response) => {
    if (request.url === "/health") {
      const payload: HealthPayload = { status: "ok" };

      log("INFO", "Health check OK");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "not_found" }));
  });

  server.on("listening", () => {
    log("INFO", "Service started");
  });

  server.on("error", (error) => {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    log("ERROR", message);
  });

  return server.listen(port);
}

if (require.main === module) {
  startServer();
}
