import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type { CallArtifact, EvidenceRightsMetadata, FirstPartyContextItem } from "../../../packages/contracts/src";
import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

async function closeServer(server: ReturnType<typeof startServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function requestJson(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    body?: JsonObject;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; payload: JsonObject }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = (await response.json()) as JsonObject;
  return {
    status: response.status,
    payload
  };
}

function rights(displayMode: EvidenceRightsMetadata["display_mode"] = "excerpt_only"): EvidenceRightsMetadata {
  return {
    rights_class: "first_party_public",
    display_mode: displayMode,
    source_rank: "first_party",
    source_type: "first_party_corporate",
    can_store_full_text: false,
    can_display_excerpt: displayMode === "excerpt_only",
    can_display_link: true,
    policy_reason: "Approved Phase 6 M2 seed first-party source.",
    reviewed_at: "2026-04-17T00:00:00.000Z"
  };
}

function contextItem(): FirstPartyContextItem {
  return {
    context_id: "ph6m2-context-aapl",
    ticker: "AAPL",
    event_id: "event-aapl-earnings",
    registry_entry_id: "ph6m2-aapl-investor",
    source_url: "https://investor.apple.com/investor-relations/",
    source_domain: "investor.apple.com",
    page_type: "investor_relations",
    title: "Apple Investor Relations",
    summary: "Apple publishes investor updates and quarterly earnings entry points.",
    excerpt: "Investor Updates, Newsroom, Financial Data, Quarterly Earnings Reports.",
    retrieved_at: "2026-04-17T00:00:00.000Z",
    published_at: "2026-04-17T00:00:00.000Z",
    content_hash: "context-hash-aapl",
    fetch_state: "fetched",
    rights: rights(),
    artifact_ids: ["ph6m2-artifact-aapl"],
    metadata: {
      full_text_stored: false
    }
  };
}

function callArtifact(): CallArtifact {
  return {
    artifact_id: "ph6m2-artifact-aapl",
    ticker: "AAPL",
    event_id: "event-aapl-earnings",
    context_id: "ph6m2-context-aapl",
    artifact_type: "earnings_release",
    title: "Apple quarterly earnings reports entry point",
    source_url: "https://investor.apple.com/investor-relations/",
    source_domain: "investor.apple.com",
    published_at: "2026-04-17T00:00:00.000Z",
    retrieved_at: "2026-04-17T00:00:00.000Z",
    completeness_state: "metadata_only",
    rights: rights(),
    content_hash: "artifact-hash-aapl",
    metadata: {
      full_text_stored: false
    }
  };
}

test("PH6 M2 first-party context and call artifacts persist through internal API", async () => {
  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const unauthorized = await requestJson(baseUrl, "/internal/first-party/context/ingest", {
      method: "POST",
      body: {
        context_items: [contextItem()]
      }
    });
    assert.equal(unauthorized.status, 401);

    const ingest = await requestJson(baseUrl, "/internal/first-party/context/ingest", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        context_items: [contextItem()],
        call_artifacts: [callArtifact()]
      }
    });
    assert.equal(ingest.status, 200);
    assert.equal(ingest.payload.context_upserted, 1);
    assert.equal(ingest.payload.artifact_upserted, 1);

    const list = await requestJson(
      baseUrl,
      "/internal/first-party/context?ticker=AAPL&event_id=event-aapl-earnings",
      {
        headers: {
          "x-internal-token": "dev-internal-worker-token"
        }
      }
    );
    assert.equal(list.status, 200);
    const data = list.payload.data as {
      context_items: FirstPartyContextItem[];
      call_artifacts: CallArtifact[];
    };
    assert.equal(data.context_items.length, 1);
    assert.equal(data.context_items[0]?.rights.display_mode, "excerpt_only");
    assert.equal(data.context_items[0]?.metadata.full_text_stored, false);
    assert.equal(data.call_artifacts.length, 1);
    assert.equal(data.call_artifacts[0]?.completeness_state, "metadata_only");
  } finally {
    await closeServer(server);
  }
});

test("PH6 M2 rejects context items without rights metadata", async () => {
  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const item = contextItem() as unknown as JsonObject;
    delete item.rights;
    const malformed = await requestJson(baseUrl, "/internal/first-party/context/ingest", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        context_items: [item]
      }
    });
    assert.equal(malformed.status, 422);
    assert.equal(malformed.payload.error, "validation_failed");
  } finally {
    await closeServer(server);
  }
});
