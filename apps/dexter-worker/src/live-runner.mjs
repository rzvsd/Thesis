import { Agent } from "dexter/src/agent/index.ts";

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

async function main() {
  const raw = await readStdin();
  const input = JSON.parse(raw);
  const agent = await Agent.create({
    model: input.model,
    maxIterations: input.maxIterations,
    memoryEnabled: false
  });

  let answer = "";
  let iterations = 0;
  let tokenCount = 0;
  let toolCalls = [];

  for await (const event of agent.run(input.query)) {
    if (event.type === "tool_end") {
      toolCalls.push({
        tool: event.tool,
        args: event.args,
        result: event.result,
        duration: event.duration
      });
    }

    if (event.type === "done") {
      answer = event.answer ?? "";
      iterations = event.iterations ?? 0;
      tokenCount = event.tokenUsage?.totalTokens ?? 0;
      toolCalls = event.toolCalls?.length ? event.toolCalls : toolCalls;
    }
  }

  process.stdout.write(
    JSON.stringify({
      answer,
      iterations,
      token_count: tokenCount,
      tool_calls: toolCalls
    })
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message);
  process.exitCode = 1;
});
