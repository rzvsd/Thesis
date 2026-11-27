package com.thesis.mobile.ui.components

import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.theme.Tone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

/** Pure-model tests for the kit: CompareTable TSV, RowPosition, Loadable, SourceInfo, kit copy. */
class KitModelTest {

    private val model = CompareTableModel(
        columns = listOf(
            CompareColumn("FY Sep-25", "10-K · 31 Oct 2025", subject = true),
            CompareColumn("FY Sep-24", "10-K · 1 Nov 2024"),
        ),
        rows = listOf(
            CompareRow("Revenue", listOf("391.0", "383.3"), unit = "\$bn", delta = "+2.0%", deltaTone = Tone.Favourable),
            CompareRow("Gross\tmargin", listOf("46.2", "45.8"), unit = "%", delta = null),
        ),
        labelHeader = "Metric",
        deltaHeader = "Change",
    )

    @Test
    fun tsvHasHeaderFilingAndRowsWithTabsAndNewlines() {
        val expected = listOf(
            "Metric\tFY Sep-25\tFY Sep-24\tChange",
            "\t10-K · 31 Oct 2025\t10-K · 1 Nov 2024\t",
            "Revenue, \$bn\t391.0\t383.3\t+2.0%",
            "Gross margin, %\t46.2\t45.8\t",
        ).joinToString("\n")
        assertEquals(expected, model.toTsv())
    }

    @Test
    fun tsvWithoutFilingsOrDeltaHasOnlyPeriodHeader() {
        val plain = CompareTableModel(
            columns = listOf(CompareColumn("AAPL"), CompareColumn("MSFT")),
            rows = listOf(CompareRow("P/E", listOf("31.2", "35.0"))),
        )
        assertEquals("\tAAPL\tMSFT\nP/E\t31.2\t35.0", plain.toTsv())
    }

    @Test
    fun describeReadsTheWholeRow() {
        assertEquals(
            "Revenue, \$bn: FY Sep-25 391.0, FY Sep-24 383.3, Change +2.0%",
            model.describe(model.rows[0]),
        )
    }

    @Test
    fun aShownLabelKeepsItsUnitWithItsLastWordAndTheTsvKeepsPlainSpaces() {
        assertEquals("Revenue,\u00A0\$bn", model.labelShown(model.rows[0]))
        assertEquals("Revenue, \$bn", model.labelOf(model.rows[0]))
    }

    @Test
    fun aFilingLineWrapsAtItsSeparatorWhichGoes() {
        // Every character 1 px: "10-K · 31 Oct 2025" wraps to "10-K" over "31 Oct 2025", 11 px, the separator gone.
        val needs = compareTableNeeds(model, null) { text, _ -> text.split('\n').maxOf { it.length } }
        assertEquals(11, needs.headerWrap[0])
    }

    @Test
    fun aTightFitWrapsHeadersWhenThatKeepsMoreLabelsOnOneLine() {
        // A status header (60 px whole, 30 px wrapped) over an empty column; three labels 60 px whole, 30 px wrapped.
        fun needs(label: Int) = CompareTableNeeds(
            labelWide = label,
            labelWord = 30,
            valueWide = listOf(20, 0),
            headerLine = listOf(20, 60),
            headerWrap = listOf(20, 30),
            headerWord = listOf(20, 20),
            labelLines = listOf(label, label, label),
        )
        val tight = listOf(CompareTableDensity(padding = 0, columnMin = 0, wrapHeaders = true))
        // Whole headers leave 40 px to the labels (all three wrap); the wrapped header leaves 70 (none wraps).
        val wrapped = fitCompareTable(needs(60), 120, tight, tight[0])
        assertEquals(60, wrapped.labelWidth)
        assertEquals(listOf(25, 35), wrapped.columnWidths)
        // When the wrap saves no label row, the header stays whole.
        val whole = fitCompareTable(needs(30), 120, tight, tight[0])
        assertEquals(30, whole.labelWidth)
        assertEquals(listOf(25, 65), whole.columnWidths)
    }

    @Test
    fun modelRejectsRaggedRowsAndTooManyColumns() {
        assertThrows(IllegalArgumentException::class.java) {
            CompareTableModel(listOf(CompareColumn("A")), listOf(CompareRow("x", listOf("1", "2"))))
        }
        assertThrows(IllegalArgumentException::class.java) {
            CompareTableModel((1..5).map { CompareColumn("C$it") }, emptyList())
        }
    }

    @Test
    fun rowPositionOfIndex() {
        assertEquals(RowPosition.Only, RowPosition.of(0, 1))
        assertEquals(RowPosition.First, RowPosition.of(0, 3))
        assertEquals(RowPosition.Middle, RowPosition.of(1, 3))
        assertEquals(RowPosition.Last, RowPosition.of(2, 3))
        assertEquals(RowPosition.First, RowPosition.of(0, 2))
        assertEquals(RowPosition.Last, RowPosition.of(1, 2))
    }

    @Test
    fun loadableKindAndValue() {
        assertEquals(LoadableKind.Loading, Loadable.Loading.kind)
        assertEquals(LoadableKind.Empty, Loadable.Empty().kind)
        assertEquals(LoadableKind.Failed, Loadable.Failed("x").kind)
        assertEquals(LoadableKind.Ready, Loadable.Ready(1).kind)
        assertEquals(3, Loadable.Ready(3).valueOrNull())
        assertNull((Loadable.Loading as Loadable<Int>).valueOrNull())
    }

    @Test
    fun sourceLineJoinsWhatIsKnown() {
        assertEquals("10-K · FY2025 · filed 31 Oct 2025", SourceInfo("m", form = "10-K", period = "FY2025", filed = "31 Oct 2025").sourceLine)
        assertEquals("10-Q", SourceInfo("m", form = "10-Q").sourceLine)
        assertNull(SourceInfo("m").sourceLine)
    }

    @Test
    fun errorTitleUsesSpecWordingAndTypographicApostrophe() {
        assertEquals("Couldn\u2019t load your names", KitCopy.couldNotLoad("your names"))
        assertEquals("Couldn\u2019t load this", KitCopy.couldNotLoad())
        assertEquals("Couldn\u2019t load this", KitCopy.couldNotLoad(" "))
        assertEquals("Try again", KitCopy.TRY_AGAIN)
    }
}
