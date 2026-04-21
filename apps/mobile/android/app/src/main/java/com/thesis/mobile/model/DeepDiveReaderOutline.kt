package com.thesis.mobile.model

data class DeepDiveReaderOutline(
    val usesStructuredArtifact: Boolean,
    val memoSections: List<InvestmentMemoSectionView>,
    val financialPanels: List<DeepDiveVisualPanelView>,
    val valuationPanels: List<DeepDiveVisualPanelView>,
    val evidencePanels: List<DeepDiveVisualPanelView>,
    val riskPanels: List<DeepDiveVisualPanelView>,
    val topRisks: List<String>
)

fun DeepDiveReportView.toReaderOutline(): DeepDiveReaderOutline {
    val memoSections = investmentMemo?.sections.orEmpty()
    val topRisks = memoSections
        .firstOrNull { it.sectionId == "risks" }
        ?.keyPoints
        ?.takeIf { it.isNotEmpty() }
        ?: watchItems.take(3)

    return DeepDiveReaderOutline(
        usesStructuredArtifact = investmentMemo != null || financialAnalysis != null || valueDiscipline != null,
        memoSections = memoSections,
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
