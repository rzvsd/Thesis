package com.thesis.mobile.preview

import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.SemanticsNodeInteractionCollection
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertTrue

/*
 * Shared semantics assertions for the WP semantics tests (section 6.0 rule 7, rubric A1 and A3), on top of
 * org.jetbrains.compose.ui:ui-test-junit4-desktop (createComposeRule). Example:
 *
 *   @get:Rule val rule = createComposeRule()
 *   @Test fun chips() {
 *       rule.setContent { ThesisTheme { ChipRow(...) } }
 *       rule.assertAllTouchTargetsAtLeast()            // A1: every clickable >= 48 x 48 dp
 *       rule.onNodeWithText("At risk 2").assertRole(Role.Tab).assertIsSelected()
 *   }
 */

/** The rubric A1 minimum touch target. */
val MinTouchTarget: Dp = 48.dp

/**
 * Asserts this node's laid-out size is >= [min] in both directions (unclipped, so off-screen targets in a
 * scrolling column are measured at their real size). Layout size, not
 * SemanticsNode.touchBoundsInRoot: Compose expands the hit area of any small pointer target to the 48 dp
 * ViewConfiguration minimum, so touch bounds always pass. A target meets A1 when its layout is 48 dp, which is
 * what Modifier.minimumInteractiveComponentSize() (40 dp visual inside a 48 dp area) produces.
 */
fun SemanticsNodeInteraction.assertTouchTargetAtLeast(min: Dp = MinTouchTarget): SemanticsNodeInteraction {
    val node = fetchSemanticsNode()
    val failure = touchTargetFailure(node, min)
    assertTrue(failure ?: "", failure == null)
    return this
}

/** Asserts every node with a click action in the tree meets [min]; lists all offenders in one failure. */
fun ComposeContentTestRule.assertAllTouchTargetsAtLeast(min: Dp = MinTouchTarget) {
    onAllNodes(hasClickAction(), useUnmergedTree = false).assertAllTouchTargetsAtLeast(min)
}

fun SemanticsNodeInteractionCollection.assertAllTouchTargetsAtLeast(min: Dp = MinTouchTarget) {
    val failures = fetchSemanticsNodes().mapNotNull { touchTargetFailure(it, min) }
    assertTrue("Touch targets under $min:\n" + failures.joinToString("\n"), failures.isEmpty())
}

/** Asserts the node exposes [role] (Role.Button, Role.Tab, Role.Switch, Role.RadioButton, ...). */
fun SemanticsNodeInteraction.assertRole(role: androidx.compose.ui.semantics.Role): SemanticsNodeInteraction {
    val actual = fetchSemanticsNode().config.getOrNull(SemanticsProperties.Role)
    assertTrue("Expected role $role, was $actual (${describe(fetchSemanticsNode())})", actual == role)
    return this
}

/** Asserts the node is marked as a heading (SemanticsProperties.Heading). */
fun SemanticsNodeInteraction.assertIsHeading(): SemanticsNodeInteraction {
    val node = fetchSemanticsNode()
    assertTrue("Not a heading: ${describe(node)}", SemanticsProperties.Heading in node.config)
    return this
}

/** Asserts the node announces changes (SemanticsProperties.LiveRegion is set). */
fun SemanticsNodeInteraction.assertIsLiveRegion(): SemanticsNodeInteraction {
    val node = fetchSemanticsNode()
    assertTrue("No liveRegion: ${describe(node)}", SemanticsProperties.LiveRegion in node.config)
    return this
}

/*
 * Measures the node's own laid-out size (SemanticsNode.size), not boundsInRoot: boundsInRoot is clipped to the
 * visible area, so a correct 48 dp target scrolled partly or fully out of a verticalScroll would read as
 * 48 x 8 or 0 x 0. Nodes that are not placed (not composed into the layout yet) are skipped.
 */
private fun touchTargetFailure(node: SemanticsNode, min: Dp): String? {
    if (!node.layoutInfo.isPlaced) return null
    val density = node.layoutInfo.density
    val size = node.size
    val minPx = with(density) { min.toPx() } - 0.5f // rounding slack
    if (size.width >= minPx && size.height >= minPx) return null
    val w = with(density) { size.width.toDp() }
    val h = with(density) { size.height.toDp() }
    return "  ${describe(node)}: ${w.value.toInt()} x ${h.value.toInt()} dp"
}

private fun describe(node: SemanticsNode): String {
    val text = node.config.getOrNull(SemanticsProperties.Text)?.joinToString(" ")
    val desc = node.config.getOrNull(SemanticsProperties.ContentDescription)?.joinToString(" ")
    val tag = node.config.getOrNull(SemanticsProperties.TestTag)
    return listOfNotNull(tag?.let { "tag=$it" }, text?.let { "\"$it\"" }, desc?.let { "desc=\"$it\"" })
        .ifEmpty { listOf("node #${node.id}") }.joinToString(" ")
}
