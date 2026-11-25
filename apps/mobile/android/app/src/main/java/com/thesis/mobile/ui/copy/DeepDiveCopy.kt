package com.thesis.mobile.ui.copy

/**
 * Copy of the classic (native) Deep Dive and the sample report (docs/app-redesign/DESIGN-DIRECTION.md 5.15, 5.16).
 * Sentence case; kickers and eyebrows are set in capitals by their components. Describe, never advise (SPEC rule 6):
 * no ratings, no price goals, no "upside"; the model range is a "model range".
 */
object DeepDiveCopy {
    // ---- Chrome
    const val classicBanner = "Classic view"
    const val openNewView = "Open the new view"
    const val moreTitle = "This report"
    const val exportPdf = "Export PDF"
    const val shareCard = "Share card"
    const val memoPdf = "Memo as PDF"
    const val reportFeedback = "Report feedback"
    const val sampleBadge = "Sample report"
    const val sampleNote =
        "A sample report on Microsoft, built on 8 May 2026 from test data and a test price, so the figures are not current."

    /** The sample's company: the bundled MSFT asset carries the ticker but no issuer name. */
    const val sampleTicker = "MSFT"
    const val sampleIssuer = "Microsoft"
    const val followFirstName = "Follow your first name"
    const val closeSample = "Close sample"
    const val disclaimer = "A research summary built from SEC filings, not financial advice."
    const val loadingSample = "Opening the sample report"
    const val openingReport = "Opening the report"

    // ---- Hero
    const val deepDive = "Deep Dive"
    fun fromFiling(form: String, period: String): String = "$deepDive · from the $form for $period"
    fun fromPeriod(period: String): String = "$deepDive · $period"
    fun evidenceBadge(count: Int): String = if (count == 1) "Evidence 1 source" else "Evidence $count sources"
    fun freshnessBadge(state: String): String = when (state.lowercase()) {
        "fresh" -> "Fresh"
        "degraded" -> "Getting old"
        "stale" -> "Stale"
        else -> "Freshness not known"
    }
    fun confidenceBadge(label: String): String = "Confidence ${label.lowercase()}"
    fun reportDated(date: String): String = "Report of $date"

    // ---- Chapter pills and kickers (pill label = kicker)
    const val chSummary = "Summary"
    const val chFindings = "Findings"
    const val chFiling = "The filing"
    const val chFinancials = "Financials"
    const val chValue = "Price and value"
    const val chRisks = "Risks"
    const val chEvidence = "Evidence"
    const val chReading = "Reading notes"
    const val chDesk = "Your notes"

    // ---- Chapter titles (static fallbacks; the screen prefers a sentence generated from the data)
    const val summaryTitle = "The story in one minute"
    const val findingsTitle = "What the report found"
    const val filingTitle = "What changed in the filing"
    fun filingTitleMoved(label: String, change: String, basis: String): String = "$label $change $basis"
    const val financialsTitle = "Five years of the business"
    fun financialsTitleGrowth(label: String, change: String, from: String): String = "$label $change since $from"
    const val valueTitle = "What the price assumes"
    fun valueTitleRange(low: String, high: String): String = "The model range runs from $low to $high"
    const val risksTitle = "What could change the thesis"
    fun risksTitleCount(n: Int): String = if (n == 1) "One line would change the thesis" else "$n lines would change the thesis"
    const val evidenceTitle = "Where the figures come from"
    fun evidenceTitleCount(n: Int, sections: Int): String =
        if (sections <= 1) "$n sources back this report" else "$n sources across $sections sections"
    const val readingTitle = "How to read the numbers"
    const val deskTitle = "What you think about it"
    const val deskLede = "Your note for this report, the conviction journal and the tools that run on it."

    // ---- Summary
    const val bigQuestion = "The big question"
    const val whyNow = "Why now"
    const val companyAngle = "The company angle"
    const val readerTakeaway = "The upshot"
    const val watchNext = "What to watch next"
    const val sinceLastReport = "Since the last report"
    const val previousReport = "Previous report"
    const val thisReport = "This report"
    const val memoKicker = "The memo"

    // ---- Filing chapter
    const val theGood = "The good"
    const val theBad = "The bad"
    const val changesTitle = "Every line that moved"
    // Segment labels: short enough for three segments at 360 dp ("On the quarter" was cut to "On the").
    const val basisYear = "Year ago"
    const val basisQuarter = "Last quarter"
    const val basisFiscal = "Fiscal year"
    fun vsPeriod(period: String): String = "vs $period"
    const val changeHeader = "Change"
    const val filingSource = "SEC filing data"

    // ---- Financials chapter
    const val fiveYearSubtitleRevenue = "Revenue and free cash flow, fiscal years"
    const val fiveYearSubtitleMargins = "% of revenue, fiscal years"
    const val fiveYearSubtitleRevenueSelected = "Revenue and free cash flow, selected fiscal years"
    const val fiveYearSubtitleMarginsSelected = "% of revenue, selected fiscal years"
    const val marginsTitle = "Margins over the same years"
    fun marginsTitleMove(label: String, change: String): String = "$label $change over the period"
    const val incomeStatement = "Income statement"
    const val fiscalYear = "Fiscal year"
    const val revenue = "Revenue"
    const val freeCashFlow = "Free cash flow"
    const val netIncome = "Net income"
    const val grossMargin = "Gross margin"
    const val operatingMargin = "Operating margin"
    const val trendMetrics = "Trends"
    const val qualityMetrics = "Quality"
    const val keyIndicators = "Key indicators"
    const val businessQuality = "Business quality"
    const val cashFlow = "Cash flow"
    const val balanceSheet = "Balance sheet"
    const val fiveYearRead = "The five-year read"
    const val omitted = "Left out of this report"
    const val deltasTitle = "Changes the report tracks"
    const val now = "Now"
    const val before = "Before"
    fun basisLabel(basis: String): String = when (basis.lowercase()) {
        "yoy" -> "on the year"
        "qoq" -> "on the quarter"
        else -> "change"
    }

    // ---- Value chapter
    const val modelRange = "Model range"
    /** The range chart's caption (its subtitle); the title is generated from where the price sits. */
    const val modelRangeCaption = "Bear to bull model range"
    fun rangeTitleVsBase(pct: String, above: Boolean): String =
        "Price in report is $pct ${if (above) "above" else "below"} the model's base case"
    const val rangeTitleAtBase = "Price in report sits at the model's base case"
    const val rangeTitleBelowBear = "Price in report sits below the bear case"
    const val rangeTitleAboveBull = "Price in report sits above the bull case"
    const val rangeTitleInside = "Price in report sits inside the model range"
    fun rangeTitleBase(base: String): String = "The model's base case is $base"
    const val priceInReport = "Price in report"
    fun modelRangeSubtitle(years: Int?, growth: String?, wacc: String?): String = listOfNotNull(
        years?.let { "Discounted cash flow over $it years" } ?: "Discounted cash flow",
        growth?.let { "terminal growth $it" },
        wacc?.let { "discount rate $it" },
    ).joinToString(", ")
    const val valuationSource = "Thesis model on SEC filings"
    const val noPriceStored = "No price is stored with this report, so the range is shown without a price marker."
    const val valueLens = "Value lens"
    fun classification(label: String, confidence: String?): String =
        if (confidence.isNullOrBlank()) label else "$label, ${confidence.lowercase()} confidence"
    const val trapWarning = "Value trap warning"
    const val discipline = "Value discipline"
    fun disciplineTitle(score: Int, max: Int): String = "$score of $max value checks pass"
    const val doesNotProve = "What this does not prove"
    const val valuationIndicators = "Multiples"

    // ---- What-if
    const val whatIfKicker = "What if"
    const val whatIfTitle = "Change the model's assumptions"
    const val whatIfDeck = "Run the same model with your own inputs. Nothing you type changes the report."
    const val projectionYears = "Projection years"
    const val years = "years"
    const val terminalGrowth = "Terminal growth"
    const val discountRate = "Discount rate (WACC)"
    const val runScenario = "Run the model"
    const val running = "Running"
    const val proOnlyWhatIf = "Running the model with your own inputs is part of Thesis Pro."
    const val noValuation = "This report has no model valuation, so there is nothing to rerun."
    const val errYears = "Use a whole number of years from 1 to 30."
    const val errPercent = "Use a percent, for example 2.5."
    const val errWaccAboveGrowth = "The discount rate has to be above terminal growth."
    const val modelValue = "Model value"
    /** Under the price in report: how far your model value sits from it ("Your value +3.9%"). */
    fun yourValueGap(change: String): String = "Your value $change"
    const val baseCase = "Report's model"
    const val yourInputs = "Your inputs"
    const val modelResultTitle = "Your inputs move the model value"
    /** The model's name in words ("dcf_v2" is "Discounted cash flow model"); null for a model key we do not know. */
    fun modelName(model: String): String? {
        val key = model.trim().lowercase()
        val words = when {
            key.startsWith("reverse_dcf") -> "Reverse discounted cash flow"
            key.startsWith("dcf") -> "Discounted cash flow"
            key.startsWith("ddm") -> "Dividend discount"
            key.startsWith("multiples") || key.startsWith("comps") -> "Trading multiples"
            else -> return null
        }
        return "$words model"
    }
    const val leftOut = "Left out"

    // ---- Risks
    const val killSwitches = "Kill switches"
    const val topRisks = "Top risks"
    fun threshold(text: String): String = "Line: $text"

    // ---- Evidence
    const val evidenceSource = "Sources cited in the report"
    const val sourcesPerSection = "Sources per section"
    fun mostSources(section: String): String = "$section has the most sources"
    fun sourcesCount(n: Int): String = if (n == 1) "1 source" else "$n sources"
    const val openSources = "Sources you can open"
    fun showAllSources(n: Int): String = "Show all $n"
    const val showFewer = "Show fewer"
    const val claims = "Claims and what supports them"
    const val unsupportedClaims = "Claims without a source"
    const val missingData = "Missing data"
    const val contradictions = "Contradictions"
    const val sectionsTitle = "The report's sections"
    fun supportLine(type: String, summary: String): String = "${type.replace('_', ' ').replaceFirstChar { it.uppercase() }}: $summary"
    const val coverage = "What the report covers"
    const val covered = "Covered"
    const val missing = "Missing"
    const val dueDiligence = "Due diligence"
    const val readFull = "Read the full section"
    const val hideFull = "Hide the full section"
    const val howToRead = "How to read this report"
    const val reportChecks = "Report checks"
    const val checkFreshness = "Freshness"
    const val checkContradictions = "Contradictions"
    const val checkValuation = "Valuation"
    const val checkEvidence = "Evidence"
    const val noSectionSummary = "This section came back without a summary."
    fun coverageState(state: String): String = when (state.lowercase()) {
        "full" -> "Full coverage"
        "partial" -> "Partial coverage"
        "limited" -> "Limited coverage"
        else -> state.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
    fun sectionStatus(status: String?): String = when (status?.lowercase()) {
        "complete" -> "Complete"
        "partial" -> "Partial"
        "failed" -> "Not computed"
        null, "" -> "Status not known"
        else -> status.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }

    // ---- Notes, quotes, tools
    const val addToNote = "Add to note"
    const val copyParagraph = "Copy paragraph"
    const val addedToNote = "Added to your note."
    const val copied = "Copied."
    const val quoteSheetTitle = "This paragraph"
    const val noteSavedPrefix = "Saved"
    const val stressAction = "Stress this name"
    const val stressCaption = "Scenario Stress runs market scenarios against this name and your list."
    const val feedbackTitle = "Was this report useful?"
    const val feedbackDeck = "Pick what fits; a line of detail helps."
    const val feedbackDetails = "Details (optional)"
    const val send = "Send"
    const val sent = "Sent. Thank you."
    const val exportTitle = "Export"
    const val exportPdfCaption = "The full report as a PDF"
    const val shareCardCaption = "A one-page image for messages"
    const val memoCaption = "The memo text as a PDF"
    const val exportFailed = "Export failed."
    val feedbackOptions: List<Pair<String, String>> = listOf(
        "useful" to "Useful",
        "confusing" to "Confusing",
        "generic" to "Too generic",
        "stale" to "Out of date",
        "bug_report" to "Something is wrong",
    )
    // ---- Conviction and coherence (sentence case; Phase4Copy stays for the screens that still use it)
    const val convictionKicker = "Conviction"
    const val convictionTitle = "What you believed and what changed"
    const val convictionDeck = "Your journal for this name and the strongest case against the thesis."
    const val journalTitle = "Journal"
    const val journalEmpty = "Nothing is in the journal for this name yet."
    const val refresh = "Refresh"
    const val oppositeTitle = "The opposite case"
    const val oppositeEmpty = "Build the strongest case against this thesis from the same evidence."
    const val oppositeBuild = "Build the opposite case"
    const val oppositeBuilding = "Building the opposite case"
    const val decisiveFactors = "Decisive factors"
    const val convictionPro = "The conviction journal and the opposite case are part of Thesis Pro."

    /** The page's one Pro upsell when the what-if model would also be locked (5.15 "Pro upsell once"). */
    const val deskPro = "The what-if model, the conviction journal and the opposite case are part of Thesis Pro."
    const val seePro = "See Thesis Pro"
    const val coherenceKicker = "Coherence"
    const val coherenceTitle = "Monthly coherence"
    const val coherenceDeck = "Patterns across your names: overlap, contradiction and conviction mismatch."
    const val coherenceEmpty = "No monthly coherence card has been built yet."
    const val coherencePro = "Monthly coherence is part of Thesis Pro."
    const val refreshCoherence = "Refresh coherence"
    /** A period whose dates did not parse, shown as sent (the caption under a coherence card's title). */
    fun periodRange(start: String, end: String): String = "$start to $end"
    fun eventLabel(type: String): String = when (type.lowercase()) {
        "kill_switch_alert_fired" -> "Kill switch fired"
        "freshness_decay_alert_fired" -> "Report getting old"
        "opposite_case_generated" -> "Opposite case built"
        "cross_name_alert_fired" -> "Alert across names"
        "report_generated", "deep_dive_generated" -> "Report built"
        "note_updated" -> "Note updated"
        else -> type.replace('_', ' ').trim().lowercase().replaceFirstChar { it.uppercase() }
    }
    fun findingLabel(type: String): String = when (type.lowercase()) {
        "contradiction" -> "Contradiction"
        "overlap" -> "Overlap"
        "mismatch" -> "Conviction mismatch"
        else -> type.replace('_', ' ').trim().lowercase().replaceFirstChar { it.uppercase() }
    }

    // ---- Failed and loading states
    const val noLongerRunning = "This Deep Dive is no longer running."
    const val sampleFailed = "The sample report did not open."
}
