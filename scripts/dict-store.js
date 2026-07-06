// ───── 值字典读写存储 + HTTP API（dev-server 与生产 server 共用） ─────
// 值字典 = code 码 → 中/英显示文案 的转义表（画布字段/全局信号的值经它转义后显示）。
// 每个字典是 value-dicts/ 目录下的单个 <type>.json：
//   { schemaVersion:'vd-1', type, name, nameEn, applyTo:[{deviceType,field:'location.field'}], items:[{code,zh,en}] }
// 字典「清单」由 buildIndexFromDir(dir) 实时扫描目录动态生成（增删改 *.json 即自动反映），
// 与 template-store / icon-store 同构。通过 createDictApi({dir, log, warn}) 绑定目录，
// 返回 {matches, handle, dir, buildIndex}。
const fs = require('fs');
const path = require('path');

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}
function safeType(t) {
  // 只允许字母/数字/下划线/连字符，避免目录穿越
  return String(t || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 4 * 1024 * 1024) { reject(new Error('payload too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}
// 条目校验（与编辑器弹框校验一致）：code/中文/英文三项必填、code 同字典内唯一；命中返回错误消息，否则 null
function itemsError(items) {
  if (!Array.isArray(items)) return null;
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const code = String(it.code == null ? '' : it.code).trim();
    const zh = String(it.zh || '').trim();
    const en = String(it.en || '').trim();
    if (!code || !zh || !en) return `item #${i + 1}: code/zh/en are all required`;
    if (seen.has(code)) return `duplicate code: ${code}`;
    seen.add(code);
  }
  return null;
}
// 归一化一份字典（POST/PUT 入库前统一清洗；items/applyTo 非法项静默剔除）
function normalizeDict(type, body) {
  const items = (Array.isArray(body.items) ? body.items : [])
    .filter((it) => it && it.code !== undefined && it.code !== null && String(it.code) !== '')
    .map((it) => ({ code: String(it.code), zh: String(it.zh || ''), en: String(it.en || '') }));
  const applyTo = (Array.isArray(body.applyTo) ? body.applyTo : [])
    .filter((a) => a && a.field)
    .map((a) => ({ deviceType: String(a.deviceType || ''), field: String(a.field) }));
  return {
    schemaVersion: 'vd-1',
    type,
    name: String(body.name || type),
    nameEn: String(body.nameEn || body.name || type),
    applyTo,
    items,
  };
}

// ───── 字典清单：扫描目录里的 *.json 动态生成（不维护 index.json 落盘） ─────
function buildIndexFromDir(dir) {
  const out = { schemaVersion: 'vd-index-1', dicts: [] };
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort(); }
  catch (err) { return out; }
  for (const file of files) {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (err) { continue; }
    if (!doc || typeof doc !== 'object') continue;
    const type = safeType(doc.type) || safeType(file.replace(/\.json$/, ''));
    if (!type) continue;
    if (out.dicts.some((d) => d.type === type)) continue;   // type 冲突：先到先得（文件名有序，结果稳定）
    out.dicts.push({
      type,
      name: doc.name || type,
      nameEn: doc.nameEn || doc.name || type,
      applyTo: Array.isArray(doc.applyTo) ? doc.applyTo.filter((a) => a && a.field) : [],
      items: Array.isArray(doc.items) ? doc.items.filter((it) => it && it.code !== undefined) : [],
    });
  }
  return out;
}

// 创建绑定到指定字典目录的 API 处理器
function createDictApi(opts) {
  const dir = opts.dir;
  const log = opts.log || (() => {});
  const warn = opts.warn || (() => {});

  function readIndex() { return buildIndexFromDir(dir); }
  function fileOf(type) { return path.join(dir, `${type}.json`); }
  function persist(type, doc) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fileOf(type), JSON.stringify(doc, null, 2), 'utf8');
  }
  // 中/英文名各自全库唯一（排除自身 type）；命中返回错误消息，否则 null
  function nameError(idx, name, nameEn, selfType) {
    for (const d of (idx.dicts || [])) {
      if (d.type === selfType) continue;
      if (name && (d.name || '') === name) return 'duplicate Chinese name: ' + name;
      if (nameEn && (d.nameEn || '') === nameEn) return 'duplicate English name: ' + nameEn;
    }
    return null;
  }

  function matches(pathname) {
    return pathname === '/api/value-dicts' || pathname.startsWith('/api/value-dicts/');
  }

  async function handle(req, res, pathname) {
    const method = req.method || 'GET';
    const rest = pathname.replace(/^\/api\/value-dicts\/?/, '');
    const type = safeType(decodeURIComponent(rest));
    try {
      // GET /api/value-dicts → 清单（前端读列表也可 GET value-dicts/index.json 的扫描结果）
      if (method === 'GET' && !rest) return sendJSON(res, 200, readIndex());

      // POST /api/value-dicts → 新建字典：{type, name, nameEn?, applyTo?, items?}
      if (method === 'POST' && !rest) {
        const body = await readBody(req);
        const t = safeType(body.type);
        if (!t) return sendJSON(res, 400, { ok: false, error: 'type required (letters/digits/_/-)' });
        if (!String(body.name || '').trim()) return sendJSON(res, 400, { ok: false, error: 'name required' });
        if (!String(body.nameEn || '').trim()) return sendJSON(res, 400, { ok: false, error: 'nameEn required' });
        const iErr = itemsError(body.items);
        if (iErr) return sendJSON(res, 400, { ok: false, error: iErr });
        const idx = readIndex();
        if ((idx.dicts || []).some((d) => d.type === t)) return sendJSON(res, 409, { ok: false, error: 'type exists: ' + t });
        const nErr = nameError(idx, String(body.name).trim(), String(body.nameEn).trim(), null);
        if (nErr) return sendJSON(res, 409, { ok: false, error: nErr });
        const doc = normalizeDict(t, body);
        persist(t, doc);
        log(`Value dict created: ${t} (${doc.items.length} item(s))`);
        return sendJSON(res, 200, { ok: true, dict: doc });
      }

      // PUT /api/value-dicts/:type → 整体更新（名称/applyTo/items）
      if (method === 'PUT' && type) {
        const body = await readBody(req);
        const idx = readIndex();
        const cur = (idx.dicts || []).find((d) => d.type === type);
        if (!cur) return sendJSON(res, 404, { ok: false, error: 'not found' });
        const name = body.name != null ? String(body.name).trim() : (cur.name || type);
        const nameEn = body.nameEn != null ? String(body.nameEn).trim() : (cur.nameEn || '');
        if (!name) return sendJSON(res, 400, { ok: false, error: 'name required' });
        if (!nameEn) return sendJSON(res, 400, { ok: false, error: 'nameEn required' });
        const iErr = itemsError(body.items != null ? body.items : cur.items);
        if (iErr) return sendJSON(res, 400, { ok: false, error: iErr });
        const nErr = nameError(idx, name, nameEn, type);
        if (nErr) return sendJSON(res, 409, { ok: false, error: nErr });
        const doc = normalizeDict(type, {
          name, nameEn,
          applyTo: body.applyTo != null ? body.applyTo : cur.applyTo,
          items: body.items != null ? body.items : cur.items,
        });
        persist(type, doc);
        log(`Value dict updated: ${type} (${doc.items.length} item(s))`);
        return sendJSON(res, 200, { ok: true, dict: doc });
      }

      // DELETE /api/value-dicts/:type → 删除 <type>.json（清单随之自动少一项）
      if (method === 'DELETE' && type) {
        const idx = readIndex();
        const cur = (idx.dicts || []).find((d) => d.type === type);
        if (!cur) return sendJSON(res, 404, { ok: false, error: 'not found' });
        try { if (fs.existsSync(fileOf(type))) fs.unlinkSync(fileOf(type)); }
        catch (err) { warn(`Delete ${fileOf(type)} failed: ${err.message}`); }
        log(`Value dict deleted: ${type}`);
        return sendJSON(res, 200, { ok: true });
      }

      return sendJSON(res, 405, { ok: false, error: 'method not allowed' });
    } catch (err) {
      warn(`Value dict API error: ${err.stack || err}`);
      return sendJSON(res, 400, { ok: false, error: String(err.message || err) });
    }
  }

  return { matches, handle, dir, buildIndex: () => buildIndexFromDir(dir) };
}

module.exports = { createDictApi, buildIndexFromDir };
