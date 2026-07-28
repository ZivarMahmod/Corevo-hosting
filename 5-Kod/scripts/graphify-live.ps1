param(
  [ValidateSet("Start", "Stop", "Status")]
  [string]$Action = "Start",
  [int]$ViewerPort = 8765,
  [int]$McpPort = 8766,
  [int]$StudioMcpPort = 8767,
  [int]$StudioPort = 8768,
  [switch]$Open
)

$ErrorActionPreference = "Stop"
$codeRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repoRoot = (Resolve-Path (Join-Path $codeRoot "..")).Path
$pythonFile = Join-Path $codeRoot "graphify-out/.graphify_python"
$graphPath = Join-Path $codeRoot "graphify-out/graph.json"
$watchScript = Join-Path $PSScriptRoot "graphify-watch.py"
$viewerServer = Join-Path $PSScriptRoot "graphify-viewer-server.cjs"
$studioMcpScript = Join-Path $PSScriptRoot "zivar-studio-mcp.py"
$studioServer = Join-Path $codeRoot "apps/zivar-graph-studio/local-server.cjs"
$globalMcpScript = Join-Path $env:USERPROFILE ".codex/skills/graphify/scripts/graphify-library.ps1"
$viewerUrl = "http://127.0.0.1:$ViewerPort/tools/graphify-live/"
$mcpUrl = "http://127.0.0.1:$McpPort/mcp"
$studioMcpUrl = "http://127.0.0.1:$StudioMcpPort/mcp"
$studioUrl = "http://127.0.0.1:$StudioPort/"
$studioEvents = Join-Path $codeRoot "graphify-out/studio-events.jsonl"
$studioState = Join-Path $codeRoot "graphify-out/studio-state.json"
$studioBranchImpact = Join-Path $codeRoot "graphify-out/studio-branch-impact.json"

if (-not (Test-Path $pythonFile)) {
  throw "Graphify interpreter saknas: $pythonFile"
}
if (-not (Test-Path $graphPath)) {
  throw "Graphify graph saknas: $graphPath"
}
if (-not (Test-Path $viewerServer)) {
  throw "Graphify viewer server saknas: $viewerServer"
}
if (-not (Test-Path $studioServer)) {
  throw "Zivar Graph Studio server saknas: $studioServer"
}
if (-not (Test-Path $globalMcpScript)) {
  throw "Global Graphify library saknas: $globalMcpScript"
}

$python = (Get-Content -Raw $pythonFile).Trim()
$node = (Get-Command node -ErrorAction Stop).Source

function Get-GraphifyProcesses {
  $pythonProcesses = @(
    Get-CimInstance Win32_Process |
      Where-Object { $_.Name -like "python*" }
  )
  $nodeProcesses = @(
    Get-CimInstance Win32_Process |
      Where-Object { $_.Name -eq "node.exe" }
  )
  return @{
    Watcher = @(
      $pythonProcesses |
        Where-Object { $_.CommandLine -like "*$watchScript*" }
    )
    Viewer = @(
      $nodeProcesses |
        Where-Object {
          $_.CommandLine -like "*$viewerServer*" -and
          $_.CommandLine -like "*--port*$ViewerPort*"
        }
    )
    Mcp = @(
      $pythonProcesses |
        Where-Object {
          $_.CommandLine -like "*graphify_library_server.py*" -and
          $_.CommandLine -like "*--port*$McpPort*"
        }
    )
    StudioMcp = @(
      $pythonProcesses |
        Where-Object {
          $_.CommandLine -like "*$studioMcpScript*" -and
          $_.CommandLine -like "*--port*$StudioMcpPort*"
        }
    )
    Studio = @(
      $nodeProcesses |
        Where-Object {
          $_.CommandLine -like "*$studioServer*" -and
          $_.CommandLine -like "*--port*$StudioPort*"
        }
    )
  }
}

function Write-Status($processes) {
  $watcher = if ($processes.Watcher.Count) {
    "kor (PID $($processes.Watcher[0].ProcessId))"
  } else { "stoppad" }
  $viewer = if ($processes.Viewer.Count) {
    "kor (PID $($processes.Viewer[0].ProcessId))"
  } else { "stoppad" }
  $mcp = if ($processes.Mcp.Count) {
    "kor (PID $($processes.Mcp[0].ProcessId))"
  } else { "stoppad" }
  $studioMcp = if ($processes.StudioMcp.Count) {
    "kor (PID $($processes.StudioMcp[0].ProcessId))"
  } else { "stoppad" }
  $studio = if ($processes.Studio.Count) {
    "kor (PID $($processes.Studio[0].ProcessId))"
  } else { "stoppad" }

  Write-Output "Graphify watcher: $watcher"
  Write-Output "Grafvy: $viewer - $viewerUrl"
  Write-Output "MCP graphify-corevo: $mcp - $mcpUrl"
  Write-Output "MCP zivar-graph-studio: $studioMcp - $studioMcpUrl"
  Write-Output "Zivar Graph Studio: $studio - $studioUrl"
}

$processes = Get-GraphifyProcesses

if ($Action -eq "Status") {
  Write-Status $processes
  exit 0
}

if ($Action -eq "Stop") {
  $managed = @(
    $processes.Watcher
    $processes.Viewer
    $processes.StudioMcp
    $processes.Studio
  )
  $managed |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Write-Output "Graphify stoppad: $($managed.Count) process(er)."
  exit 0
}

if (-not $processes.Mcp.Count) {
  & powershell -NoProfile -ExecutionPolicy Bypass `
    -File $globalMcpScript -Action Start -Port $McpPort
  if ($LASTEXITCODE -ne 0) {
    throw "Global Graphify library kunde inte starta."
  }
  $processes = Get-GraphifyProcesses
}

$started = @()
try {
  if (-not $processes.Watcher.Count) {
    $oldLimit = $env:GRAPHIFY_VIZ_NODE_LIMIT
    $env:GRAPHIFY_VIZ_NODE_LIMIT = "5000"
    try {
      $started += Start-Process `
        -FilePath $python `
        -ArgumentList @("-u", $watchScript, "--debounce", "5") `
        -WorkingDirectory $codeRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $codeRoot "graphify-out/live-watch.log") `
        -RedirectStandardError (Join-Path $codeRoot "graphify-out/live-watch.err.log") `
        -PassThru
    }
    finally {
      $env:GRAPHIFY_VIZ_NODE_LIMIT = $oldLimit
    }
  }

  if (-not $processes.Viewer.Count) {
    $started += Start-Process `
      -FilePath $node `
      -ArgumentList @(
        $viewerServer,
        "--port", "$ViewerPort",
        "--code-root", $codeRoot
      ) `
      -WorkingDirectory $codeRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $codeRoot "graphify-out/live-view.log") `
      -RedirectStandardError (Join-Path $codeRoot "graphify-out/live-view.err.log") `
      -PassThru
  }

  if (-not $processes.StudioMcp.Count) {
    $started += Start-Process `
      -FilePath $python `
      -ArgumentList @(
        "-u", $studioMcpScript,
        "--port", "$StudioMcpPort",
        "--events", $studioEvents,
        "--state", $studioState,
        "--branch-impact", $studioBranchImpact
      ) `
      -WorkingDirectory $codeRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $codeRoot "graphify-out/studio-mcp.log") `
      -RedirectStandardError (Join-Path $codeRoot "graphify-out/studio-mcp.err.log") `
      -PassThru
  }

  if (-not $processes.Studio.Count) {
    $started += Start-Process `
      -FilePath $node `
      -ArgumentList @(
        $studioServer,
        "--port", "$StudioPort",
        "--workspace", $repoRoot
      ) `
      -WorkingDirectory $codeRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $codeRoot "graphify-out/studio-web.log") `
      -RedirectStandardError (Join-Path $codeRoot "graphify-out/studio-web.err.log") `
      -PassThru
  }

  Start-Sleep -Seconds 1
  $failed = @($started | Where-Object { $_.HasExited })
  if ($failed.Count) {
    throw "En Graphify-process kunde inte starta. Se live-*.err.log."
  }
}
catch {
  $started |
    Where-Object { -not $_.HasExited } |
    ForEach-Object { Stop-Process -Id $_.Id -Force }
  throw
}

$processes = Get-GraphifyProcesses
Write-Status $processes

if ($Open) {
  Start-Process $studioUrl
}
