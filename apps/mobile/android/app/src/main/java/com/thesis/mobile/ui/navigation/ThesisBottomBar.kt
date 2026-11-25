package com.thesis.mobile.ui.navigation

import com.thesis.mobile.ui.components.BottomBarItem
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.icons.ThesisIcons

/**
 * The four tabs (DESIGN-DIRECTION 5.5) for the kit's `ThesisBottomBar` (3 #4): Today, Names, Research, Inbox,
 * keyed by [ShellTab] name. You opens from the top bar avatar. One meaning per glyph (2.8): Today `today` (the
 * newspaper is Pulse's), Names `format_list_bulleted`, Research `manage_search` (the magnifier is the top bar's
 * Search), Inbox `inbox`; the FILL 1 glyph and ink mark the selected tab, outlined and muted the others.
 * `NamesFilled` and `ResearchFilled` have no FILL 1 shape, so for those two the ink label carries selection.
 */
fun shellNavItems(inboxHasNew: Boolean): List<BottomBarItem> = listOf(
    BottomBarItem(ShellTab.Today.name, Phase4Copy.todayTab, ThesisIcons.Today, ThesisIcons.TodayFilled),
    BottomBarItem(ShellTab.Names.name, Phase4Copy.namesTab, ThesisIcons.Names, ThesisIcons.NamesFilled),
    BottomBarItem(ShellTab.Research.name, Phase4Copy.researchTab, ThesisIcons.Research, ThesisIcons.ResearchFilled),
    BottomBarItem(
        ShellTab.Inbox.name,
        Phase4Copy.inboxTab,
        ThesisIcons.Inbox,
        ThesisIcons.InboxFilled,
        hasNew = inboxHasNew
    ),
)
