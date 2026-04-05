param()

$ErrorActionPreference = "Stop"

function New-ArtifactDirectory {
  $timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
  $path = Join-Path -Path "artifacts/m4/runbooks" -ChildPath $timestamp
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

function Require-PatternsInFile {
  param(
    [string]$Path,
    [string[]]$Patterns
  )
  if (-not (Test-Path $Path)) {
    throw "Missing required file: $Path"
  }
  $content = Get-Content -Path $Path -Raw
  $missing = @()
  foreach ($pattern in $Patterns) {
    if ($content -notmatch [Regex]::Escape($pattern)) {
      $missing += $pattern
    }
  }
  if ($missing.Count -gt 0) {
    throw "Missing patterns in ${Path}: $($missing -join ', ')"
  }
}

$artifactDirectory = New-ArtifactDirectory
$results = [System.Collections.Generic.List[object]]::new()

try {
  $runbookFiles = @(
    "docs/runbooks/README.md",
    "docs/runbooks/INDEX.md",
    "docs/runbooks/visibility-observability.md",
    "docs/runbooks/provider-outage.md",
    "docs/runbooks/failed-jobs.md",
    "docs/runbooks/redis-flush-recovery.md",
    "docs/runbooks/deployment-rollback.md",
    "docs/runbooks/database-backup-restore.md"
  )

  $missingRunbooks = @()
  foreach ($file in $runbookFiles) {
    if (-not (Test-Path $file)) {
      $missingRunbooks += $file
    }
  }

  if ($missingRunbooks.Count -gt 0) {
    Add-Result -Results $results -Name "runbook_files" -Status "fail" -Details ("Missing: " + ($missingRunbooks -join ", "))
  }
  else {
    Add-Result -Results $results -Name "runbook_files" -Status "pass" -Details "All required runbook files are present."
  }

  try {
    Require-PatternsInFile -Path "apps/product-api/src/server.ts" -Patterns @(
      "Unhandled request failure",
      "Queue publish failed",
      "Earnings preview notification delivery partially failed",
      "Contrarian notification delivery partially failed",
      "Weekly digest notification delivery partially failed",
      "captureException(new Error(message)"
    )
    Add-Result -Results $results -Name "product_api_alert_hooks" -Status "pass" -Details "API, queue, and notification alert hooks are present."
  }
  catch {
    Add-Result -Results $results -Name "product_api_alert_hooks" -Status "fail" -Details $_.Exception.Message
  }

  try {
    Require-PatternsInFile -Path "apps/product-api/src/job-recovery-scheduler.ts" -Patterns @(
      "Queue recovery marked stale running job as failed",
      "captureException(new Error(message)"
    )
    Add-Result -Results $results -Name "stale_job_alert_hooks" -Status "pass" -Details "Stale scheduled-job alert hooks are present."
  }
  catch {
    Add-Result -Results $results -Name "stale_job_alert_hooks" -Status "fail" -Details $_.Exception.Message
  }

  try {
    $health = Invoke-RestMethod -Method Get -Uri "http://localhost:3001/health"
    if ($health.status -eq "ok") {
      Add-Result -Results $results -Name "product_api_health" -Status "pass" -Details "GET /health returned ok."
    }
    else {
      Add-Result -Results $results -Name "product_api_health" -Status "fail" -Details "Unexpected /health payload."
    }
  }
  catch {
    Add-Result -Results $results -Name "product_api_health" -Status "skipped" -Details "product-api is not running locally."
  }
}
finally {
  $overall = if ($results.Where({ $_.status -eq "fail" }).Count -gt 0) { "fail" } else { "pass" }
  $summary = [PSCustomObject]@{
    timestamp      = (Get-Date).ToString("o")
    overall_status = $overall
    artifact_dir   = $artifactDirectory
    checks         = $results
  }
  $summaryPath = Join-Path $artifactDirectory "summary.json"
  $summary | ConvertTo-Json -Depth 8 | Set-Content -Path $summaryPath -Encoding UTF8
  Write-Output ("M4 ops smoke summary written to: " + $summaryPath)
  $summary | ConvertTo-Json -Depth 8
  if ($overall -eq "fail") {
    exit 1
  }
}
