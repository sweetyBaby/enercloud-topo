// ───── 图标库读写存储 + HTTP API（dev-server 与生产 server 共用） ─────
// 上传/重命名/替换/删除图标：图片直接落盘到 icons/ 目录、登记到 icons/index.json（清单仍由
// 服务端扫描目录动态合并生成，见各 server 的 buildIconManifest）。前端增删改后调 reloadIconLibrary()
// 重扫即可动态生效，刷新页面也不丢失。
// 通过 createIconApi({dir, log, warn}) 绑定到具体 icons 目录，返回 {matches, handle, dir}。
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
    req.on('data', (c) => { size += c.length; if (size > 16 * 1024 * 1024) { reject(new Error('payload too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}
// dataURL → {ext, buf}；仅接受常见图片 MIME
const EXT_BY_MIME = {
  'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/gif': 'gif', 'image/webp': 'webp',
};
const IMG_EXT = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
function parseDataURL(s) {
  const m = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(s || ''));
  if (!m) return null;
  const ext = EXT_BY_MIME[m[1].toLowerCase()];
  if (!ext) return null;
  try { return { ext, buf: Buffer.from(m[2], 'base64') }; } catch (err) { return null; }
}

function createIconApi(opts) {
  const dir = opts.dir;
  const log = opts.log || (() => {});
  const warn = opts.warn || (() => {});
  const indexPath = path.join(dir, 'index.json');

  function readIndex() {
    try { return JSON.parse(fs.readFileSync(indexPath, 'utf8')); }
    catch (err) { return { schemaVersion: '1.0', groups: [] }; }
  }
  function writeIndex(idx) {
    fs.writeFileSync(indexPath, JSON.stringify(idx, null, 2), 'utf8');
  }
  // 在清单所有分组中找 type 对应的元素项
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
  // 上传的自定义图标统一登记到「自定义图标」分组（tab=custom，显示在左栏“自定义”页签）
  function customGroup(idx) {
    idx.groups = idx.groups || [];
    let g = idx.groups.find((x) => x && x.title === '自定义图标');
    if (!g) { g = { title: '自定义图标', title_en: 'Custom Icons', color: '#42a5f5', tab: 'custom', devices: [] }; idx.groups.push(g); }
    g.devices = g.devices || [];
    return g;
  }
  function writeImage(type, img, oldFile) {
    const file = type + '.' + img.ext;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), img.buf);
    if (oldFile && oldFile !== file) {
      try { fs.unlinkSync(path.join(dir, oldFile)); } catch (err) { /* 旧文件可能已不存在 */ }
    }
    return file;
  }

  function matches(pathname) {
    return pathname === '/api/icons' || pathname.startsWith('/api/icons/');
  }

  async function handle(req, res, pathname) {
    const method = req.method || 'GET';
    const rest = pathname.replace(/^\/api\/icons\/?/, '');
    const type = safeType(decodeURIComponent(rest));
    try {
      // GET /api/icons → 返回原始清单（前端通常直接读 icons/index.json 的扫描合并结果）
      if (method === 'GET' && !rest) return sendJSON(res, 200, readIndex());

      // POST /api/icons → 新增（或覆盖同 type）图标：{type?, labelZh, labelEn, dataURL}
      if (method === 'POST' && !rest) {
        const body = await readBody(req);
        const zh = String(body.labelZh || '').trim();
        const en = String(body.labelEn || '').trim();
        if (!zh || !en) return sendJSON(res, 400, { ok: false, error: 'labelZh & labelEn required' });
        const img = parseDataURL(body.dataURL);
        if (!img) return sendJSON(res, 400, { ok: false, error: 'invalid dataURL (png/svg/jpg/gif/webp)' });
        let t = safeType(body.type);
        if (!t) t = 'custom_' + (safeType(en.replace(/\s+/g, '_')) || ('icon' + Date.now()));
        const idx = readIndex();
        const found = findDevice(idx, t);
        const file = writeImage(t, img, found && found.device.file);
        if (found) {
          found.device.label = zh; found.device.label_en = en; found.device.file = file;
        } else {
          customGroup(idx).devices.push({ type: t, label: zh, label_en: en, badge: t, file });
        }
        writeIndex(idx);
        log(`Icon saved: ${t} → icons/${file}`);
        return sendJSON(res, 200, { ok: true, type: t, file });
      }

      // PUT /api/icons/:type → 重命名(labelZh/labelEn) 和/或 替换图片(dataURL)
      if (method === 'PUT' && type) {
        const body = await readBody(req);
        const idx = readIndex();
        const found = findDevice(idx, type);
        if (!found) return sendJSON(res, 404, { ok: false, error: 'not found' });
        if (body.labelZh != null && String(body.labelZh).trim()) found.device.label = String(body.labelZh).trim();
        if (body.labelEn != null && String(body.labelEn).trim()) found.device.label_en = String(body.labelEn).trim();
        if (body.dataURL != null) {
          const img = parseDataURL(body.dataURL);
          if (!img) return sendJSON(res, 400, { ok: false, error: 'invalid dataURL (png/svg/jpg/gif/webp)' });
          found.device.file = writeImage(type, img, found.device.file);
        }
        writeIndex(idx);
        log(`Icon updated: ${type}`);
        return sendJSON(res, 200, { ok: true, type, file: found.device.file });
      }

      // DELETE /api/icons/:type → 删除图片文件 + 从清单移除（空分组一并移除）
      if (method === 'DELETE' && type) {
        const idx = readIndex();
        const found = findDevice(idx, type);
        let file = found && found.device.file;
        if (found) {
          found.group.devices.splice(found.di, 1);
          if (!found.group.devices.length) idx.groups.splice(found.gi, 1);
          writeIndex(idx);
        }
        // 未登记（仅靠目录扫描出现）的图标：按 type 匹配同名图片文件删除
        if (!file) {
          try { file = fs.readdirSync(dir).find((f) => IMG_EXT.has(path.extname(f).toLowerCase()) && f.replace(/\.[^.]+$/, '') === type) || null; }
          catch (err) { file = null; }
        }
        if (!found && !file) return sendJSON(res, 404, { ok: false, error: 'not found' });
        if (file) { try { fs.unlinkSync(path.join(dir, file)); } catch (err) { warn(`Delete icons/${file} failed: ${err.message}`); } }
        log(`Icon deleted: ${type}`);
        return sendJSON(res, 200, { ok: true });
      }

      return sendJSON(res, 405, { ok: false, error: 'method not allowed' });
    } catch (err) {
      warn(`Icon API error: ${err.stack || err}`);
      return sendJSON(res, 400, { ok: false, error: String(err.message || err) });
    }
  }

  return { matches, handle, dir };
}

module.exports = { createIconApi };
