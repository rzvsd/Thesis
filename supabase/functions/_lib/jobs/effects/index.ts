// Side effects of completing a Deep Dive (contrarian anchor, kill-switch rules, name relationships,
// monitor snapshot, conviction journal, filing-change alerts, audit).
// Issuer enrichment and the audit helper for routes come from M1: ../../reports/issuer.ts, ../../store/reports.ts.
export { applyCompletionEffects } from "./apply.ts";
export { appendAudit, asContrarianSignal, extractThesisStatement } from "./helpers.ts";
export { createContrarianAnchorFromReport } from "./contrarian.ts";
export { createKillSwitchRulesFromReport, sanitizeKillSwitchConditionDrafts } from "./kill-switch.ts";
export {
  createNameRelationshipsFromReport,
  isNameRelationshipType,
  sanitizeNameRelationshipDrafts,
  upsertNameRelationships,
} from "./name-relationships.ts";
export { computeMonitorFreshness, summarizeMonitorState, upsertSnapshotFromReport } from "./monitor.ts";
export {
  convictionEvidenceRefsFromReport,
  convictionThesisSnapshotFromReport,
  recordConvictionJournalEntry,
  recordConvictionJournalEntryFromReport,
} from "./conviction.ts";
export { dispatchFilingChangeAlerts, findPriorDeepDive, noopNotifier } from "./filing-alerts.ts";
export { postgresEffectsStore } from "./store.ts";
export type * from "./types.ts";
