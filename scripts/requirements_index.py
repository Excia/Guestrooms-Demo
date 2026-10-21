#!/usr/bin/env python3
"""Print an index of docs/requirements/entries/*.md (IDs, status, file). Writes nothing."""
import re
import sys
from pathlib import Path

ID = re.compile(r"^\|\s*((?:F|Q|D|P)-[\w-]+-\d+)\s*\|(.*)\|\s*$|^- \*\*((?:F|Q|D|P)-[\w-]+-\d+):\*\*\s*(.*)$")
root = Path(__file__).resolve().parent.parent / "docs" / "requirements" / "entries"
seen: dict[str, Path] = {}
status = 0
for path in sorted(root.glob("*.md")):
    if path.name in ("README.md", "_TEMPLATE.md"):
        continue
    lines = path.read_text().splitlines()
    print(f"\n{path.name}: {lines[0].lstrip('# ') if lines else ''}")
    for line in lines:
        if line.startswith("**Status:**"):
            print(f"  {line}")
        m = ID.match(line)
        if not m:
            continue
        ident = m.group(1) or m.group(3)
        text = (m.group(2) or m.group(4) or "").split("|")[0].strip()
        if re.fullmatch(r"(F|Q|D|P)-X-\d+", ident):
            continue  # unfilled template row
        print(f"  {ident}  {text[:90]}")
        if ident in seen:
            print(f"  !! duplicate id {ident} (also in {seen[ident].name})", file=sys.stderr)
            status = 1
        seen[ident] = path
sys.exit(status)
