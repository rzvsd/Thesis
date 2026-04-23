package com.thesis.mobile.model

data class DeepDiveReaderOutline(
    val usesStructuredArtifact: Boolean,
    val memoSections: List<InvestmentMemoSectionView>,
    val dueDiligenceSections: List<DueDiligenceSectionView>,
    val dueDiligenceEvidenceSections: List<DueDiligenceSectionView>,
    val financialPanels: List<DeepDiveVisualPanelView>,
    val valuationPanels: List<DeepDiveVisualPanelView>,
    val evidencePanels: List<DeepDiveVisualPanelView>,
    val riskPanels: List<DeepDiveVisualPanelView>,
    val topRisks: List<String>
)

private val dueDiligenceSectionOrder = listOf(
    "financial_analysis",
    "competitive_positioning",
    "management_and_governance",
    "risks_and_challenges",
    "growth_opportunities_and_outlook",
    "valuation_and_thesis_stance"
)

fun DeepDiveReportView.toReaderOutline(): DeepDiveReaderOutline {
    val memoSections = investmentMemo?.sections.orEmpty()
    val dueDiligenceSections = dueDiligence?.sections
        .orEmpty()
        .sortedBy { section ->
            dueDiligenceSectionOrder.indexOf(section.sectionId).let { index ->
                if (index >= 0) index else Int.MAX_VALUE
            }
        }
    val topRisks = memoSections
        .firstOrNull { it.sectionId == "risks" }
        ?.keyPoints
        ?.takeIf { it.isNotEmpty() }
        ?: dueDiligenceSections
            .firstOrNull { it.sectionId == "risks_and_challenges" }
            ?.keyPoints
            ?.take(3)
            ?.takeIf { it.isNotEmpty() }
        ?: watchItems.take(3)

    return DeepDiveReaderOutline(
        usesStructuredArtifact = investmentMemo != null || dueDiligence != null || financialAnalysis != null || valueDiscipline != null,
        memoSections = memoSections,
        dueDiligenceSections = dueDiligenceSections,
        dueDiligenceEvidenceSections = dueDiligenceSections.filter { section ->
            section.evidenceRefs.isNotEmpty() ||
                section.omissions.isNotEmpty() ||
                !section.coverageState.equals("full", ignoreCase = true)
        },
        financialPanels = visualPanels.filter { panel ->
            panel is MetricDeltaPanelView || panel.title.contains("margin", ignoreCase = true)
        },
        valuationPanels = visualPanels.filter { panel ->
            panel is RangeBandPanelView || panel is ValuationBridgePanelView || panel is ScenarioComparePanelView
        },
        evidencePanels = visualPanels.filterIsInstance<EvidenceLadderPanelView>(),
        riskPanels = visualPanels.filter { panel ->
            panel is TimelinePanelView || panel.title.contains("risk", ignoreCase = true)
        },
        topRisks = topRisks
    )
}

fun DeepDiveReportView.memoSection(sectionId: String): InvestmentMemoSectionView? =
    investmentMemo?.sections?.firstOrNull { it.sectionId == sectionId }

fun DeepDiveReportView.dueDiligenceSection(sectionId: String): DueDiligenceSectionView? =
    dueDiligence?.sections?.firstOrNull { it.sectionId == sectionId }

fun DeepDiveReportView.readerIssuerName(): String =
    issuer?.name?.takeIf { it.isNotBlank() } ?: ticker ?: "Ticker"

fun DeepDiveReportView.readerIssuerMetadataLine(): String? {
    if (issuer?.name.isNullOrBlank()) {
        return null
    }

    val parts = listOfNotNull(
        ticker?.takeIf { it.isNotBlank() }?.uppercase(),
        issuer?.exchange?.takeIf { it.isNotBlank() }
    )
    return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
}
