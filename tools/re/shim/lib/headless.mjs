/**
 * Invoke existing tools/re/ghidra run_headless wrappers.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT, RE_ROOT, LANGUAGE, ROM_PATH } from './paths.mjs';
import { exists, readJson } from './io.mjs';
import { artifactFreshness } from './artifacts.mjs';

const GHIDRA_DIR = path.join(RE_ROOT, 'ghidra');
const DETECT_MJS = path.join(GHIDRA_DIR, 'detect.mjs');

export function runDetect() {
  const r = spawnSync(process.execPath, [DETECT_MJS], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  let report = null;
  try {
    report = JSON.parse((r.stdout || '').trim() || '{}');
  } catch {
    report = readJson(path.join(RE_ROOT, 'out', 'ghidra_detect.json'));
  }
  return {
    exitCode: r.status ?? 1,
    ready: Boolean(report?.ready),
    report,
    stderr: r.stderr || '',
  };
}

export function runHeadless({ force = false } = {}) {
  const freshness = artifactFreshness();
  if (!force && freshness.fresh) {
    return {
      ok: true,
      skipped: true,
      reason: 'Artifacts fresh — reuse existing tools/re/out/ghidra exports',
      freshness,
    };
  }

  const detect = runDetect();
  if (!detect.ready) {
    return {
      ok: false,
      skipped: false,
      error: 'Ghidra/JDK not ready',
      blockers: detect.report?.blockers || [],
      detect: detect.report,
      hint: 'Set GHIDRA_INSTALL_DIR and ensure java is on PATH, then re-run export-refresh',
    };
  }

  if (!exists(ROM_PATH)) {
    return {
      ok: false,
      skipped: false,
      error: `ROM missing: ${ROM_PATH}`,
      hint: 'Fetch BASEMAP RedLabel into public/rom/ (see tools/re/data/README.md)',
    };
  }

  const isWin = process.platform === 'win32';
  let cmd;
  let args;
  if (isWin) {
    cmd = 'powershell';
    args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(GHIDRA_DIR, 'run_headless.ps1'),
      '-Language',
      LANGUAGE,
    ];
  } else {
    cmd = 'bash';
    args = [path.join(GHIDRA_DIR, 'run_headless.sh'), '--language', LANGUAGE];
  }

  const r = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env },
    maxBuffer: 16 * 1024 * 1024,
  });

  const status = readJson(path.join(RE_ROOT, 'out', 'ghidra_headless_status.json'));
  const after = artifactFreshness();

  return {
    ok: (r.status ?? 1) === 0 && after.fresh,
    skipped: false,
    exitCode: r.status ?? 1,
    language: LANGUAGE,
    headlessStatus: status,
    freshness: after,
    stdoutTail: (r.stdout || '').slice(-2000),
    stderrTail: (r.stderr || '').slice(-2000),
  };
}

export function romPresent() {
  return exists(ROM_PATH);
}
