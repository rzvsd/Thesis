param(
  [string]$StagedInputPath = "Project Note/Phase3/Milestones/M5/m5_staged_scorecard_input.json"
)

$ErrorActionPreference = "Stop"

function New-ArtifactDirectory {
  $timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
  $path = Join-Path -Path "artifacts/m5/launch-gate" -ChildPath $timestamp
  New-Item -ItemType Directory -Path $path -Force | Out-Null
  return $path
}

function Add-Result {
  param(
    [System.Collections.Generic.List[object]]$Results,
    [string]$Name,
    [string]$Status,
    [string]$Details
  )
  $Results.Add([PSCustomObject]@{
      name    = $Name
      status  = $Status
      details = $Details
    })
}

function Get-LatestFile {
  param(
    [string]$Root,
    [string]$Filter
  )
  if (-not (Test-Path $Root)) {
    return $null
  }
  $items = Get-ChildItem -Path $Root -File -Recurse -Filter $Filter -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
  if ($items.Count -eq 0) {
    return $null
  }
  return $items[0]
}

function Read-JsonFile {
  param(
    [string]$Path
  )
  return (Get-Content -Path $Path -Raw | ConvertFrom-Json)
}

function Bool-ToPassFail {
  param(
    [bool]$Value
  )
  if ($Value) {
    return "pass"
  }
  return "fail"
}

function Check-FilePatterns {
  param(
    [string]$Path,
    [string[]]$Patterns
  )

  if (-not (Test-Path $Path)) {
    return [PSCustomObject]@{
      pass    = $false
      details = "Missing file: $Path"
    }
  }

  $content = Get-Content -Path $Path -Raw
  $missing = @()
  foreach ($pattern in $Patterns) {
    if ($content -notmatch [Regex]::Escape($pattern)) {
      $missing += $pattern
    }
  }

  if ($missing.Count -gt 0) {
    return [PSCustomObject]@{
      pass    = $false
      details = "Missing patterns: $($missing -join ', ')"
    }
  }

  return [PSCustomObject]@{
    pass    = $true
    details = "All required patterns present."
  }
}

$artifactDirectory = New-ArtifactDirectory
$results = [System.Collections.Generic.List[object]]::new()

try {
  $requiredDocs = @(
    "Project Note/Phase3/Milestones/M5/M5_MILESTONE_AGENTS_ph3.md",
    "Project Note/Phase3/Milestones/M5/M5_SMOKE_PLAN_ph3.md",
    "Project Note/Phase3/Milestones/M5/M5_BETA_PLAN_ph3.md",
    "Project Note/Phase3/Milestones/M5/M5_WEEKLY_REVIEW_TEMPLATE_ph3.md",
    "Project Note/Phase3/Milestones/M5/M5_LAUNCH_SCORECARD_ph3.md",
    "Project Note/Phase3/Milestones/M5/M5_GO_NO_GO_CHECKLIST_ph3.md",
    "Project Note/Phase3/Milestones/M5/M5_DECISION_2026-04-05.md",
    "Project Note/Phase3/Milestones/M5/M5_EXECUTION_EVIDENCE_2026-04-05.md"
  )

  $missingDocs = @()
  foreach ($doc in $requiredDocs) {
    if (-not (Test-Path $doc)) {
      $missingDocs += $doc
    }
  }

  if ($missingDocs.Count -gt 0) {
    Add-Result -Results $results -Name "m5_docs_presence" -Status "fail" -Details ("Missing: " + ($missingDocs -join ", "))
  }
  else {
    Add-Result -Results $results -Name "m5_docs_presence" -Status "pass" -Details "All M5 operational docs are present."
  }

  if (-not (Test-Path $StagedInputPath)) {
    Add-Result -Results $results -Name "m5_staged_input" -Status "fail" -Details "Missing staged input file: $StagedInputPath"
    throw "Missing staged input file: $StagedInputPath"
  }

  $staged = Read-JsonFile -Path $StagedInputPath
  Add-Result -Results $results -Name "m5_staged_input" -Status "pass" -Details "Loaded staged scorecard input."

  $betaPlanCheck = Check-FilePatterns -Path "Project Note/Phase3/Milestones/M5/M5_BETA_PLAN_ph3.md" -Patterns @(
    "invite-only",
    "capped at 100 users",
    "user_feedback_queue",
    "Support owner runs daily queue triage"
  )
  Add-Result -Results $results -Name "m5_beta_plan_gate" -Status (Bool-ToPassFail -Value ([bool]$betaPlanCheck.pass)) -Details $betaPlanCheck.details

  $weeklyTemplateCheck = Check-FilePatterns -Path "Project Note/Phase3/Milestones/M5/M5_WEEKLY_REVIEW_TEMPLATE_ph3.md" -Patterns @(
    "Weekly Review Template",
    "Weekly Review Record - 2026-04-05 (Staged Rehearsal)",
    "KPI Snapshot"
  )
  Add-Result -Results $results -Name "m5_weekly_review_template_gate" -Status (Bool-ToPassFail -Value ([bool]$weeklyTemplateCheck.pass)) -Details $weeklyTemplateCheck.details

  $scorecardDocCheck = Check-FilePatterns -Path "Project Note/Phase3/Milestones/M5/M5_LAUNCH_SCORECARD_ph3.md" -Patterns @(
    "Crash-free sessions",
    "Activation (% invite acceptances activated)",
    "Notification disablement (% push users)",
    "Conversion",
    "Churn"
  )
  Add-Result -Results $results -Name "m5_scorecard_doc_gate" -Status (Bool-ToPassFail -Value ([bool]$scorecardDocCheck.pass)) -Details $scorecardDocCheck.details

  $maestroFile = Get-LatestFile -Root "artifacts/m4/maestro" -Filter "five-pass-summary.json"
  $e2eFile = Get-LatestFile -Root "artifacts/m4/e2e" -Filter "summary.json"
  $loadFile = Get-LatestFile -Root "artifacts/m4/load" -Filter "summary.json"
  $opsFile = Get-LatestFile -Root "artifacts/m4/runbooks" -Filter "summary.json"
  $m3SummaryFile = Get-LatestFile -Root "artifacts/ph3/m3" -Filter "m3_api_summary.json"
  $m3ManualFile = Get-LatestFile -Root "artifacts/ph3/m3" -Filter "m3_manual_feedback_verify.json"

  if ($null -eq $maestroFile -or $null -eq $e2eFile -or $null -eq $loadFile -or $null -eq $opsFile) {
    Add-Result -Results $results -Name "m4_rehearsal_evidence" -Status "fail" -Details "Missing one or more required M4 evidence files."
  }
  else {
    $maestro = Read-JsonFile -Path $maestroFile.FullName
    $e2e = Read-JsonFile -Path $e2eFile.FullName
    $load = Read-JsonFile -Path $loadFile.FullName
    $ops = Read-JsonFile -Path $opsFile.FullName

    $maestroPass = ($maestro.all_passed -eq $true -and [int]$maestro.pass_count -ge 5)
    Add-Result -Results $results -Name "m4_maestro_gate" -Status (Bool-ToPassFail -Value $maestroPass) -Details ("evidence=" + $maestroFile.FullName)

    $e2ePass = ($e2e.result -eq "pass")
    Add-Result -Results $results -Name "m4_e2e_gate" -Status (Bool-ToPassFail -Value $e2ePass) -Details ("evidence=" + $e2eFile.FullName)

    $loadThresholds = @(
      [bool]$load.thresholds.deep_dive_error_rate_under_1pct,
      [bool]$load.thresholds.deep_dive_enqueue_p95_under_750ms,
      [bool]$load.thresholds.pulse_error_rate_under_1pct,
      [bool]$load.thresholds.pulse_latest_p95_under_300ms,
      [bool]$load.thresholds.fanout_duration_under_5min,
      [bool]$load.thresholds.fanout_failure_rate_under_1pct,
      [bool]$load.thresholds.fanout_attempted_1000_recipients
    )
    $loadPass = ($load.result -eq "pass" -and ($loadThresholds -notcontains $false))
    Add-Result -Results $results -Name "m4_load_gate" -Status (Bool-ToPassFail -Value $loadPass) -Details ("evidence=" + $loadFile.FullName)

    $opsPass = ($ops.overall_status -eq "pass")
    Add-Result -Results $results -Name "m4_ops_gate" -Status (Bool-ToPassFail -Value $opsPass) -Details ("evidence=" + $opsFile.FullName)
  }

  if ($null -eq $m3SummaryFile -or $null -eq $m3ManualFile) {
    Add-Result -Results $results -Name "m3_feedback_intake_gate" -Status "fail" -Details "Missing M3 feedback intake evidence files."
  }
  else {
    $m3Summary = Read-JsonFile -Path $m3SummaryFile.FullName
    $m3Manual = Read-JsonFile -Path $m3ManualFile.FullName
    $queueRowsPass = ([int]$m3Summary.queue_rows_for_user -ge 2)
    $triagePass = ($m3Manual.latest_queue_row.triage_status -eq "new")
    $feedbackPass = ($queueRowsPass -and $triagePass)
    Add-Result -Results $results -Name "m3_feedback_intake_gate" -Status (Bool-ToPassFail -Value $feedbackPass) -Details ("summary=" + $m3SummaryFile.FullName + "; manual=" + $m3ManualFile.FullName)
  }

  $metrics = $staged.scorecard_metrics
  $activationPct = 0.0
  if ([double]$metrics.beta_invite_acceptances -gt 0) {
    $activationPct = [math]::Round(([double]$metrics.beta_activated_users / [double]$metrics.beta_invite_acceptances) * 100.0, 2)
  }
  $disablementPct = 0.0
  if ([double]$metrics.push_receiving_users -gt 0) {
    $disablementPct = [math]::Round(([double]$metrics.notification_disablement_users / [double]$metrics.push_receiving_users) * 100.0, 2)
  }

  $scorecardPass = (
    [double]$metrics.crash_free_sessions_pct -ge 99.5 -and
    $activationPct -ge 35.0 -and
    $disablementPct -lt 15.0 -and
    [int]$metrics.unresolved_sev1_blockers -eq 0 -and
    [int]$metrics.severe_trust_clusters_unresolved -eq 0
  )

  Add-Result -Results $results -Name "m5_scorecard_thresholds" -Status (Bool-ToPassFail -Value $scorecardPass) -Details ("crash_free=" + $metrics.crash_free_sessions_pct + "; activation_pct=" + $activationPct + "; disablement_pct=" + $disablementPct + "; sev1_open=" + $metrics.unresolved_sev1_blockers + "; severe_trust_clusters_unresolved=" + $metrics.severe_trust_clusters_unresolved)

  $checklistPath = "Project Note/Phase3/Milestones/M5/M5_GO_NO_GO_CHECKLIST_ph3.md"
  $checklistContent = if (Test-Path $checklistPath) { Get-Content -Path $checklistPath -Raw } else { "" }
  $decisionDeclared = ($checklistContent -match "Decision:\s*GO")
  Add-Result -Results $results -Name "m5_go_decision_declared" -Status (Bool-ToPassFail -Value $decisionDeclared) -Details ("path=" + $checklistPath)

  $signoffCheck = Check-FilePatterns -Path $checklistPath -Patterns @(
    "Product Lead Sign-off: GO",
    "Engineering Lead Sign-off: GO",
    "QA Lead Sign-off: GO"
  )
  Add-Result -Results $results -Name "m5_signoff_fields" -Status (Bool-ToPassFail -Value ([bool]$signoffCheck.pass)) -Details $signoffCheck.details
}
finally {
  $overall = if ($results.Where({ $_.status -eq "fail" }).Count -gt 0) { "fail" } else { "pass" }
  $decision = if ($overall -eq "pass") { "go" } else { "no_go" }
  $summary = [PSCustomObject]@{
    timestamp       = (Get-Date).ToString("o")
    overall_status  = $overall
    launch_decision = $decision
    artifact_dir    = $artifactDirectory
    checks          = $results
  }
  $summaryPath = Join-Path $artifactDirectory "summary.json"
  $summary | ConvertTo-Json -Depth 8 | Set-Content -Path $summaryPath -Encoding UTF8
  Copy-Item -Path $StagedInputPath -Destination (Join-Path $artifactDirectory "staged_scorecard_input.json") -Force
  Write-Output ("M5 launch-gate smoke summary written to: " + $summaryPath)
  $summary | ConvertTo-Json -Depth 8
  if ($overall -eq "fail") {
    exit 1
  }
}
