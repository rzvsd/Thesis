package com.thesis.mobile.ui.shell

import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.BriefingContextView
import com.thesis.mobile.ui.navigation.DeepLinkRouter
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.LaunchTarget
import com.thesis.mobile.ui.navigation.RouteAction
import com.thesis.mobile.ui.navigation.ShellTab
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppNavigatorTest {

    private fun destinations(nav: AppNavigator, tab: ShellTab) = nav.stack(tab).map { it.destination }

    @Test
    fun startsOnTodayWithEveryTabAtItsRoot() {
        val nav = AppNavigator()
        assertEquals(ShellTab.Today, nav.currentTab)
        ShellTab.entries.forEach { assertEquals(listOf(it.root), destinations(nav, it)) }
        assertTrue(nav.modalStack.isEmpty())
        assertFalse(nav.canGoBack)
    }

    @Test
    fun pushAndPopStayInTheCurrentTab() {
        val nav = AppNavigator()
        nav.push(Destination.Pulse())
        nav.push(Destination.MacroStress)
        assertEquals(Destination.MacroStress, nav.top.destination)
        assertEquals(listOf(Destination.Today, Destination.Pulse(), Destination.MacroStress), destinations(nav, ShellTab.Today))
        assertEquals(Destination.MacroStress, nav.pop()?.destination)
        assertEquals(Destination.Pulse(), nav.top.destination)
        assertEquals(Destination.Pulse(), nav.pop()?.destination)
        assertNull("a tab root is never popped", nav.pop())
    }

    @Test
    fun entryIdsAreUnique() {
        val nav = AppNavigator()
        val ids = (1..5).map { nav.push(Destination.Name("T$it")).entryId } +
            ShellTab.entries.map { nav.stack(it).first().entryId }
        assertEquals(ids.size, ids.toSet().size)
        // The same destination pushed twice is two entries (Name(AAPL) -> Name(MSFT) -> Name(AAPL)).
        val a = nav.push(Destination.Name("AAPL"))
        val b = nav.push(Destination.Name("AAPL"))
        assertTrue(a.entryId != b.entryId)
    }

    @Test
    fun switchTabKeepsEachTabsSubStack() {
        val nav = AppNavigator()
        nav.push(Destination.Pulse())
        nav.switchTab(ShellTab.Research)
        nav.push(Destination.History())
        nav.switchTab(ShellTab.Today)
        assertEquals(Destination.Pulse(), nav.top.destination)
        nav.switchTab(ShellTab.Research)
        assertEquals(Destination.History(), nav.top.destination)
    }

    @Test
    fun reselectingTheShowingTabReturnsToItsRoot() {
        val nav = AppNavigator()
        nav.selectTab(ShellTab.Research)
        nav.push(Destination.History())
        nav.push(Destination.Report("r1"))
        assertFalse("same tab: not a change", nav.selectTab(ShellTab.Research))
        assertEquals(listOf(Destination.Research), destinations(nav, ShellTab.Research))
    }

    @Test
    fun selectingATabClosesModalsAndClearsNamesFocus() {
        val nav = AppNavigator()
        nav.apply(DeepLinkRouter.route(LaunchTarget(tab = "names", ticker = "aapl"))!!)
        assertEquals("AAPL", nav.namesFocusTicker)
        nav.openModal(Destination.You)
        assertNull("no tab selected while You is open", nav.selectedTab)
        assertTrue(nav.selectTab(ShellTab.Today))
        assertTrue(nav.modalStack.isEmpty())
        nav.selectTab(ShellTab.Names)
        assertNull(nav.namesFocusTicker)
    }

    @Test
    fun backPopsModalThenTabStackThenGoesToTodayThenStops() {
        val nav = AppNavigator()
        nav.switchTab(ShellTab.Research)
        nav.push(Destination.History())
        nav.openModal(Destination.You)
        nav.push(Destination.YouPage("appearance"))
        val popped = mutableListOf<Destination>()

        assertTrue(nav.back { popped += it.destination }) // YouPage
        assertTrue(nav.back { popped += it.destination }) // You
        assertTrue(nav.modalStack.isEmpty())
        assertTrue(nav.back { popped += it.destination }) // History
        assertEquals(Destination.Research, nav.top.destination)
        assertTrue("at a non-Today root, back goes to Today", nav.back { popped += it.destination })
        assertEquals(ShellTab.Today, nav.currentTab)
        assertFalse(nav.canGoBack)
        assertFalse("at Today's root the system handles back", nav.back { popped += it.destination })
        assertEquals(
            listOf(Destination.YouPage("appearance"), Destination.You, Destination.History()),
            popped
        )
    }

    @Test
    fun backNeverExitsFromASubScreen() {
        // Any push in any tab: back must be handled until Today's root.
        ShellTab.entries.forEach { tab ->
            val nav = AppNavigator()
            nav.selectTab(tab)
            nav.push(Destination.Pulse("2026-11-20"))
            nav.push(Destination.Report("r"))
            var presses = 0
            while (nav.back()) presses++
            assertEquals(ShellTab.Today, nav.currentTab)
            assertEquals(listOf(Destination.Today), destinations(nav, ShellTab.Today))
            assertEquals(if (tab == ShellTab.Today) 2 else 3, presses)
        }
    }

    @Test
    fun replaceTopSwapsTheRunningBuildForItsReport() {
        val nav = AppNavigator()
        nav.switchTab(ShellTab.Research)
        val running = nav.push(Destination.DeepDiveRunning("AAPL"))
        val report = nav.replaceTop(Destination.Report("rep_9", "AAPL"))!!
        assertEquals(listOf(Destination.Research, Destination.Report("rep_9", "AAPL")), destinations(nav, ShellTab.Research))
        assertTrue(running.entryId != report.entryId)
        assertNull("a root is never replaced", AppNavigator().replaceTop(Destination.Pulse()))
    }

    @Test
    fun historyBackNeverLoopsToDeepDive() {
        // Research -> History -> Report -> back -> back lands on the Research root, not on the report again.
        val nav = AppNavigator()
        nav.switchTab(ShellTab.Research)
        nav.push(Destination.History())
        nav.push(Destination.Report("rep_1"))
        nav.back()
        assertEquals(Destination.History(), nav.top.destination)
        nav.back()
        assertEquals(Destination.Research, nav.top.destination)
    }

    // ---- Deep links and notification routes (5.5: unchanged destinations)

    @Test
    fun todayLinkLoadsThePulseAndOpensTheDigestWhenAsked() {
        val plain = DeepLinkRouter.route(LaunchTarget(tab = "today", pulseDate = "2026-11-20", notificationType = "market_pulse_ready"))!!
        assertEquals(ShellTab.Today, plain.tab)
        assertNull(plain.push)
        assertEquals(
            listOf(RouteAction.OpenPulse("2026-11-20"), RouteAction.TrackLanded("today")),
            plain.actions
        )

        val digest = DeepLinkRouter.route(LaunchTarget(tab = "today", notificationType = "weekly_digest", digestDate = "2026-11-23"))!!
        assertEquals(Destination.WeeklyDigest("2026-11-23"), digest.push)
        assertTrue(RouteAction.OpenWeeklyDigest(fromPush = true) in digest.actions)

        val nav = AppNavigator()
        nav.push(Destination.MacroStress)
        nav.apply(digest)
        assertEquals(listOf(Destination.Today, Destination.WeeklyDigest("2026-11-23")), destinations(nav, ShellTab.Today))
    }

    @Test
    fun researchLinksPushTheRightScreen() {
        fun push(target: LaunchTarget) = DeepLinkRouter.route(target)!!.push
        assertEquals(Destination.WarRoom("wr_1"), push(LaunchTarget(tab = "research", warRoomId = "wr_1", ticker = "AAPL")))
        assertEquals(Destination.WarRoom(null), push(LaunchTarget(tab = "research", notificationType = "earnings_war_room")))
        assertEquals(
            Destination.ScenarioStress(runId = "sr_1", scenarioId = "rates"),
            push(LaunchTarget(tab = "research", scenarioRunId = "sr_1", scenarioId = "rates"))
        )
        assertEquals(Destination.ScenarioStress(scenarioId = "rates"), push(LaunchTarget(tab = "research", scenarioId = "rates")))
        assertEquals(Destination.Report("rep_1", "MSFT"), push(LaunchTarget(tab = "research", reportId = "rep_1", ticker = "msft")))
        assertEquals(Destination.DeepDiveRunning("NVDA"), push(LaunchTarget(tab = "research", ticker = " nvda ")))
        assertNull(push(LaunchTarget(tab = "research")))

        val warRoomTyped = DeepLinkRouter.route(
            LaunchTarget(tab = "research", notificationType = "earnings_war_room", ticker = "aapl")
        )!!
        assertEquals(
            "a War Room notification selects the ticker but never builds a report",
            listOf(RouteAction.SelectTicker("AAPL"), RouteAction.TrackLanded("research")),
            warRoomTyped.actions
        )
    }

    @Test
    fun youLinkOpensTheModalStackAndUnknownTabsAreIgnored() {
        val nav = AppNavigator()
        nav.apply(DeepLinkRouter.route(LaunchTarget(tab = "you"))!!)
        assertEquals(Destination.You, nav.top.destination)
        assertEquals(ShellTab.Today, nav.currentTab)
        nav.apply(DeepLinkRouter.route(LaunchTarget(tab = "you"))!!)
        assertEquals("not opened twice", 1, nav.modalStack.size)
        assertNull(DeepLinkRouter.route(LaunchTarget(tab = "elsewhere")))
    }

    @Test
    fun aTabLinkClosesModalsSoTheDestinationShows() {
        val nav = AppNavigator()
        nav.openModal(Destination.You)
        nav.apply(DeepLinkRouter.route(LaunchTarget(tab = "inbox"))!!)
        assertTrue(nav.modalStack.isEmpty())
        assertEquals(ShellTab.Inbox, nav.currentTab)
    }

    @Test
    fun alertRoutesKeepTheirDestinations() {
        fun alert(route: String, block: (AlertLedgerItemView) -> AlertLedgerItemView = { it }) = block(
            AlertLedgerItemView(
                id = "a1", notificationType = "kill_switch", category = "thesis_drift", route = route,
                title = "t", body = "b", reasonCode = "r", reasonText = "", deliveryState = "sent",
                createdAt = "2026-11-24T07:00:00Z", updatedAt = "2026-11-24T07:00:00Z"
            )
        )
        val names = DeepLinkRouter.routeAlert(alert("names") { it.copy(relatedTickers = listOf(" msft ")) })
        assertEquals(ShellTab.Names, names.tab)
        assertEquals("MSFT", names.namesFocusTicker)

        val report = DeepLinkRouter.routeAlert(alert("research") { it.copy(reportId = "rep_2", ticker = "aapl") })
        assertEquals(Destination.Report("rep_2", "AAPL"), report.push)
        assertEquals(listOf(RouteAction.OpenReport("rep_2")), report.actions)

        val warRoom = DeepLinkRouter.routeAlert(alert("research") { it.copy(warRoomId = "wr_2", reportId = "rep_2") })
        assertEquals(Destination.WarRoom("wr_2"), warRoom.push)

        val digest = DeepLinkRouter.routeAlert(alert("today") { it.copy(digestDate = "2026-11-23") })
        assertEquals(Destination.WeeklyDigest("2026-11-23"), digest.push)
        assertEquals(listOf(RouteAction.OpenWeeklyDigest(fromPush = false)), digest.actions)

        val pulse = DeepLinkRouter.routeAlert(alert("today") { it.copy(pulseDate = "2026-11-21") })
        assertNull(pulse.push)
        assertEquals(listOf(RouteAction.OpenPulse("2026-11-21")), pulse.actions)

        assertEquals(Destination.You, DeepLinkRouter.routeAlert(alert("you")).modal)
        assertEquals(ShellTab.Inbox, DeepLinkRouter.routeAlert(alert("something_new")).tab)
        // Inbox hides "Open" where the route only lands back on the Inbox root (5.5).
        assertFalse(DeepLinkRouter.alertHasDestination(alert("something_new")))
        assertFalse(DeepLinkRouter.alertHasDestination(alert("inbox")))
        assertTrue(DeepLinkRouter.alertHasDestination(alert("you")))
        assertTrue(DeepLinkRouter.alertHasDestination(alert("names")))
        assertTrue(DeepLinkRouter.alertHasDestination(alert("research") { it.copy(reportId = "rep_2") }))

        val briefing = DeepLinkRouter.routeAlert(
            alert("inbox") {
                it.copy(
                    notificationType = "morning_exception_briefing",
                    briefingContext = BriefingContextView(leadRoute = "Research", leadTicker = "amd")
                )
            }
        )
        assertEquals("the briefing's lead route wins", Destination.DeepDiveRunning("AMD"), briefing.push)
    }

    @Test
    fun thesisDriftLandsOnNameChangesFromAPushAndFromAnAlert() {
        // 5.25: the push and the Inbox tap land on the same page, Name at "Since the last report".
        val changes = Destination.Name("NVDA", anchor = Destination.Name.ANCHOR_CHANGES)
        val push = DeepLinkRouter.route(LaunchTarget(tab = "names", ticker = "nvda", notificationType = "thesis_drift"))!!
        assertEquals(ShellTab.Names, push.tab)
        assertEquals(changes, push.push)
        assertEquals("NVDA", push.namesFocusTicker)
        val contrarian = DeepLinkRouter.route(LaunchTarget(tab = "names", ticker = "nvda", notificationType = "contrarian_alert"))!!
        assertEquals(changes, contrarian.push)
        // Other Names links keep their destination: the board, the row pinned.
        assertNull(DeepLinkRouter.route(LaunchTarget(tab = "names", ticker = "nvda", notificationType = "kill_switch"))!!.push)
        assertNull(DeepLinkRouter.route(LaunchTarget(tab = "names", notificationType = "thesis_drift"))!!.push)

        val alert = AlertLedgerItemView(
            id = "a1", notificationType = "contrarian_alert", category = "thesis_drift", route = "names", ticker = "nvda",
            title = "t", body = "b", reasonCode = "r", reasonText = "", deliveryState = "sent",
            createdAt = "2026-11-24T07:00:00Z", updatedAt = "2026-11-24T07:00:00Z"
        )
        assertEquals(changes, DeepLinkRouter.routeAlert(alert).push)
        val nav = AppNavigator()
        nav.apply(push)
        assertEquals(listOf(Destination.Names, changes), destinations(nav, ShellTab.Names))
    }

    @Test
    fun inboxTickerRequestIsOneShotAndResetClearsIt() {
        val nav = AppNavigator()
        nav.requestInboxTicker(" aapl ")
        assertEquals("AAPL", nav.inboxTicker)
        nav.clearInboxTicker()
        assertNull(nav.inboxTicker)
        nav.requestInboxTicker("msft")
        nav.reset()
        assertNull(nav.inboxTicker)
    }

    @Test
    fun aWindowSizeChangeDropsTheContainerTransformOrigins() {
        val nav = AppNavigator()
        nav.onWindowSize(1080, 2400)
        val entry = run {
            var pushed: NavEntry? = null
            nav.pushFrom(androidx.compose.ui.geometry.Rect(0f, 400f, 1080f, 560f)) { pushed = nav.push(Destination.Name("AAPL")) }
            pushed!!
        }
        assertTrue(nav.transformOrigin(entry.entryId) != null)
        nav.onWindowSize(1080, 2400)
        assertTrue("same size: kept", nav.transformOrigin(entry.entryId) != null)
        nav.onWindowSize(2400, 1080)
        assertNull("rotated: the row moved, so the pop uses the shared axis", nav.transformOrigin(entry.entryId))
    }

    // ---- Recreation through the saved-state store

    @Test
    fun simulatedRecreateRestoresEveryStackTheModalAndIds() {
        val saved = MapNavigatorStateStore()
        val before = AppNavigator(saved)
        before.push(Destination.Pulse("2026-11-20"))
        before.switchTab(ShellTab.Research)
        before.push(Destination.History("with notes"))
        before.push(Destination.Report("rep_1", "AAPL", "02-business"))
        before.apply(DeepLinkRouter.route(LaunchTarget(tab = "names", ticker = "msft"))!!)
        before.switchTab(ShellTab.Research)
        before.openModal(Destination.You)

        // Activity recreated (rotation, font scale, dark-mode switch): a new navigator over the same handle.
        val after = AppNavigator(MapNavigatorStateStore(saved.values.toMutableMap()))
        assertEquals(before.currentTab, after.currentTab)
        ShellTab.entries.forEach { assertEquals(before.stack(it), after.stack(it)) }
        assertEquals(before.modalStack.toList(), after.modalStack.toList())
        assertEquals("MSFT", after.namesFocusTicker)

        // New entries never reuse a restored id (saved UI state is keyed by entryId).
        val restoredIds = ShellTab.entries.flatMap { after.stack(it) }.map { it.entryId } + after.modalStack.map { it.entryId }
        val fresh = after.push(Destination.Search)
        assertFalse(fresh.entryId in restoredIds)

        // Back still walks the restored stack.
        after.back()
        after.back()
        assertEquals(Destination.Report("rep_1", "AAPL", "02-business"), after.top.destination)
    }

    @Test
    fun unreadableSavedStateStartsFresh() {
        val saved = MapNavigatorStateStore(mutableMapOf("nav.tab" to "Research", "nav.stack.research" to "e1 report|r1"))
        val nav = AppNavigator(saved)
        assertEquals(ShellTab.Today, nav.currentTab)
        ShellTab.entries.forEach { assertEquals(listOf(it.root), destinations(nav, it)) }
    }

    @Test
    fun resetAfterLogOut() {
        val nav = AppNavigator()
        nav.switchTab(ShellTab.Inbox)
        nav.push(Destination.WarRoom("wr"))
        nav.openModal(Destination.You)
        nav.reset()
        assertEquals(ShellTab.Today, nav.currentTab)
        assertTrue(nav.modalStack.isEmpty())
        ShellTab.entries.forEach { assertEquals(listOf(it.root), destinations(nav, it)) }
    }

    @Test
    fun finishedBuildReplacesTheRunningEntryWhereverItIs() {
        val nav = AppNavigator()
        nav.selectTab(ShellTab.Research)
        nav.push(Destination.DeepDiveRunning("AAPL"))
        nav.push(Destination.ScenarioStress())
        val before = nav.stack(ShellTab.Research)[1].entryId
        val replaced = nav.replaceWhere(Destination.Report("r1", "AAPL")) {
            it is Destination.DeepDiveRunning && it.ticker == "AAPL"
        }
        assertEquals(1, replaced)
        assertEquals(
            listOf(Destination.Research, Destination.Report("r1", "AAPL"), Destination.ScenarioStress()),
            destinations(nav, ShellTab.Research)
        )
        assertTrue("a replaced entry gets a new id", nav.stack(ShellTab.Research)[1].entryId != before)
        assertEquals(NavMove.Replace, nav.lastMove)
        assertEquals("roots are never replaced", 0, nav.replaceWhere(Destination.Report("x")) { it == Destination.Research })
    }

    @Test
    fun removeWhereDropsMatchingEntriesFromEveryStackButNeverARoot() {
        val nav = AppNavigator()
        nav.selectTab(ShellTab.Research)
        nav.push(Destination.DeepDiveRunning("AAPL"))
        nav.push(Destination.ScenarioStress())
        nav.selectTab(ShellTab.Today)
        nav.push(Destination.DeepDiveRunning("MSFT"))
        val removed = nav.removeWhere { it is Destination.DeepDiveRunning }
        assertEquals(2, removed)
        assertEquals(listOf(Destination.Research, Destination.ScenarioStress()), destinations(nav, ShellTab.Research))
        assertEquals(listOf(Destination.Today), destinations(nav, ShellTab.Today))
        assertEquals(NavMove.Replace, nav.lastMove)
        assertEquals("roots are never removed", 0, nav.removeWhere { it == Destination.Today })
    }

    @Test
    fun lastMoveTellsTheShellWhichTransitionToPlay() {
        val nav = AppNavigator()
        nav.push(Destination.Pulse())
        assertEquals(NavMove.Push, nav.lastMove)
        nav.back()
        assertEquals(NavMove.Pop, nav.lastMove)
        nav.selectTab(ShellTab.Names)
        assertEquals(NavMove.Tab, nav.lastMove)
        nav.openModal(Destination.You)
        assertEquals(NavMove.Modal, nav.lastMove)
        nav.back()
        assertEquals(NavMove.Modal, nav.lastMove)
        // A deep link to another tab that pushes there still reads as a tab change.
        nav.apply(DeepLinkRouter.route(LaunchTarget(tab = "research", reportId = "r9"))!!)
        assertEquals(NavMove.Tab, nav.lastMove)
    }

    @Test
    fun liveEntryIdsCoverEveryStackAndForgetPoppedEntries() {
        val nav = AppNavigator()
        val pushed = nav.push(Destination.Pulse())
        val modal = nav.openModal(Destination.Search)
        val live = nav.liveEntryIds()
        assertTrue(pushed.entryId in live && modal.entryId in live)
        assertEquals(ShellTab.entries.size + 2, live.size)
        nav.back()
        nav.back()
        assertFalse(pushed.entryId in nav.liveEntryIds())
    }

    @Test
    fun everyWayOffAStackReportsTheRemovedEntries() {
        val nav = AppNavigator()
        val removed = mutableListOf<Destination>()
        val record: (NavEntry) -> Unit = { removed += it.destination }

        // Reselecting Today pops a dated Pulse; the caller hears about it, as it does from back().
        nav.push(Destination.Pulse("2026-11-20"))
        nav.selectTab(ShellTab.Today, record)
        assertEquals(listOf<Destination>(Destination.Pulse("2026-11-20")), removed)

        // Changing tab keeps the old tab's stack: nothing is reported. Closing a modal on a tap is.
        removed.clear()
        nav.push(Destination.Pulse("2026-11-19"))
        nav.openModal(Destination.You)
        nav.selectTab(ShellTab.Names, record)
        assertEquals(listOf<Destination>(Destination.You), removed)
        assertEquals(listOf(Destination.Today, Destination.Pulse("2026-11-19")), destinations(nav, ShellTab.Today))

        // A route that lands on Today pops its sub-stack (the dated Pulse) and closes modals.
        removed.clear()
        nav.openModal(Destination.Search)
        nav.apply(DeepLinkRouter.route(LaunchTarget(tab = "today"))!!, record)
        assertEquals(listOf(Destination.Search, Destination.Pulse("2026-11-19")), removed)

        // popToRoot reports top first.
        removed.clear()
        nav.push(Destination.History())
        nav.push(Destination.Pulse("2026-11-18"))
        nav.popToRoot(ShellTab.Today, record)
        assertEquals(listOf(Destination.Pulse("2026-11-18"), Destination.History()), removed)
        removed.clear()
        nav.popToRoot(ShellTab.Today, record)
        assertTrue("nothing to pop, nothing reported", removed.isEmpty())
    }

    @Test
    fun backingOutOfABuildAndStartingAnotherShowsTheRunningBuild() {
        val nav = AppNavigator()
        nav.selectTab(ShellTab.Research)
        nav.push(Destination.DeepDiveRunning("AAPL"))
        // Back out while AAPL builds, then ask for MSFT from Names.
        nav.back()
        nav.selectTab(ShellTab.Names)
        val decision = decideDeepDiveStart("msft", isRunning = true, runningTicker = "AAPL", top = nav.tabTop.destination)
        assertEquals(
            DeepDiveStartDecision.ShowRunning(
                runningTicker = "AAPL",
                alreadyShowing = false,
                replaceTop = false,
                message = stillBuildingMessage("AAPL", "MSFT")
            ),
            decision
        )
        nav.push(Destination.DeepDiveRunning("AAPL"))
        // AAPL finishes: its entry becomes the report, and no MSFT entry was ever left behind to say "no longer running".
        nav.replaceWhere(Destination.Report("r1", "AAPL")) { it is Destination.DeepDiveRunning && it.ticker == "AAPL" }
        assertEquals(listOf(Destination.Names, Destination.Report("r1", "AAPL")), destinations(nav, ShellTab.Names))
        assertFalse(nav.isInCurrentStack { it is Destination.DeepDiveRunning })
    }

    /**
     * 4.3 rule 2 (HANDOFF-M1 item 8): the navigator owns the entrance registry. An entry's first-open entrance is
     * remembered across a simulated recreate, and a popped entry's scope is dropped, so a new entry for the same
     * screen animates again.
     */
    @Test
    fun entrancesSurviveARecreateAndDieWithTheirEntry() {
        val store = MapNavigatorStateStore()
        val nav = AppNavigator(store)
        val today = nav.tabTop.entryId
        val pulse = nav.push(Destination.Pulse(null)).entryId
        // Home and Pulse play their first-open stagger (one key claimed each, for the issue "i1").
        assertTrue(nav.entranceRegistry.coordinator(today, "i1").claim("hero") >= 0)
        assertTrue(nav.entranceRegistry.coordinator(pulse, "i1").claim("hero") >= 0)

        val recreated = AppNavigator(store)
        // Same issue: already played, nothing animates again; a new issue does.
        assertEquals(-1, recreated.entranceRegistry.coordinator(today, "i1").claim("hero"))
        assertEquals(-1, recreated.entranceRegistry.coordinator(pulse, "i1").claim("hero"))

        recreated.pop()
        val again = recreated.push(Destination.Pulse(null)).entryId
        assertTrue(again != pulse)
        assertTrue(recreated.entranceRegistry.coordinator(again, "i1").claim("hero") >= 0)
        assertEquals(setOf(today, again).size, recreated.entranceRegistry.size)
    }
}
