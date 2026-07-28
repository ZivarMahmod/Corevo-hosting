param(
  [ValidateSet("Start", "Status", "Pack", "Dist")]
  [string]$Action = "Start"
)

$ErrorActionPreference = "Stop"
$codeRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repoRoot = (Resolve-Path (Join-Path $codeRoot "..")).Path
$appRoot = Join-Path $codeRoot "apps/zivar-graph-studio"
$electron = Join-Path $codeRoot "node_modules/electron/dist/electron.exe"
$portable = Get-ChildItem -Path (Join-Path $appRoot "dist") -Filter "Zivar-Graph-Studio-*.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($Action -eq "Status") {
  & (Join-Path $PSScriptRoot "graphify-live.ps1") -Action Status
  $desktop = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "electron.exe" -and $_.CommandLine -like "*zivar-graph-studio*"
  })
  $desktopStatus = if ($desktop.Count) { "kor (PID $($desktop[0].ProcessId))" } else { "stoppad" }
  Write-Output "Zivar Graph Studio: $desktopStatus"
  if ($portable) { Write-Output "Portabel app: $($portable.FullName)" }
  exit 0
}

if ($Action -eq "Pack" -or $Action -eq "Dist") {
  Push-Location $codeRoot
  try {
    $script = if ($Action -eq "Dist") { "dist" } else { "build" }
    & corepack pnpm --filter "@corevo/zivar-graph-studio" $script
    if ($LASTEXITCODE -ne 0) { throw "Desktop-paketeringen misslyckades." }
  }
  finally {
    Pop-Location
  }
  exit 0
}

if (-not (Test-Path $electron)) {
  throw "Electron saknas. Kor 'corepack pnpm install' fran $codeRoot."
}

& (Join-Path $PSScriptRoot "graphify-live.ps1") -Action Start
$env:ZIVAR_STUDIO_WORKSPACE = $repoRoot
Start-Process `
  -FilePath $electron `
  -ArgumentList @($appRoot) `
  -WorkingDirectory $codeRoot
Write-Output "Zivar Graph Studio startad."
