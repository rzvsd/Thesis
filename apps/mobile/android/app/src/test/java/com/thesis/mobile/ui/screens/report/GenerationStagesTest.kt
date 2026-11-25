package com.thesis.mobile.ui.screens.report

import com.thesis.mobile.ui.components.StageStatus
import com.thesis.mobile.ui.copy.ReportCopy
import org.junit.Assert.assertEquals
import org.junit.Test

class GenerationStagesTest {
    @Test
    fun mapsTheServerStatuses() {
        // supabase/functions/_lib/jobs/types.ts: queued, running, complete, failed.
        assertEquals(GenerationPhase.Queued, GenerationStages.phaseOf("queued"))
        assertEquals(GenerationPhase.Building, GenerationStages.phaseOf("running"))
        assertEquals(GenerationPhase.Ready, GenerationStages.phaseOf("complete"))
        assertEquals(GenerationPhase.Failed, GenerationStages.phaseOf("failed"))
    }

    @Test
    fun noStatusYetIsTheQueue() {
        assertEquals(GenerationPhase.Queued, GenerationStages.phaseOf(null))
        assertEquals(GenerationPhase.Queued, GenerationStages.phaseOf("  "))
    }

    @Test
    fun acceptsOtherSpellings() {
        listOf("Pending", "WAITING", "created").forEach { assertEquals(it, GenerationPhase.Queued, GenerationStages.phaseOf(it)) }
        listOf("completed", "Done", "succeeded", "success", "ready").forEach {
            assertEquals(it, GenerationPhase.Ready, GenerationStages.phaseOf(it))
        }
        listOf("error", "errored", "cancelled", "canceled", "timed out", "timed-out", "timeout").forEach {
            assertEquals(it, GenerationPhase.Failed, GenerationStages.phaseOf(it))
        }
    }

    @Test
    fun anUnknownStatusIsBuildingNeverReady() {
        listOf("processing", "in_progress", "follower", "generating").forEach {
            assertEquals(it, GenerationPhase.Building, GenerationStages.phaseOf(it))
        }
    }

    @Test
    fun stagesFollowThePhase() {
        val labels = listOf(ReportCopy.STAGE_QUEUED, ReportCopy.STAGE_BUILDING, ReportCopy.STAGE_READY)
        fun statuses(phase: GenerationPhase, reached: GenerationPhase = GenerationPhase.Building) =
            GenerationStages.stagesFor(phase, reached).also { stages -> assertEquals(labels, stages.map { it.label }) }
                .map { it.status }

        assertEquals(listOf(StageStatus.Current, StageStatus.Waiting, StageStatus.Waiting), statuses(GenerationPhase.Queued))
        assertEquals(listOf(StageStatus.Done, StageStatus.Current, StageStatus.Waiting), statuses(GenerationPhase.Building))
        assertEquals(listOf(StageStatus.Done, StageStatus.Done, StageStatus.Done), statuses(GenerationPhase.Ready))
        assertEquals(listOf(StageStatus.Done, StageStatus.Waiting, StageStatus.Waiting), statuses(GenerationPhase.Failed))
        assertEquals(
            listOf(StageStatus.Waiting, StageStatus.Waiting, StageStatus.Waiting),
            statuses(GenerationPhase.Failed, reached = GenerationPhase.Queued),
        )
    }
}
