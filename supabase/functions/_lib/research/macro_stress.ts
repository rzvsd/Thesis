// Macro Stress logic, copied from apps/product-api/src/macro-stress.ts (AGENTS rule 3) plus the types from
// packages/contracts. Owner: M3. toAppMacroStress() adds the fields the Android app parses (see M3 report).
import { createHash } from "node:crypto";

export type FearGreedLabel =
  | "extreme_fear"
  | "fear"
  | "neutral"
  | "greed"
  | "extreme_greed";

export interface FearGreedSubScore {
  input_name: string;
  provider: string;
  available: boolean;
  weight: number;
  normalized_score?: number;
  raw_value?: number;
  retrieved_at?: string;
  notes?: string;
}

export interface FearGreedSnapshot {
  id: string;
  market_date: string;
  score: number;
  label: FearGreedLabel;
  sub_scores: FearGreedSubScore[];
  missing_inputs: string[];
  calculated_at: string;
}

export const macroStressStates = [
  "stable",
  "mixed",
  "elevated",
  "insufficient_data",
] as const;

export type MacroStressState = (typeof macroStressStates)[number];

export const macroStressPressureLevels = [
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export type MacroStressPressureLevel = (typeof macroStressPressureLevels)[number];

export const macroStressCategories = [
  "rates",
  "inflation",
  "labor",
  "growth",
  "energy",
] as const;

export type MacroStressCategory = (typeof macroStressCategories)[number];

export const macroStressSourceStates = [
  "official",
  "partial",
  "missing",
] as const;

export type MacroStressSourceState = (typeof macroStressSourceStates)[number];

export interface MacroStressInput {
  registry_id: string;
  label: string;
  category: MacroStressCategory;
  pressure: MacroStressPressureLevel;
  source_state: MacroStressSourceState;
  value?: number;
  unit?: string;
  period?: string;
  reason: string;
  source_name?: string;
  retrieved_at?: string;
}

export interface MacroStressOmission {
  registry_id: string;
  reason_code: string;
  reason_text: string;
}

export interface MacroStressSnapshot {
  snapshot_id: string;
  as_of: string;
  generated_at: string;
  state: MacroStressState;
  summary: string;
  no_material_change: boolean;
  inputs: MacroStressInput[];
  omissions: MacroStressOmission[];
}

const macroRegistryLabels: Record<string, string> = {
  TREASURY_DAILY_10Y: "Treasury 10Y",
  TREASURY_DAILY_2Y: "Treasury 2Y",
  BLS_CPI_U_ALL_ITEMS: "CPI-U All Items",
  BLS_UNEMPLOYMENT_RATE: "Unemployment Rate",
  BEA_REAL_GDP: "Real GDP",
  EIA_WTI_SPOT: "WTI Spot",
};

const categoryOrder: MacroStressCategory[] = [
  "rates",
  "inflation",
  "labor",
  "growth",
  "energy",
];

interface OfficialMacroSource {
  source_name?: string;
}

interface OfficialMacroRetrieval {
  source?: OfficialMacroSource;
  retrieved_at?: string;
}

interface OfficialMacroObservation {
  registry_id?: string;
  value?: number;
  unit?: string;
  period?: string;
  category?: string;
  retrieval?: OfficialMacroRetrieval;
  missing_fields?: unknown[];
}

interface BuildMacroStressSnapshotInput {
  asOf: string;
  generatedAt: string;
  observations: OfficialMacroObservation[];
  omissions?: MacroStressOmission[];
  noMaterialChangeHint?: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCategory(
  rawCategory: string | undefined,
  registryId: string,
): MacroStressCategory {
  const normalized = rawCategory?.trim().toLowerCase();
  if (normalized === "rates") {
    return "rates";
  }
  if (normalized === "inflation") {
    return "inflation";
  }
  if (normalized === "labor") {
    return "labor";
  }
  if (normalized === "growth") {
    return "growth";
  }
  if (normalized === "energy") {
    return "energy";
  }
  if (registryId.startsWith("TREASURY_")) {
    return "rates";
  }
  if (registryId.startsWith("BLS_CPI")) {
    return "inflation";
  }
  if (registryId.startsWith("BLS_UNEMPLOYMENT")) {
    return "labor";
  }
  if (registryId.startsWith("BEA_")) {
    return "growth";
  }
  return "energy";
}

function pressureFromValue(
  category: MacroStressCategory,
  value: number | undefined,
): MacroStressPressureLevel {
  if (!isFiniteNumber(value)) {
    return "unknown";
  }

  if (category === "rates") {
    if (value >= 4.75) {
      return "high";
    }
    if (value >= 3.75) {
      return "medium";
    }
    return "low";
  }

  if (category === "inflation") {
    if (value >= 310) {
      return "high";
    }
    if (value >= 300) {
      return "medium";
    }
    return "low";
  }

  if (category === "labor") {
    if (value >= 5.0) {
      return "high";
    }
    if (value >= 4.0) {
      return "medium";
    }
    return "low";
  }

  if (category === "growth") {
    if (value <= 0.5) {
      return "high";
    }
    if (value <= 1.5) {
      return "medium";
    }
    return "low";
  }

  if (value >= 95) {
    return "high";
  }
  if (value >= 80) {
    return "medium";
  }
  return "low";
}

function sourceStateFromObservation(observation: OfficialMacroObservation): MacroStressInput["source_state"] {
  const valuePresent = isFiniteNumber(observation.value);
  const missingFieldsCount = Array.isArray(observation.missing_fields)
    ? observation.missing_fields.length
    : 0;

  if (!valuePresent) {
    return "missing";
  }
  if (missingFieldsCount > 0) {
    return "partial";
  }
  return "official";
}

function pressureRank(level: MacroStressPressureLevel): number {
  switch (level) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function pressureToScore(level: MacroStressPressureLevel): number {
  switch (level) {
    case "high":
      return 85;
    case "medium":
      return 55;
    case "low":
      return 25;
    default:
      return 65;
  }
}

function pressureFromScore(score: number | undefined): MacroStressPressureLevel {
  if (!isFiniteNumber(score)) {
    return "unknown";
  }
  if (score >= 75) {
    return "high";
  }
  if (score >= 45) {
    return "medium";
  }
  if (score > 0) {
    return "low";
  }
  return "unknown";
}

function stateFromInputs(inputs: MacroStressInput[]): MacroStressState {
  const available = inputs.filter(
    (input) => input.source_state !== "missing" && input.pressure !== "unknown",
  );
  if (available.length < 3) {
    return "insufficient_data";
  }

  const high = available.filter((input) => input.pressure === "high").length;
  const medium = available.filter((input) => input.pressure === "medium").length;
  if (high > 0) {
    return "elevated";
  }
  if (medium >= 2) {
    return "mixed";
  }
  return "stable";
}

function summaryFromSnapshot(
  state: MacroStressState,
  inputs: MacroStressInput[],
  omissions: MacroStressOmission[],
): string {
  const topPressure = [...inputs]
    .sort((left, right) => pressureRank(right.pressure) - pressureRank(left.pressure))
    .slice(0, 2)
    .map((input) => `${input.label} (${input.pressure})`);

  if (state === "insufficient_data") {
    return omissions.length > 0
      ? "Macro Stress is partial because key official inputs are missing."
      : "Macro Stress has insufficient official coverage for a full read.";
  }
  if (state === "elevated") {
    return topPressure.length > 0
      ? `Macro pressure is elevated: ${topPressure.join(", ")}.`
      : "Macro pressure is elevated across official inputs.";
  }
  if (state === "mixed") {
    return topPressure.length > 0
      ? `Macro pressure is mixed with cross-currents in ${topPressure.join(", ")}.`
      : "Macro pressure is mixed across official inputs.";
  }
  return "Macro pressure remains stable across the official daily basket.";
}

function macroLabelFromScore(score: number): FearGreedLabel {
  if (score < 20) {
    return "extreme_fear";
  }
  if (score < 45) {
    return "fear";
  }
  if (score < 60) {
    return "neutral";
  }
  if (score < 80) {
    return "greed";
  }
  return "extreme_greed";
}

function categoryFromRegistry(registryId: string): MacroStressCategory {
  return normalizeCategory(undefined, registryId);
}

function labelFromRegistry(registryId: string): string {
  return macroRegistryLabels[registryId] ?? registryId;
}

function normalizeLegacyOmissions(
  missingInputs: string[],
): MacroStressOmission[] {
  return missingInputs
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [registryId, reasonCode] = entry.split(":");
      const normalizedRegistry = registryId?.trim().toUpperCase();
      const normalizedReason = reasonCode?.trim().toLowerCase();
      if (!normalizedRegistry || !normalizedReason) {
        return {
          registry_id: entry.toUpperCase(),
          reason_code: "missing_input",
          reason_text: "Input was missing in compatibility snapshot.",
        };
      }
      return {
        registry_id: normalizedRegistry,
        reason_code: normalizedReason,
        reason_text: `Missing input: ${normalizedRegistry} (${normalizedReason}).`,
      };
    });
}

export function buildMacroStressSnapshot(
  input: BuildMacroStressSnapshotInput,
): MacroStressSnapshot {
  const normalizedInputs: MacroStressInput[] = [];
  for (const observation of input.observations) {
    const registryId = observation.registry_id?.trim().toUpperCase();
    if (!registryId) {
      continue;
    }
    const category = normalizeCategory(observation.category, registryId);
    const sourceState = sourceStateFromObservation(observation);
    const pressure = pressureFromValue(category, observation.value);
    const sourceName = observation.retrieval?.source?.source_name;
    const reason = isFiniteNumber(observation.value)
      ? `${labelFromRegistry(registryId)} is ${observation.value} ${observation.unit ?? "value"} (${
        observation.period ?? "latest"
      }).`
      : `${labelFromRegistry(registryId)} is unavailable in the latest official pull.`;
    const normalized: MacroStressInput = {
      registry_id: registryId,
      label: labelFromRegistry(registryId),
      category,
      pressure,
      source_state: sourceState,
      ...(isFiniteNumber(observation.value) ? { value: observation.value } : {}),
      ...(observation.unit?.trim() ? { unit: observation.unit.trim() } : {}),
      ...(observation.period?.trim() ? { period: observation.period.trim() } : {}),
      reason,
      ...(sourceName?.trim() ? { source_name: sourceName.trim() } : {}),
      ...(observation.retrieval?.retrieved_at ? { retrieved_at: observation.retrieval.retrieved_at } : {}),
    };
    normalizedInputs.push(normalized);
  }

  normalizedInputs.sort((left, right) => {
    const byCategory = categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category);
    if (byCategory !== 0) {
      return byCategory;
    }
    return left.registry_id.localeCompare(right.registry_id);
  });

  const omissions = input.omissions ?? [];
  const state = stateFromInputs(normalizedInputs);
  const noMaterialChange = input.noMaterialChangeHint ??
    (normalizedInputs.every((entry) => entry.pressure === "low" || entry.pressure === "unknown") &&
      omissions.length === 0);
  const summary = summaryFromSnapshot(state, normalizedInputs, omissions);

  const snapshotId = createHash("sha256")
    .update(`macro_stress:${input.asOf}`)
    .digest("hex");

  return {
    snapshot_id: snapshotId,
    as_of: input.asOf,
    generated_at: input.generatedAt,
    state,
    summary,
    no_material_change: noMaterialChange,
    inputs: normalizedInputs,
    omissions,
  };
}

export function macroStressToLegacySnapshot(snapshot: MacroStressSnapshot): FearGreedSnapshot {
  const pressureScores = snapshot.inputs.map((entry) => pressureToScore(entry.pressure));
  const averagePressure = pressureScores.length > 0
    ? pressureScores.reduce((sum, score) => sum + score, 0) / pressureScores.length
    : 65;
  const score = snapshot.state === "insufficient_data"
    ? 35
    : Math.max(0, Math.min(100, Number((100 - averagePressure).toFixed(2))));
  const label = macroLabelFromScore(score);

  const subScores = snapshot.inputs.map((entry) => ({
    input_name: entry.registry_id,
    provider: entry.source_name ?? "official_macro",
    available: entry.source_state !== "missing",
    weight: Number((1 / Math.max(snapshot.inputs.length, 1)).toFixed(8)),
    normalized_score: pressureToScore(entry.pressure),
    raw_value: entry.value,
    retrieved_at: entry.retrieved_at,
    notes: `${entry.category}|${entry.source_state}|${entry.reason}`,
  }));

  return {
    id: snapshot.snapshot_id,
    market_date: snapshot.as_of,
    score,
    label,
    sub_scores: subScores,
    missing_inputs: snapshot.omissions.map(
      (omission) => `${omission.registry_id}:${omission.reason_code}`,
    ),
    calculated_at: snapshot.generated_at,
  };
}

export function legacySnapshotToMacroStress(
  snapshot: FearGreedSnapshot,
): MacroStressSnapshot {
  const inputs: MacroStressInput[] = [];
  for (const subScore of snapshot.sub_scores) {
    const registryId = subScore.input_name?.trim().toUpperCase();
    if (!registryId || registryId.startsWith("__")) {
      continue;
    }
    const noteParts = subScore.notes?.split("|") ?? [];
    const category = noteParts[0] as MacroStressCategory | undefined;
    const sourceState = noteParts[1] as MacroStressInput["source_state"] | undefined;
    const reason = noteParts.slice(2).join("|").trim();
    const input: MacroStressInput = {
      registry_id: registryId,
      label: labelFromRegistry(registryId),
      category: categoryOrder.includes(category as MacroStressCategory)
        ? (category as MacroStressCategory)
        : categoryFromRegistry(registryId),
      pressure: pressureFromScore(subScore.normalized_score),
      source_state: sourceState === "official" || sourceState === "partial" || sourceState === "missing"
        ? sourceState
        : subScore.available
        ? "official"
        : "missing",
      ...(isFiniteNumber(subScore.raw_value) ? { value: subScore.raw_value } : {}),
      reason: reason.length > 0 ? reason : "Derived from stored macro compatibility snapshot.",
      ...(subScore.provider?.trim() ? { source_name: subScore.provider.trim() } : {}),
      ...(subScore.retrieved_at ? { retrieved_at: subScore.retrieved_at } : {}),
    };
    inputs.push(input);
  }

  const omissions = normalizeLegacyOmissions(snapshot.missing_inputs);
  const state = stateFromInputs(inputs);
  const summary = summaryFromSnapshot(state, inputs, omissions);
  const noMaterialChange =
    inputs.every((entry) => entry.pressure === "low" || entry.pressure === "unknown") &&
    omissions.length === 0;

  return {
    snapshot_id: snapshot.id,
    as_of: snapshot.market_date,
    generated_at: snapshot.calculated_at,
    state,
    summary,
    no_material_change: noMaterialChange,
    inputs,
    omissions,
  };
}

// ---- App compatibility (M3) ----
// The Android parser (ProductApiClient.mapSentimentSnapshot) needs a numeric `score` and reads `label`,
// `sub_scores` and `missing_inputs`. The old server sent only the Macro Stress shape, so the app dropped every
// row and the screen stayed empty. These extra fields are additive: every existing field keeps its name and value.
// Score: 0-100, higher means more macro pressure (the app's own label fallback reads it that way).

export type AppMacroStressLabel = "elevated_pressure" | "balanced" | "low_pressure" | "insufficient_data";

export interface AppMacroStressSnapshot extends MacroStressSnapshot {
  id: string;
  market_date: string;
  calculated_at: string;
  score: number;
  label: AppMacroStressLabel;
  sub_scores: FearGreedSubScore[];
  missing_inputs: string[];
}

function appLabel(state: MacroStressState): AppMacroStressLabel {
  if (state === "elevated") return "elevated_pressure";
  if (state === "mixed") return "balanced";
  if (state === "stable") return "low_pressure";
  return "insufficient_data";
}

export function stressScore(snapshot: MacroStressSnapshot): number {
  const known = snapshot.inputs.filter((i) => i.source_state !== "missing" && i.pressure !== "unknown");
  if (known.length === 0) return 50;
  const avg = known.reduce((sum, i) => sum + pressureToScore(i.pressure), 0) / known.length;
  return Math.max(0, Math.min(100, Number(avg.toFixed(2))));
}

export function toAppMacroStress(legacy: FearGreedSnapshot): AppMacroStressSnapshot {
  const snapshot = legacySnapshotToMacroStress(legacy);
  return {
    ...snapshot,
    id: snapshot.snapshot_id,
    market_date: snapshot.as_of,
    calculated_at: snapshot.generated_at,
    score: stressScore(snapshot),
    label: appLabel(snapshot.state),
    sub_scores: legacy.sub_scores.filter((s) => !s.input_name.startsWith("__")),
    missing_inputs: legacy.missing_inputs,
  };
}
