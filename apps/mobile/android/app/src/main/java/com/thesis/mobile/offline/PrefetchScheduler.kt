package com.thesis.mobile.offline

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.time.Duration
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

object PrefetchScheduler {
    private val newYorkZone: ZoneId = ZoneId.of("America/New_York")

    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<PulsePrefetchWorker>(
            repeatInterval = 24,
            repeatIntervalTimeUnit = TimeUnit.HOURS,
            flexTimeInterval = 1,
            flexTimeIntervalUnit = TimeUnit.HOURS
        )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setInitialDelay(nextInitialDelay())
            .addTag(PulsePrefetchWorker.WORK_NAME)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PulsePrefetchWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(PulsePrefetchWorker.WORK_NAME)
    }

    private fun nextInitialDelay(now: ZonedDateTime = ZonedDateTime.now(newYorkZone)): Duration {
        // WorkManager executes periodic work during the last `flex` window.
        // To target a 06:00 ET center window of 05:30-06:30, we anchor at 06:30 with 1h flex.
        var next = now.withHour(6).withMinute(30).withSecond(0).withNano(0)
        if (!next.isAfter(now)) {
            next = next.plusDays(1)
        }
        return Duration.between(now, next).coerceAtLeast(Duration.ofMinutes(1))
    }
}
