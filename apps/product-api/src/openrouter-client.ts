export interface OpenRouterChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterChatOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: OpenRouterChatMessage[];
  timeoutMs: number;
  maxTokens: number;
  temperature?: number;
  fetchImpl?: typeof fetch;
}

interface OpenRouterChatChoice {
  message?: {
    content?: string;
  };
}

interface OpenRouterChatResponse {
  choices?: OpenRouterChatChoice[];
}

export async function createOpenRouterChatCompletion(
  options: OpenRouterChatOptions
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, options.timeoutMs));
  const fetcher = options.fetchImpl ?? fetch;
  const endpoint = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;

  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as OpenRouterChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error("OpenRouter response did not include message content");
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
