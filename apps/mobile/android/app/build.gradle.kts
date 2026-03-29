plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

fun escapeBuildString(value: String): String = value.replace("\\", "\\\\").replace("\"", "\\\"")

val posthogEnabled = (project.findProperty("POSTHOG_ENABLED")?.toString() ?: "false").toBoolean()
val posthogApiKey = project.findProperty("POSTHOG_API_KEY")?.toString() ?: ""
val posthogHost = project.findProperty("POSTHOG_HOST")?.toString() ?: "https://us.i.posthog.com"
val posthogWatchlistFlagKey =
    project.findProperty("POSTHOG_WATCHLIST_FLAG_KEY")?.toString() ?: "m7_watchlist_enabled"
val apiBaseUrl = project.findProperty("API_BASE_URL")?.toString() ?: "http://127.0.0.1:3001"
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
        buildConfigField("String", "API_BASE_URL", "\"${escapeBuildString(apiBaseUrl)}\"")
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
        release {
            isMinifyEnabled = false
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
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("com.revenuecat.purchases:purchases:9.28.1")
    implementation(platform("com.google.firebase:firebase-bom:33.9.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}

if (googleServicesJsonExists) {
    apply(plugin = "com.google.gms.google-services")
}
