plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}

fun escapeBuildString(value: String): String = value.replace("\\", "\\\\").replace("\"", "\\\"")
fun requiredReleaseProp(
    key: String,
    releaseTaskRequested: Boolean
): String {
    val value = project.findProperty(key)?.toString()?.trim()
    if (!releaseTaskRequested) {
        return value ?: ""
    }
    if (value.isNullOrBlank()) {
        throw GradleException("Missing required release property: $key")
    }
    return value
}

fun ensureNoReleasePlaceholder(value: String, fieldName: String) {
    val normalized = value.lowercase()
    if (
        normalized.contains("example.com") ||
        normalized.contains("placeholder") ||
        normalized.contains("localhost") ||
        normalized.contains("127.0.0.1")
    ) {
        throw GradleException("$fieldName contains a forbidden release placeholder value: $value")
    }
}

fun ensureSha256Pin(pin: String, fieldName: String) {
    val pattern = Regex("^[A-Za-z0-9+/]{43}=$")
    if (!pattern.matches(pin)) {
        throw GradleException("$fieldName must be a base64-encoded SHA-256 pin (43 chars + '=')")
    }
    if (
        pin == "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" ||
        pin == "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
    ) {
        throw GradleException("$fieldName uses a forbidden placeholder pin value")
    }
}

val posthogEnabled = (project.findProperty("POSTHOG_ENABLED")?.toString() ?: "false").toBoolean()
val posthogApiKey = project.findProperty("POSTHOG_API_KEY")?.toString() ?: ""
val posthogHost = project.findProperty("POSTHOG_HOST")?.toString() ?: "https://us.i.posthog.com"
val posthogWatchlistFlagKey =
    project.findProperty("POSTHOG_WATCHLIST_FLAG_KEY")?.toString() ?: "m7_watchlist_enabled"
val releaseTaskRequested = gradle.startParameter.taskNames.any { task ->
    task.contains("release", ignoreCase = true)
}
val apiBaseUrlOverride = project.findProperty("API_BASE_URL")?.toString()?.trim()?.takeIf { it.isNotBlank() }
val apiBaseUrlDebug = apiBaseUrlOverride ?: "http://127.0.0.1:3001"
val apiBaseUrlRelease = requiredReleaseProp(
    "API_BASE_URL_RELEASE",
    releaseTaskRequested = releaseTaskRequested
)
val releaseApiHost = requiredReleaseProp(
    "RELEASE_API_HOST",
    releaseTaskRequested = releaseTaskRequested
)
val releaseCertPinPrimary = requiredReleaseProp(
    "RELEASE_CERT_PIN_PRIMARY",
    releaseTaskRequested = releaseTaskRequested
)
val releaseCertPinBackup = requiredReleaseProp(
    "RELEASE_CERT_PIN_BACKUP",
    releaseTaskRequested = releaseTaskRequested
)
if (releaseTaskRequested) {
    ensureNoReleasePlaceholder(apiBaseUrlRelease, "API_BASE_URL_RELEASE")
    if (!apiBaseUrlRelease.startsWith("https://")) {
        throw GradleException("API_BASE_URL_RELEASE must use https://")
    }
    ensureNoReleasePlaceholder(releaseApiHost, "RELEASE_API_HOST")
    ensureSha256Pin(releaseCertPinPrimary, "RELEASE_CERT_PIN_PRIMARY")
    ensureSha256Pin(releaseCertPinBackup, "RELEASE_CERT_PIN_BACKUP")
}
val revenueCatPublicAndroidKey =
    project.findProperty("REVENUECAT_PUBLIC_ANDROID_KEY")?.toString() ?: ""
val googleServicesJsonExists = file("google-services.json").exists()

android {
    namespace = "com.thesis.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.thesis.mobile"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("boolean", "POSTHOG_ENABLED", posthogEnabled.toString())
        buildConfigField("String", "POSTHOG_API_KEY", "\"${escapeBuildString(posthogApiKey)}\"")
        buildConfigField("String", "POSTHOG_HOST", "\"${escapeBuildString(posthogHost)}\"")
        buildConfigField(
            "String",
            "POSTHOG_WATCHLIST_FLAG_KEY",
            "\"${escapeBuildString(posthogWatchlistFlagKey)}\""
        )
        buildConfigField(
            "String",
            "REVENUECAT_PUBLIC_ANDROID_KEY",
            "\"${escapeBuildString(revenueCatPublicAndroidKey)}\""
        )
    }

    buildTypes {
        debug {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            buildConfigField("String", "API_BASE_URL", "\"${escapeBuildString(apiBaseUrlDebug)}\"")
        }
        release {
            manifestPlaceholders["usesCleartextTraffic"] = "false"
            buildConfigField("String", "API_BASE_URL", "\"${escapeBuildString(apiBaseUrlRelease)}\"")
            resValue("string", "release_api_host", escapeBuildString(releaseApiHost))
            resValue("string", "release_cert_pin_primary", escapeBuildString(releaseCertPinPrimary))
            resValue("string", "release_cert_pin_backup", escapeBuildString(releaseCertPinBackup))
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.3")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material:material")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("com.revenuecat.purchases:purchases:9.28.1")
    implementation(platform("com.google.firebase:firebase-bom:33.9.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("com.patrykandpatrick.vico:compose-m3:1.15.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}

if (googleServicesJsonExists) {
    apply(plugin = "com.google.gms.google-services")
}
