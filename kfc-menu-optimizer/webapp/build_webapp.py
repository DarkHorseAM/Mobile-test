#!/usr/bin/env python3
"""Inline solver.js and menu.json into the template -> webapp/dist.html."""
import json
from pathlib import Path

here = Path(__file__).parent
template = (here / "index.template.html").read_text()
solver = (here / "solver.js").read_text()
menu = json.loads((here / ".." / "menu.json").read_text())
menu_js = json.dumps(menu, separators=(",", ":"), ensure_ascii=False)

out = template.replace("/*__SOLVER_JS__*/", solver)
out = out.replace("/*__MENU_JSON__*/ null", menu_js)
(here / "dist.html").write_text(out)
print(f"wrote dist.html ({len(out):,} bytes)")
