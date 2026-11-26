package com.thesis.mobile.ui.screens.report

/*
 * Page breaks for the exported PDF (docs/app-redesign/DESIGN-DIRECTION.md 5.24: real pagination, nothing dropped at
 * the foot of a page). ReportExport.kt lays every block out once (android.text.StaticLayout) and hands the line
 * bottoms here; this decides where each run of lines goes. Pure, so the JVM tests cover it.
 */

/**
 * One block of the document as laid out: the bottom of each line, measured from the block's top (so the last
 * entry is the block's height), the space above it, and whether it must start on the same page as the next block's
 * first line (a heading).
 */
data class ExportBlock(
    val lineBottoms: List<Float>,
    val spaceBefore: Float = 0f,
    val keepWithNext: Boolean = false,
) {
    val height: Float get() = lineBottoms.lastOrNull() ?: 0f

    /** Top of line [line], from the block's top. */
    fun lineTop(line: Int): Float = if (line <= 0) 0f else lineBottoms[line - 1]
}

/** Lines [fromLine] until [toLine] (exclusive) of block [block], drawn with their top at [y] on the page. */
data class ExportSlice(val block: Int, val fromLine: Int, val toLine: Int, val y: Float)

object ExportPagination {
    /**
     * Splits [blocks] into pages: the first page starts at [firstPageTop], the others at [pageTop], and no line ends
     * below [pageBottom]. A block that does not fit continues on the next page at a line boundary; a heading
     * ([ExportBlock.keepWithNext]) moves to the next page with the first line that follows it. The space above a
     * block is dropped at the top of a page. A single line taller than a whole page is placed alone, never lost.
     */
    fun paginate(
        blocks: List<ExportBlock>,
        firstPageTop: Float,
        pageTop: Float,
        pageBottom: Float,
    ): List<List<ExportSlice>> {
        val pages = mutableListOf(mutableListOf<ExportSlice>())
        var y = firstPageTop

        fun newPage() {
            pages += mutableListOf<ExportSlice>()
            y = pageTop
        }

        blocks.forEachIndexed { index, block ->
            val lines = block.lineBottoms.size
            if (lines == 0) return@forEachIndexed
            if (block.keepWithNext && pages.last().isNotEmpty()) {
                val next = blocks.drop(index + 1).firstOrNull { it.lineBottoms.isNotEmpty() }
                val withNext = block.spaceBefore + block.height +
                    (next?.let { it.spaceBefore + it.lineBottoms.first() } ?: 0f)
                if (y + withNext > pageBottom) newPage()
            }
            if (pages.last().isNotEmpty()) y += block.spaceBefore
            var from = 0
            while (from < lines) {
                val offset = block.lineTop(from)
                var to = from
                while (to < lines && y + (block.lineBottoms[to] - offset) <= pageBottom) to++
                if (to == from) {
                    if (pages.last().isNotEmpty()) {
                        newPage()
                        continue
                    }
                    to = from + 1
                }
                pages.last() += ExportSlice(index, from, to, y)
                y += block.lineBottoms[to - 1] - offset
                from = to
                if (from < lines) newPage()
            }
        }
        return pages.filter { it.isNotEmpty() }.ifEmpty { listOf(emptyList()) }
    }
}
