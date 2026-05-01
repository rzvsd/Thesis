function readStdin() {
  return new Promise((resolve, reject) => {
    let buffer = "";

    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
    });
    process.stdin.on("end", () => {
      resolve(buffer);
    });
    process.stdin.on("error", reject);
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required for live Dexter provider calls`);
  }
  return value;
}

function normalizeOpenRouterModel(model) {
  return model.replace(/^openrouter:/, "");
}

function extractOpenAiText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text ?? "")
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractAnthropicText(payload) {
  const content = payload?.content;
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => part?.text ?? "")
    .filter(Boolean)
    .join("\n");
}

function tokenCountFromPayload(provider, payload) {
  if (provider === "anthropic") {
    return Number(payload?.usage?.input_tokens ?? 0) + Number(payload?.usage?.output_tokens ?? 0);
  }

  return Number(payload?.usage?.total_tokens ?? 0);
}

async function postJson(url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload;
  try {
    payload = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      text.slice(0, 500) ??
      `provider request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function callOpenAiCompatibleProvider(input, provider) {
  const isOpenRouter = provider === "openrouter";
  const apiKey = requiredEnv(isOpenRouter ? "OPENROUTER_API_KEY" : "OPENAI_API_KEY");
  const payload = await postJson(
    isOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions",
    {
      authorization: `Bearer ${apiKey}`,
      ...(isOpenRouter
        ? {
            "http-referer": process.env.OPENROUTER_HTTP_REFERER ?? "https://thesis.local",
            "x-title": process.env.OPENROUTER_APP_TITLE ?? "Thesis Dexter Worker"
          }
        : {})
    },
    {
      model: isOpenRouter ? normalizeOpenRouterModel(input.model) : input.model,
      messages: [
        {
          role: "system",
          content:
            "You are Dexter inside Thesis. Produce concise, evidence-aware financial research copy. Do not give trading instructions, price targets, or buy/sell/hold recommendations."
        },
        {
          role: "user",
          content: input.query
        }
      ],
      temperature: 0.2,
      max_tokens: 1200
    }
  );

  return {
    answer: extractOpenAiText(payload),
    token_count: tokenCountFromPayload(provider, payload)
  };
}

async function callAnthropicProvider(input) {
  const payload = await postJson(
    "https://api.anthropic.com/v1/messages",
    {
      "x-api-key": requiredEnv("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01"
    },
    {
      model: input.model,
      max_tokens: 1200,
      temperature: 0.2,
      system:
        "You are Dexter inside Thesis. Produce concise, evidence-aware financial research copy. Do not give trading instructions, price targets, or buy/sell/hold recommendations.",
      messages: [
        {
          role: "user",
          content: input.query
        }
      ]
    }
  );

  return {
    answer: extractAnthropicText(payload),
    token_count: tokenCountFromPayload("anthropic", payload)
  };
}

async function runDirectProvider(input) {
  if (input.modelProvider === "openrouter") {
    return callOpenAiCompatibleProvider(input, "openrouter");
  }
  if (input.modelProvider === "openai") {
    return callOpenAiCompatibleProvider(input, "openai");
  }
  if (input.modelProvider === "anthropic") {
    return callAnthropicProvider(input);
  }

  throw new Error(`Unsupported live Dexter provider: ${input.modelProvider}`);
}

async function main() {
  const raw = await readStdin();
  const input = JSON.parse(raw);
  const result = await runDirectProvider(input);

  process.stdout.write(
    JSON.stringify({
      answer: result.answer,
      iterations: 1,
      token_count: result.token_count,
      tool_calls: []
    })
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message);
  process.exitCode = 1;
});
