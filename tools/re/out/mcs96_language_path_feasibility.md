# MCS-96 language path feasibility (RedLabel)

**Target:** BMW RedLabel 64KB flat ROM · MCS-96 / 80C196-class · **not** x86 · `C16x900A` = CS16 only  
**Date:** 2026-10-14  
**Repo evidence:** `tools/re` Ghidra headless (PR #5 lineage), `MCS96:LE:16:default`, Blocker 1 resolved  

---

## Executive answers (yes / no)

| Question | Answer | One-liner |
|----------|--------|-----------|
| Reconstruct an MCS-96 pipeline **from 8096 / MCS-96 docs**? | **Yes** | Manuals exist and match what we already run; docs validate the stack, they do not require rebuilding SLEIGH. |
| Create an MCS **language path** (agent / tool admission)? | **Yes** | Prefer local Ghidra wrap (B) + optional extension profile (D); not a new SLEIGH (C); REA upstream (A) is optional/slow. |
| Tools / plugins / extensions / code? | **Yes (already)** | `ForceDisassembleRedLabel` + `ExportRedLabel` + headless scripts + Node CFG/ingest are the working path. |
| Input **simulator** (ADC/HSI → fuel/ign CAL)? | **Not yet / later** | No ready open 80C196 MCU sim; commercial legacy or MAME core + custom I/O = weeks+, not days. |

**Recommended option:** **B** (local REA-like MCP/shim → `tools/re` Ghidra headless), with **D** as a small packaging upgrade.  
**Do not** implement full SLEIGH (**C**) unless a concrete decode bug appears.  
**Minimum effort to interactive RE of this ROM:** **~2–5 days** (Ghidra GUI + existing headless), not weeks.

---

## 1. From 8096 docs → complete pipeline

### What a complete stack needs

| Layer | Role for RedLabel | Status |
|-------|-------------------|--------|
| **Instruction decode / SLEIGH** | Disassemble CODE `0x2000–0xB930` | **Stock Ghidra `MCS96:LE:16:default`** — proven (~5972 insn / ~213 fn) |
| **Loader** | Flat 64KB image @ base `0x0000` | **Ghidra `BinaryLoader`** — already used in `run_headless.*` |
| **Entry / seed** | No ELF/PE entry; vectors @ `0x2000` | **`ForceDisassembleRedLabel.java`** seeds LE16 vectors + landmarks |
| **Calling conventions / cspec** | Decompiler / stack / register-file ABI | **Minimal stock `MCS96.cspec`** — register-file MCU style; weak vs C ABIs; adequate for listing/CFG |
| **Memory / SFR map** | REG_FILE + HSI/HSO/ADC/ports | **Partial** — `MCS96.pspec` REG_FILE `0x00–0x1FF`; SFR names incomplete (HSO/HSI R/W aliases — see audit) |
| **Export / offline merge** | Listing → byte_map / CFG / XDF | **`ExportRedLabel.java` + Node annotate/ingest** |
| **Simulator** | Drive ADC/HSI, observe CAL/fuel/ign | **Missing** in Ghidra; separate effort (§3) |

### Already in Ghidra MCS96 (keep)

- Language id: `MCS96:LE:16:default` (`MCS96.sla` / `.sinc` / `.pspec` / `.cspec`)
- External names include `8096`, `80196`, `80196np` (IDA aliases)
- Manual index: `MCS96.idx` → *1991 Intel 16-Bit Embedded Controller Handbook*
- **LJMP / LCALL:** SLEIGH `inst_next + disp16` matches Intel MCS-96 Macro Assembler — **385/385** Ghidra-aligned edges (`blocker1_ljmp_lcall.md`). **Do not rewrite SLEIGH for absolute targets.**

### Must extend or rebuild (narrow)

| Gap | Rebuild SLEIGH? | Preferred fix |
|-----|-----------------|---------------|
| Raw binary needs seeds | No | Keep / polish `ForceDisassembleRedLabel` |
| HSI vs HSO naming @ `0x04`/`0x06` | No (cosmetic + analysis) | Overlay symbols / notes (`sfr_hso_hsi_audit.md` already cross_checked) |
| Decompiler calling convention | Optional tiny cspec tweak | Only if decomp quality blocks RE |
| Flat 64K “DME profile” (regions, vectors, CODE end) | No | Extension **loader profile** or script package (**D**) |
| Instruction-level I/O sim | N/A | External sim (§3) |

### Findable Intel manuals (cite)

| Document | Use | Access |
|----------|-----|--------|
| **MCS-96 Macro Assembler User’s Guide** (DOS), e.g. 122350-003 | LJMP/LCALL PC-rel, opcode map, 8096 vs 80C196KB/KC deltas | Public archive: [mark-ogden.uk MCS-96 Macro Assembler](https://mark-ogden.uk/files/intel/publications/122350-003%20MCS-96%20Macro%20Assembler%20User%27s%20Guide%20for%20DOS%20systems.pdf) |
| **AP-248 Using the 8096** (270061-002, Sep 87) | HSI/HSO/ADC/PWM usage patterns | [mark-ogden.uk AP-248](https://mark-ogden.uk/files/intel/publications/270061-002%20AP-248%20Using%20the%208096-Sep87.PDF) |
| **80C196KB / KC User’s Guides** (e.g. 270704 cited in assembler bib) | SFR map: `HSO_COMMAND`/`HSI_STATUS` @ `06H`, `HSO_TIME`/`HSI_TIME` @ `04H` | Cited in repo SFR audit; still the authority for R/W aliases |
| **1991 Intel 16-Bit Embedded Controller Handbook** | Ghidra `MCS96.idx` page map for opcodes | Referenced by stock Ghidra processor module |

**Verdict on “reconstruct from docs”:** Yes — documentation is sufficient to **verify** and **annotate** the pipeline. Stock Ghidra already embodies the instruction set for our purposes; docs close peripheral/SFR semantics, not a greenfield SLEIGH rewrite.

---

## 2. Create an MCS language path — ranked options

### A) Fix / extend REA admission (raw `.bin` + force `MCS96`)

**Idea:** Upstream or plugin so REA `open_binary` accepts flat ROM and selects Ghidra language `MCS96:LE:16:default`.

**Observed REA limits (this host / MCP):**

- `open_binary` admits structured executables / archives / JS / analysis DBs; headerless path is only **`format=dos-com`** (DOS COM), not arbitrary 64KB MCU ROM.
- `list_architectures` is **Mach-O slice listing only** — no MCS-96 language selector.
- No MCS96 / Ghidra language force parameter in the exposed schema.

**Pros:** Interactive REA tools (pseudo, xrefs) if Ghidra provider is wired.  
**Cons:** Depends on upstream REA product work; timeline uncertain; wraps the same Ghidra we already drive headless.  
**Effort:** **weeks+** (upstream + test) · **Do not block RedLabel RE on this.**

### B) Local “REA-like” MCP / shim → `tools/re` Ghidra headless *(recommended)*

**Idea:** Thin MCP (or Cursor tools) that shells to existing pipeline:

- `run_headless.ps1` / `.sh` with `-processor MCS96:LE:16:default`
- `ForceDisassembleRedLabel` / `ExportRedLabel`
- Optional: `correct_ljmp_targets.mjs`, listing grep, CFG JSON

**Pros:** Zero SLEIGH risk; reuses proven PR #5 path; works with raw `.bin` today; agent-interactive without waiting on REA.  
**Cons:** Not full REA decompiler UX; listing/CSV oriented unless GUI Ghidra is opened beside it.  
**Effort:** **2–4 days** for a useful shim (import status, listing query, function list, seed re-run).

### C) Author new SLEIGH from 8096 docs

**Only if stock MCS96 is insufficient.** Current evidence says it is **sufficient**:

- ISA locked: `isa_ghidra_conclusion.md`
- LJMP/LCALL PC-rel correct: `blocker1_ljmp_lcall.md`
- Known “gaps” are SFR **naming** and memory-map **profile**, not opcode decode

**Effort if forced:** **multi-week** specialist work · **high risk, low reward** · **reject unless a hard decode bug is proven.**

### D) Ghidra extension / plugin packaging our scripts as a reusable profile

**Idea:** Package as a Ghidra extension:

- Default language `MCS96:LE:16:default`
- BinaryLoader preset: base `0`, 64KB, block `ROM`
- Pre/post scripts: ForceDisassemble + Export
- Optional: RedLabel memory map labels (PAD / VECTOR / CODE / DATA_CAL)

**Pros:** One-click GUI + headless; shareable; still stock SLEIGH.  
**Cons:** Extension build/jar packaging overhead vs loose scripts.  
**Effort:** **3–7 days** for a polished profile; **1–2 days** for a “scriptPath + README recipe” stopgap.

### Ranking

| Rank | Option | Effort | Use when |
|------|--------|--------|----------|
| **1** | **B** Local MCP/shim → tools/re | Days | Agent + CI interactive RE now |
| **2** | **D** Ghidra extension/profile | Days | Human GUI + reusable import |
| **3** | **A** REA admission | Weeks+ | Want REA UX after B/D work |
| **4** | **C** New SLEIGH | Weeks+ | Only on proven decode failure |

---

## 3. Simulator (input → observe CAL / fuel / ign)

### Existing 8096 / MCS-96 simulators

| Product | Type | Fit for RedLabel |
|---------|------|------------------|
| **ChipView-x96** (ChipTools, legacy) | PC instruction-set simulator (DOS/Win) | Historically correct class; availability / licensing / modern OS unclear |
| **Phyton PDS-96** / Project-96 | Commercial sim + ICE for 80C196 KB/KC/KD | Best MCU fidelity if obtainable; not open |
| **MAME `devices/cpu/mcs96`** (+ `i8xc196`) | Open CPU core (arcade lineage) | Instruction engine exists; **not** a turnkey 80C196KB with ADC/HSI/HSO for automotive ROM |
| **uCsim** | Open MCU sim (MCS-51, AVR, …) | **No MCS-96** family listed |
| Academic **SIM8096** etc. | Teaching tools | Not maintained / not RE-grade |

### Feasibility: instruction-level sim for ADC/HSI → fuel/ign CAL reads

| Scope | What you get | Effort |
|-------|--------------|--------|
| **CPU-only ISS** (regs, ROM, RAM, basic branches) | Step CODE; see register-file / CAL loads | **1–3 weeks** if forking MAME core or writing thin ISS from opcode tables |
| **Useful I/O stub** (fake ADC results, HSI captures, TIMER1, INT_PEND) | Drive “inputs,” watch paths that read AD_result / HSI_time / CAL tables | **+2–6 weeks** after CPU-only (depends on how many peripheral side-effects firmware assumes) |
| **Cycle-accurate HSO spark/inj schedule** | Match hardware timing | **Months** / ICE territory — out of scope for near-term RE |

**Practical RE substitute (days, no full sim):** Ghidra listing + breakpoints on SFR / CAL xrefs + Node dataflow scripts already in `tools/re` (`cal_access_model`, `sfr_hso_hsi_audit`, `ignition_fuel_dataflow`). Enough to hypothesize until a sim is justified.

---

## 4. Recommendation — minimum path to interactive RE

### Do this (days)

1. **Keep stock Ghidra MCS96** — no SLEIGH rewrite.
2. **Interactive RE:** open the same project GUI Ghidra creates via headless, **or** re-import with the documented `BinaryLoader` + `MCS96:LE:16:default` + ForceDisassemble recipe (`tools/re/README.md`).
3. **Agent language path:** implement **B** (MCP/shim over `npm run re:ghidra:win` / Linux headless + query exports under `tools/re/out/ghidra/`).
4. **Optional polish:** **D** — package scripts as a RedLabel / Motronic loader profile (regions + vectors).
5. **SFR overlay only** — dual-name HSO/HSI from Intel 80C196KB (already audited); do not wait for upstream `.sinc` rename.

### Defer

- **A** REA raw-bin + MCS96 until B is boring and you need REA-native decomp.
- **C** New SLEIGH unless a concrete wrong mnemonic/operand appears.
- **Full input simulator** until static CODE→CAL coverage stalls; then start with stubbed ADC/HSI on a thin ISS, not cycle-accurate HSO.

### Effort summary

| Goal | Effort |
|------|--------|
| Interactive disasm/CFG of RedLabel (human) | **Already done / hours** with installed Ghidra |
| Agent “MCS language path” via **B** | **~2–5 days** |
| Packaged Ghidra profile **D** | **~3–7 days** |
| REA **A** | **weeks+**, optional |
| New SLEIGH **C** | **weeks+**, not justified now |
| Input sim (useful stubs) | **~1–2 months** for first useful loop; not required for first interactive RE |

### Bottom line

- **Docs → pipeline:** **Yes** — Intel 8096 / MCS-96 / 80C196 manuals confirm the stack; Ghidra stock MCS96 + BinaryLoader + our seed/export scripts **are** the pipeline.
- **MCS language path:** **Yes** — choose **B** (+ **D**); skip **C**; treat **A** as later.
- **Simulator:** **Feasible later, not blocking** — no open drop-in; commercial legacy or custom/MAME-based ISS with stubbed ADC/HSI.

**Primary recommendation: Option B, leverage stock Ghidra MCS96, ~days not weeks.**
