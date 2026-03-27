param(
  [switch]$RunBackupRestore
)

$ErrorActionPreference = "Stop"

function Invoke-NativeCommandChecked {
  param(
    [scriptblock]$Command,
    [string]$FailureMessage
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

function New-ArtifactDirectory {
  $timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
  $path = Join-Path -Path "artifacts/m9" -ChildPath $timestamp
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

function Test-RunbookSection {
  param(
    [string]$Path
  )
  $content = Get-Content -Path $Path -Raw
  $requiredPatterns = @(
    "## Go/No-Go",
    "### Prechecks",
    "### Success signal",
    "### Abort signal",
    "## Rollback command"
  )
  foreach ($pattern in $requiredPatterns) {
    if ($content -notmatch [Regex]::Escape($pattern)) {
      return "Missing section '$pattern'"
    }
  }
  return $null
}

function Invoke-BackupRestoreCheck {
  param(
    [string]$ArtifactDirectory
  )

  $backupPath = Join-Path $ArtifactDirectory "thesis_backup.sql"
  $restoreDb = "thesis_restore_smoke"
  $pgUser = if ([string]::IsNullOrWhiteSpace($env:POSTGRES_USER)) { "postgres" } else { $env:POSTGRES_USER }

  Invoke-NativeCommandChecked -FailureMessage "pg_dump failed for thesis backup." -Command {
    docker compose exec -T postgres pg_dump -U $pgUser thesis > $backupPath
  }
  if (-not (Test-Path $backupPath)) {
    throw "Backup file was not created at $backupPath"
  }
  if ((Get-Item $backupPath).Length -le 0) {
    throw "Backup file is empty at $backupPath"
  }

  $cleanupSql = @"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$restoreDb'
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $restoreDb;
"@

  Invoke-NativeCommandChecked -FailureMessage "Failed to clean restore database $restoreDb before restore." -Command {
    $cleanupSql | docker compose exec -T postgres psql -U $pgUser -d postgres -v ON_ERROR_STOP=1 | Out-Null
  }

  Invoke-NativeCommandChecked -FailureMessage "Failed to create restore database $restoreDb." -Command {
    docker compose exec -T postgres psql -U $pgUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $restoreDb;" | Out-Null
  }

  Invoke-NativeCommandChecked -FailureMessage "Failed to restore backup into $restoreDb." -Command {
    Get-Content $backupPath | docker compose exec -T postgres psql -U $pgUser -d $restoreDb -v ON_ERROR_STOP=1 | Out-Null
  }

  $sourceJobs = (docker compose exec -T postgres psql -U $pgUser -d thesis -At -c "SELECT count(*) FROM jobs;" | Select-Object -Last 1).Trim()
  $restoreJobs = (docker compose exec -T postgres psql -U $pgUser -d $restoreDb -At -c "SELECT count(*) FROM jobs;" | Select-Object -Last 1).Trim()

  Invoke-NativeCommandChecked -FailureMessage "Failed to drop restore database $restoreDb during cleanup." -Command {
    $cleanupSql | docker compose exec -T postgres psql -U $pgUser -d postgres -v ON_ERROR_STOP=1 | Out-Null
  }

  if ($sourceJobs -ne $restoreJobs) {
    throw "Row count mismatch for jobs table. source=$sourceJobs restore=$restoreJobs"
  }

  return "Backup/restore PASS. jobs source=$sourceJobs restore=$restoreJobs"
}

$artifactDirectory = New-ArtifactDirectory
$results = [System.Collections.Generic.List[object]]::new()

try {
  $requiredFiles = @(
    "docs/runbooks/README.md",
    "docs/runbooks/INDEX.md",
    "docs/runbooks/visibility-observability.md",
    "docs/runbooks/provider-outage.md",
    "docs/runbooks/failed-jobs.md",
    "docs/runbooks/redis-flush-recovery.md",
    "docs/runbooks/deployment-rollback.md",
    "docs/runbooks/database-backup-restore.md"
  )

  $missing = @()
  foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
      $missing += $file
    }
  }

  if ($missing.Count -gt 0) {
    Add-Result -Results $results -Name "runbook_files_exist" -Status "fail" -Details ("Missing: " + ($missing -join ", "))
  }
  else {
    Add-Result -Results $results -Name "runbook_files_exist" -Status "pass" -Details "All required runbook files are present."
  }

  $sectionFailures = @()
  foreach ($file in $requiredFiles | Where-Object { $_ -like "docs/runbooks/*.md" -and $_ -notlike "*/README.md" -and $_ -notlike "*/INDEX.md" }) {
    $failure = Test-RunbookSection -Path $file
    if ($failure) {
      $sectionFailures += "${file}: $failure"
    }
  }

  if ($sectionFailures.Count -gt 0) {
    Add-Result -Results $results -Name "runbook_sections" -Status "fail" -Details ($sectionFailures -join "; ")
  }
  else {
    Add-Result -Results $results -Name "runbook_sections" -Status "pass" -Details "All runbooks include Go/No-Go and rollback sections."
  }

  try {
    $health = Invoke-RestMethod -Method Get -Uri "http://localhost:3001/health"
    if ($health.status -eq "ok") {
      Add-Result -Results $results -Name "product_api_health" -Status "pass" -Details "GET /health returned ok."
    }
    else {
      Add-Result -Results $results -Name "product_api_health" -Status "fail" -Details "Unexpected health payload."
    }
  }
  catch {
    Add-Result -Results $results -Name "product_api_health" -Status "fail" -Details $_.Exception.Message
  }

  if ($RunBackupRestore) {
    try {
      $details = Invoke-BackupRestoreCheck -ArtifactDirectory $artifactDirectory
      Add-Result -Results $results -Name "backup_restore_check" -Status "pass" -Details $details
    }
    catch {
      Add-Result -Results $results -Name "backup_restore_check" -Status "fail" -Details $_.Exception.Message
    }
  }
  else {
    Add-Result -Results $results -Name "backup_restore_check" -Status "skipped" -Details "Not requested. Use -RunBackupRestore."
  }
}
finally {
  $overall = if ($results.Where({ $_.status -eq "fail" }).Count -gt 0) { "fail" } else { "pass" }
  $summary = [PSCustomObject]@{
    timestamp       = (Get-Date).ToString("o")
    overall_status  = $overall
    artifact_dir    = $artifactDirectory
    checks          = $results
  }
  $summaryPath = Join-Path $artifactDirectory "summary.json"
  $summary | ConvertTo-Json -Depth 8 | Set-Content -Path $summaryPath -Encoding UTF8
  Write-Output ("M9 runbook smoke summary written to: " + $summaryPath)
  $summary | ConvertTo-Json -Depth 8
  if ($overall -eq "fail") {
    exit 1
  }
}
