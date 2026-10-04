/**
 * Region / every-byte classifier for the 64KB RedLabel image.
 * Emits run-length annotations covering 0x0000–0xFFFF.
 *
 * Baseline CODE (Richard): 0x2000–0xB930 inclusive; DATA_CAL starts at 0xB931.
 */
import { MEM } from './romPaths.mjs';

function paint(bytes, start, endInclusive, patch) {
  const lo = Math.max(0, start);
  const hi = Math.min(bytes.length - 1, endInclusive);
  for (let i = lo; i <= hi; i++) Object.assign(bytes[i], patch);
}

function runsFromBytes(bytes) {
  const runs = [];
  let i = 0;
  while (i < bytes.length) {
    const cur = bytes[i];
    let j = i + 1;
    while (
      j < bytes.length &&
      bytes[j].region === cur.region &&
      bytes[j].confidence === cur.confidence &&
      bytes[j].source === cur.source &&
      bytes[j].note === cur.note
    ) {
      j++;
    }
    runs.push({
      start: i,
      end: j - 1,
      length: j - i,
      region: cur.region,
      confidence: cur.confidence,
      evidence: cur.evidence,
      source: cur.source,
      note: cur.note || undefined,
      verificationStatus: cur.verificationStatus,
    });
    i = j;
  }
  return runs;
}

function parseXdfSpans(xdfText) {
  const blocks = xdfText.split(/<\/(?:XDFTABLE|XDFCONSTANT)>/i);
  const spans = [];
  for (const block of blocks) {
    const titleM = block.match(/<title>([^<]+)<\/title>/i);
    const addrM = block.match(/mmedaddress="(0x[0-9A-Fa-f]+)"/i);
    if (!titleM || !addrM) continue;
    const title = titleM[1].replace(/\s+/g, ' ').trim();
    if (/^INFO\b/i.test(title)) continue;
    const offset = parseInt(addrM[1], 16);
    const bits = Number(block.match(/mmedelementsizebits="(\d+)"/i)?.[1] ?? 8);
    const rows = Number(block.match(/mmedrowcount="(\d+)"/i)?.[1] ?? 1);
    const cols = Number(block.match(/mmedcolcount="(\d+)"/i)?.[1] ?? 1);
    const elem = bits >= 16 ? 2 : 1;
    const size = Math.max(1, rows * cols * elem);
    if (offset < 0 || offset > 0xffff) continue;
    spans.push({
      start: offset,
      end: Math.min(0xffff, offset + size - 1),
      title: title.slice(0, 96),
    });
  }
  return spans;
}

function findPadRuns(buf, start, end, padByte, minLen = 16) {
  const out = [];
  let run = -1;
  for (let i = start; i <= end; i++) {
    const isPad = i <= end && buf[i] === padByte;
    if (isPad) {
      if (run < 0) run = i;
    } else if (run >= 0) {
      if (i - run >= minLen) out.push({ start: run, end: i - 1 });
      run = -1;
    }
  }
  if (run >= 0 && end - run + 1 >= minLen) out.push({ start: run, end });
  return out;
}

/**
 * @param {Buffer} buf
 * @param {{ xdfText?: string, ghidraInsnAddrs?: number[], ghidraLanguage?: string|null }} [opts]
 */
export function classifyRom(buf, opts = {}) {
  /** @type {Array<{region:string,confidence:number,evidence:string,source:string,note:string,verificationStatus:string}>} */
  const bytes = new Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    bytes[i] = {
      region: 'UNKNOWN',
      confidence: 0.1,
      evidence: 'unclassified',
      source: 're_pipeline',
      note: '',
      verificationStatus: 'unverified',
    };
  }

  paint(bytes, 0x0000, MEM.LOW_PAD_END, {
    region: 'PAD',
    confidence: 0.9,
    evidence:
      'Erased/unpopulated low image 0x0000-0x1FFF (all 0xFF). Sheet: possible internal 16KB ROM window not present in external dump.',
    source: 're_pipeline',
    note: 'low_image_erased',
    verificationStatus: 'plausible',
  });

  // Baseline CODE through 0xB930 inclusive (Richard / RedLabel 413/623).
  paint(bytes, MEM.CODE_START, MEM.CODE_END, {
    region: 'CODE',
    confidence: 0.7,
    evidence:
      'Baseline CODE section 0x2000–0xB930 inclusive (Richard). First non-FF @0x2000; MCS-96 Ghidra language locked. Mid-window XDF claims may still paint DATA islands.',
    source: 'sheet',
    note: 'code_through_0xB930',
    verificationStatus: 'plausible',
  });

  paint(bytes, MEM.DATA_START, MEM.DATA_END, {
    region: 'DATA',
    confidence: 0.85,
    evidence: `DATA_CAL window after CODE: 0x${MEM.DATA_START.toString(16).toUpperCase()}–0xFFFD (CODE ends inclusive 0xB930).`,
    source: 're_pipeline',
    note: 'data_cal_after_code',
    verificationStatus: 'plausible',
  });

  paint(bytes, 0xfffe, 0xffff, {
    region: 'OTHER',
    confidence: 0.95,
    evidence: 'Trailing 16-bit checksum field (CS16_TRAIL). Full-file sum including these bytes = 0x900A.',
    source: 're_pipeline',
    note: 'cs16_trail',
    verificationStatus: 'cross_checked',
  });

  paint(bytes, MEM.VECTOR_START, MEM.VECTOR_END, {
    region: 'VECTOR',
    confidence: 0.7,
    evidence:
      'LE u16 interrupt/vector candidates @0x2000 (sheet: hard-coded vector addresses). Targets 0x4178..0x4194 step +4.',
    source: 'sheet',
    note: 'vector_table_0x2000',
    verificationStatus: 'plausible',
  });

  // PAD holes inside CODE (FF and FD)
  for (const run of findPadRuns(buf, MEM.CODE_START, MEM.CODE_END, 0xff, 16)) {
    paint(bytes, run.start, run.end, {
      region: 'PAD',
      confidence: 0.8,
      evidence: `0xFF pad run inside CODE window [${run.start.toString(16)}..${run.end.toString(16)}]`,
      source: 're_pipeline',
      note: 'ff_pad',
      verificationStatus: 'plausible',
    });
  }
  for (const run of findPadRuns(buf, MEM.CODE_START, MEM.CODE_END, 0xfd, 16)) {
    paint(bytes, run.start, run.end, {
      region: 'PAD',
      confidence: 0.65,
      evidence: `0xFD pad run inside CODE window [${run.start.toString(16)}..${run.end.toString(16)}] (sheet: FD≈NOP / filler)`,
      source: 'sheet',
      note: 'fd_pad',
      verificationStatus: 'plausible',
    });
  }

  // Identity / ASCII-ish trailer in high DATA
  let asciiStart = -1;
  for (let i = 0xffb0; i <= 0xffd0; i++) {
    const c = buf[i];
    if (c >= 0x20 && c <= 0x7e) {
      if (asciiStart < 0) asciiStart = i;
    } else if (asciiStart >= 0) {
      if (i - asciiStart >= 6) {
        paint(bytes, asciiStart, i - 1, {
          region: 'DATA',
          confidence: 0.75,
          evidence: `ASCII identity string in high DATA: "${buf.slice(asciiStart, i).toString('ascii')}"`,
          source: 're_pipeline',
          note: 'ascii_id',
          verificationStatus: 'plausible',
        });
      }
      asciiStart = -1;
    }
  }

  // XDF claimed map spans — may create mid-CODE DATA islands when addr < 0xB931
  if (opts.xdfText) {
    const spans = parseXdfSpans(opts.xdfText);
    for (const sp of spans) {
      if (sp.start < 0x8000 || sp.start > MEM.DATA_END) continue;
      const inCode = sp.start <= MEM.CODE_END;
      paint(bytes, sp.start, Math.min(sp.end, MEM.DATA_END), {
        region: 'DATA',
        confidence: 0.5,
        evidence: inCode
          ? `XDF candidate span inside CODE≤0xB930 (mid-CODE data island?): ${sp.title}`
          : `XDF candidate span: ${sp.title}`,
        source: 'xdf',
        note: inCode ? 'xdf_mid_code_island' : 'xdf_claim',
        verificationStatus: 'unverified',
      });
    }
  }

  // Ghidra listing instruction starts → raise CODE confidence
  if (Array.isArray(opts.ghidraInsnAddrs) && opts.ghidraInsnAddrs.length) {
    const lang = opts.ghidraLanguage || 'unknown';
    for (const a of opts.ghidraInsnAddrs) {
      if (a < 0x2010 || a > MEM.CODE_END) continue;
      paint(bytes, a, Math.min(a + 2, MEM.CODE_END), {
        region: 'CODE',
        confidence: 0.78,
        evidence: `Ghidra listing instruction start (${lang}); LJMP/LCALL are PC-relative disp16`,
        source: 'ghidra',
        note: 'ghidra_insn',
        verificationStatus: 'plausible',
      });
    }
  }

  // Re-assert vector table + trailing checksum after overlays
  paint(bytes, MEM.VECTOR_START, MEM.VECTOR_END, {
    region: 'VECTOR',
    confidence: 0.7,
    evidence:
      'LE u16 interrupt/vector candidates @0x2000 (sheet: hard-coded vector addresses). Targets 0x4178..0x4194 step +4.',
    source: 'sheet',
    note: 'vector_table_0x2000',
    verificationStatus: 'plausible',
  });
  paint(bytes, 0xfffe, 0xffff, {
    region: 'OTHER',
    confidence: 0.95,
    evidence: 'Trailing 16-bit checksum field (CS16_TRAIL). Full-file sum including these bytes = 0x900A.',
    source: 're_pipeline',
    note: 'cs16_trail',
    verificationStatus: 'cross_checked',
  });

  const runs = runsFromBytes(bytes);

  const byRegion = {};
  for (const r of runs) {
    byRegion[r.region] = (byRegion[r.region] || 0) + r.length;
  }

  const classified = runs
    .filter(r => r.region !== 'UNKNOWN')
    .reduce((a, r) => a + r.length, 0);
  const unknown = buf.length - classified;

  const gaps = runs
    .filter(r => r.region === 'UNKNOWN' || (r.region === 'CODE' && r.confidence < 0.7))
    .map(r => ({
      start: r.start,
      end: r.end,
      length: r.length,
      region: r.region,
      reason:
        r.region === 'UNKNOWN'
          ? 'no classifier rule matched'
          : 'CODE window only coarsely classified — needs ISA-locked disasm/xrefs',
      confidence: r.confidence,
    }));

  return {
    size: buf.length,
    memoryMap: {
      codeStart: MEM.CODE_START,
      codeEndInclusive: MEM.CODE_END,
      codeEndExclusive: MEM.CODE_END_EXCLUSIVE,
      dataStart: MEM.DATA_START,
      dataEndInclusive: MEM.DATA_END,
      note: 'CODE ends at 0xB930 inclusive (Richard baseline RedLabel 413/623).',
    },
    byRegion,
    classifiedBytes: classified,
    unknownBytes: unknown,
    classifiedPct: (100 * classified) / buf.length,
    runs,
    gaps,
    regionStream: bytes.map(b => b.region[0]).join(''),
  };
}
