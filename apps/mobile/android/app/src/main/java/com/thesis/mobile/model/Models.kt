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

data class ReportNoteView(
    val content: String,
    val updatedAt: String
)

data class ScenarioOverridesView(
    val projectionYears: Int? = null,
    val terminalGrowthRate: Double? = null,
    val wacc: Double? = null
)

data class ScenarioResultView(
    val reportId: String,
    val base: ValuationDisplayView,
    val scenario: ValuationDisplayView
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
    val sections: List<SectionView>
)

data class PulseReportView(
    val reportId: String,
    val generatedAt: String,
    val sections: List<SectionView>
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

data class ReportHistoryItem(
    val reportId: String,
    val jobId: String,
    val type: String,
    val ticker: String?,
    val createdAt: String
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
    val enabled: Boolean
)

data class SubscriptionOfferView(
    val packageType: String,
    val identifier: String,
    val title: String
)
