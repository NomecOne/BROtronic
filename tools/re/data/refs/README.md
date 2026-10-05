# Reference documents (`tools/re/data/refs`)

Pointers to **local-only** Bosch / BMW reference PDFs used for Motronic RE. Binaries stay out of git (copyright + size).

## Canonical location (Richard)

PDFs live under:

```
tools/re/docs/
```

Do **not** force-commit them. Prefer this README + extracted notes in `tools/re/out/`.

## Primary Motronic reference

| Item | Path | Notes |
|------|------|-------|
| Bosch *M-Motronic Engine Management* Technical Instruction (2000, 4th ed., 68 pp., ~1.33 MiB) | `tools/re/docs/Bosch-M-Motronic-Technical-Instruction.pdf` | **Canonical filename** |
| Same file (duplicate SHA-256) | `tools/re/docs/Bosch M-Motronic Engine Management 89403362.pdf` | Identical content; keep one local copy |

**Structured extract (committed):**  
`tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md`

## Secondary / application

| Item | Path | Notes |
|------|------|-------|
| BMW Product Information VANOS (Aftersales Training, June 2005, ~7.5 MiB) | `tools/re/docs/BMW Product info  Vanos.pdf` | BMW cam/VANOS context; large — local-only |
| E36 GT1 training set | `tools/re/docs/bmw doc e36 gt1 training/` | Coding / EPROM / Progman — not fuel math |

## Optional git-lfs

If you later decide to track refs in-repo:

```bash
git lfs track "tools/re/docs/*.pdf"
# still check copyright redistribution rights before pushing
```

Default for this project: **gitignore PDFs** under `tools/re/docs/` and keep extracts in `tools/re/out/`.
