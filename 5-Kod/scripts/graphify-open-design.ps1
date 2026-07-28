param(
  [string]$Source = "",
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$codeRoot = Join-Path $repoRoot "5-Kod"
$outputRoot = Join-Path $codeRoot "graphify-references/open-design"
$pythonFile = Join-Path $codeRoot "graphify-out/.graphify_python"

if (-not $Source) {
  $gitCommonDir = (& git -C $repoRoot rev-parse --path-format=absolute --git-common-dir).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Could not resolve the main checkout."
  }
  $mainCheckout = Split-Path $gitCommonDir -Parent
  $Source = Join-Path $mainCheckout "4-Dokument-Underlag/08-externa-verktyg/open-design"
}

if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
  throw "Open Design source not found: $Source"
}
if (-not (Test-Path -LiteralPath $pythonFile -PathType Leaf)) {
  throw "Graphify interpreter not found: $pythonFile"
}

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$python = (Get-Content -LiteralPath $pythonFile -Raw).Trim()
$graphPath = Join-Path $outputRoot "graphify-out/graph.json"
$callflowPath = Join-Path $outputRoot "graphify-out/open-design-callflow.html"

if ($outputRoot.StartsWith($sourcePath, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Output must stay outside the read-only Open Design clone."
}

if ($Check) {
  Write-Output "Source: $sourcePath"
  Write-Output "Output: $outputRoot"
  Write-Output "Python: $python"
  exit 0
}

$excludes = @(
  ".claude/",
  ".claude-plugin/",
  ".github/",
  ".looper-attachments/",
  ".od/",
  ".tmp/",
  ".vaunt/",
  "apps/desktop/",
  "apps/landing-page/",
  "apps/packaged/",
  "assets/",
  "clipper/",
  "craft/",
  "data/",
  "design-systems/",
  "docs/",
  "e2e/",
  "figma-plugin/",
  "graphify-out/",
  "mocks/",
  "nix/",
  "plugins/",
  "prompt-templates/",
  "skills/",
  "specs/",
  "story/",
  "tools/dev/",
  "tools/release/",
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/",
  "**/fixtures/",
  "**/generated/"
)

$extractArgs = @(
  "-m", "graphify", "extract", $sourcePath,
  "--out", $outputRoot,
  "--code-only"
)
foreach ($exclude in $excludes) {
  $extractArgs += @("--exclude", $exclude)
}

& $python @extractArgs
if ($LASTEXITCODE -ne 0) {
  throw "Open Design extraction failed."
}

& $python -m graphify cluster-only $outputRoot
if ($LASTEXITCODE -ne 0) {
  throw "Open Design clustering failed."
}

Push-Location $outputRoot
try {
  & $python -m graphify export html --graph $graphPath
  if ($LASTEXITCODE -ne 0) {
    throw "Open Design HTML export failed."
  }
}
finally {
  Pop-Location
}

& $python -m graphify export callflow-html --graph $graphPath --output $callflowPath
if ($LASTEXITCODE -ne 0) {
  throw "Open Design call-flow export failed."
}
