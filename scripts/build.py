from pathlib import Path
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ICONS = ROOT / "icons"
IMG_EXT = {".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp"}


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

# 图标库：扫描 icons/ 与 icons/index.json 合并后拷贝到 dist（与 dev-server 行为一致）
#  · 替换图片（同名）→ 生效；删除图片 → 元素移除；新增未登记图片 → 归入「自定义图标」分组。
def build_icon_manifest(icons_dir: Path) -> dict:
    curated = {"groups": []}
    idx = icons_dir / "index.json"
    if idx.is_file():
        try:
            curated = json.loads(idx.read_text(encoding="utf-8"))
        except Exception as err:  # noqa: BLE001
            print(f"WARN read icons/index.json failed: {err}")
    existing = {p.name for p in icons_dir.iterdir() if p.suffix.lower() in IMG_EXT}
    referenced = set()
    groups = []
    for g in curated.get("groups", []):
        devices = []
        for d in g.get("devices", []):
            f = d.get("file")
            if not f:
                devices.append(d)            # 纯绘制元素（文本框/变量节点）无图片，保留
            elif f in existing:
                referenced.add(f)
                devices.append(d)
            # else: 图片已删除 → 移除该元素
        if devices:
            ng = dict(g)
            ng["devices"] = devices
            groups.append(ng)
    extras = sorted(f for f in existing if f not in referenced)
    # 自动归组：未登记的图片按文件名前缀匹配已有元素类型（最长匹配），落到该类型所在分组；
    #  例如 bms_charge.png → 前缀 bms → 归入「储能设备」。无任何匹配时才进「自定义图标」兜底。
    type_to_group_idx = {}
    for gi, g in enumerate(groups):
        for d in g.get("devices", []):
            type_to_group_idx[d["type"]] = gi
    known_types = list(type_to_group_idx.keys())
    custom_devices = []
    for f in extras:
        stem = Path(f).stem
        if stem in type_to_group_idx:  # 与已有类型同名，跳过避免重复
            continue
        best = None
        for t in known_types:
            if stem.startswith(t + "_") and (best is None or len(t) > len(best)):
                best = t
        dev = {"type": stem, "label": stem, "label_en": stem, "badge": stem, "file": f}
        if best is not None:
            groups[type_to_group_idx[best]]["devices"].append(dev)
        else:
            custom_devices.append(dev)
    if custom_devices:
        groups.append({
            "title": "自定义图标", "title_en": "Custom Icons", "color": "#42a5f5", "tab": "device",
            "devices": custom_devices,
        })
    out = dict(curated)
    out["groups"] = groups
    return out


if ICONS.is_dir():
    dist_icons = DIST / "icons"
    dist_icons.mkdir(parents=True, exist_ok=True)
    n = 0
    for p in ICONS.iterdir():
        if p.suffix.lower() in IMG_EXT:
            shutil.copy2(p, dist_icons / p.name)
            n += 1
    manifest = build_icon_manifest(ICONS)
    (dist_icons / "index.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    dev_count = sum(len(g.get("devices", [])) for g in manifest.get("groups", []))
    print(f"Copied icons/ ({n} images, {dev_count} devices in manifest)")

# 模板库：原样拷贝 templates/ 到 dist（每个模板单独 JSON + index.json，前端按需加载）
tpl_src = ROOT / "templates"
if tpl_src.is_dir():
    shutil.copytree(tpl_src, DIST / "templates")
    print(f"Copied templates/ ({len(list(tpl_src.glob('*.json')))} files)")

print("Build complete: dist/")
for rel in outputs:
    size = (DIST / rel).stat().st_size / 1024
    print(f"{rel} {size:.1f}KB")
