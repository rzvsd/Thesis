package com.thesis.mobile.ui.screens

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thesis.mobile.ui.MainViewModel

/**
 * Password reset (DESIGN-DIRECTION 5.4), the Android entry point: [PasswordResetContent] with the ViewModel's
 * reset calls. Kept thin because it is Android-only (`viewModel()`); the screen itself renders in design-preview.
 * [onDone] returns to the login screen (back, and after the new password is set).
 */
@Composable
fun PasswordResetScreen(
    onDone: () -> Unit,
    mainViewModel: MainViewModel = viewModel()
) {
    PasswordResetContent(
        onBack = onDone,
        onRequestCode = { email, onResult -> mainViewModel.requestPasswordReset(email, onResult) },
        onConfirm = { email, code, newPassword, onResult ->
            mainViewModel.confirmPasswordReset(email, code, newPassword) { error ->
                onResult(error)
                if (error == null) onDone()
            }
        }
    )
}
