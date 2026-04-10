import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Client } from "langsmith";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const manifestPath = resolve(repoRoot, "data", "golden", "dexter-worker", "prompts.json");

const promptIdentifiers = {
  planner: process.env.LANGSMITH_PLANNER_PROMPT ?? "thesis-m3-planner",
  sectionExecutor:
    process.env.LANGSMITH_SECTION_EXECUTOR_PROMPT ?? "thesis-m3-section-executor",
  synthesizer: process.env.LANGSMITH_SYNTHESIZER_PROMPT ?? "thesis-m3-synthesizer",
  killSwitchExtractor:
    process.env.LANGSMITH_KILL_SWITCH_PROMPT ?? "thesis-m5-kill-switch-extractor",
  relationshipExtractor:
    process.env.LANGSMITH_RELATIONSHIP_PROMPT ?? "thesis-m5-relationship-extractor",
  oppositeCase:
    process.env.LANGSMITH_OPPOSITE_CASE_PROMPT ?? "thesis-m6-opposite-case",
  coherenceAnalyzer:
    process.env.LANGSMITH_COHERENCE_ANALYZER_PROMPT ?? "thesis-m6-coherence-analyzer"
};

function extractInputVariables(template) {
  return [...template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]);
}

function toLangSmithPromptManifest(promptTemplate) {
  return {
    lc: 1,
    type: "constructor",
    id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
    kwargs: {
      input_variables: extractInputVariables(promptTemplate.template),
      template_format: "f-string",
      template: promptTemplate.template
    }
  };
}

function ensureEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required to sync LangSmith prompts`);
  }
  return value;
}

async function main() {
  const apiKey = ensureEnv("LANGSMITH_API_KEY");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const client = new Client({ apiKey });

  const pushPrompt = async (
    promptIdentifier,
    object,
    description,
    tags
  ) => {
    try {
      await client.pushPrompt(promptIdentifier, {
        object,
        description,
        tags
      });
      return "updated";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Nothing to commit")) {
        return "unchanged";
      }

      throw error;
    }
  };

  const plannerStatus = await pushPrompt(
    promptIdentifiers.planner,
    toLangSmithPromptManifest(manifest.planner),
    "M3 planner prompt for Company Deep Dive",
    ["thesis", "m3", "planner"]
  );

  const sectionExecutorStatus = await pushPrompt(
    promptIdentifiers.sectionExecutor,
    toLangSmithPromptManifest(manifest.section_executor),
    "M3 section executor prompt for Company Deep Dive",
    ["thesis", "m3", "section-executor"]
  );

  const synthesizerStatus = await pushPrompt(
    promptIdentifiers.synthesizer,
    toLangSmithPromptManifest(manifest.synthesizer),
    "M3 synthesizer prompt for Company Deep Dive",
    ["thesis", "m3", "synthesizer"]
  );

  const killSwitchExtractorStatus = await pushPrompt(
    promptIdentifiers.killSwitchExtractor,
    toLangSmithPromptManifest(manifest.kill_switch_extractor),
    "M5 kill-switch extractor prompt for falsifiable thesis rules",
    ["thesis", "m5", "kill-switch"]
  );

  const relationshipExtractorStatus = await pushPrompt(
    promptIdentifiers.relationshipExtractor,
    toLangSmithPromptManifest(manifest.relationship_extractor),
    "M5 relationship extractor prompt for cross-name intelligence",
    ["thesis", "m5", "name-relationships"]
  );

  const oppositeCaseStatus = await pushPrompt(
    promptIdentifiers.oppositeCase,
    toLangSmithPromptManifest(manifest.opposite_case),
    "M6 opposite-case prompt for report-linked conviction intelligence",
    ["thesis", "m6", "opposite-case"]
  );

  const coherenceAnalyzerStatus = await pushPrompt(
    promptIdentifiers.coherenceAnalyzer,
    toLangSmithPromptManifest(manifest.coherence_analyzer),
    "M6 coherence analyzer prompt for monthly conviction insights",
    ["thesis", "m6", "coherence"]
  );

  process.stdout.write(
    JSON.stringify({
      ok: true,
      prompts: promptIdentifiers,
      status: {
        planner: plannerStatus,
        sectionExecutor: sectionExecutorStatus,
        synthesizer: synthesizerStatus,
        killSwitchExtractor: killSwitchExtractorStatus,
        relationshipExtractor: relationshipExtractorStatus,
        oppositeCase: oppositeCaseStatus,
        coherenceAnalyzer: coherenceAnalyzerStatus
      }
    })
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message);
  process.exitCode = 1;
});
