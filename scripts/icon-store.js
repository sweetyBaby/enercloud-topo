// ───── 图标库读写存储 + HTTP API（dev-server 与生产 server 共用） ─────
// 图标 = icons/ 目录下的图片文件 + icons/index.json 里的登记信息(分组/中英文名)。
//  · 清单(buildManifest)由「扫描目录 + 合并 index.json」动态生成：手动丢进 icons/ 的图片自动归入「未分组」。
//  · 写操作(上传/重命名/替换/删除图标、增删改分组)先把扫描结果「物化」进 index.json 再改，
//    因此扫描出但未登记的图标也能正常编辑/删除（修复「保存失败」），且刷新页面不丢失。
// 通过 createIconApi({dir, log, warn}) 绑定到具体 icons 目录，返回 {matches, handle, dir}。
// buildManifest(dir) 供两端拦截 GET /icons/index.json 复用。
const fs = require('fs');
const path = require('path');

const IMG_EXT = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
const EXT_BY_MIME = {
  'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/gif': 'gif', 'image/webp': 'webp',
};
const UNGROUPED_TITLE = '未分组';
const UNGROUPED_EN = 'Ungrouped';

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
    req.on('data', (c) => { size += c.length; if (size > 16 * 1024 * 1024) { reject(new Error('payload too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}
// SVG 消毒：图标以同源方式落盘 icons/ 并可被直接访问，SVG 属活动内容，需去除脚本类向量，
//   避免存储型 XSS（去 <script>/<foreignObject>、on* 事件属性、javascript: 协议、外链实体）。
function sanitizeSvg(buf) {
  let s = buf.toString('utf8');
  s = s.replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  s = s.replace(/<\s*script\b[^>]*\/?\s*>/gi, '');
  s = s.replace(/<\s*foreignObject[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  s = s.replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
  s = s.replace(/javascript:/gi, 'blocked:');
  return Buffer.from(s, 'utf8');
}
function parseDataURL(s) {
  const m = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(s || ''));
  if (!m) return null;
  const ext = EXT_BY_MIME[m[1].toLowerCase()];
  if (!ext) return null;
  try {
    let buf = Buffer.from(m[2], 'base64');
    if (ext === 'svg') buf = sanitizeSvg(buf);
    return { ext, buf };
  } catch (err) { return null; }
}
function listImageFiles(dir) {
  try { return fs.readdirSync(dir).filter((f) => IMG_EXT.has(path.extname(f).toLowerCase())); }
  catch (err) { return []; }
}
function readIndexRaw(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')); }
  catch (err) { return { schemaVersion: '1.0', groups: [] }; }
}
function allDevices(idx) {
  const out = [];
  (idx.groups || []).forEach((g) => (g.devices || []).forEach((d) => out.push(d)));
  return out;
}
function hasType(idx, type) { return allDevices(idx).some((d) => d.type === type); }
function ungroupedGroup(idx) {
  idx.groups = idx.groups || [];
  let g = idx.groups.find((x) => x && x.title === UNGROUPED_TITLE);
  // 新建时放到最前：管理面板按清单顺序渲染，「未分组」(新增/未归类图标默认落此)即显示在最上面，便于查看验证
  if (!g) { g = { title: UNGROUPED_TITLE, title_en: UNGROUPED_EN, color: '#8aa8c4', tab: 'device', devices: [] }; idx.groups.unshift(g); }
  g.devices = g.devices || [];
  return g;
}
// 把「扫描目录」与「index.json 登记」合并成完整清单：
//  · 剔除引用了已删除图片的登记项；· 未被任何登记项引用的图片 → 归入「未分组」；· 去掉空的「未分组」。
// 结果即前端看到的完整图标库；写操作先 reconcile 再改，保证扫描出的图标也可编辑（source of truth）。
function reconcile(idx, dir) {
  idx.groups = idx.groups || [];
  const files = new Set(listImageFiles(dir));
  // 剔除引用了不存在图片的登记项（file-less 纯绘制元素如文本框/变量保留）
  idx.groups.forEach((g) => { g.devices = (g.devices || []).filter((d) => !d.file || files.has(d.file)); });
  const referenced = new Set();
  allDevices(idx).forEach((d) => { if (d.file) referenced.add(d.file); });
  const extras = [...files].filter((f) => !referenced.has(f)).sort();
  if (extras.length) {
    const g = ungroupedGroup(idx);
    extras.forEach((f) => {
      const stem = f.replace(/\.[^.]+$/, '');
      if (hasType(idx, stem)) return; // 与已有类型同名（避免重复登记）
      g.devices.push({ type: stem, label: stem, label_en: stem, badge: stem, file: f });
    });
  }
  // 去掉空的「未分组」（其它空分组是用户新建的，保留）
  idx.groups = idx.groups.filter((g) => g.title !== UNGROUPED_TITLE || (g.devices && g.devices.length));
  return idx;
}
function buildManifest(dir) { return reconcile(readIndexRaw(dir), dir); }

function createIconApi(opts) {
  const dir = opts.dir;
  const log = opts.log || (() => {});
  const warn = opts.warn || (() => {});
  const indexPath = path.join(dir, 'index.json');

  // 载入「已 reconcile 的完整清单」——写操作都基于它，改完整体回写
  function load() { return reconcile(readIndexRaw(dir), dir); }
  function persist(idx) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(idx, null, 2), 'utf8');
  }
  function findDevice(idx, type) {
    const groups = idx.groups || [];
    for (let gi = 0; gi < groups.length; gi++) {
      const devices = groups[gi].devices || [];
      for (let di = 0; di < devices.length; di++) {
        if (devices[di] && devices[di].type === type) return { group: groups[gi], device: devices[di], gi, di };
      }
    }
    return null;
  }
  function findGroup(idx, title) { return (idx.groups || []).find((g) => g && g.title === title) || null; }
  // 中/英文名各自必填且全库唯一（排除自身 type）；返回错误消息或 null
  function nameError(idx, zh, en, selfType) {
    if (!zh || !en) return 'labelZh & labelEn required';
    const devs = allDevices(idx).filter((d) => d.type !== selfType);
    if (devs.some((d) => (d.label || '') === zh)) return 'duplicate Chinese name: ' + zh;
    if (devs.some((d) => (d.label_en || '') === en)) return 'duplicate English name: ' + en;
    return null;
  }
  function writeImage(type, img, oldFile) {
    const file = type + '.' + img.ext;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), img.buf);
    if (oldFile && oldFile !== file) { try { fs.unlinkSync(path.join(dir, oldFile)); } catch (err) { /* 旧文件可能已不存在 */ } }
    return file;
  }
  // 把图标放入指定分组（title 不存在则回退「未分组」）
  function targetGroup(idx, title) {
    if (title) { const g = findGroup(idx, title); if (g) { g.devices = g.devices || []; return g; } }
    return ungroupedGroup(idx);
  }

  function matches(pathname) {
    return pathname === '/api/icons' || pathname.startsWith('/api/icons/')
      || pathname === '/api/icon-groups' || pathname.startsWith('/api/icon-groups/');
  }

  async function handleIcons(req, res, rest, method) {
    const type = safeType(decodeURIComponent(rest));
    // GET /api/icons → 完整清单（前端通常直接读 /icons/index.json 的合并结果）
    if (method === 'GET' && !rest) return sendJSON(res, 200, load());

    // POST /api/icons → 新增图标：{type?, labelZh, labelEn, dataURL, group?}
    if (method === 'POST' && !rest) {
      const body = await readBody(req);
      const zh = String(body.labelZh || '').trim();
      const en = String(body.labelEn || '').trim();
      const img = parseDataURL(body.dataURL);
      if (!img) return sendJSON(res, 400, { ok: false, error: 'invalid dataURL (png/svg/jpg/gif/webp)' });
      const idx = load();
      const nErr = nameError(idx, zh, en, null);
      if (nErr) return sendJSON(res, 409, { ok: false, error: nErr });
      let t = safeType(body.type);
      if (!t || hasType(idx, t)) {
        const base = 'custom_' + (safeType(en.replace(/\s+/g, '_')) || 'icon');
        t = base; let n = 2; while (hasType(idx, t)) t = base + '_' + (n++);
      }
      const file = writeImage(t, img, null);
      // 新增图标放到目标分组最前，便于在管理面板顶部立即看到（不用滚到底）
      targetGroup(idx, String(body.group || '').trim()).devices.unshift({ type: t, label: zh, label_en: en, badge: t, file });
      persist(idx);
      log(`Icon saved: ${t} → icons/${file}`);
      return sendJSON(res, 200, { ok: true, type: t, file });
    }

    // PUT /api/icons/:type → 重命名 / 替换图片 / 移动分组：{labelZh?, labelEn?, dataURL?, group?}
    if (method === 'PUT' && type) {
      const body = await readBody(req);
      const idx = load();
      const found = findDevice(idx, type);
      if (!found) return sendJSON(res, 404, { ok: false, error: 'not found' });
      const zh = body.labelZh != null ? String(body.labelZh).trim() : (found.device.label || '');
      const en = body.labelEn != null ? String(body.labelEn).trim() : (found.device.label_en || '');
      if (body.labelZh != null || body.labelEn != null) {
        const nErr = nameError(idx, zh, en, type);
        if (nErr) return sendJSON(res, 409, { ok: false, error: nErr });
        found.device.label = zh; found.device.label_en = en;
      }
      if (body.dataURL != null) {
        const img = parseDataURL(body.dataURL);
        if (!img) return sendJSON(res, 400, { ok: false, error: 'invalid dataURL (png/svg/jpg/gif/webp)' });
        found.device.file = writeImage(type, img, found.device.file);
      }
      if (body.group != null && String(body.group).trim() && String(body.group).trim() !== found.group.title) {
        const dest = targetGroup(idx, String(body.group).trim());
        found.group.devices.splice(found.di, 1);
        dest.devices.push(found.device);
      }
      persist(reconcile(idx, dir)); // 移动可能清空「未分组」，回收一次
      log(`Icon updated: ${type}`);
      return sendJSON(res, 200, { ok: true, type, file: found.device.file });
    }

    // DELETE /api/icons/:type → 删图片 + 从清单移除（空系统分组保留，空「未分组」由 reconcile 清理）
    if (method === 'DELETE' && type) {
      const idx = load();
      const found = findDevice(idx, type);
      if (!found) return sendJSON(res, 404, { ok: false, error: 'not found' });
      const file = found.device.file;
      found.group.devices.splice(found.di, 1);
      if (file) { try { fs.unlinkSync(path.join(dir, file)); } catch (err) { warn(`Delete icons/${file} failed: ${err.message}`); } }
      persist(reconcile(idx, dir));
      log(`Icon deleted: ${type}`);
      return sendJSON(res, 200, { ok: true });
    }
    return sendJSON(res, 405, { ok: false, error: 'method not allowed' });
  }

  // 分组中/英文名各自唯一（排除自身分组对象）；命中返回错误消息，否则 null
  function groupNameError(idx, zh, en, selfGroup) {
    if (!zh) return 'title required';
    for (const g of (idx.groups || [])) {
      if (g === selfGroup) continue;
      if ((g.title || '') === zh) return 'duplicate group name: ' + zh;
      if (en && (g.title_en || '') === en) return 'duplicate group English name: ' + en;
    }
    return null;
  }

  async function handleGroups(req, res, rest, method) {
    const title = decodeURIComponent(rest).trim();
    // POST /api/icon-groups → 新增分组：{title, title_en?, color?, tab?}
    if (method === 'POST' && !rest) {
      const body = await readBody(req);
      const t = String(body.title || '').trim();
      const ten = String(body.title_en || '').trim() || t;
      const idx = load();
      const gErr = groupNameError(idx, t, ten, null);
      if (gErr) return sendJSON(res, (gErr === 'title required' ? 400 : 409), { ok: false, error: gErr });
      // 新增分组放到列表最前，便于在管理面板顶部立即看到
      idx.groups.unshift({ title: t, title_en: ten, color: body.color || '#8aa8c4', tab: body.tab || 'device', devices: [] });
      persist(idx);
      log(`Icon group created: ${t}`);
      return sendJSON(res, 200, { ok: true, title: t });
    }
    // PUT /api/icon-groups/:title → 重命名 / 改颜色 / 改英文名：{title?, title_en?, color?}
    if (method === 'PUT' && title) {
      const body = await readBody(req);
      const idx = load();
      const g = findGroup(idx, title);
      if (!g) return sendJSON(res, 404, { ok: false, error: 'not found' });
      const nt = body.title != null ? String(body.title).trim() : g.title;
      const nten = body.title_en != null ? (String(body.title_en).trim() || nt) : (g.title_en || nt);
      const gErr = groupNameError(idx, nt, nten, g);
      if (gErr) return sendJSON(res, (gErr === 'title required' ? 400 : 409), { ok: false, error: gErr });
      g.title = nt;
      g.title_en = nten;
      if (body.color != null) g.color = body.color;
      persist(idx);
      log(`Icon group updated: ${title} → ${nt}`);
      return sendJSON(res, 200, { ok: true, title: nt });
    }
    // DELETE /api/icon-groups/:title → 删分组；组内图标移到「未分组」（保留其名称，不丢图）
    if (method === 'DELETE' && title) {
      const idx = load();
      const gi = (idx.groups || []).findIndex((g) => g.title === title);
      if (gi < 0) return sendJSON(res, 404, { ok: false, error: 'not found' });
      if (title === UNGROUPED_TITLE) return sendJSON(res, 400, { ok: false, error: 'cannot delete the ungrouped bucket' });
      const moved = idx.groups[gi].devices || [];
      idx.groups.splice(gi, 1);
      if (moved.length) ungroupedGroup(idx).devices.push(...moved);
      persist(reconcile(idx, dir));
      log(`Icon group deleted: ${title} (${moved.length} icon(s) → ${UNGROUPED_TITLE})`);
      return sendJSON(res, 200, { ok: true });
    }
    return sendJSON(res, 405, { ok: false, error: 'method not allowed' });
  }

  async function handle(req, res, pathname) {
    const method = req.method || 'GET';
    try {
      if (pathname === '/api/icon-groups' || pathname.startsWith('/api/icon-groups/')) {
        return await handleGroups(req, res, pathname.replace(/^\/api\/icon-groups\/?/, ''), method);
      }
      return await handleIcons(req, res, pathname.replace(/^\/api\/icons\/?/, ''), method);
    } catch (err) {
      warn(`Icon API error: ${err.stack || err}`);
      return sendJSON(res, 400, { ok: false, error: String(err.message || err) });
    }
  }

  return { matches, handle, dir };
}

module.exports = { createIconApi, buildManifest };
