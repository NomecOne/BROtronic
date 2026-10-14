#!/usr/bin/env python3
"""Extract Bosch M-Motronic Technical Instruction PDF text for RE notes."""
from __future__ import annotations

import re
from pathlib import Path

from pypdf import PdfReader

PDF = Path("tools/re/docs/Bosch-M-Motronic-Technical-Instruction.pdf")
OUT = Path("tools/re/out/_pdf_extract")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(PDF))
    pages: list[str] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages.append(text)
        (OUT / f"page_{i:02d}.txt").write_text(text, encoding="utf-8", errors="replace")

    parts = []
    for i, text in enumerate(pages):
        parts.append(f"===== PAGE {i} (PDF index; booklet page may differ) =====\n{text}")
    (OUT / "all_pages.txt").write_text("\n\n".join(parts), encoding="utf-8", errors="replace")
    print(f"pages={len(pages)} chars={sum(len(t) for t in pages)}")
    print(f"meta_title={reader.metadata.title if reader.metadata else None}")

    keywords = [
        r"air.?mass",
        r"\bHLM\b",
        r"\bHFM\b",
        r"hot.?wire",
        r"hot.?film",
        r"\bload\b",
        r"injection",
        r"ignition",
        r"Lambda",
        r"\bMAF\b",
        r"program.?map",
        r"cylinder.?charge",
        r"idle",
        r"adaptation",
        r"correction",
        r"throttle",
        r"crankshaft",
        r"camshaft",
        r"knock",
        r"injector",
        r"dwell",
        r"injection time",
        r"ignition angle",
        r"operating-data",
        r"fuel system",
    ]
    for i, text in enumerate(pages):
        hits = [k for k in keywords if re.search(k, text, re.I)]
        if not hits:
            continue
        preview = re.sub(r"\s+", " ", text).strip()[:160]
        print(f"p{i+1:02d}: {', '.join(hits[:10])}")
        print(f"     {preview}")


if __name__ == "__main__":
    main()
