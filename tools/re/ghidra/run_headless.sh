#!/usr/bin/env bash
# Headless Ghidra import + analyze for the 64KB RedLabel ROM (BROtronic offline RE).
#
# Canonical CODE analysis path. Does not use "C16x900A" as a processor hint
# (that token is checksum16=0x900A only).
#
# Default language: MCS96:LE:16:default (canonical after x86 Real Mode reject).
# First-attempt negative control:
#   bash tools/re/ghidra/run_headless.sh --language 'x86:LE:16:Real Mode'
#
# Usage (repo root):
#   export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra_11.3.2_PUBLIC"
#   bash tools/re/ghidra/run_headless.sh
#   bash tools/re/ghidra/run_headless.sh --language 'MCS96:LE:16:default'
#   bash tools/re/ghidra/run_headless.sh --detect-only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$RE_ROOT/out"
GHIDRA_OUT="$OUT_DIR/ghidra"
PROJECT_DIR="$RE_ROOT/ghidra/project"
ROM_REL='public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin'
ROM_PATH="$REPO_ROOT/$ROM_REL"

LANGUAGE='MCS96:LE:16:default'
COMPILER='default'
PROJECT_NAME='RedLabel_M331'
DETECT_ONLY=0
SKIP_ANALYSIS=0
GHIDRA_INSTALL_DIR="${GHIDRA_INSTALL_DIR:-${GHIDRA_HOME:-}}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --language|-Language)
      LANGUAGE="${2:-}"; shift 2 ;;
    --compiler|-Compiler)
      COMPILER="${2:-}"; shift 2 ;;
    --project-name|-ProjectName)
      PROJECT_NAME="${2:-}"; shift 2 ;;
    --ghidra-install-dir|-GhidraInstallDir)
      GHIDRA_INSTALL_DIR="${2:-}"; shift 2 ;;
    --detect-only|-DetectOnly)
      DETECT_ONLY=1; shift ;;
    --skip-analysis|-SkipAnalysis)
      SKIP_ANALYSIS=1; shift ;;
    -h|--help)
      sed -n '2,16p' "$0"; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

mkdir -p "$OUT_DIR" "$GHIDRA_OUT" "$PROJECT_DIR"

write_status_json() {
  local json="$1"
  local path="$OUT_DIR/ghidra_headless_status.json"
  printf '%s\n' "$json" >"$path"
  printf '%s\n' "$json"
}

# Detect (always refresh report)
set +e
node "$SCRIPT_DIR/detect.mjs" >/dev/null
DETECT_EXIT=$?
set -e
if [[ "$DETECT_ONLY" -eq 1 ]]; then
  exit "$DETECT_EXIT"
fi

if [[ ! -f "$ROM_PATH" ]]; then
  write_status_json "$(node -e "console.log(JSON.stringify({ok:false,error:'ROM missing: '+process.argv[1],hint:'Fetch BASEMAP RedLabel into public/rom/'},null,2))" "$ROM_PATH")"
  exit 1
fi

HEADLESS=""
if [[ -n "$GHIDRA_INSTALL_DIR" ]]; then
  if [[ -x "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" ]]; then
    HEADLESS="$GHIDRA_INSTALL_DIR/support/analyzeHeadless"
  elif [[ -f "$GHIDRA_INSTALL_DIR/support/analyzeHeadless.bat" ]]; then
    HEADLESS="$GHIDRA_INSTALL_DIR/support/analyzeHeadless.bat"
  fi
fi

# Fall back to detect.mjs discovery if env unset
if [[ -z "$HEADLESS" ]]; then
  HEADLESS="$(node -e "
const r=JSON.parse(require('fs').readFileSync('$OUT_DIR/ghidra_detect.json','utf8'));
if (r.ghidra?.headless) {
  console.log(r.ghidra.headless);
  if (r.ghidra.installDir) process.stderr.write('');
}
" 2>/dev/null || true)"
  if [[ -n "$HEADLESS" && -z "$GHIDRA_INSTALL_DIR" ]]; then
    GHIDRA_INSTALL_DIR="$(node -e "const r=JSON.parse(require('fs').readFileSync('$OUT_DIR/ghidra_detect.json','utf8')); console.log(r.ghidra.installDir||'')")"
  fi
fi

if [[ -z "$HEADLESS" || ! -e "$HEADLESS" ]]; then
  write_status_json "$(node -e "
console.log(JSON.stringify({
  ok: false,
  ready: false,
  error: 'Ghidra analyzeHeadless not found',
  namingNote: 'C16x900A = CS16 0x900A fingerprint only; do not pick C166 language from the filename',
  languageRequested: process.argv[1],
  install: {
    steps: [
      'Install a JDK compatible with your Ghidra release (Temurin 21 recommended for Ghidra 11.x).',
      'Download Ghidra from https://ghidra-sre.org/ and extract (no installer).',
      'Set GHIDRA_INSTALL_DIR to the extracted root (contains support/analyzeHeadless).',
      'Ensure java is on PATH, then re-run: bash tools/re/ghidra/run_headless.sh'
    ]
  },
  exactCommandOnceInstalled: [
    'export GHIDRA_INSTALL_DIR=\"\$HOME/tools/ghidra_11.3.2_PUBLIC\"',
    \"bash tools/re/ghidra/run_headless.sh --language 'x86:LE:16:Real Mode'\"
  ],
  detectExit: Number(process.argv[2])
}, null, 2));
" "$LANGUAGE" "$DETECT_EXIT")"
  exit 2
fi

if ! command -v java >/dev/null 2>&1; then
  write_status_json "$(node -e "console.log(JSON.stringify({ok:false,error:'java not on PATH',ghidraInstallDir:process.argv[1],hint:'Install JDK and reopen the shell'},null,2))" "$GHIDRA_INSTALL_DIR")"
  exit 2
fi

ARGS=(
  "$PROJECT_DIR"
  "$PROJECT_NAME"
  -import "$ROM_PATH"
  -overwrite
  -processor "$LANGUAGE"
  -cspec "$COMPILER"
  -loader BinaryLoader
  -loader-baseAddr 0x0000
  -loader-blockName ROM
  -scriptPath "$SCRIPT_DIR"
  -preScript ForceDisassembleRedLabel.java
  -postScript ExportRedLabel.java "$GHIDRA_OUT"
)

if [[ "$SKIP_ANALYSIS" -eq 1 ]]; then
  ARGS+=(-noanalysis)
fi

echo "Running Ghidra headless..."
echo "  headless = $HEADLESS"
echo "  language = $LANGUAGE"
echo "  rom      = $ROM_PATH"
echo "  out      = $GHIDRA_OUT"

LOG="$OUT_DIR/ghidra_headless.log"
set +e
"$HEADLESS" "${ARGS[@]}" >"$LOG" 2>&1
CODE=$?
set -e

node -e '
const fs = require("fs");
const path = require("path");
const ghidraOut = process.argv[1];
const outDir = process.argv[2];
const code = Number(process.argv[3]);
const language = process.argv[4];
const compiler = process.argv[5];
const ghidraInstallDir = process.argv[6];
const headless = process.argv[7];
const rom = process.argv[8];
const projectDir = process.argv[9];
const projectName = process.argv[10];
const log = process.argv[11];
const exports = [
  "ghidra_export_meta.json",
  "ghidra_functions.csv",
  "ghidra_symbols.csv",
  "ghidra_listing.txt",
];
const present = {};
for (const e of exports) present[path.join(ghidraOut, e)] = fs.existsSync(path.join(ghidraOut, e));
const status = {
  ok: code === 0,
  exitCode: code,
  language,
  compiler,
  ghidraInstallDir,
  headless,
  rom,
  projectDir,
  projectName,
  log,
  exports: present,
  namingNote: "C16x900A = CS16 0x900A only",
  next: [
    "Review tools/re/out/ghidra/ghidra_listing.txt for instruction sanity",
    "If x86 Real Mode looks wrong, try MCS-96 module or alternate language (see README)",
    "node tools/re/annotate.mjs  # merge region map; import Ghidra function starts",
  ],
};
const p = path.join(outDir, "ghidra_headless_status.json");
fs.writeFileSync(p, JSON.stringify(status, null, 2) + "\n");
console.log(JSON.stringify(status, null, 2));
process.exit(code);
' "$GHIDRA_OUT" "$OUT_DIR" "$CODE" "$LANGUAGE" "$COMPILER" "$GHIDRA_INSTALL_DIR" "$HEADLESS" "$ROM_PATH" "$PROJECT_DIR" "$PROJECT_NAME" "$LOG"
