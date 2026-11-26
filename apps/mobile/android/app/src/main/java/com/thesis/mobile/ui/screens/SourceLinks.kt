package com.thesis.mobile.ui.screens

import com.thesis.mobile.ui.components.SourceInfo

/**
 * The sheet's evidence links close the sheet before they open, so a report opened from a source sheet does not
 * leave the sheet showing when the reader comes back.
 */
internal fun SourceInfo.closingOnOpen(close: () -> Unit): SourceInfo =
    if (evidence.isEmpty()) this else copy(evidence = evidence.map { link -> link.copy(onOpen = { close(); link.onOpen() }) })
