import { readFileSync } from "node:fs";

import { getLangSmithClient } from "../../../packages/observability/src";

import type { DexterConfig } from "./config";

export interface PromptTemplate {
  version: string;
  template: string;
}

interface PromptManifest {
  planner: PromptTemplate;
  section_executor: PromptTemplate;
  synthesizer: PromptTemplate;
  kill_switch_extractor: PromptTemplate;
  relationship_extractor: PromptTemplate;
  opposite_case: PromptTemplate;
  coherence_analyzer: PromptTemplate;
}

export interface LoadedPrompts {
  planner: PromptTemplate;
  sectionExecutor: PromptTemplate;
  synthesizer: PromptTemplate;
  killSwitchExtractor: PromptTemplate;
  relationshipExtractor: PromptTemplate;
  oppositeCase: PromptTemplate;
  coherenceAnalyzer: PromptTemplate;
}

let cachedLivePrompts:
  | {
      cacheKey: string;
      prompts: LoadedPrompts;
    }
  | undefined;

export function loadPrompts(promptManifestPath: string): LoadedPrompts {
  const raw = readFileSync(promptManifestPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<PromptManifest>;

  if (
    !parsed.planner ||
    !parsed.section_executor ||
    !parsed.synthesizer ||
    !parsed.kill_switch_extractor ||
    !parsed.relationship_extractor ||
    !parsed.opposite_case ||
    !parsed.coherence_analyzer
  ) {
    throw new Error(`Prompt manifest is missing required templates: ${promptManifestPath}`);
  }

  return {
    planner: parsed.planner,
    sectionExecutor: parsed.section_executor,
    synthesizer: parsed.synthesizer,
    killSwitchExtractor: parsed.kill_switch_extractor,
    relationshipExtractor: parsed.relationship_extractor,
    oppositeCase: parsed.opposite_case,
    coherenceAnalyzer: parsed.coherence_analyzer
  };
}

function isPromptTemplate(value: unknown): value is PromptTemplate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PromptTemplate>;
  return typeof candidate.version === "string" && typeof candidate.template === "string";
}

function promptTemplateFromManifest(
  value: unknown,
  version: string
): PromptTemplate | undefined {
  if (isPromptTemplate(value)) {
    return {
      version,
      template: value.template
    };
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as {
    kwargs?: {
      template?: unknown;
    };
  };

  if (typeof candidate.kwargs?.template !== "string") {
    return undefined;
  }

  return {
    version,
    template: candidate.kwargs.template
  };
}

async function pullPromptTemplate(promptIdentifier: string): Promise<PromptTemplate> {
  const client = getLangSmithClient();
  if (!client) {
    throw new Error("LangSmith client is not initialized");
  }

  const commit = await client.pullPromptCommit(promptIdentifier, { skipCache: false });
  const template = promptTemplateFromManifest(
    commit.manifest,
    `${promptIdentifier}:${commit.commit_hash}`
  );

  if (!template) {
    throw new Error(`LangSmith prompt ${promptIdentifier} is not a PromptTemplate manifest`);
  }

  return template;
}

export async function loadRuntimePrompts(config: DexterConfig): Promise<LoadedPrompts> {
  if (config.fixtureMode) {
    return loadPrompts(config.promptManifestPath);
  }

  if (config.promptSource === "local") {
    return loadPrompts(config.promptManifestPath);
  }

  const cacheKey = [
    config.promptSource,
    config.langsmithPlannerPrompt,
    config.langsmithSectionExecutorPrompt,
    config.langsmithSynthesizerPrompt,
    config.langsmithKillSwitchPrompt,
    config.langsmithRelationshipPrompt,
    config.langsmithOppositeCasePrompt,
    config.langsmithCoherenceAnalyzerPrompt
  ].join("|");

  if (cachedLivePrompts?.cacheKey === cacheKey) {
    return cachedLivePrompts.prompts;
  }

  try {
    const prompts: LoadedPrompts = {
      planner: await pullPromptTemplate(config.langsmithPlannerPrompt),
      sectionExecutor: await pullPromptTemplate(config.langsmithSectionExecutorPrompt),
      synthesizer: await pullPromptTemplate(config.langsmithSynthesizerPrompt),
      killSwitchExtractor: await pullPromptTemplate(config.langsmithKillSwitchPrompt),
      relationshipExtractor: await pullPromptTemplate(config.langsmithRelationshipPrompt),
      oppositeCase: await pullPromptTemplate(config.langsmithOppositeCasePrompt),
      coherenceAnalyzer: await pullPromptTemplate(config.langsmithCoherenceAnalyzerPrompt)
    };

    cachedLivePrompts = { cacheKey, prompts };
    return prompts;
  } catch {
    return loadPrompts(config.promptManifestPath);
  }
}

export function renderPrompt(
  template: PromptTemplate,
  values: Record<string, string>
): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, value);
  }, template.template);
}
