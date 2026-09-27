from pathlib import Path
import re

p = Path("README.md")
text = p.read_text(encoding="utf-8")
new_head = """<div align=\"center\">
  <img src=\"docs/images/xhamil-brand.png?v=5#gh-light-mode-only\" alt=\"XhaMil\" width=\"420\" />
  <img src=\"docs/images/xhamil-brand-white.png?v=5#gh-dark-mode-only\" alt=\"XhaMil\" width=\"420\" />

  <h1>XhaMil Chat AI</h1>
"""
text2, n = re.subn(
    r"<div align=\"center\">[\s\S]*?<h1>XhaMil Chat AI</h1>",
    new_head,
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f"replace failed n={n}")
p.write_text(text2, encoding="utf-8")
print("ok")
print(text2[:450])
