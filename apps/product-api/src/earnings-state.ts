import type {
  CallArtifact,
  EarningsEventConflictState,
  EarningsEventEvidenceState,
  EarningsEventSourceState,
  EarningsEventState,
  EarningsEventTimingCandidate,
  EarningsEventTimingState,
  EarningsReleaseArtifactSummary
} from "../../../packages/contracts/src";

import type { CalendarEventRecord } from "./types";

const dayMs = 24 * 60 * 60 * 1000;

const releaseArtifactTypes = new Set<CallArtifact["artifact_type"]>([
  "earnings_release",
  "presentation",
  "sec_exhibit",
  "supplemental_material"
]);

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function timingRank(state: EarningsEventTimingState): number {
  if (state === "actual") {
    return 3;
  }
  if (state === "confirmed") {
    return 2;
  }
  return 1;
}

function sourceRank(state: EarningsEventSourceState): number {
  if (state === "official") {
    return 5;
  }
  if (state === "first_party") {
    return 4;
  }
  if (state === "mixed") {
    return 3;
  }
  if (state === "derived") {
    return 2;
  }
  return 1;
}

function parseMs(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function providerFallbackSourceState(provider: string | undefined): EarningsEventSourceState {
  const normalized = provider?.trim().toLowerCase() ?? "";
  if (
    normalized.includes("official") ||
    normalized.includes("sec") ||
    normalized.includes("edgar") ||
    normalized.includes("treasury") ||
    normalized.includes("bls") ||
    normalized.includes("bea") ||
    normalized.includes("eia")
  ) {
    return "official";
  }
  if (
    normalized.includes("first_party") ||
    normalized.includes("issuer") ||
    normalized.includes("ir") ||
    normalized.includes("newsroom")
  ) {
    return "first_party";
  }
  if (normalized.includes("mixed")) {
    return "mixed";
  }
  return "derived";
}

export function normalizeEarningsTimingState(
  value: string | undefined
): EarningsEventTimingState {
  if (value === "confirmed" || value === "actual") {
    return value;
  }
  return "estimated";
}

export function normalizeEarningsSourceState(
  value: string | undefined,
  provider: string | undefined
): EarningsEventSourceState {
  if (
    value === "official" ||
    value === "first_party" ||
    value === "derived" ||
    value === "mixed" ||
    value === "conflicting"
  ) {
    return value;
  }
  return providerFallbackSourceState(provider);
}

function normalizeConfirmedTimingBySource(
  timingState: EarningsEventTimingState,
  sourceState: EarningsEventSourceState
): EarningsEventTimingState {
  if (timingState !== "confirmed") {
    return timingState;
  }
  if (sourceState === "official" || sourceState === "first_party") {
    return timingState;
  }
  return "estimated";
}

function artifactMatchesEventDate(artifact: CallArtifact, eventDate: string): boolean {
  const eventMs = Date.parse(`${eventDate}T12:00:00.000Z`);
  if (!Number.isFinite(eventMs)) {
    return false;
  }

  const publishedDate = normalizeDate(artifact.published_at);
  const retrievedDate = normalizeDate(artifact.retrieved_at);
  const candidateDate = publishedDate ?? retrievedDate;
  if (!candidateDate) {
    return false;
  }
  const candidateMs = Date.parse(`${candidateDate}T12:00:00.000Z`);
  if (!Number.isFinite(candidateMs)) {
    return false;
  }
  const lowerBound = eventMs - 3 * dayMs;
  const upperBound = eventMs + 7 * dayMs;
  return candidateMs >= lowerBound && candidateMs <= upperBound;
}

function selectReleaseArtifact(
  artifacts: CallArtifact[],
  event: CalendarEventRecord
): EarningsReleaseArtifactSummary | undefined {
  const candidates = artifacts.filter((artifact) => {
    if (!releaseArtifactTypes.has(artifact.artifact_type)) {
      return false;
    }
    if (artifact.event_id && artifact.event_id === event.id) {
      return true;
    }
    return artifactMatchesEventDate(artifact, event.eventDate);
  });
  if (candidates.length === 0) {
    return undefined;
  }
  candidates.sort((left, right) => parseMs(right.retrieved_at) - parseMs(left.retrieved_at));
  const selected = candidates[0];
  if (!selected) {
    return undefined;
  }
  return {
    artifact_id: selected.artifact_id,
    artifact_type: selected.artifact_type,
    source_url: selected.source_url,
    source_domain: selected.source_domain,
    published_at: selected.published_at,
    retrieved_at: selected.retrieved_at
  };
}

function hasTranscriptArtifact(artifacts: CallArtifact[], event: CalendarEventRecord): boolean {
  return artifacts.some((artifact) => {
    if (artifact.artifact_type !== "transcript") {
      return false;
    }
    if (artifact.event_id && artifact.event_id === event.id) {
      return true;
    }
    return artifactMatchesEventDate(artifact, event.eventDate);
  });
}

function compareCandidates(
  left: EarningsEventTimingCandidate,
  right: EarningsEventTimingCandidate
): number {
  const timing = timingRank(right.timing_state) - timingRank(left.timing_state);
  if (timing !== 0) {
    return timing;
  }
  const source = sourceRank(right.source_state) - sourceRank(left.source_state);
  if (source !== 0) {
    return source;
  }
  return parseMs(right.retrieved_at) - parseMs(left.retrieved_at);
}

function conflictStateFromCandidates(
  candidates: EarningsEventTimingCandidate[],
  primarySourceState: EarningsEventSourceState
): EarningsEventConflictState {
  const distinctDates = [...new Set(candidates.map((candidate) => candidate.event_date))].sort();
  const hasConflict = distinctDates.length > 1;
  return {
    has_conflict: hasConflict,
    primary_source_state: primarySourceState,
    conflicting_dates: hasConflict ? distinctDates : [],
    conflicting_event_ids: hasConflict ? candidates.map((candidate) => candidate.event_id) : [],
    reason_text: hasConflict
      ? "Multiple earnings dates are available across sources. Showing highest-trust timing as primary."
      : undefined
  };
}

function evidenceStateFromInputs(input: {
  releaseArtifact?: EarningsReleaseArtifactSummary;
  hasTranscript: boolean;
  hasFollowupContext: boolean;
}): EarningsEventEvidenceState {
  if (!input.releaseArtifact) {
    return "calendar_only";
  }
  if (input.hasTranscript) {
    return "release_with_transcript";
  }
  if (input.hasFollowupContext) {
    return "release_with_followup";
  }
  return "release_artifact";
}

function reasonTextFromInputs(input: {
  timingState: EarningsEventTimingState;
  reasonText: string;
  releaseArtifact?: EarningsReleaseArtifactSummary;
  conflict: EarningsEventConflictState;
}): string {
  if (input.timingState === "actual" && input.releaseArtifact) {
    const artifactDate = normalizeDate(input.releaseArtifact.published_at ?? input.releaseArtifact.retrieved_at);
    const base = artifactDate
      ? `Results artifact detected (${artifactDate}); earnings state promoted to actual.`
      : "Results artifact detected; earnings state promoted to actual.";
    return input.conflict.has_conflict
      ? `${base} ${input.conflict.reason_text ?? ""}`.trim()
      : base;
  }
  const base = input.reasonText.trim();
  if (!input.conflict.has_conflict) {
    return base.length > 0 ? base : "No explicit earnings timing reason was provided.";
  }
  if (base.length === 0) {
    return input.conflict.reason_text ?? "Conflicting earnings timing candidates were detected.";
  }
  return `${base} ${input.conflict.reason_text ?? ""}`.trim();
}

export function buildEarningsEventStates(input: {
  asOf: string;
  events: CalendarEventRecord[];
  artifactsByTicker: Map<string, CallArtifact[]>;
  hasFollowupByTicker?: Map<string, boolean>;
}): EarningsEventState[] {
  const grouped = new Map<string, CalendarEventRecord[]>();
  for (const event of input.events) {
    const ticker = event.ticker.trim().toUpperCase();
    const list = grouped.get(ticker);
    if (list) {
      list.push({ ...event, ticker });
    } else {
      grouped.set(ticker, [{ ...event, ticker }]);
    }
  }

  const rows: EarningsEventState[] = [];
  for (const [ticker, events] of grouped.entries()) {
    const artifacts = input.artifactsByTicker.get(ticker) ?? [];
    const candidates: EarningsEventTimingCandidate[] = [];
    let chosenReleaseArtifact: EarningsReleaseArtifactSummary | undefined;
    let chosenHasTranscript = false;
    let updatedAt = 0;

    for (const event of events) {
      const releaseArtifact = selectReleaseArtifact(artifacts, event);
      const hasTranscript = hasTranscriptArtifact(artifacts, event);
      const baseTiming = normalizeEarningsTimingState(event.timingState);
      const baseSource = normalizeEarningsSourceState(event.sourceState, event.provider);
      const normalizedTiming = normalizeConfirmedTimingBySource(baseTiming, baseSource);
      const candidateTiming: EarningsEventTimingState = releaseArtifact ? "actual" : normalizedTiming;
      const reasonText =
        event.reasonText.trim().length > 0
          ? event.reasonText.trim()
          : baseTiming === "confirmed" && normalizedTiming === "estimated"
            ? "Earnings timing remains estimated because confirmation is not from an official or first-party source."
            : baseTiming === "confirmed"
              ? "Company or official source confirms the earnings timing."
              : "Earnings timing is estimated pending stronger source confirmation.";
      candidates.push({
        event_id: event.id,
        event_date: event.eventDate,
        event_time: event.eventTime,
        timing_state: candidateTiming,
        source_state: baseSource,
        provider: event.provider,
        retrieved_at: event.retrievedAt,
        reason_text: reasonText
      });
      if (releaseArtifact) {
        if (!chosenReleaseArtifact || parseMs(releaseArtifact.retrieved_at) > parseMs(chosenReleaseArtifact.retrieved_at)) {
          chosenReleaseArtifact = releaseArtifact;
        }
      }
      if (hasTranscript) {
        chosenHasTranscript = true;
      }
      updatedAt = Math.max(updatedAt, parseMs(event.retrievedAt));
    }

    if (candidates.length === 0) {
      continue;
    }

    candidates.sort(compareCandidates);
    const primary = candidates[0];
    if (!primary) {
      continue;
    }
    const conflict = conflictStateFromCandidates(candidates, primary.source_state);
    const hasFollowupContext = input.hasFollowupByTicker?.get(ticker) ?? false;
    const evidenceState = evidenceStateFromInputs({
      releaseArtifact: chosenReleaseArtifact,
      hasTranscript: chosenHasTranscript,
      hasFollowupContext
    });
    const reasonText = reasonTextFromInputs({
      timingState: primary.timing_state,
      reasonText: primary.reason_text,
      releaseArtifact: chosenReleaseArtifact,
      conflict
    });
    const releaseUpdatedAt = chosenReleaseArtifact ? parseMs(chosenReleaseArtifact.retrieved_at) : 0;
    const finalUpdatedAt = Math.max(updatedAt, releaseUpdatedAt);
    rows.push({
      ticker,
      earnings_event_id: primary.event_id,
      event_date: primary.event_date,
      event_time: primary.event_time,
      timing_state: primary.timing_state,
      source_state: primary.source_state,
      evidence_state: evidenceState,
      reason_text: reasonText,
      primary_candidate: primary,
      candidates,
      conflict,
      release_artifact: chosenReleaseArtifact,
      has_transcript: chosenHasTranscript,
      updated_at: finalUpdatedAt > 0 ? new Date(finalUpdatedAt).toISOString() : new Date().toISOString()
    });
  }

  return rows.sort((left, right) => left.ticker.localeCompare(right.ticker));
}
