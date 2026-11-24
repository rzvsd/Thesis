// Standalone JVM build that renders the app's Compose UI to PNG with Compose Desktop (Skia).
// It is NOT part of the Android build (not included from ../settings.gradle.kts) and only needs
// Maven Central + the Gradle Plugin Portal, so it works where Google Maven / the Android SDK are
// unavailable. See README.md in this folder.
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}

rootProject.name = "thesis-design-preview"
