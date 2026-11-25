package com.thesis.mobile.preview.harness

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.preview.PreviewTheme
import com.thesis.mobile.preview.captureFrame
import com.thesis.mobile.preview.renderScreen
import com.thesis.mobile.preview.withPreviewProperties
import com.thesis.mobile.ui.platform.RenderFlags
import com.thesis.mobile.ui.platform.rememberSystemReducedMotion
import com.thesis.mobile.ui.platform.thesisCardShadow
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import org.jetbrains.skia.Bitmap
import org.jetbrains.skia.Image
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.File
import java.nio.file.Files
import javax.imageio.ImageIO

/** The renderScreen knobs (section 6.1 F4): size, fontScale, reducedMotion, glow, themes. */
class RenderKnobsTest {

    // These tests render tiny fixtures and check them, so the -Pscreens.only / -Pscreens.theme filters of a
    // render run must not apply to them, and their PNGs go to a temp folder, never into screens.out (a
    // reviewer's render.sh folder would otherwise list harness-*.png as new renders and gold-share would
    // measure them).
    private val filters = listOf("screens.only", "screens.theme", "screens.out")
    private var saved: List<String?> = emptyList()
    private lateinit var tmpOut: File

    @Before
    fun isolateFromRenderRun() {
        saved = filters.map { System.getProperty(it) }
        filters.forEach { System.clearProperty(it) }
        tmpOut = Files.createTempDirectory("render-knobs").toFile()
        System.setProperty("screens.out", tmpOut.absolutePath)
    }

    @After
    fun restoreRenderRun() {
        filters.zip(saved).forEach { (key, value) ->
            if (value != null) System.setProperty(key, value) else System.clearProperty(key)
        }
        tmpOut.deleteRecursively()
    }

    private fun size(file: File): Pair<Int, Int> = ImageIO.read(file).let { it.width to it.height }

    @Test
    fun widthHeightAndDensityGiveThePixelSize() {
        val files = renderScreen(
            "harness-size", widthDp = 360, heightDp = 200, density = 2f, themes = listOf(PreviewTheme.DARK),
            settleMs = 0,
        ) { Box(Modifier) }
        assertEquals(1, files.size)
        assertEquals(720 to 400, size(files.single()))
    }

    @Test
    fun bothThemesByDefaultAndTheyDiffer() {
        val shadows = mutableListOf<Boolean>()
        val files = renderScreen("harness-themes", heightDp = 100, settleMs = 0) {
            shadows += LocalThesisPalette.current.cardShadow
        }
        assertEquals(listOf("harness-themes-dark.png", "harness-themes-light.png"), files.map { it.name })
        assertEquals("InkDark has no card shadow, PaperLight has one", listOf(false, true), shadows.distinct())
        assertFalse(files[0].readBytes().contentEquals(files[1].readBytes()))
    }

    @Test
    fun fontScaleScalesSpButNotDp() {
        fun heightAt(scale: Float): Int = captureFrame(
            widthDp = 200, heightDp = 400, density = 1f, fontScale = scale, settleMs = 0, frameMs = 100,
            fitHeight = true,
        ) {
            Column {
                Box(Modifier.size(10.dp))
                Text("Ag", style = TextStyle(fontSize = 20.sp, lineHeight = 24.sp))
            }
        }.height
        val text1 = heightAt(1f) - 10 // the 10 dp box does not scale
        val text2 = heightAt(2f) - 10
        assertTrue("one 24 sp line at 1x is about 24 px at density 1 ($text1)", text1 in 22..25)
        assertTrue("the line doubles at 2x ($text1 -> $text2)", text2 in (2 * text1 - 2)..(2 * text1 + 2))
    }

    @Test
    fun reducedMotionReachesTheThemeAndTheShimAndIsRestored() {
        val before = System.getProperty("preview.reducedMotion")
        var local: Boolean? = null
        var system: Boolean? = null
        renderScreen("harness-reduced", heightDp = 50, themes = listOf(PreviewTheme.DARK), settleMs = 0,
            reducedMotion = true) {
            local = LocalReducedMotion.current
            system = rememberSystemReducedMotion()
        }
        assertEquals(true, local)
        assertEquals(true, system)
        assertEquals(before, System.getProperty("preview.reducedMotion"))

        renderScreen("harness-reduced", heightDp = 50, themes = listOf(PreviewTheme.DARK), settleMs = 0,
            reducedMotion = false) {
            local = LocalReducedMotion.current
            system = rememberSystemReducedMotion()
        }
        assertEquals(false, local)
        assertEquals(false, system)
    }

    @Test
    fun glowFlagReachesRenderFlags() {
        var seen: Boolean? = null
        renderScreen("harness-glow", heightDp = 50, themes = listOf(PreviewTheme.DARK), settleMs = 0, glow = false) {
            seen = RenderFlags.pageGlow
        }
        assertEquals(false, seen)
        renderScreen("harness-glow", heightDp = 50, themes = listOf(PreviewTheme.DARK), settleMs = 0, glow = true) {
            seen = RenderFlags.pageGlow
        }
        assertEquals(true, seen)
    }

    @Test
    fun previewPropertiesAreRestoredAfterAFailure() {
        System.clearProperty("preview.harness.probe")
        runCatching { withPreviewProperties("preview.harness.probe" to "x") { error("boom") } }
        assertNull(System.getProperty("preview.harness.probe"))
    }

    @Test
    fun fitHeightCropsToTheContent() {
        val image = captureFrame(
            widthDp = 100, heightDp = 1000, density = 2f, fontScale = 1f, settleMs = 0, frameMs = 100,
            fitHeight = true,
        ) { Box(Modifier.fillMaxWidth().height(30.dp)) }
        assertEquals(200, image.width)
        assertEquals(60, image.height)
    }

    @Test
    fun cardShadowDarkensBelowTheCardOnlyWhenEnabled() {
        fun belowCard(enabled: Boolean): Int {
            val image = captureFrame(
                widthDp = 200, heightDp = 200, density = 1f, fontScale = 1f, settleMs = 0, frameMs = 100,
                fitHeight = false,
            ) { ShadowFixture(enabled) }
            return luminanceAt(image, x = 100, y = 125) // 5 dp under the card's bottom edge
        }
        val withShadow = belowCard(true)
        val without = belowCard(false)
        assertEquals("plain page white", 255, without)
        assertTrue("shadow darkens the page under the card ($withShadow)", withShadow < 250)
        assertNotEquals(withShadow, without)
    }

    @Composable
    private fun ShadowFixture(enabled: Boolean) {
        Box(Modifier.size(200.dp).background(Color.White)) {
            Box(
                Modifier.padding(top = 40.dp, start = 40.dp).size(120.dp, 80.dp)
                    .thesisCardShadow(
                        enabled = enabled, color = Color.Black.copy(alpha = 0.35f), cornerRadius = 14.dp,
                        offsetY = 10.dp, blur = 28.dp, spread = (-20).dp,
                    )
                    .background(Color.White),
            )
        }
    }

    private fun luminanceAt(image: Image, x: Int, y: Int): Int {
        val bitmap = Bitmap.makeFromImage(image)
        val argb = bitmap.getColor(x, y)
        val r = (argb shr 16) and 0xFF
        val g = (argb shr 8) and 0xFF
        val b = argb and 0xFF
        return (r + g + b) / 3
    }
}
