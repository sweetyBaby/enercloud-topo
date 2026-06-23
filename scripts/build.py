from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def write(rel: str, content: str) -> None:
    target = DIST / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def minify_css(css: str) -> str:
    css = re.sub(r"/\*[\s\S]*?\*/", "", css)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{}:;,>+~])\s*", r"\1", css)
    return css.replace(";}", "}").strip()


def minify_js(js: str) -> str:
    lines = []
    for line in js.splitlines():
        stripped = line.strip()
        if stripped.startswith("//"):
            continue
        lines.append(line.rstrip())
    return re.sub(r"\n{2,}", "\n", "\n".join(lines)).strip()


def minify_html(html: str) -> str:
    html = re.sub(r">\s+<", "><", html)
    html = re.sub(r"\n{2,}", "\n", html)
    return html.strip() + "\n"


if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir(parents=True)

outputs = {
    "topo.html": minify_html(read("topo.html")),
    "topo-editor/topology-editor.css": minify_css(read("topo-editor/topology-editor.css")) + "\n",
    "topo-editor/topology-editor-icons.js": minify_js(read("topo-editor/topology-editor-icons.js")) + "\n",
    "topo-editor/topology-editor.js": minify_js(read("topo-editor/topology-editor.js")) + "\n",
}

for rel, content in outputs.items():
    write(rel, content)

# 模板库：原样拷贝 templates/ 到 dist（每个模板单独 JSON + index.json，前端按需加载）
tpl_src = ROOT / "templates"
if tpl_src.is_dir():
    shutil.copytree(tpl_src, DIST / "templates")
    print(f"Copied templates/ ({len(list(tpl_src.glob('*.json')))} files)")

print("Build complete: dist/")
for rel in outputs:
    size = (DIST / rel).stat().st_size / 1024
    print(f"{rel} {size:.1f}KB")
