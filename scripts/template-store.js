// ───── 模板读写存储 + HTTP API（dev-server 与生产 server 共用） ─────
// 保存/编辑/重命名/删除直接落盘到模板目录里的单个 <id>.json；模板「清单」由 buildIndexFromDir(dir)
// 实时扫描目录动态生成，不再维护 index.json 文件。
// 通过 createTemplateApi({dir, log, warn}) 绑定到具体目录，返回 {matches, handle, dir, buildIndex}。
const fs = require('fs');
const path = require('path');
const url = require('url');

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}
function safeId(id) {
  // 只允许字母/数字/下划线/连字符，避免目录穿越
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 16 * 1024 * 1024) { reject(new Error('payload too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}
function genTplId(idx) {
  let n = 1;
  const taken = new Set((idx.templates || []).map((t) => t.id));
  while (taken.has(`tpl_${n}`)) n += 1;
  return `tpl_${n}`;
}
// 从模板文档(seed/canvas)里取节点与连线，给 index.json 生成轻量缩略图预览
function previewFromDoc(doc) {
  try {
    if (doc && doc.preview && Array.isArray(doc.preview.pts)) return doc.preview;
    const src = doc && (doc.seed || doc.canvas || doc);
    const nodes = (src && src.nodes) || [];
    if (!nodes.length) return undefined;
    const idxMap = {};
    const pts = nodes.map((nd, i) => {
      idxMap[nd.id] = i;
      const p = nd.position || nd;
      return [Math.round(+p.x || 0), Math.round(+p.y || 0)];
    });
    const edges = ((src && src.edges) || []).map((e) => {
      const a = idxMap[e.from], b = idxMap[e.to];
      if (a == null || b == null) return null;
      return [a, b, (e.color || (e.style && e.style.color) || '#4dd0ff')];
    }).filter(Boolean);
    return { pts, edges };
  } catch (err) { return undefined; }
}

// ───── 模板清单：由目录扫描动态生成（不再依赖 index.json 落盘） ─────
// 每个模板 .json 自带元数据(doc.template) + 可由画布(seed/canvas/nodes)生成预览，
// 因此增删改模板文件后清单自动更新；无需维护 index.json。
// 默认模板：某文件 template.default===true 则为默认，否则取排序后第一个（内置在前·按文件名）。
function buildIndexFromDir(dir) {
  const out = { schemaVersion: 'tpl-index-1', default: null, templates: [] };
  let files = [];
  try { files = fs.readdirSync(dir); } catch (err) { return out; }
  const entries = [];
  for (const file of files) {
    if (!file.endsWith('.json') || file === 'index.json') continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (err) { continue; }
    // 必须看起来像「模板/画布」：有 template 块，或有 canvas/seed/nodes
    const looksLikeCanvas = !!(doc && (doc.canvas || doc.seed || Array.isArray(doc.nodes)));
    if (!doc || (!doc.template && !looksLikeCanvas)) continue;
    const t = doc.template || {};
    const id = safeId(t.id) || safeId(file.replace(/\.json$/, ''));
    if (!id) continue;
    entries.push({
      id,
      name: t.name || id,
      nameEn: t.nameEn || t.name || id,
      desc: t.desc || '',
      file,
      builtin: !!t.builtin,
      _def: !!t.default,
      preview: previewFromDoc(doc),
    });
  }
  entries.sort((a, b) => {
    if (a.builtin !== b.builtin) return a.builtin ? -1 : 1; // 内置在前
    return a.file < b.file ? -1 : (a.file > b.file ? 1 : 0); // 同类按文件名
  });
  const def = entries.find((e) => e._def);
  out.default = def ? def.id : (entries[0] ? entries[0].id : null);
  out.templates = entries.map(({ _def, ...rest }) => rest);
  return out;
}

// 创建绑定到指定模板目录的 API 处理器
function createTemplateApi(opts) {
  const dir = opts.dir;
  const log = opts.log || (() => {});
  const warn = opts.warn || (() => {});

  function readIndex() { return buildIndexFromDir(dir); }   // 实时扫描目录，不读 index.json

  // 是否归该 API 处理（GET 列表 + 写操作）
  function matches(pathname) {
    return pathname === '/api/templates' || pathname.startsWith('/api/templates/');
  }

  async function handle(req, res, pathname) {
    const method = req.method || 'GET';
    const rest = pathname.replace(/^\/api\/templates\/?/, '');
    const id = safeId(decodeURIComponent(rest));
    try {
      // GET /api/templates → 返回清单（前端读列表也可直接 GET 静态 templates/index.json）
      if (method === 'GET' && !rest) return sendJSON(res, 200, readIndex());

      // POST /api/templates → 新建模板：写 <id>.json（清单由目录扫描得出，无需落盘 index.json）
      if (method === 'POST' && !rest) {
        const body = await readBody(req);
        const meta = body.template || {};
        const idx = readIndex();
        const newId = safeId(meta.id) || genTplId(idx);
        if (!meta.name) return sendJSON(res, 400, { ok: false, error: 'name required' });
        if ((idx.templates || []).some((t) => t.id === newId)) return sendJSON(res, 409, { ok: false, error: 'id exists' });
        const file = `${newId}.json`;
        const doc = { schemaVersion: 'tpl-1', template: { id: newId, name: meta.name, nameEn: meta.nameEn || meta.name, desc: meta.desc || '', builtin: false } };
        if (body.canvas) doc.canvas = body.canvas; else if (body.seed) doc.seed = body.seed;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, file), JSON.stringify(doc, null, 2), 'utf8');
        const entry = { id: newId, name: meta.name, nameEn: meta.nameEn || meta.name, desc: meta.desc || '', file, builtin: false, preview: previewFromDoc(body) };
        log(`Template created: ${newId}`);
        return sendJSON(res, 200, { ok: true, entry, default: readIndex().default });
      }

      // PUT /api/templates/:id → 编辑(改内容)或重命名(改 meta)：只改 <id>.json 自身
      if (method === 'PUT' && id) {
        const body = await readBody(req);
        const idx = readIndex();
        const entry = (idx.templates || []).find((t) => t.id === id);
        if (!entry) return sendJSON(res, 404, { ok: false, error: 'not found' });
        const file = entry.file || `${id}.json`;
        const fp = path.join(dir, file);
        let doc = {};
        try { if (fs.existsSync(fp)) doc = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (err) { /* rebuild */ }
        doc.schemaVersion = doc.schemaVersion || 'tpl-1';
        doc.template = doc.template || { id, builtin: entry.builtin };
        const meta = body.template || {};
        if (meta.name != null) { entry.name = meta.name; doc.template.name = meta.name; }
        if (meta.nameEn != null) { entry.nameEn = meta.nameEn; doc.template.nameEn = meta.nameEn; }
        if (meta.desc != null) { entry.desc = meta.desc; doc.template.desc = meta.desc; }
        doc.template.id = id;
        // 内容更新（编辑模板）：传入 canvas 或 seed 则覆盖
        if (body.canvas) { doc.canvas = body.canvas; delete doc.seed; entry.preview = previewFromDoc(body); }
        else if (body.seed) { doc.seed = body.seed; delete doc.canvas; entry.preview = previewFromDoc(body); }
        fs.writeFileSync(fp, JSON.stringify(doc, null, 2), 'utf8');
        log(`Template updated: ${id}`);
        return sendJSON(res, 200, { ok: true, entry });
      }

      // DELETE /api/templates/:id → 删除 <id>.json（清单随之自动少一项）
      if (method === 'DELETE' && id) {
        const idx = readIndex();
        const entry = (idx.templates || []).find((t) => t.id === id);
        if (!entry) return sendJSON(res, 404, { ok: false, error: 'not found' });
        const fp = path.join(dir, entry.file || `${id}.json`);
        try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (err) { warn(`Delete ${fp} failed: ${err.message}`); }
        log(`Template deleted: ${id}`);
        return sendJSON(res, 200, { ok: true, default: readIndex().default });
      }

      return sendJSON(res, 405, { ok: false, error: 'method not allowed' });
    } catch (err) {
      warn(`Template API error: ${err.stack || err}`);
      return sendJSON(res, 400, { ok: false, error: String(err.message || err) });
    }
  }

  // buildIndex(): 扫描目录得到清单（供两端拦截 /templates/index.json 复用）
  return { matches, handle, dir, buildIndex: () => buildIndexFromDir(dir) };
}

module.exports = { createTemplateApi, send, buildIndexFromDir };
