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
    val title: String,
    val body: String,
    val status: String? = null,
    val evidence: List<EvidenceView> = emptyList()
)

data class DeepDiveReportView(
    val reportId: String,
    val ticker: String?,
    val signalValue: String?,
    val confidenceLabel: String?,
    val confidenceScore: Double?,
    val sections: List<SectionView>
)

data class PulseReportView(
    val reportId: String,
    val generatedAt: String,
    val sections: List<SectionView>
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

data class SubscriptionOfferView(
    val packageType: String,
    val identifier: String,
    val title: String
)
