import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

type HealthPayload = {
  status: "ok";
  modes: { push: string; email: string; artifact_store: string };
};

test("GET /health returns the expected payload", async () => {
  const server = startServer(0);
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  const payload = (await response.json()) as HealthPayload;

  assert.equal(response.status, 200);
  assert.equal(payload.status, "ok");
  assert.deepEqual(Object.keys(payload.modes).sort(), ["artifact_store", "email", "push"]);

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});
