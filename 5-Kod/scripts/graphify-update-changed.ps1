param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$codeRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pythonFile = Join-Path $codeRoot "graphify-out/.graphify_python"

if (-not (Test-Path $pythonFile)) {
  throw "Graphify interpreter saknas: $pythonFile"
}

Push-Location $codeRoot
try {
  $tracked = @(git diff --name-only --no-renames HEAD -- .)
  if ($LASTEXITCODE -ne 0) {
    throw "Kunde inte lasa andrade Git-filer."
  }

  $untracked = @(git ls-files --others --exclude-standard -- .)
  if ($LASTEXITCODE -ne 0) {
    throw "Kunde inte lasa nya Git-filer."
  }

  $changed = @($tracked; $untracked) |
    Where-Object { $_ -and $_ -notlike "graphify-out/*" } |
    Sort-Object -Unique

  if ($changed.Count -eq 0) {
    Write-Output "Graphify: inga andrade filer."
    exit 0
  }

  $python = (Get-Content -Raw $pythonFile).Trim()
$program = @'
import os
from pathlib import Path
import sys
import subprocess
from graphify.detect import CODE_EXTENSIONS
from graphify.watch import _notify_only, _rebuild_code

os.environ.setdefault("GRAPHIFY_VIZ_NODE_LIMIT", "5000")
force = sys.argv[1] == "1"
paths = [Path(path) for path in sys.argv[2:]]
code_paths = [path for path in paths if path.suffix.lower() in CODE_EXTENSIONS]
non_code_paths = [path for path in paths if path not in code_paths]

ok = True
if code_paths:
    ok = _rebuild_code(
        Path("."),
        changed_paths=code_paths,
        force=force,
        block_on_lock=True,
    )
    if ok:
        subprocess.run(
            [
                sys.executable,
                "-m",
                "graphify",
                "export",
                "html",
                "--graph",
                "graphify-out/graph.json",
            ],
            check=True,
        )
if non_code_paths:
    _notify_only(Path("."))
raise SystemExit(0 if ok else 1)
'@

  $forceArg = if ($Force) { "1" } else { "0" }
  $encodedProgram = [Convert]::ToBase64String(
    [Text.Encoding]::UTF8.GetBytes($program)
  )
  $launcher = "import base64,sys;payload=sys.argv.pop(1);exec(base64.b64decode(payload))"
  $pythonArgs = @("-c", $launcher, $encodedProgram, $forceArg) + $changed
  & $python @pythonArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Graphify kunde inte uppdatera grafen."
  }

  Write-Output "Graphify: uppdaterade $($changed.Count) andrade filer."
}
finally {
  Pop-Location
}
