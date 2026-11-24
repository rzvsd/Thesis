import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.9.24"
}

// Versions chosen to match the Android app: Kotlin 1.9.24 + Compose compiler 1.5.14, and
// Compose Multiplatform 1.6.11 == androidx Compose 1.6.x / Material3 1.2.1 (compose-bom 2024.06.00).
val composeMpVersion = "1.6.11"
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
    "com/thesis/mobile/ui/screens/SentimentDashboardScreen.kt", // Vico charts (Android-only)
)

// Stage a filtered copy of the app's UI + model sources so the filters do not apply to the shims.
val stageAppSources by tasks.registering(Sync::class) {
    from(appSrc) {
        include("com/thesis/mobile/ui/**", "com/thesis/mobile/model/**")
        // Pure-Kotlin helpers outside ui/model that the app's JVM unit tests cover.
        include("com/thesis/mobile/offline/OfflineJsonCodec.kt", "com/thesis/mobile/launch/LaunchDestinationResolver.kt")
        exclude(*androidOnlyFiles.toTypedArray())
    }
    into(layout.buildDirectory.dir("app-src"))
}

// The app's own JVM unit tests (app/src/test) run here too, minus the one that needs MainViewModel.
val stageAppTests by tasks.registering(Sync::class) {
    from(file("../app/src/test/java")) {
        exclude("com/thesis/mobile/ui/copy/Phase4CopyTest.kt") // defaultNotificationPreferences() lives in MainViewModel
    }
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
    implementation("org.jetbrains.compose.material:material-icons-extended-desktop:$composeMpVersion")
    implementation("org.jetbrains.compose.animation:animation-desktop:$composeMpVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    implementation("org.json:json:20240303") // org.json ships inside the Android framework
    runtimeOnly("org.jetbrains.skiko:skiko-awt-runtime-linux-x64:0.8.4") // Skia native for Linux x64

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}

configurations.all {
    resolutionStrategy.dependencySubstitution {
        // androidx.collection's JVM artifact is published only on Google Maven (dl.google.com).
        // JetBrains published the same androidx.collection classes on Maven Central.
        val collection = "org.jetbrains.compose.collection-internal:collection-desktop:1.6.0-beta02"
        substitute(module("androidx.collection:collection-jvm")).using(module(collection))
            .because("Google Maven is not reachable from the build container")
        substitute(module("androidx.collection:collection")).using(module(collection))
            .because("Google Maven is not reachable from the build container")
    }
    // Annotation-only artifact, Google-Maven-only; not needed to compile or run.
    exclude(group = "androidx.annotation")
    // androidx.lifecycle JVM artifacts are Google-Maven-only too; ImageComposeScene does not use them.
    exclude(group = "androidx.lifecycle")
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
    // Optional filters / knobs, forwarded as system properties.
    listOf("screens.only", "screens.density", "screens.theme").forEach { key ->
        project.findProperty(key)?.let { systemProperty(key, it) }
    }
    systemProperty("java.awt.headless", "true")
    // -PappTestsOnly / -PrendersOnly pick one half of the test suite.
    if (project.hasProperty("appTestsOnly")) filter { excludeTestsMatching("com.thesis.mobile.preview.*") }
    if (project.hasProperty("rendersOnly")) filter { includeTestsMatching("com.thesis.mobile.preview.*") }
    maxHeapSize = "2g"
    testLogging { events("passed", "failed", "skipped"); showStandardStreams = true }
    outputs.upToDateWhen { false }
}
