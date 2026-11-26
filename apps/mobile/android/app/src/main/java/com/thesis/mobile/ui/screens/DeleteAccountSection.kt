package com.thesis.mobile.ui.screens

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thesis.mobile.ui.MainViewModel

/**
 * "Delete account" in You (DESIGN-DIRECTION 5.22), the Android entry point: [DeleteAccountControl] with the
 * ViewModel's delete call. Kept thin because it is Android-only (`viewModel()`); the control renders in
 * design-preview. The user must type DELETE to confirm; on success the ViewModel ends the session.
 */
@Composable
fun DeleteAccountSection(mainViewModel: MainViewModel = viewModel()) {
    DeleteAccountControl(onDelete = { onError -> mainViewModel.deleteAccount(onError) })
}
