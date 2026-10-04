import fs from "node:fs";

/** Richard baseline 413/623: CODE section goes to offset 0xB930 (exclusive). */
const CODE_END = 0xb930;
const path = new URL("../out/irq_stubs_review.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(path, "utf8"));

data.schemaVersion = 2;
data.purpose =
  "Human visual review of IRQ stub PC-rel landings (0xAxxx are inside baseline CODE through 0xB930)";
data.codeWindow = {
  start: 0,
  startHex: "0x0000",
  endExclusive: CODE_END,
  endExclusiveHex: "0xB930",
  note: "Richard baseline 413/623: CODE section goes to offset 0xB930 (exclusive). Coarse region map that labeled 0x8000+ as DATA is superseded for this review.",
};
data.addressingNote =
  "LJMP/LCALL are PC-relative disp16; Ghidra SLEIGH correct (blocker1 resolved). Baseline CODE extends through 0xB930 — 0xAxxx landings are inside CODE, not outside it.";

function classify(addr) {
  if (addr < CODE_END) {
    return {
      region_label: "CODE",
      region_note: "baseline_code_to_0xB930",
      inBaselineCode: true,
      coarseMapWasData: addr >= 0x8000,
    };
  }
  return {
    region_label: "DATA",
    region_note: "beyond_baseline_code_0xB930",
    inBaselineCode: false,
    coarseMapWasData: true,
  };
}

for (const land of data.uniqueLandings) {
  const c = classify(land.addr);
  land.region_label = c.region_label;
  land.region_note = c.region_note;
  land.inBaselineCode = c.inBaselineCode;
  land.coarseMapLabel = c.coarseMapWasData ? "DATA" : "CODE";
  land.coarseMapConflict = c.inBaselineCode && c.coarseMapWasData;
}

let axxxInCode = 0;
let baselineCodeLandings = 0;
let beyondCode = 0;

for (const site of data.sites) {
  const addr = site.landing.addr;
  const c = classify(addr);
  const inHighAxxx = addr >= 0xa000 && addr < 0xb000;
  site.landing.region_label = c.region_label;
  site.landing.region_note = c.region_note;
  site.landing.inBaselineCode = c.inBaselineCode;
  site.landing.inHighAxxx = inHighAxxx;
  site.landing.coarseMapLabel = c.coarseMapWasData ? "DATA" : "CODE";
  site.landing.coarseMapConflict = c.inBaselineCode && c.coarseMapWasData;
  if (site.cfg_edge_from) {
    site.cfg_edge_from.toRegion = c.region_label;
    site.cfg_edge_from.coarseMapToRegion = c.coarseMapWasData ? "DATA" : "CODE";
  }

  if (c.inBaselineCode) baselineCodeLandings += 1;
  else beyondCode += 1;
  if (inHighAxxx && c.inBaselineCode) axxxInCode += 1;

  const coarseNote = site.landing.coarseMapConflict
    ? " Coarse map previously labeled this DATA (old CODE end 0x7FFF); Richard baseline CODE through 0xB930 places it inside CODE."
    : "";

  if (c.inBaselineCode) {
    site.explanation =
      `Vector[${site.vectorIndex}] @${site.vectorAddrHex} -> stub ${site.stubAddrHex} ` +
      `(${site.stubPrologue} + LJMP @${site.ljmpAddrHex}) PC-rel CFG: LJMP disp ${site.cfg_edge_from.dispHex} -> ` +
      `${site.landing.addrHex} (baseline CODE, window ends 0xB930).${coarseNote} ` +
      "Encoding is PC-rel LJMP; review whether this landing is a real IRQ handler vs mid-CODE data island — not an outside-CODE map error.";
  } else {
    site.explanation =
      `Vector[${site.vectorIndex}] @${site.vectorAddrHex} -> stub ${site.stubAddrHex} lands at ` +
      `${site.landing.addrHex} beyond baseline CODE end 0xB930 — still needs human review.`;
  }
}

data.axxxLandingCount = axxxInCode;
data.dataLandingCount = beyondCode;
data.baselineCodeLandingCount = baselineCodeLandings;
data.beyondBaselineCodeCount = beyondCode;
data.shippingNote =
  "Review-only. Baseline CODE through 0xB930 accepted for layout; do not promote map edits into definitions/packs/*.shipping.json until map-level verification.";

fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      siteCount: data.siteCount,
      baselineCodeLandingCount: baselineCodeLandings,
      axxxInCode,
      beyondCode,
      landings: data.sites.map((s) => ({
        id: s.id,
        to: s.landing.addrHex,
        region: s.landing.region_label,
        coarseConflict: s.landing.coarseMapConflict,
      })),
    },
    null,
    2,
  ),
);
