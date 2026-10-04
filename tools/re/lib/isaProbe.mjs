/**
 * Offline ISA probe for RedLabel 64KB image.
 *
 * Naming: "C16x900A" in the ROM filename is the checksum fingerprint (0x900A),
 * not Siemens/Infineon C16x CPU evidence.
 *
 * Working policy (Richard): prefer user-stated 8086 analysis path unless binary/docs
 * evidence is stronger for another ISA — and always report conflicts with proof.
 */

function countByte(buf, start, end, value) {
  let n = 0;
  for (let i = start; i < end; i++) if (buf[i] === value) n++;
  return n;
}

function countOpcode(buf, start, end, opcode) {
  return countByte(buf, start, end, opcode);
}

function le16(buf, off) {
  return buf[off] | (buf[off + 1] << 8);
}

function readVectorTable(buf, start = 0x2000, count = 8) {
  const entries = [];
  for (let i = 0; i < count; i++) {
    const at = start + i * 2;
    entries.push({ at, target: le16(buf, at) });
  }
  return entries;
}

/** Scan for MCS-96-style LJMP (E7 lo hi) whose target lands inside CODE window. */
function scoreMcs96Ljmp(buf, start, end) {
  let hits = 0;
  let inRange = 0;
  for (let i = start; i < end - 2; i++) {
    if (buf[i] !== 0xe7) continue;
    hits++;
    const tgt = le16(buf, i + 1);
    if (tgt >= 0x2000 && tgt < 0x8000) inRange++;
  }
  return { hits, inRange };
}

/** Scan for 8086-ish near CALL (E8 rel16) landing in CODE. */
function score8086NearCall(buf, start, end) {
  let hits = 0;
  let inRange = 0;
  for (let i = start; i < end - 2; i++) {
    if (buf[i] !== 0xe8) continue;
    hits++;
    const rel = (le16(buf, i + 1) << 16) >> 16; // sign-extend
    const tgt = (i + 3 + rel) & 0xffff;
    if (tgt >= 0x2000 && tgt < 0x8000) inRange++;
  }
  return { hits, inRange };
}

export function probeIsa(buf) {
  const codeStart = 0x2000;
  const codeEnd = 0x8000;
  const firstNonFf = (() => {
    for (let i = 0; i < buf.length; i++) if (buf[i] !== 0xff) return i;
    return -1;
  })();

  const vectors = readVectorTable(buf, 0x2000, 8);
  const vectorSequential =
    vectors.length >= 4 &&
    vectors.every((v, idx) => idx === 0 || v.target === vectors[idx - 1].target + 4);

  const fdPad = countByte(buf, codeStart, codeEnd, 0xfd);
  const ffPad = countByte(buf, codeStart, codeEnd, 0xff);
  const nop90 = countOpcode(buf, codeStart, codeEnd, 0x90);
  const ljmp = scoreMcs96Ljmp(buf, codeStart, codeEnd);
  const nearCall = score8086NearCall(buf, codeStart, codeEnd);
  const pushBpFrame = (() => {
    let n = 0;
    for (let i = codeStart; i < codeEnd - 2; i++) {
      if (buf[i] === 0x55 && buf[i + 1] === 0x8b && buf[i + 2] === 0xec) n++;
    }
    return n;
  })();

  const evidence = [
    {
      kind: 'naming_clarification',
      detail:
        'ROM filename token C16x900A denotes full-file byte-sum fingerprint 0x900A, not Siemens/Infineon C16x CPU family.',
      sources: ['re_pipeline'],
    },
    {
      kind: 'memory_layout',
      detail: `First non-0xFF byte at 0x${firstNonFf.toString(16).toUpperCase()}; shipping pack maps CODE 0x0000-0x7FFF / DATA 0x8000-0xFFFD. Bytes 0x0000-0x1FFF are erased (0xFF) in this external image.`,
      sources: ['re_pipeline', 'brotronic_legacy'],
    },
    {
      kind: 'sheet_ida_note',
      detail:
        'CAL sheet @0x2000: "Hard coded vector addresses for interupts ?"; @0x2010: "Internal 16kb of ROM Not always internal?". Community IDA notes treat some mid-CODE ranges as data.',
      sources: ['sheet', 'ida'],
    },
    {
      kind: 'vector_table',
      detail: `LE u16 table at 0x2000 -> ${vectors
        .map(v => '0x' + v.target.toString(16).toUpperCase())
        .join(', ')}${vectorSequential ? ' (targets step +4)' : ''}.`,
      sources: ['re_pipeline', 'sheet'],
    },
    {
      kind: 'mcs96_opcode_pattern',
      detail: `In CODE window: opcode 0xE7 (MCS-96 LJMP) count=${ljmp.hits}, targets in 0x2000-0x7FFF=${ljmp.inRange}. Pad byte 0xFD count=${fdPad}; community sheet states 0xFD~=NOP and 0xFF~=reset - matches MCS-96 (NOP=0xFD, unimplemented/RST often 0xFF), not classic 8086 (NOP=0x90).`,
      sources: ['re_pipeline', 'sheet'],
    },
    {
      kind: '8086_opcode_pattern',
      detail: `In CODE window: 0xE8 near-call-like bytes=${nearCall.hits} (in-range targets=${nearCall.inRange}); classic prologue 55 8B EC count=${pushBpFrame}; 0x90 (8086 NOP) count=${nop90} vs 0xFD count=${fdPad}.`,
      sources: ['re_pipeline'],
    },
  ];

  const conflicts = [];
  // Stronger than filename: MCS-96 markers beat naive 8086 assumption.
  const mcs96Score =
    (ljmp.hits > 80 ? 2 : ljmp.inRange > 15 ? 1 : 0) +
    (fdPad > 100 ? 2 : 0) +
    (pushBpFrame === 0 ? 1 : 0);
  const i8086Score =
    (nearCall.inRange > 40 ? 2 : nearCall.inRange > 10 ? 1 : 0) +
    (pushBpFrame > 5 ? 2 : 0) +
    (nop90 > fdPad ? 1 : 0);

  if (mcs96Score > i8086Score) {
    conflicts.push({
      kind: 'isa_conflict',
      detail:
        'Binary+sheet patterns currently favor Intel MCS-96 / 80C196-class markers (LJMP-like E7 abs16, FD pad~=NOP per sheet) over classic 8086 (no 55 8B EC prologues; 0x90 NOP rarer than 0xFD). Keep user-stated 8086 as first Ghidra language (x86:LE:16:Real Mode); confirm or reject via listing sanity - do not pick C16x from filename.',
      preferredByEvidence: 'mcs96_80c196_family',
      userStated: '8086',
      scores: { mcs96Score, i8086Score },
    });
  }

  return {
    verificationStatus: 'plausible',
    userStatedIsa: '8086',
    /**
     * Analysis default for this offline pass: follow Richard's stated 8086 path for tooling,
     * but do not treat it as verified — evidence currently leans MCS-96-class.
     */
    workingHypothesis: '8086',
    evidencePreferredIsa: mcs96Score > i8086Score ? 'mcs96_80c196_family' : '8086',
    confidence: mcs96Score > i8086Score ? 0.35 : 0.45,
    scores: { mcs96Score, i8086Score, ljmp, nearCall, fdPad, ffPad, nop90, pushBpFrame },
    firstNonFf,
    vectors,
    evidence,
    conflicts,
    notes: [
      'Do not infer CPU from "C16x####" ROM naming — that is checksum16.',
      'No IDA .i64/.idb checked into this repo; sheet references IDA views as external evidence. Canonical CODE path is now Ghidra (tools/re/ghidra).',
      'Headless full disassembly requires Ghidra + JDK; default language attempt x86:LE:16:Real Mode — validate vs MCS-96 markers before trusting.',
    ],
  };
}
