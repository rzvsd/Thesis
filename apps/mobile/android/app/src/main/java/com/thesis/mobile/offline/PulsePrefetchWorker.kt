package com.thesis.mobile.offline

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.thesis.mobile.data.SessionStore
import com.thesis.mobile.network.ProductApiClient
import com.thesis.mobile.observability.MobileTelemetry
import java.io.IOException

class PulsePrefetchWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
    private val sessionStore = SessionStore(applicationContext)
    private val cacheStore = OfflineCacheStore.getInstance(applicationContext)
    private val client = ProductApiClient()
    private val telemetry = MobileTelemetry()

    override suspend fun doWork(): Result {
        val tokens = sessionStore.loadTokens() ?: return Result.success()
        val baseUrl = sessionStore.loadApiBaseUrl()
        val startedAt = System.currentTimeMillis()
        val distinctId = sessionStore.getInstallationId()

        return runCatching {
            val pulse = client.getLatestPulse(baseUrl, tokens.accessToken)
            val sentimentCurrent = client.getCurrentSentiment(baseUrl, tokens.accessToken)
            val sentimentHistory = client.getSentimentHistory(baseUrl, tokens.accessToken, 90)

            cacheStore.cachePulse(pulse)
            cacheStore.cacheSentiment(sentimentCurrent, sentimentHistory)

            telemetry.capture(
                event = "prefetch_completed",
                distinctId = distinctId,
                properties = mapOf(
                    "worker" to WORK_NAME,
                    "duration_ms" to (System.currentTimeMillis() - startedAt),
                    "sentiment_history_count" to sentimentHistory.size
                )
            )
            Result.success()
        }.getOrElse { error ->
            telemetry.capture(
                event = "prefetch_failed",
                distinctId = distinctId,
                properties = mapOf(
                    "worker" to WORK_NAME,
                    "duration_ms" to (System.currentTimeMillis() - startedAt),
                    "error_message" to (error.message ?: error::class.java.simpleName)
                )
            )
            if (error is IOException) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }

    companion object {
        const val WORK_NAME = "morning_pulse_prefetch"
    }
}
