package com.thesis.mobile.ui.screens.report

import com.thesis.mobile.ui.components.Stage
import com.thesis.mobile.ui.components.StageStatus
import com.thesis.mobile.ui.copy.ReportCopy

/*
 * The Deep Dive generation screen's stages (docs/app-redesign/DESIGN-DIRECTION.md 5.14), driven by the job's
 * server status only: no timers and no invented sub-steps. The server's statuses are queued, running, complete
 * and failed (supabase/functions/_lib/jobs/types.ts); the other spellings below are accepted so an API wording
 * change degrades to the nearest honest stage instead of a blank screen.
 */

/** Where a Deep Dive build stands, as the generation screen tells it. */
enum class GenerationPhase { Queued, Building, Ready, Failed }

object GenerationStages {
    private val queued = setOf("queued", "pending", "waiting", "created")
    private val ready = setOf("complete", "completed", "done", "succeeded", "success", "ready")
    private val failed = setOf("failed", "error", "errored", "cancelled", "canceled", "timed_out", "timeout")

    /**
     * The phase for a job status. Null (the build was asked for and the server has not answered yet) is
     * [GenerationPhase.Queued]; any status the app does not know is [GenerationPhase.Building] (the job exists and
     * is not finished), so the screen never claims more than the server said.
     */
    fun phaseOf(jobStatus: String?): GenerationPhase {
        val status = jobStatus?.trim()?.lowercase()?.replace(' ', '_')?.replace('-', '_')
        return when {
            status.isNullOrEmpty() -> GenerationPhase.Queued
            status in queued -> GenerationPhase.Queued
            status in ready -> GenerationPhase.Ready
            status in failed -> GenerationPhase.Failed
            else -> GenerationPhase.Building
        }
    }

    /**
     * The three stages for [phase]: In the queue, Reading the filings and building the report, Ready. A failed
     * build shows how far it got: the stages before the one it reached ([reached]: the phase before the failure,
     * Building when unknown) are done, and that one carries "Stopped here".
     */
    fun stagesFor(phase: GenerationPhase, reached: GenerationPhase = GenerationPhase.Building): List<Stage> {
        val at = when (phase) {
            GenerationPhase.Queued -> 0
            GenerationPhase.Building -> 1
            GenerationPhase.Ready -> 3
            GenerationPhase.Failed -> if (reached == GenerationPhase.Queued) 0 else 1
        }
        val labels = listOf(ReportCopy.STAGE_QUEUED, ReportCopy.STAGE_BUILDING, ReportCopy.STAGE_READY)
        return labels.mapIndexed { index, label ->
            val status = when {
                index < at -> StageStatus.Done
                index == at && phase != GenerationPhase.Failed -> StageStatus.Current
                else -> StageStatus.Waiting
            }
            val caption = if (phase == GenerationPhase.Failed && index == at) ReportCopy.STAGE_STOPPED else null
            Stage(label, status, caption)
        }
    }
}
