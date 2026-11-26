package com.thesis.mobile.ui.shell

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.geometry.Rect
import com.thesis.mobile.ui.motion.EntranceRegistry
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.NavRoute
import com.thesis.mobile.ui.navigation.ShellTab

/** One entry on a stack. [entryId] is unique for the navigator's lifetime and keys the entry's saved UI state. */
data class NavEntry(val destination: Destination, val entryId: String)

/** The last change to the stacks, read by the shell to pick the transition (4.5). */
enum class NavMove { None, Push, Pop, Tab, Replace, Modal }

/**
 * Where the navigator keeps its state across Activity recreation. `MainViewModel` backs it with
 * `SavedStateHandle`; tests use [MapNavigatorStateStore]. Values are plain strings (no parcelize).
 */
interface NavigatorStateStore {
    operator fun get(key: String): String?
    operator fun set(key: String, value: String?)
}

class MapNavigatorStateStore(val values: MutableMap<String, String> = mutableMapOf()) : NavigatorStateStore {
    override fun get(key: String): String? = values[key]
    override fun set(key: String, value: String?) {
        if (value == null) values.remove(key) else values[key] = value
    }
}

/**
 * The app's back stack (DESIGN-DIRECTION 4.5): one stack per bottom tab plus a global modal stack above all
 * tabs. Plain class, no Android types, so design-preview compiles it and `AppNavigatorTest` drives it.
 *
 * - Owned by `MainViewModel`, which passes a `SavedStateHandle`-backed [store]: every change is written
 *   through, so rotation, font-scale changes and the nightly dark-mode switch keep the whole stack.
 * - State is snapshot state ([SnapshotStateList], `mutableStateOf`): `ThesisShell` recomposes on change.
 * - Back order: modal stack first, then the current tab's stack; at a tab root other than Today go to Today;
 *   at Today's root [back] returns false and the system handles it.
 */
@Stable
class AppNavigator(private val store: NavigatorStateStore? = null) {

    private val stacks: Map<ShellTab, SnapshotStateList<NavEntry>> =
        ShellTab.entries.associateWith { mutableStateListOf<NavEntry>() }

    /** You, its pages, Paywall and Search, above every tab. Empty when no modal is open. */
    val modalStack: SnapshotStateList<NavEntry> = mutableStateListOf()

    var currentTab: ShellTab by mutableStateOf(ShellTab.Today)
        private set

    /** Names root scrolls to and highlights this ticker (set by notifications and alerts). */
    var namesFocusTicker: String? by mutableStateOf(null)
        private set

    /**
     * One-shot requests for the Names root, raised from other screens and cleared once Names has acted on them
     * ([clearNamesRequests]): focus the add field (Home's empty "Add a name", 5.6) and open the holdings CSV import
     * (You > Portfolio, 5.22). Not persisted: a request outlives no recreation.
     */
    var namesFocusAdd: Boolean by mutableStateOf(false)
        private set
    var namesOpenImport: Boolean by mutableStateOf(false)
        private set

    /** One-shot Inbox category filter (the weekly digest's alert rows), cleared once the Inbox has read it. */
    var inboxCategory: String? by mutableStateOf(null)
        private set

    private var nextId = 0L

    /**
     * The first-open entrances of every entry (4.3 rule 2), keyed by `entryId`: the shell provides it to each entry
     * ([com.thesis.mobile.ui.motion.ProvideEntranceScope]). Scopes of entries that left every stack are dropped on
     * each change, and the "already played" markers are persisted with the stacks, so Home does not stagger again
     * for the same issue after a tab return, a recreation or process death.
     */
    val entranceRegistry: EntranceRegistry = EntranceRegistry()

    /** What the last mutation did (not persisted; [NavMove.None] after a restore). */
    var lastMove: NavMove = NavMove.None
        private set

    init {
        if (!restore()) {
            ShellTab.entries.forEach { tab -> stacks.getValue(tab).add(newEntry(tab.root)) }
            persist()
        }
        entranceRegistry.onPlayed = { persistEntrances() }
    }

    /** The stack of [tab], root first. Never empty. */
    fun stack(tab: ShellTab): List<NavEntry> = stacks.getValue(tab).toList()

    /** The entry on screen in the tab layer (ignores the modal stack). */
    val tabTop: NavEntry get() = stacks.getValue(currentTab).last()

    /** The entry on screen: the top modal when one is open, else [tabTop]. */
    val top: NavEntry get() = modalStack.lastOrNull() ?: tabTop

    /** True when [back] would do something, so the system back-to-home animation still plays at the root. */
    val canGoBack: Boolean
        get() = modalStack.isNotEmpty() || stacks.getValue(currentTab).size > 1 || currentTab != ShellTab.Today

    /** The selected tab for the bottom bar: none while a modal (You) is open. */
    val selectedTab: ShellTab? get() = if (modalStack.isEmpty()) currentTab else null

    /** Programmatic tab change: keeps the tab's sub-stack (state kept, 4.5 fade-through). */
    fun switchTab(tab: ShellTab) {
        if (currentTab != tab) {
            currentTab = tab
            lastMove = NavMove.Tab
        }
        persist()
    }

    /**
     * A bottom-bar tap. Closes any modal; tapping the tab that is already showing returns it to its root.
     * Returns true when the tap changed the tab (the caller refreshes that tab's data if it is stale).
     * [onRemoved] sees each entry the tap took off a stack (closed modals, a popped sub-stack), as [back] does.
     */
    fun selectTab(tab: ShellTab, onRemoved: (NavEntry) -> Unit = {}): Boolean {
        val wasModalOpen = modalStack.isNotEmpty()
        val removed = modalStack.toMutableList()
        modalStack.clear()
        val changed = currentTab != tab
        if (!changed && !wasModalOpen) removed += popStackToRoot(tab)
        if (tab == ShellTab.Names) namesFocusTicker = null
        currentTab = tab
        lastMove = if (changed) NavMove.Tab else if (wasModalOpen) NavMove.Modal else NavMove.Pop
        persist()
        removed.forEach(onRemoved)
        return changed
    }

    /**
     * The window bounds of the list row each pushed entry opened from (4.5 container transform), by `entryId`. The
     * tab layer grows the entry's page from them on the push and shrinks it back into them on the pop. Not persisted:
     * a restored entry moves on the shared axis.
     */
    private val transformOrigins = mutableMapOf<String, Rect>()

    /** The origin [push] gives the entry it creates; set only for the duration of [pushFrom]. */
    private var pendingOrigin: Rect? = null

    /** Where [entryId]'s page grows from and shrinks back into; null for a shared-axis push. */
    fun transformOrigin(entryId: String): Rect? = transformOrigins[entryId]

    /**
     * Runs [open] (which pushes a list row's detail, for example `onOpenNameIn`) so that the entry it pushes grows
     * from [origin], the tapped row's window bounds. Only pages the tab layer draws take an origin: a report is
     * drawn by the base layer under it and keeps the shared axis.
     */
    fun pushFrom(origin: Rect?, open: () -> Unit) {
        pendingOrigin = origin?.takeIf { it.width > 0f && it.height > 0f }
        try {
            open()
        } finally {
            pendingOrigin = null
        }
    }

    /** Pushes [destination]: modal destinations onto the modal stack, others onto the current tab. */
    fun push(destination: Destination): NavEntry {
        val entry = newEntry(destination)
        if (destination.isModal) {
            modalStack.add(entry)
            lastMove = NavMove.Modal
        } else {
            require(ShellTab.entries.none { it.root == destination }) { "Tab roots are not pushed: $destination" }
            stacks.getValue(currentTab).add(entry)
            lastMove = NavMove.Push
            val origin = pendingOrigin
            if (origin != null && destination !is Destination.Report && destination !is Destination.ReportClassic) {
                // Origins of entries that left every stack go with them.
                transformOrigins.keys.retainAll(liveEntryIds())
                transformOrigins[entry.entryId] = origin
            }
        }
        pendingOrigin = null
        persist()
        return entry
    }

    /** Opens [destination] on the modal stack (You, Paywall, Search). */
    fun openModal(destination: Destination): NavEntry {
        require(destination.isModal) { "Not a modal destination: $destination" }
        return push(destination)
    }

    /** Closes every modal entry whose destination matches [predicate] (all modals by default). */
    fun closeModals(predicate: (Destination) -> Boolean = { true }) {
        if (modalStack.removeAll { predicate(it.destination) }) {
            lastMove = NavMove.Modal
            persist()
        }
    }

    /**
     * Replaces the top entry of the current tab (or the top modal when one is open) with [destination],
     * for example `DeepDiveRunning(AAPL)` becoming `Report(id)` when the build completes. The new entry gets
     * a new [NavEntry.entryId]. A tab root is never replaced.
     */
    fun replaceTop(destination: Destination): NavEntry? {
        val stack = if (modalStack.isNotEmpty()) modalStack else stacks.getValue(currentTab)
        if (stack === stacks.getValue(currentTab) && stack.size <= 1) return null
        if (destination.isModal != (stack === modalStack)) return null
        val entry = newEntry(destination)
        stack[stack.lastIndex] = entry
        lastMove = NavMove.Replace
        persist()
        return entry
    }

    /**
     * Replaces, in every stack, each entry (never a tab root) whose destination matches [predicate] with
     * [destination], keeping its position. For example the finished build replaces `DeepDiveRunning(AAPL)`
     * with `Report(id)` even when the user pushed something above it meanwhile. Returns the number replaced.
     */
    fun replaceWhere(destination: Destination, predicate: (Destination) -> Boolean): Int {
        var replaced = 0
        val all = stacks.values + listOf(modalStack)
        all.forEach { stack ->
            for (index in stack.indices) {
                val isRoot = stack !== modalStack && index == 0
                if (isRoot || !predicate(stack[index].destination)) continue
                if (destination.isModal != (stack === modalStack)) continue
                stack[index] = newEntry(destination)
                replaced++
            }
        }
        if (replaced > 0) {
            lastMove = NavMove.Replace
            persist()
        }
        return replaced
    }

    /**
     * Removes, from every stack, each entry (never a tab root) whose destination matches [predicate]. For example a
     * `DeepDiveRunning` entry restored after its job ended. Returns the number removed.
     */
    fun removeWhere(predicate: (Destination) -> Boolean): Int {
        var removed = 0
        val all = stacks.values + listOf(modalStack)
        all.forEach { stack ->
            for (index in stack.indices.reversed()) {
                val isRoot = stack !== modalStack && index == 0
                if (isRoot || !predicate(stack[index].destination)) continue
                stack.removeAt(index)
                removed++
            }
        }
        if (removed > 0) {
            lastMove = NavMove.Replace
            persist()
        }
        return removed
    }

    /** Every entry id on any stack (the shell drops saved UI state of the others). */
    fun liveEntryIds(): Set<String> =
        (stacks.values.flatMap { it.toList() } + modalStack.toList()).mapTo(HashSet()) { it.entryId }

    /** Pops the top entry (modal first). Returns the popped entry, or null at a tab root. */
    fun pop(): NavEntry? {
        val popped = when {
            modalStack.isNotEmpty() -> modalStack.removeAt(modalStack.lastIndex)
            stacks.getValue(currentTab).size > 1 -> stacks.getValue(currentTab).let { it.removeAt(it.lastIndex) }
            else -> null
        }
        if (popped != null) {
            lastMove = if (popped.destination.isModal) NavMove.Modal else NavMove.Pop
            persist()
        }
        return popped
    }

    /**
     * System back. Returns false only at Today's root with no modal open (the system then closes the app).
     * [onPopped] sees each entry that leaves the screen, so the shell can undo work tied to it.
     */
    fun back(onPopped: (NavEntry) -> Unit = {}): Boolean {
        pop()?.let { onPopped(it); return true }
        if (currentTab != ShellTab.Today) {
            switchTab(ShellTab.Today)
            return true
        }
        return false
    }

    /** Pops [tab] back to its root. [onRemoved] sees each popped entry (top first), as [back] does. */
    fun popToRoot(tab: ShellTab = currentTab, onRemoved: (NavEntry) -> Unit = {}) {
        val removed = popStackToRoot(tab)
        if (removed.isNotEmpty()) persist()
        removed.forEach(onRemoved)
    }

    /** Pops [tab]'s stack to its root without persisting; returns the popped entries, top first. */
    private fun popStackToRoot(tab: ShellTab): List<NavEntry> {
        val stack = stacks.getValue(tab)
        val removed = mutableListOf<NavEntry>()
        // removeAt(lastIndex), not removeLast(): on compileSdk 35 that resolves to the Java 21 member.
        while (stack.size > 1) removed += stack.removeAt(stack.lastIndex)
        if (removed.isNotEmpty()) lastMove = NavMove.Pop
        return removed
    }

    /** True when [destination] is anywhere on the current tab's stack (the report base layer needs this). */
    fun isInCurrentStack(predicate: (Destination) -> Boolean): Boolean =
        stacks.getValue(currentTab).any { predicate(it.destination) }

    /**
     * Applies a deep-link, notification or alert route: see [com.thesis.mobile.ui.navigation.DeepLinkRouter].
     * [onRemoved] sees each entry the route took off a stack (closed modals, the landing tab's popped sub-stack).
     */
    fun apply(route: NavRoute, onRemoved: (NavEntry) -> Unit = {}) {
        if (route.modal != null) {
            if (modalStack.lastOrNull()?.destination != route.modal) openModal(route.modal)
            return
        }
        val tab = route.tab ?: return
        val removed = modalStack.toMutableList()
        modalStack.clear()
        removed += popStackToRoot(tab)
        val changedTab = currentTab != tab
        currentTab = tab
        if (tab == ShellTab.Names) namesFocusTicker = route.namesFocusTicker
        route.push?.let { push(it) }
        // A link that lands on another tab reads as a tab change even when it pushes an entry there.
        lastMove = if (changedTab) NavMove.Tab else if (route.push != null) NavMove.Push else NavMove.Pop
        persist()
        removed.forEach(onRemoved)
    }

    fun requestNamesFocusAdd() {
        namesFocusAdd = true
    }

    fun requestNamesImport() {
        namesOpenImport = true
    }

    fun clearNamesRequests() {
        namesFocusAdd = false
        namesOpenImport = false
    }

    fun requestInboxCategory(category: String?) {
        inboxCategory = category?.trim()?.ifBlank { null }
    }

    fun clearInboxCategory() {
        inboxCategory = null
    }

    fun clearNamesFocus() {
        if (namesFocusTicker != null) {
            namesFocusTicker = null
            persist()
        }
    }

    /** After log out: every tab back to its root, no modal, Today selected. */
    fun reset() {
        modalStack.clear()
        ShellTab.entries.forEach { popToRoot(it) }
        currentTab = ShellTab.Today
        namesFocusTicker = null
        clearNamesRequests()
        inboxCategory = null
        // A new session opens Home as a first open again.
        entranceRegistry.retainOnly(emptyList())
        persist()
    }

    // ---- Persistence

    private fun newEntry(destination: Destination) = NavEntry(destination, "e${nextId++}")

    private fun persist() {
        // Entrances of entries that left every stack die with them (a new entry for the same screen animates).
        entranceRegistry.retainOnly(liveEntryIds())
        val store = store ?: return
        store[KEY_TAB] = currentTab.name
        store[KEY_NEXT_ID] = nextId.toString()
        store[KEY_NAMES_FOCUS] = namesFocusTicker
        ShellTab.entries.forEach { tab -> store[stackKey(tab)] = encodeStack(stacks.getValue(tab)) }
        store[KEY_MODAL] = encodeStack(modalStack)
        persistEntrances()
    }

    /** Writes the entrance registry's "already played" markers next to the stacks. */
    private fun persistEntrances() {
        val store = store ?: return
        store[KEY_ENTRANCES] = entranceRegistry.saveState().joinToString(ENTRY_SEPARATOR).ifEmpty { null }
    }

    private fun restore(): Boolean {
        val store = store ?: return false
        val tab = store[KEY_TAB]?.let { name -> ShellTab.entries.firstOrNull { it.name == name } } ?: return false
        val restored = ShellTab.entries.associateWith { decodeStack(store[stackKey(it)]) }
        // A stack must start with its own root; anything else means the saved state is from an unknown version.
        if (restored.any { (t, entries) -> entries.firstOrNull()?.destination != t.root }) return false
        restored.forEach { (t, entries) -> stacks.getValue(t).addAll(entries) }
        modalStack.addAll(decodeStack(store[KEY_MODAL]).filter { it.destination.isModal })
        currentTab = tab
        namesFocusTicker = store[KEY_NAMES_FOCUS]
        val maxId = (restored.values.flatten() + modalStack).maxOfOrNull { it.entryId.drop(1).toLongOrNull() ?: 0L }
        nextId = maxOf(store[KEY_NEXT_ID]?.toLongOrNull() ?: 0L, (maxId ?: -1L) + 1)
        store[KEY_ENTRANCES]?.takeIf { it.isNotEmpty() }?.let { entranceRegistry.restoreState(it.split(ENTRY_SEPARATOR)) }
        entranceRegistry.retainOnly(liveEntryIds())
        return true
    }

    private fun encodeStack(entries: List<NavEntry>): String =
        entries.joinToString(ENTRY_SEPARATOR) { "${it.entryId}$ID_SEPARATOR${it.destination.encode()}" }

    private fun decodeStack(raw: String?): List<NavEntry> {
        if (raw.isNullOrEmpty()) return emptyList()
        return raw.split(ENTRY_SEPARATOR).mapNotNull { line ->
            val cut = line.indexOf(ID_SEPARATOR)
            if (cut <= 0) return@mapNotNull null
            val destination = Destination.decode(line.substring(cut + 1)) ?: return@mapNotNull null
            NavEntry(destination, line.substring(0, cut))
        }
    }

    private fun stackKey(tab: ShellTab) = "$KEY_STACK_PREFIX${tab.launchKey}"

    companion object {
        private const val KEY_TAB = "nav.tab"
        private const val KEY_NEXT_ID = "nav.nextId"
        private const val KEY_NAMES_FOCUS = "nav.namesFocus"
        private const val KEY_MODAL = "nav.modal"
        private const val KEY_STACK_PREFIX = "nav.stack."
        private const val KEY_ENTRANCES = "nav.entrances"
        private const val ENTRY_SEPARATOR = "\n"
        private const val ID_SEPARATOR = ' '

        /** Every key the navigator writes, so the ViewModel can clear them on log out if it needs to. */
        val storeKeys: List<String> =
            listOf(KEY_TAB, KEY_NEXT_ID, KEY_NAMES_FOCUS, KEY_MODAL, KEY_ENTRANCES) + ShellTab.entries.map { "$KEY_STACK_PREFIX${it.launchKey}" }
    }
}
