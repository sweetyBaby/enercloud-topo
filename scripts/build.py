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

# 编辑器逻辑已按职责拆为 12 个有序片段（01→12 顺序即执行顺序，共享同一全局作用域，等价于原单文件；
#  12-bootstrap 必须最后：待 01→11 全部函数定义后再启动 init()）。逐个 minify 后拷贝到 dist，
#  topo.html 按同一顺序用 <script> 引入。新增/调整片段务必同步维护本列表与 topo.html 的 <script> 顺序。
EDITOR_JS_PARTS = [
    "topology-editor-01-core.js",
    "topology-editor-02-toolbar.js",
    "topology-editor-03-input.js",
    "topology-editor-04-geometry.js",
    "topology-editor-05-routing.js",
    "topology-editor-06-render.js",
    "topology-editor-07-editing.js",
    "topology-editor-08-serialize.js",
    "topology-editor-09-rules.js",
    "topology-editor-10-library-export.js",
    "topology-editor-11-templates-runtime.js",
    "topology-editor-12-bootstrap.js",  # 必须最后：待 01→11 全部函数定义后再启动 init()
]

outputs = {
    "topo.html": minify_html(read("topo.html")),
    "topo-editor/topology-editor.css": minify_css(read("topo-editor/topology-editor.css")) + "\n",
    "topo-editor/topology-editor-icons.js": minify_js(read("topo-editor/topology-editor-icons.js")) + "\n",
    # headless 核心包（topo.html 以 <script> 引入，路径与源码一致）
    "packages/topology-runtime/topology-runtime.js": minify_js(read("packages/topology-runtime/topology-runtime.js")) + "\n",
    "packages/topology-runtime/rules.js": minify_js(read("packages/topology-runtime/rules.js")) + "\n",
}
for part in EDITOR_JS_PARTS:
    outputs["topo-editor/" + part] = minify_js(read("topo-editor/" + part)) + "\n"

for rel, content in outputs.items():
    write(rel, content)

# 护栏：topo.html 里引用的每个本地 js/css 都必须在 outputs 清单里（dev-server 直接服务文件系统，
#  清单漏项只会在 dist 环境 404 → 编辑器白屏且只在生产构建复现；这里在构建期就拦下）。
_refs = re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"', outputs["topo.html"])
_missing = [r for r in _refs if not r.startswith(("http://", "https://", "//")) and r not in outputs]
if _missing:
    raise SystemExit(f"BUILD FAIL: topo.html 引用了未纳入 dist 清单的本地资源: {_missing}（更新 outputs/EDITOR_JS_PARTS）")

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

# 模板库：拷贝模板 JSON 到 dist，并「扫描生成」index.json（与 dev/生产 server 同逻辑；
#  纯静态托管 dist 时前端仍能读到清单。增删改 templates/*.json 重新 build 即自动反映）。
def template_preview(doc: dict):
    try:
        if isinstance(doc.get("preview"), dict) and isinstance(doc["preview"].get("pts"), list):
            return doc["preview"]
        src = doc.get("seed") or doc.get("canvas") or doc
        nodes = (src or {}).get("nodes") or []
        if not nodes:
            return None
        idx_map, pts = {}, []
        for i, nd in enumerate(nodes):
            idx_map[nd.get("id")] = i
            p = nd.get("position") or nd
            # 与 JS Math.round 一致（四舍五入·半值向上），避免 Python round 的银行家舍入造成预览坐标分歧
            jsround = lambda v: int((float(v) + 0.5) // 1)
            pts.append([jsround(p.get("x") or 0), jsround(p.get("y") or 0)])
        edges = []
        for e in ((src or {}).get("edges") or []):
            a, b = idx_map.get(e.get("from")), idx_map.get(e.get("to"))
            if a is None or b is None:
                continue
            color = e.get("color") or (e.get("style") or {}).get("color") or "#4dd0ff"
            edges.append([a, b, color])
        return {"pts": pts, "edges": edges}
    except Exception:
        return None


def build_template_index(tpl_dir: Path) -> dict:
    entries = []
    for fp in sorted(tpl_dir.glob("*.json")):
        if fp.name == "index.json":
            continue
        try:
            doc = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(doc, dict):
            continue  # 顶层为数组/标量的 JSON 不是模板，跳过（与 JS 扫描器一致，不报错）
        looks_like_canvas = bool(doc.get("canvas") or doc.get("seed") or isinstance(doc.get("nodes"), list))
        if not doc.get("template") and not looks_like_canvas:
            continue
        t = doc.get("template") or {}
        tid = re.sub(r"[^a-zA-Z0-9_-]", "", str(t.get("id") or fp.stem))[:64]
        if not tid:
            continue
        entries.append({
            "id": tid,
            "name": t.get("name") or tid,
            "nameEn": t.get("nameEn") or t.get("name") or tid,
            "desc": t.get("desc") or "",
            "file": fp.name,
            "builtin": bool(t.get("builtin")),
            "_def": bool(t.get("default")),
            "preview": template_preview(doc),
        })
    entries.sort(key=lambda e: (not e["builtin"], e["file"]))  # 内置在前·按文件名
    default = next((e["id"] for e in entries if e["_def"]), entries[0]["id"] if entries else None)
    for e in entries:
        e.pop("_def", None)
    return {"schemaVersion": "tpl-index-1", "default": default, "templates": entries}


tpl_src = ROOT / "templates"
if tpl_src.is_dir():
    dist_tpl = DIST / "templates"
    dist_tpl.mkdir(parents=True, exist_ok=True)
    n = 0
    for fp in tpl_src.glob("*.json"):
        if fp.name == "index.json":
            continue  # 由扫描重新生成，不拷贝源 index.json
        shutil.copy2(fp, dist_tpl / fp.name)
        n += 1
    manifest = build_template_index(tpl_src)
    (dist_tpl / "index.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Copied templates/ ({n} files) + generated index.json ({len(manifest['templates'])} templates, default={manifest['default']})")

# 后台字段字典 dic/：拷贝 *.json + 扫描合并生成 dic/index.json（按 deviceType 归并；增删改字典文件重新 build 即反映）
dic_src = ROOT / "dic"
if dic_src.is_dir():
    dist_dic = DIST / "dic"
    dist_dic.mkdir(parents=True, exist_ok=True)
    merged: dict = {}
    n = 0
    for fp in dic_src.glob("*.json"):
        if fp.name == "index.json":
            continue
        shutil.copy2(fp, dist_dic / fp.name)
        n += 1
        try:
            arr = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(arr, list):
            continue
        for g in arr:
            if not isinstance(g, dict):
                continue
            dt, fields = g.get("deviceType"), g.get("fields")
            if not dt or not isinstance(fields, list):
                continue
            merged.setdefault(dt, []).append({"location": g.get("location") or "", "fields": fields})
    (dist_dic / "index.json").write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Copied dic/ ({n} files) + generated index.json (deviceTypes: {', '.join(merged.keys()) or 'none'})")

# 设备档案 device/：原样拷贝（device-type.json / device-info.json 等，内容变更由前端 no-store 重新拉取）
dev_src = ROOT / "device"
if dev_src.is_dir():
    shutil.copytree(dev_src, DIST / "device", dirs_exist_ok=True)
    print(f"Copied device/ ({len(list(dev_src.glob('*.json')))} files)")

print("Build complete: dist/")
for rel in outputs:
    size = (DIST / rel).stat().st_size / 1024
    print(f"{rel} {size:.1f}KB")
