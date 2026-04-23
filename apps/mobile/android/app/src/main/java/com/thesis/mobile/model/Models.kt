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

data class IssuerView(
    val name: String,
    val exchange: String? = null
)

data class DeepDiveStoryHeaderView(
    val headline: String,
    val thesisSummary: String,
    val whyNow: String,
    val readerTakeaway: String,
    val stanceLabel: String
)

data class DeepDiveTopChangeView(
    val title: String,
    val direction: String,
    val impactLevel: String,
    val whyItChanged: String,
    val whyItMatters: String
)

data class DeepDiveChangeSummaryView(
    val previousView: String,
    val currentView: String,
    val topChanges: List<DeepDiveTopChangeView> = emptyList()
)

sealed interface DeepDiveVisualPanelView {
    val type: String
    val title: String
    val eyebrow: String?
    val summary: String?
}

data class MetricDeltaItemView(
    val label: String,
    val currentValue: Double? = null,
    val referenceValue: Double? = null,
    val deltaPct: Double? = null,
    val basis: String,
    val direction: String,
    val note: String? = null
)

data class TimelinePointView(
    val label: String,
    val value: String,
    val emphasis: String? = null
)

data class EvidenceLadderRungView(
    val label: String,
    val count: Int,
    val tone: String
)

data class ValuationBridgePointView(
    val label: String,
    val value: Double,
    val tone: String
)

data class MetricDeltaPanelView(
    override val type: String = "metric_delta",
    override val title: String,
    override val eyebrow: String? = null,
    override val summary: String? = null,
    val metrics: List<MetricDeltaItemView> = emptyList()
) : DeepDiveVisualPanelView

data class TimelinePanelView(
    override val type: String = "timeline",
    override val title: String,
    override val eyebrow: String? = null,
    override val summary: String? = null,
    val points: List<TimelinePointView> = emptyList()
) : DeepDiveVisualPanelView

data class RangeBandPanelView(
    override val type: String = "range_band",
    override val title: String,
    override val eyebrow: String? = null,
    override val summary: String? = null,
    val lowValue: Double? = null,
    val midValue: Double? = null,
    val highValue: Double? = null,
    val referenceValue: Double? = null,
    val valueLabel: String? = null,
    val referenceLabel: String? = null
) : DeepDiveVisualPanelView

data class TrustScorecardPanelView(
    override val type: String = "trust_scorecard",
    override val title: String,
    override val eyebrow: String? = null,
    override val summary: String? = null,
    val freshnessState: String? = null,
    val contradictionState: String? = null,
    val valuationState: String? = null,
    val evidenceCount: Int? = null
) : DeepDiveVisualPanelView

data class EvidenceLadderPanelView(
    override val type: String = "evidence_ladder",
    override val title: String,
    override val eyebrow: String? = null,
    override val summary: String? = null,
    val rungs: List<EvidenceLadderRungView> = emptyList()
) : DeepDiveVisualPanelView

data class ValuationBridgePanelView(
    override val type: String = "valuation_bridge",
    override val title: String,
    override val eyebrow: String? = null,
    override val summary: String? = null,
    val points: List<ValuationBridgePointView> = emptyList()
) : DeepDiveVisualPanelView

data class ScenarioComparePanelView(
    override val type: String = "scenario_compare",
    override val title: String,
    override val eyebrow: String? = null,
    override val summary: String? = null,
    val baseLabel: String,
    val scenarioLabel: String,
    val baseValue: Double? = null,
    val scenarioValue: Double? = null,
    val deltaText: String? = null
) : DeepDiveVisualPanelView

data class DeepDiveExplainersView(
    val signal: String,
    val confidence: String,
    val freshness: String,
    val valuation: String,
    val omissions: String
)

data class DeepDiveCoverageTruthView(
    val summary: String,
    val covered: List<String> = emptyList(),
    val missing: List<String> = emptyList()
)

data class MemoClaimSupportRefView(
    val supportType: String,
    val refId: String,
    val summary: String
)

data class InvestmentMemoClaimView(
    val claimId: String,
    val sectionId: String,
    val statement: String,
    val materiality: String,
    val supports: List<MemoClaimSupportRefView> = emptyList()
)

data class InvestmentMemoSectionView(
    val sectionId: String,
    val title: String,
    val narrative: String,
    val keyPoints: List<String> = emptyList()
)

data class InvestmentMemoView(
    val promptVersion: String,
    val generationMode: String,
    val companyAngle: String,
    val decisionQuestion: String,
    val sections: List<InvestmentMemoSectionView> = emptyList(),
    val materialClaims: List<InvestmentMemoClaimView> = emptyList(),
    val unsupportedClaims: List<String> = emptyList(),
    val sparseDataHonestyNote: String
)

data class DueDiligenceSectionView(
    val sectionId: String,
    val title: String,
    val summary: String,
    val narrativeParagraphs: List<String> = emptyList(),
    val keyPoints: List<String> = emptyList(),
    val evidenceRefs: List<String> = emptyList(),
    val omissions: List<String> = emptyList(),
    val coverageState: String
)

data class DueDiligenceView(
    val promptVersion: String,
    val generationMode: String,
    val sections: List<DueDiligenceSectionView> = emptyList()
)

data class FinancialHistoryRowView(
    val period: String,
    val periodType: String,
    val fiscalYear: Int,
    val fiscalQuarter: Int? = null,
    val revenue: Double? = null,
    val grossMargin: Double? = null,
    val operatingMargin: Double? = null,
    val netIncome: Double? = null,
    val freeCashFlow: Double? = null,
    val debtTotal: Double? = null,
    val cashAndEquivalents: Double? = null,
    val sharesOutstanding: Double? = null
)

data class FinancialDerivedMetricView(
    val key: String,
    val label: String,
    val value: Double? = null,
    val unit: String,
    val status: String,
    val direction: String,
    val note: String? = null
)

data class FinancialOmissionView(
    val code: String,
    val label: String,
    val reason: String,
    val impacts: List<String> = emptyList()
)

data class FinancialAnalysisView(
    val annualHistory: List<FinancialHistoryRowView> = emptyList(),
    val quarterlyHistory: List<FinancialHistoryRowView> = emptyList(),
    val trendMetrics: List<FinancialDerivedMetricView> = emptyList(),
    val qualityMetrics: List<FinancialDerivedMetricView> = emptyList(),
    val omissions: List<FinancialOmissionView> = emptyList()
)

data class ValueDisciplineSignalView(
    val key: String,
    val label: String,
    val family: String,
    val status: String,
    val reason: String,
    val value: Double? = null
)

data class ValueTrapWarningView(
    val triggered: Boolean,
    val summary: String,
    val reasonCodes: List<String> = emptyList()
)

data class ValueDisciplineView(
    val score: Int,
    val maxScore: Int,
    val availableSignals: Int,
    val completeness: String,
    val contextLabel: String,
    val interpretation: String,
    val missingSignals: List<String> = emptyList(),
    val doesNotProve: String,
    val signals: List<ValueDisciplineSignalView> = emptyList(),
    val valueTrapWarning: ValueTrapWarningView
)

data class KillSwitchConditionView(
    val conditionText: String,
    val signalType: String,
    val direction: String,
    val thresholdDescription: String? = null
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
    val generatedAt: String? = null,
    val issuer: IssuerView? = null,
    val schemaVersion: String = "1.0",
    val isLegacy: Boolean = false,
    val thesisStatement: String? = null,
    val storyHeader: DeepDiveStoryHeaderView? = null,
    val changeSummary: DeepDiveChangeSummaryView? = null,
    val visualPanels: List<DeepDiveVisualPanelView> = emptyList(),
    val explainers: DeepDiveExplainersView? = null,
    val watchItems: List<String> = emptyList(),
    val coverageTruth: DeepDiveCoverageTruthView? = null,
    val investmentMemo: InvestmentMemoView? = null,
    val dueDiligence: DueDiligenceView? = null,
    val financialAnalysis: FinancialAnalysisView? = null,
    val valueDiscipline: ValueDisciplineView? = null,
    val confidence: ConfidenceDisplayView? = null,
    val signalValue: String?,
    val signalReasons: List<String> = emptyList(),
    val confidenceLabel: String?,
    val confidenceScore: Double?,
    val valuation: ValuationDisplayView? = null,
    val historical: HistoricalDisplayView? = null,
    val trustMetadata: TrustMetadataView? = null,
    val killSwitchConditions: List<KillSwitchConditionView> = emptyList(),
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
