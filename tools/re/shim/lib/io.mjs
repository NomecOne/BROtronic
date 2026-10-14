import fs from 'node:fs';

export function exists(p) {
  try {
    return Boolean(p && fs.existsSync(p));
  } catch {
    return false;
  }
}

export function readJson(p, fallback = null) {
  if (!exists(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

export function mtimeMs(p) {
  if (!exists(p)) return null;
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
}

export function emit(obj, { exitCode = 0 } = {}) {
  console.log(JSON.stringify(obj, null, 2));
  return exitCode;
}

export function parseAddr(raw) {
  if (raw == null || raw === '') {
    throw new Error('Address required (e.g. 0x2091 or 2091)');
  }
  const s = String(raw).trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]+$/.test(s)) {
    throw new Error(`Invalid address: ${raw}`);
  }
  const n = Number.parseInt(s, 16);
  if (!Number.isFinite(n) || n < 0 || n > 0xffff) {
    throw new Error(`Address out of 16-bit range: ${raw}`);
  }
  return n;
}

export function hex(n, width = 4) {
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(width, '0');
}
