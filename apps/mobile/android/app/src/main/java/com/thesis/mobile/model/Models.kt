package com.thesis.mobile.model

data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val accessTokenExpiresAt: String,
    val refreshTokenExpiresAt: String
)

data class RegisterResult(
    val status: String,
    val email: String?,
    val verificationToken: String?
)

data class TickerSearchItem(
    val symbol: String,
    val companyName: String,
    val exchange: String
)

data class JobStatus(
    val jobId: String,
    val status: String,
    val ticker: String?,
    val reportId: String?,
    val errorMessage: String?
)

data class EvidenceView(
    val sourceName: String,
    val excerpt: String,
    val url: String?
)

data class SectionView(
    val sectionId: String? = null,
    val title: String,
    val body: String,
    val status: String? = null,
    val evidence: List<EvidenceView> = emptyList()
)

data class ConfidenceDisplayView(
    val score: Double? = null,
    val label: String? = null,
    val limitingFactors: List<String> = emptyList()
)

data class SignalDisplayView(
    val value: String? = null,
    val reasons: List<String> = emptyList()
)

data class ValuationAssumptionsView(
    val methodology: String? = null,
    val projectionYears: Int? = null,
    val terminalGrowthRate: Double? = null,
    val wacc: Double? = null
)

data class ValuationDisplayView(
    val fairValueMid: Double? = null,
    val fairValueLow: Double? = null,
    val fairValueHigh: Double? = null,
    val spotPrice: Double? = null,
    val impliedUpsidePct: Double? = null,
    val assumptions: ValuationAssumptionsView? = null,
    val degradedReason: String? = null
)

data class HistoricalDisplayView(
    val latestPeriod: String? = null,
    val priorQuarterPeriod: String? = null,
    val yearAgoPeriod: String? = null,
    val financialSnapshotCount: Int = 0,
    val transcriptCount: Int = 0
)

data class TrustContradictionView(
    val id: String,
    val description: String,
    val severity: String
)

data class TrustQuoteProvenanceView(
    val quote: String,
    val sourceName: String,
    val sourceType: String,
    val sourcePeriod: String? = null,
    val transcriptId: String? = null,
    val retrievedAt: String? = null
)

data class TrustThesisDriftView(
    val status: String,
    val summary: String,
    val reasons: List<String> = emptyList(),
    val comparableReportId: String? = null,
    val comparableGeneratedAt: String? = null,
    val comparableSchemaVersion: String? = null
)

data class TrustMetadataView(
    val generatedAt: String? = null,
    val freshnessState: String? = null,
    val evidenceCount: Int? = null,
    val contradictionState: String? = null,
    val contradictions: List<TrustContradictionView> = emptyList(),
    val valuationState: String? = null,
    val missingDataNotes: List<String> = emptyList(),
    val quoteProvenance: List<TrustQuoteProvenanceView> = emptyList(),
    val thesisDrift: TrustThesisDriftView? = null
)

data class ReportNoteView(
    val content: String,
    val updatedAt: String
)

data class ScenarioOverridesView(
    val projectionYears: Int? = null,
    val terminalGrowthRate: Double? = null,
    val wacc: Double? = null
)

data class ScenarioInputOmissionView(
    val omissionCode: String,
    val omissionText: String,
    val affectsFields: List<String> = emptyList()
)

data class ScenarioResultView(
    val reportId: String,
    val base: ValuationDisplayView,
    val scenario: ValuationDisplayView,
    val deterministicModel: String? = null,
    val omissions: List<ScenarioInputOmissionView> = emptyList()
)

data class ScenarioStressRouteView(
    val openTab: String,
    val scenarioId: String,
    val scenarioRunId: String,
    val ticker: String? = null,
    val ruleId: String? = null
)

data class ScenarioStressTemplateView(
    val scenarioId: String,
    val title: String,
    val summary: String,
    val hypothesis: String,
    val active: Boolean,
    val createdAt: String,
    val updatedAt: String
)

data class ScenarioStressRunHeaderView(
    val scenarioRunId: String,
    val scenarioId: String,
    val userId: String,
    val status: String,
    val runMode: String,
    val asOf: String,
    val totalNames: Int,
    val impactedNames: Int,
    val criticalNames: Int,
    val summary: String,
    val route: ScenarioStressRouteView,
    val createdAt: String,
    val completedAt: String
)

data class ScenarioStressImpactView(
    val scenarioImpactId: String,
    val scenarioRunId: String,
    val userId: String,
    val ticker: String,
    val impactLevel: String,
    val thesisBreakLikelihood: String,
    val stressScore: Double,
    val rationale: String,
    val evidenceRefs: List<String> = emptyList(),
    val route: ScenarioStressRouteView,
    val createdAt: String
)

data class ScenarioStressRuleSuggestionView(
    val scenarioRuleSuggestionId: String,
    val scenarioRunId: String,
    val userId: String,
    val ticker: String,
    val signalType: String,
    val direction: String,
    val conditionText: String,
    val rationale: String,
    val confidence: Double,
    val route: ScenarioStressRouteView,
    val createdAt: String
)

data class ScenarioStressRunView(
    val run: ScenarioStressRunHeaderView,
    val impacts: List<ScenarioStressImpactView> = emptyList(),
    val ruleSuggestions: List<ScenarioStressRuleSuggestionView> = emptyList()
)

data class DeepDiveReportView(
    val reportId: String,
    val ticker: String?,
    val schemaVersion: String = "1.0",
    val isLegacy: Boolean = false,
    val thesisStatement: String? = null,
    val confidence: ConfidenceDisplayView? = null,
    val signalValue: String?,
    val signalReasons: List<String> = emptyList(),
    val confidenceLabel: String?,
    val confidenceScore: Double?,
    val valuation: ValuationDisplayView? = null,
    val historical: HistoricalDisplayView? = null,
    val trustMetadata: TrustMetadataView? = null,
    val sections: List<SectionView>
)

data class PulseReportView(
    val reportId: String,
    val generatedAt: String,
    val sections: List<SectionView>
)

data class WarRoomPhaseView(
    val phase: String,
    val title: String,
    val summary: String,
    val highlights: List<String> = emptyList(),
    val status: String? = null,
    val ticker: String? = null,
    val route: String? = null,
    val reportId: String? = null,
    val updatedAt: String? = null
)

data class WarRoomView(
    val warRoomId: String,
    val title: String? = null,
    val ticker: String? = null,
    val status: String? = null,
    val generatedAt: String? = null,
    val summary: String? = null,
    val phases: List<WarRoomPhaseView> = emptyList(),
    val relatedTickers: List<String> = emptyList()
)

data class SentimentSubScoreView(
    val inputName: String,
    val provider: String,
    val available: Boolean,
    val weight: Double,
    val normalizedScore: Double? = null,
    val rawValue: Double? = null,
    val retrievedAt: String? = null,
    val notes: String? = null
)

data class SentimentSnapshotView(
  val id: String,
  val marketDate: String,
  val score: Double,
    val label: String,
    val subScores: List<SentimentSubScoreView> = emptyList(),
    val missingInputs: List<String> = emptyList(),
  val calculatedAt: String
)

// Phase 6 M3: keep type-compatible aliases while UI/API terminology transitions to Macro Stress.
typealias MacroStressSubScoreView = SentimentSubScoreView
typealias MacroStressSnapshotView = SentimentSnapshotView

data class ThesisMonitorSnapshotView(
    val ticker: String,
    val state: String,
    val reason: String,
    val score: Double,
    val reportId: String? = null,
    val reportGeneratedAt: String? = null,
    val reportSchemaVersion: String? = null,
    val lastDeepDiveAt: String? = null,
    val materialEventsCount: Int = 0,
    val unreviewedEventsCount: Int = 0,
    val freshnessState: String = "stale",
    val freshnessScore: Double = 0.0,
    val killSwitchTriggeredAt: String? = null,
    val freshnessReason: String? = null,
    val updatedAt: String
)

data class AlertLedgerItemView(
    val id: String,
    val notificationType: String,
    val category: String,
    val route: String,
    val title: String,
    val body: String,
    val reasonCode: String,
    val reasonText: String,
    val deliveryState: String,
    val feedbackState: String? = null,
    val mutedAt: String? = null,
    val ticker: String? = null,
    val reportId: String? = null,
    val pulseDate: String? = null,
    val digestDate: String? = null,
    val briefingContext: BriefingContextView? = null,
    val relatedTickers: List<String> = emptyList(),
    val createdAt: String,
    val updatedAt: String
)

data class BriefingContextView(
    val mode: String? = null,
    val count: Int? = null,
    val watchlistCount: Int? = null,
    val leadRoute: String? = null,
    val leadTicker: String? = null,
    val leadReportId: String? = null,
    val leadPulseDate: String? = null,
    val leadDigestDate: String? = null,
    val relatedTickers: List<String> = emptyList()
)

data class ReportHistoryItem(
    val reportId: String,
    val jobId: String,
    val type: String,
    val ticker: String?,
    val createdAt: String
)

data class ConvictionEvidenceRefView(
    val kind: String,
    val refId: String,
    val label: String? = null,
    val ticker: String? = null,
    val capturedAt: String? = null
)

data class ConvictionThesisSnapshotView(
    val ticker: String? = null,
    val reportId: String? = null,
    val reportGeneratedAt: String? = null,
    val signalValue: String? = null,
    val confidenceLabel: String? = null,
    val confidenceScore: Double? = null,
    val thesisSummary: String? = null,
    val monitorState: String? = null,
    val freshnessState: String? = null
)

data class ConvictionJournalEntryView(
    val journalEntryId: String,
    val ticker: String,
    val eventType: String,
    val sourceType: String,
    val sourceId: String,
    val eventAt: String,
    val title: String,
    val summary: String,
    val thesisSnapshot: ConvictionThesisSnapshotView? = null,
    val evidenceRefs: List<ConvictionEvidenceRefView> = emptyList(),
    val reportId: String? = null,
    val alertLedgerId: String? = null,
    val warRoomId: String? = null,
    val oppositeCaseId: String? = null
)

data class ConvictionInsightFindingView(
    val findingType: String,
    val title: String,
    val summary: String,
    val tickers: List<String> = emptyList(),
    val confidence: Double = 0.0,
    val evidenceRefs: List<ConvictionEvidenceRefView> = emptyList()
)

data class ConvictionInsightCardView(
    val insightId: String,
    val periodStart: String,
    val periodEnd: String,
    val insightType: String,
    val status: String,
    val title: String,
    val summary: String,
    val findings: List<ConvictionInsightFindingView> = emptyList(),
    val generatedAt: String
)

data class OppositeCasePointView(
    val title: String,
    val summary: String,
    val evidenceRefs: List<ConvictionEvidenceRefView> = emptyList()
)

data class OppositeCaseReportView(
    val oppositeCaseId: String,
    val sourceReportId: String,
    val ticker: String,
    val thesisSummary: String,
    val oppositeCaseSummary: String,
    val keyPoints: List<OppositeCasePointView> = emptyList(),
    val sharedEvidenceRefs: List<ConvictionEvidenceRefView> = emptyList(),
    val decisiveFactors: List<String> = emptyList(),
    val generatedAt: String
)

data class LastViewedReport(
    val reportId: String,
    val label: String,
    val type: String,
    val referenceDate: String? = null,
    val timestampMs: Long
)

data class UserProfileView(
    val userId: String,
    val email: String,
    val tier: String,
    val billingPeriodEnd: String?,
    val watchlistLimit: Int,
    val dailyDeepDiveLimit: Int,
    val deepDivesRemainingToday: Int
)

data class NotificationPreferenceView(
    val type: String,
    val enabled: Boolean,
    val quietUntil: String? = null
)

data class SubscriptionOfferView(
    val packageType: String,
    val identifier: String,
    val title: String
)
