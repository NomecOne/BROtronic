/**
 * Structural pass over hypothesized CODE window.
 * Does NOT claim verified disassembly — emits candidate entrypoints + LJMP/E8 targets
 * for later IDA/Ghidra import once ISA is locked.
 *
 * Dual-path markers:
 *  - MCS-96: LJMP = E7 lo hi
 *  - 8086 working hypothesis: near CALL = E8 rel16 (weak alone)
 */

function le16(buf, off) {
  return buf[off] | (buf[off + 1] << 8);
}

export function structuralCodePass(buf, { codeStart = 0x2000, codeEnd = 0x8000 } = {}) {
  const entries = [];
  const ljmps = [];
  const nearCalls = [];

  // Vector table entries
  for (let i = 0; i < 16; i += 2) {
    const at = 0x2000 + i;
    if (at + 1 >= buf.length) break;
    const target = le16(buf, at);
    if (target >= codeStart && target < codeEnd) {
      entries.push({ kind: 'vector_le16', at, target });
    }
  }

  for (let i = codeStart; i < codeEnd - 2; i++) {
    if (buf[i] === 0xe7) {
      const target = le16(buf, i + 1);
      if (target >= codeStart && target < codeEnd) {
        // Note: true MCS-96 LJMP target is PC-rel (at+3+le16); `target` here is raw disp/legacy abs probe only.
        ljmps.push({ at: i, target, encoding: 'E7_disp16', isaHint: 'mcs96_LJMP_pc_rel' });
      }
    }
    if (buf[i] === 0xe8) {
      const rel = (le16(buf, i + 1) << 16) >> 16;
      const target = (i + 3 + rel) & 0xffff;
      if (target >= codeStart && target < codeEnd) {
        nearCalls.push({ at: i, target, rel, encoding: 'E8_rel16', isaHint: '8086_NEAR_CALL_candidate' });
      }
    }
  }

  // Dedup targets as entrypoint candidates
  const targetHits = new Map();
  for (const e of [...entries.map(e => e.target), ...ljmps.map(j => j.target), ...nearCalls.map(c => c.target)]) {
    targetHits.set(e, (targetHits.get(e) || 0) + 1);
  }
  const entrypoints = [...targetHits.entries()]
    .map(([addr, refs]) => ({ addr, refs }))
    .sort((a, b) => b.refs - a.refs || a.addr - b.addr)
    .slice(0, 256);

  return {
    verificationStatus: 'unverified',
    description:
      'Structural markers only. Ambiguous opcodes (E7/E8) are dual-listed until ISA is confirmed in IDA/Ghidra.',
    vectorEntries: entries,
    mcs96LjmpCandidates: ljmps.slice(0, 500),
    i8086NearCallCandidates: nearCalls.slice(0, 500),
    counts: {
      vectors: entries.length,
      ljmpCandidates: ljmps.length,
      nearCallCandidates: nearCalls.length,
      uniqueEntrypoints: targetHits.size,
    },
    topEntrypoints: entrypoints,
  };
}
