#!/usr/bin/env node
/**
 * Local MCS-96 RE shim — agent CLI over tools/re Ghidra headless (option B).
 *
 * Does NOT patch REA MCP. Online BROtronic stays AI-free.
 *
 * Usage (repo root):
 *   npm run re:shim -- status
 *   npm run re:shim -- disasm-at 0x2091 --count 20
 *   node tools/re/shim/cli.mjs xrefs 0x4120
 */
import {
  COMMANDS,
  cmdOpenStatus,
  cmdOverview,
  cmdRegions,
  cmdDisasmAt,
  cmdXrefs,
  cmdExportRefresh,
  cmdQueryProgress,
} from './lib/commands.mjs';

const HELP = `
tools/re/shim — local agent API for RedLabel MCS-96 (Ghidra headless wrap)

Commands:
  open | status          Detect Ghidra/JDK + artifact freshness / session
  overview               Export meta, sanity samples, function summary
  regions                CODE 0x2000–0xB930 + PAD/VECTOR/DATA_CAL map
  disasm-at <addr>       Listing window [--count N] [--before N]
  xrefs <addr>           CFG edges + listing operand refs
  export-refresh         Run headless if stale/missing [--force]
  query-progress         code_verification_progress.json

Examples:
  npm run re:shim -- status
  npm run re:shim -- overview
  npm run re:shim -- regions
  npm run re:shim -- disasm-at 0x2091 --count 16
  npm run re:shim -- xrefs 0x4120
  npm run re:shim -- export-refresh
  npm run re:shim -- query-progress

Env:
  GHIDRA_INSTALL_DIR   Ghidra root (contains support/analyzeHeadless[.bat])
  Language locked to   MCS96:LE:16:default
  C16x900A             = CS16 fingerprint only — never C166 language
`.trim();

function parseArgs(argv) {
  const args = argv.slice(2);
  if (!args.length || args[0] === '-h' || args[0] === '--help') {
    return { help: true };
  }
  const command = args[0];
  const rest = args.slice(1);
  const flags = {};
  const positionals = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--force') flags.force = true;
    else if (a === '--count' || a === '-n') {
      flags.count = Number(rest[++i]);
    } else if (a === '--before') {
      flags.before = Number(rest[++i]);
    } else if (a.startsWith('--count=')) {
      flags.count = Number(a.slice('--count='.length));
    } else if (a.startsWith('--before=')) {
      flags.before = Number(a.slice('--before='.length));
    } else if (a.startsWith('-')) {
      throw new Error(`Unknown flag: ${a}`);
    } else {
      positionals.push(a);
    }
  }
  return { command, positionals, flags };
}

function run(parsed) {
  if (parsed.help) {
    console.log(HELP);
    return 0;
  }

  const { command, positionals, flags } = parsed;
  if (!COMMANDS[command]) {
    throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  }

  let result;
  switch (command) {
    case 'open':
    case 'status':
      result = cmdOpenStatus();
      break;
    case 'overview':
      result = cmdOverview();
      break;
    case 'regions':
      result = cmdRegions();
      break;
    case 'disasm-at':
      if (!positionals[0]) throw new Error('disasm-at requires <addr>');
      result = cmdDisasmAt(positionals[0], flags);
      break;
    case 'xrefs':
      if (!positionals[0]) throw new Error('xrefs requires <addr>');
      result = cmdXrefs(positionals[0]);
      break;
    case 'export-refresh':
      result = cmdExportRefresh({ force: Boolean(flags.force) });
      break;
    case 'query-progress':
      result = cmdQueryProgress();
      break;
    default:
      throw new Error(`Unhandled command: ${command}`);
  }

  console.log(JSON.stringify(result, null, 2));
  if (result.ok === false) return 1;
  return 0;
}

try {
  const code = run(parseArgs(process.argv));
  process.exit(code);
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
  process.exit(1);
}
