#Requires -Version 5.1
<#
.SYNOPSIS
  Headless Ghidra import + analyze for the 64KB RedLabel ROM (BROtronic offline RE).

.DESCRIPTION
  Canonical CODE analysis path. Does not use "C16x900A" as a processor hint
  (that token is checksum16=0x900A only).

  Default language: x86:LE:16:Real Mode (user-stated 8086 interest).
  If the listing fails sanity checks, re-run with -Language for an alternate
  (or install an MCS-96/80C196 Ghidra module — see README).

.EXAMPLE
  $env:GHIDRA_INSTALL_DIR = 'C:\Tools\ghidra_11.2_PUBLIC'
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/re/ghidra/run_headless.ps1

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/re/ghidra/run_headless.ps1 -Language 'x86:LE:16:Real Mode'
#>
param(
  [string]$GhidraInstallDir = $env:GHIDRA_INSTALL_DIR,
  [string]$Language = 'x86:LE:16:Real Mode',
  [string]$Compiler = 'default',
  [string]$ProjectName = 'RedLabel_M331',
  [switch]$SkipAnalysis,
  [switch]$DetectOnly
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$ReRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$OutDir = Join-Path $ReRoot 'out'
$GhidraOut = Join-Path $OutDir 'ghidra'
$ProjectDir = Join-Path $ReRoot 'ghidra\project'
$RomRel = 'public\rom\BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin'
$RomPath = Join-Path $RepoRoot $RomRel
$ScriptPath = Join-Path $PSScriptRoot 'ExportRedLabel.java'

New-Item -ItemType Directory -Force -Path $OutDir, $GhidraOut, $ProjectDir | Out-Null

function Write-Status($obj) {
  $path = Join-Path $OutDir 'ghidra_headless_status.json'
  ($obj | ConvertTo-Json -Depth 8) | Set-Content -Path $path -Encoding utf8
  Write-Host ($obj | ConvertTo-Json -Depth 8)
}

# Detect
$detect = & node (Join-Path $PSScriptRoot 'detect.mjs') 2>&1
$detectExit = $LASTEXITCODE
if ($DetectOnly) {
  exit $detectExit
}

if (-not (Test-Path $RomPath)) {
  Write-Status @{
    ok = $false
    error = "ROM missing: $RomPath"
    hint = 'Fetch BASEMAP RedLabel into public/rom/'
  }
  exit 1
}

if (-not $GhidraInstallDir) {
  $GhidraInstallDir = $env:GHIDRA_HOME
}

$headless = $null
if ($GhidraInstallDir) {
  $cand = Join-Path $GhidraInstallDir 'support\analyzeHeadless.bat'
  if (Test-Path $cand) { $headless = $cand }
}

if (-not $headless) {
  Write-Status @{
    ok = $false
    ready = $false
    error = 'Ghidra analyzeHeadless.bat not found'
    namingNote = 'C16x900A = CS16 0x900A fingerprint only; do not pick C166 language from the filename'
    languageRequested = $Language
    install = @{
      steps = @(
        'Install a JDK compatible with your Ghidra release (Temurin 21 recommended for Ghidra 11.x).',
        'Download Ghidra from https://ghidra-sre.org/ and extract (no installer).',
        'Set GHIDRA_INSTALL_DIR to the extracted root (contains support\analyzeHeadless.bat).',
        'Ensure java.exe is on PATH, then re-run: powershell -NoProfile -ExecutionPolicy Bypass -File tools/re/ghidra/run_headless.ps1'
      )
    }
    exactCommandOnceInstalled = @(
      "`$env:GHIDRA_INSTALL_DIR = '<GHIDRA_ROOT>'",
      "powershell -NoProfile -ExecutionPolicy Bypass -File tools/re/ghidra/run_headless.ps1 -Language 'x86:LE:16:Real Mode'"
    )
    detectExit = $detectExit
  }
  exit 2
}

# Sanity: java
try {
  $null = & java -version 2>&1
} catch {
  Write-Status @{
    ok = $false
    error = 'java not on PATH'
    ghidraInstallDir = $GhidraInstallDir
    hint = 'Install JDK and reopen the shell'
  }
  exit 2
}

$loaderArgs = @(
  $ProjectDir,
  $ProjectName,
  '-import', $RomPath,
  '-overwrite',
  '-processor', $Language,
  '-cspec', $Compiler,
  '-scriptPath', $PSScriptRoot,
  '-postScript', 'ExportRedLabel.java', $GhidraOut
)

if (-not $SkipAnalysis) {
  # Default analysis is on; explicit flag kept for clarity in status JSON
}

Write-Host "Running Ghidra headless..."
Write-Host "  headless = $headless"
Write-Host "  language = $Language"
Write-Host "  rom      = $RomPath"
Write-Host "  out      = $GhidraOut"

$log = Join-Path $OutDir 'ghidra_headless.log'
& $headless @loaderArgs *> $log
$code = $LASTEXITCODE

$exports = @(
  'ghidra_export_meta.json',
  'ghidra_functions.csv',
  'ghidra_symbols.csv',
  'ghidra_listing.txt'
) | ForEach-Object { Join-Path $GhidraOut $_ }

$present = @{}
foreach ($e in $exports) { $present[$e] = Test-Path $e }

Write-Status @{
  ok = ($code -eq 0)
  exitCode = $code
  language = $Language
  compiler = $Compiler
  ghidraInstallDir = $GhidraInstallDir
  headless = $headless
  rom = $RomPath
  projectDir = $ProjectDir
  projectName = $ProjectName
  log = $log
  exports = $present
  namingNote = 'C16x900A = CS16 0x900A only'
  next = @(
    'Review tools/re/out/ghidra/ghidra_listing.txt for instruction sanity',
    'If x86 Real Mode looks wrong, try MCS-96 module or alternate language (see README)',
    'node tools/re/annotate.mjs  # merge region map; later: import Ghidra function starts'
  )
}

exit $code
