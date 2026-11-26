package com.thesis.mobile.ui.screens.report

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ExportPaginationTest {
    private val top = 64f
    private val bottom = 774f

    private fun lines(count: Int, height: Float = 15f) = List(count) { (it + 1) * height }

    private fun assertEveryLineOnce(blocks: List<ExportBlock>, pages: List<List<ExportSlice>>) {
        blocks.forEachIndexed { index, block ->
            val covered = pages.flatten().filter { it.block == index }.flatMap { it.fromLine until it.toLine }
            assertEquals("block $index", (0 until block.lineBottoms.size).toList(), covered)
        }
    }

    private fun assertInsidePages(blocks: List<ExportBlock>, pages: List<List<ExportSlice>>) {
        pages.flatten().forEach { slice ->
            val block = blocks[slice.block]
            val height = block.lineBottoms[slice.toLine - 1] - block.lineTop(slice.fromLine)
            assertTrue("slice $slice ends below the page", slice.y + height <= bottom + 0.01f)
            assertTrue(slice.y >= top)
        }
    }

    @Test
    fun aLongReportRunsOverSeveralPagesWithNothingDropped() {
        val blocks = List(13) { listOf(ExportBlock(lines(1, 20f), 26f, keepWithNext = true), ExportBlock(lines(40), 8f)) }.flatten()
        val pages = ExportPagination.paginate(blocks, top, top, bottom)
        assertTrue(pages.size > 5)
        assertEveryLineOnce(blocks, pages)
        assertInsidePages(blocks, pages)
    }

    @Test
    fun aHeadingMovesWithItsFirstLine() {
        val filler = ExportBlock(lines(46))
        val heading = ExportBlock(lines(1, 20f), 26f, keepWithNext = true)
        val body = ExportBlock(lines(10), 8f)
        val pages = ExportPagination.paginate(listOf(filler, heading, body), top, top, bottom)
        val headingPage = pages.indexOfFirst { page -> page.any { it.block == 1 } }
        val bodyPage = pages.indexOfFirst { page -> page.any { it.block == 2 } }
        assertEquals(headingPage, bodyPage)
        assertEquals(1, headingPage)
        assertEquals(top, pages[1].first().y)
    }

    @Test
    fun spaceAboveIsDroppedAtThePageTop() {
        val pages = ExportPagination.paginate(listOf(ExportBlock(lines(3), 40f)), top, top, bottom)
        assertEquals(top, pages.single().single().y)
    }

    @Test
    fun aLineTallerThanAPageIsStillPlaced() {
        val blocks = listOf(ExportBlock(lines(2)), ExportBlock(listOf(2000f)), ExportBlock(lines(2)))
        val pages = ExportPagination.paginate(blocks, top, top, bottom)
        assertEveryLineOnce(blocks, pages)
        assertEquals(3, pages.size)
    }

    @Test
    fun emptyInputGivesOneEmptyPage() {
        assertEquals(listOf(emptyList<ExportSlice>()), ExportPagination.paginate(emptyList(), top, top, bottom))
    }
}
