import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.9.24"
}

// Versions chosen to match the Android app: Kotlin 1.9.24 + Compose compiler 1.5.14, and
// Compose Multiplatform 1.7.3 == androidx Compose 1.7.x / Material3 1.3.1 (the app's compose-bom 2025.04.00 is
// Compose 1.7.8 / Material3 1.3.x: same API line, patch releases apart). CMP 1.7.3 still runs on Kotlin 1.9.24
// (its runtime asks for kotlin-stdlib 1.9.24) with the 1.5.14 compiler plugin. PR-4a, DESIGN-DIRECTION 4.1 / 6.4.
val composeMpVersion = "1.7.3"
val composeCompilerVersion = "1.5.14"

val appSrc = file("../app/src/main/java")

// Files that depend on Android framework / Play / RevenueCat / WebView / ViewModel / Vico APIs.
// Everything else under ui/ and model/ is compiled unchanged from the app module; the few symbols the
// compiled files need from the excluded ones are stubbed in src/shim/kotlin.
val androidOnlyFiles = listOf(
    "com/thesis/mobile/ui/MainViewModel.kt",
    "com/thesis/mobile/ui/ThesisApp.kt",
    "com/thesis/mobile/ui/screens/DeepDiveWebPage.kt", // android.webkit.WebView
    "com/thesis/mobile/ui/screens/ReportExport.kt", // android.graphics.pdf
    "com/thesis/mobile/ui/screens/HoldingsCsvImport.kt", // Activity Result API
    "com/thesis/mobile/ui/screens/SampleDeepDiveScreen.kt", // reads app assets via Context
    "com/thesis/mobile/ui/screens/DeleteAccountSection.kt", // viewModel<MainViewModel>()
    "com/thesis/mobile/ui/screens/PasswordResetScreen.kt", // viewModel<MainViewModel>()
    "com/thesis/mobile/ui/theme/ThesisFonts.kt", // R.font; src/shim loads ../app/src/main/res/font/*.ttf instead
)

// Whole directories that are Android-only by design (docs/app-redesign/DESIGN-DIRECTION.md 4, 6.0 rule 5):
// ui/platform/* wraps BackHandler, View haptics, the animator-scale ContentObserver and the framework shadow
// paint. src/shim/kotlin/com/thesis/mobile/ui/platform holds the preview implementations of the same API.
val androidOnlyDirs = listOf(
    "com/thesis/mobile/ui/platform/**",
)

// Bundled fonts (F1 adds res/font/newsreader_*.ttf). The ThesisFonts shim loads them from here and falls back
// to the system serif while they are absent. Override with -Ppreview.fontDir=/abs/dir.
val appFontDir = file("../app/src/main/res/font")

// Stage a filtered copy of the app's UI + model sources so the filters do not apply to the shims.
val stageAppSources by tasks.registering(Sync::class) {
    from(appSrc) {
        include("com/thesis/mobile/ui/**", "com/thesis/mobile/model/**")
        // Pure-Kotlin helpers outside ui/model that the app's JVM unit tests cover.
        include("com/thesis/mobile/offline/OfflineJsonCodec.kt", "com/thesis/mobile/launch/LaunchDestinationResolver.kt")
        exclude(*androidOnlyFiles.toTypedArray())
        exclude(*androidOnlyDirs.toTypedArray())
    }
    into(layout.buildDirectory.dir("app-src"))
}

// The app's own JVM unit tests (app/src/test) run here too: all of them since PR-1 moved
// defaultNotificationPreferences() out of MainViewModel (ui/shell/UiState.kt), so NotificationDefaultsTest stages too.
val stageAppTests by tasks.registering(Sync::class) {
    from(file("../app/src/test/java"))
    into(layout.buildDirectory.dir("app-test-src"))
}

sourceSets {
    main {
        kotlin.srcDir(stageAppSources)
        kotlin.srcDir("src/shim/kotlin")
    }
    test {
        kotlin.srcDir(stageAppTests)
    }
}

val composeCompiler: Configuration by configurations.creating

dependencies {
    composeCompiler("org.jetbrains.compose.compiler:compiler:$composeCompilerVersion")

    implementation("org.jetbrains.compose.runtime:runtime-desktop:$composeMpVersion")
    implementation("org.jetbrains.compose.ui:ui-desktop:$composeMpVersion")
    implementation("org.jetbrains.compose.foundation:foundation-desktop:$composeMpVersion")
    implementation("org.jetbrains.compose.material:material-desktop:$composeMpVersion")
    implementation("org.jetbrains.compose.material3:material3-desktop:$composeMpVersion")
    implementation("org.jetbrains.compose.animation:animation-desktop:$composeMpVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    implementation("org.json:json:20240303") // org.json ships inside the Android framework
    runtimeOnly("org.jetbrains.skiko:skiko-awt-runtime-linux-x64:0.8.18") // Skia native for Linux x64

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    // Semantics tests (createComposeRule): touch bounds, Role, selected, heading, toggleable, liveRegion.
    testImplementation("org.jetbrains.compose.ui:ui-test-junit4-desktop:$composeMpVersion")
}

configurations.all {
    resolutionStrategy.dependencySubstitution {
        // androidx.collection's JVM artifact is published only on Google Maven (dl.google.com).
        // JetBrains published the same androidx.collection classes on Maven Central. CMP 1.7.3 asks for
        // androidx.collection 1.4.0 (through collection-internal:collection:1.7.3); the 1.6.0-beta02 copy is still
        // the newest on Maven Central, and every androidx.collection class, field and method that the 1.7.3 jars
        // and the compiled app sources reference exists in it (220 references, bytecode link check in PR-4a,
        // docs/app-redesign/handoff/PR4A-BOM.md).
        val collection = "org.jetbrains.compose.collection-internal:collection-desktop:1.6.0-beta02"
        substitute(module("androidx.collection:collection-jvm")).using(module(collection))
            .because("Google Maven is not reachable from the build container")
        substitute(module("androidx.collection:collection")).using(module(collection))
            .because("Google Maven is not reachable from the build container")
    }
    // Annotation-only artifact, Google-Maven-only; not needed to compile or run.
    exclude(group = "androidx.annotation")
    // androidx.lifecycle JVM artifacts are Google-Maven-only too. CMP 1.7 pulls JetBrains' lifecycle 2.8.4 from
    // Maven Central (it holds androidx.lifecycle.compose.LocalLifecycleOwner), which in turn asks for these. Only
    // ComposeContainer (ComposeWindow / ComposePanel) touches Lifecycle/ViewModelStore classes; ImageComposeScene
    // and the ui-test rule (CanvasLayersComposeScene) do not, so excluding them is safe for renders and tests.
    exclude(group = "androidx.lifecycle")
    // Google-Maven-only as well: lifecycle-runtime 2.8.x asks for it for LifecycleRegistry (windows only).
    exclude(group = "androidx.arch.core")
}

kotlin {
    jvmToolchain {} // use the JDK that runs Gradle
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType<KotlinCompile>().configureEach {
    inputs.files(composeCompiler)
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf("-Xplugin=${composeCompiler.singleFile.absolutePath}")
    }
}

tasks.test {
    // Where PNGs land; override with -Pscreens.out=/abs/dir
    val out = (project.findProperty("screens.out") as String?)
        ?: layout.buildDirectory.dir("screens").get().asFile.absolutePath
    systemProperty("screens.out", out)
    // Optional filters / knobs, forwarded as system properties. Each one may be given as -Pkey=value or as
    // -Dkey=value on the Gradle command line (the doc's "-Dpreview.glow=false").
    //   screens.only       regex of render names to run          screens.theme  dark | light
    //   screens.density    px per dp (default 2.625)             screens.fontScale  default font scale (1.0)
    //   preview.glow       false = skip page glows (bulk renders) preview.reducedMotion  true = reduced motion
    //   preview.fontDir    folder with newsreader_*.ttf           preview.online / preview.billing (screen stubs)
    listOf(
        "screens.only", "screens.density", "screens.theme", "screens.fontScale",
        "preview.glow", "preview.reducedMotion", "preview.fontDir", "preview.online", "preview.billing",
    ).forEach { key ->
        (project.findProperty(key) ?: System.getProperty(key))?.let { systemProperty(key, it) }
    }
    if (!project.hasProperty("preview.fontDir") && System.getProperty("preview.fontDir") == null) {
        systemProperty("preview.fontDir", appFontDir.absolutePath)
    }
    systemProperty("java.awt.headless", "true")
    // -PappTestsOnly / -PrendersOnly pick one half of the test suite; -PharnessOnly runs the harness's own
    // tests (render knobs, ui/platform and font shims, semantics helpers), which are part of the renders half.
    if (project.hasProperty("appTestsOnly")) filter { excludeTestsMatching("com.thesis.mobile.preview.*") }
    if (project.hasProperty("rendersOnly")) filter { includeTestsMatching("com.thesis.mobile.preview.*") }
    if (project.hasProperty("harnessOnly")) filter { includeTestsMatching("com.thesis.mobile.preview.harness.*") }
    maxHeapSize = "2g"
    // Skia's native memory grows with many tall ImageComposeScenes in one JVM (a whole kit sheet class was
    // killed with exit 137): render classes run one per forked JVM. App unit tests alone share one JVM.
    if (!project.hasProperty("appTestsOnly")) forkEvery = 1
    testLogging { events("passed", "failed", "skipped"); showStandardStreams = true }
    outputs.upToDateWhen { false }
}
