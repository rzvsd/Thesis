package com.thesis.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.content.ContextCompat
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.thesis.mobile.ui.ThesisApp

class MainActivity : ComponentActivity() {
    private var openPulseOnStart by mutableStateOf(false)
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openPulseOnStart = shouldOpenPulse(intent)
        requestNotificationPermissionIfNeeded()

        setContent {
            ThesisApp(openPulseOnStart = openPulseOnStart)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        openPulseOnStart = shouldOpenPulse(intent)
    }

    private fun shouldOpenPulse(intent: Intent?): Boolean {
        if (intent == null) {
            return false
        }
        val openTab = intent.getStringExtra("open_tab")
        if (openTab.equals("pulse", ignoreCase = true)) {
            return true
        }
        val deepLink = intent.data?.toString().orEmpty()
        return deepLink.contains("thesis://pulse", ignoreCase = true)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return
        }
        val status = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
        if (status != PackageManager.PERMISSION_GRANTED) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
