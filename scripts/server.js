// ───── 生产服务器：静态托管编辑器 + 模板读写 API（支持保存/编辑/重命名/删除自动落盘） ─────
// 与 dev-server 的区别：无热重载注入；默认托管已构建的 dist/；模板读写都指向「持久且版本受控」的 templates/ 目录，
// 不会被 build.py 重建 dist 时清空。可用环境变量覆盖：
//   PORT(默认 3009)  HOST(默认 0.0.0.0)  STATIC_ROOT(默认 dist，无则回退项目根)
//   TEMPLATES_DIR(默认 ./templates)  ICONS_DIR(默认 ./icons)
// 启动：node scripts/server.js  或  npm start
const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');
const { createTemplateApi, send } = require('./template-store');

const projectRoot = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3009);
const host = process.env.HOST || '0.0.0.0';

// 静态根：优先 dist/（已构建、压缩），未构建则回退项目根（直接跑源码也能用）
const distDir = path.join(projectRoot, 'dist');
const staticRoot = process.env.STATIC_ROOT
  ? path.resolve(process.env.STATIC_ROOT)
  : (fs.existsSync(distDir) ? distDir : projectRoot);
// 模板目录：可写、持久、版本受控；reads/writes 都走这里，build 重建 dist 不影响
const tplDir = process.env.TEMPLATES_DIR
  ? path.resolve(process.env.TEMPLATES_DIR)
  : path.join(projectRoot, 'templates');
// 图标目录：可独立挂载；默认读项目根 icons/，不存在时回退到静态根 icons/。
const defaultIconsDir = fs.existsSync(path.join(projectRoot, 'icons'))
  ? path.join(projectRoot, 'icons')
  : path.join(staticRoot, 'icons');
const iconsDir = process.env.ICONS_DIR
  ? path.resolve(process.env.ICONS_DIR)
  : defaultIconsDir;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function log(message) { console.log(`[${new Date().toLocaleTimeString()}] ${message}`); }
function warn(message) { console.warn(`[${new Date().toLocaleTimeString()}] ${message}`); }

// 图标库：扫描 icons/ 目录，与 icons/index.json 合并（与 dev-server/build 行为一致）
const IMG_EXT = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
function listIconFiles() {
  try {
    return fs.readdirSync(iconsDir).filter((f) => IMG_EXT.has(path.extname(f).toLowerCase()));
  } catch (err) {
    return [];
  }
}
function buildIconManifest() {
  let curated = { groups: [] };
  try {
    curated = JSON.parse(fs.readFileSync(path.join(iconsDir, 'index.json'), 'utf8'));
  } catch (err) {
    warn(`读取 icons/index.json 失败：${err.message}`);
  }
  const existing = new Set(listIconFiles());
  const referenced = new Set();
  const groups = (curated.groups || [])
    .map((g) => {
      const devices = (g.devices || []).filter((d) => {
        if (!d.file) return true;
        if (existing.has(d.file)) {
          referenced.add(d.file);
          return true;
        }
        return false;
      });
      return Object.assign({}, g, { devices });
    })
    .filter((g) => g.devices.length);
  const extras = [...existing].filter((f) => !referenced.has(f)).sort();
  const typeToGroupIdx = {};
  groups.forEach((g, gi) => (g.devices || []).forEach((d) => { typeToGroupIdx[d.type] = gi; }));
  const knownTypes = Object.keys(typeToGroupIdx);
  const customDevices = [];
  extras.forEach((f) => {
    const stem = f.replace(/\.[^.]+$/, '');
    if (knownTypes.includes(stem)) return;
    let best = null;
    for (const t of knownTypes) {
      if (stem.startsWith(t + '_') && (!best || t.length > best.length)) best = t;
    }
    const dev = { type: stem, label: stem, label_en: stem, badge: stem, file: f };
    if (best) groups[typeToGroupIdx[best]].devices.push(dev);
    else customDevices.push(dev);
  });
  if (customDevices.length) {
    groups.push({ title: '自定义图标', title_en: 'Custom Icons', color: '#42a5f5', tab: 'device', devices: customDevices });
  }
  return Object.assign({}, curated, { groups });
}
// 后台字段字典：扫描 dic/ 目录，按 deviceType 合并所有 *.json（增删改 dic/*.json 即自动反映）
const dicDir = path.join(staticRoot, 'dic');
function buildDicManifest() {
  const out = {};
  let files = [];
  try { files = fs.readdirSync(dicDir).filter((f) => f.endsWith('.json') && f !== 'index.json'); } catch (err) { return out; }
  for (const file of files) {
    let arr;
    try { arr = JSON.parse(fs.readFileSync(path.join(dicDir, file), 'utf8')); } catch (err) { continue; }
    if (!Array.isArray(arr)) continue;
    for (const g of arr) {
      const dt = g && g.deviceType;
      if (!dt || !Array.isArray(g.fields)) continue;
      (out[dt] = out[dt] || []).push({ location: g.location || '', fields: g.fields });
    }
  }
  return out;
}

const templateApi = createTemplateApi({ dir: tplDir, log, warn });

function inside(baseDir, file) {
  const rel = path.relative(baseDir, file);
  return rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}
// 在 baseDir 内安全地按 pathname 提供静态文件
function serveStatic(res, baseDir, pathname, indexFallback) {
  let file = path.join(baseDir, pathname);
  if (!inside(baseDir, file)) return send(res, 403, 'Forbidden');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    if (indexFallback) file = path.join(baseDir, indexFallback); else return send(res, 404, 'Not Found');
    if (!fs.existsSync(file)) return send(res, 404, 'Not Found');
  }
  const ext = path.extname(file).toLowerCase();
  send(res, 200, fs.readFileSync(file), types[ext] || 'application/octet-stream');
}

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(url.parse(req.url).pathname || '/');

  // 1) 模板写/列表 API
  if (templateApi.matches(pathname)) return templateApi.handle(req, res, pathname);

  // 2) 图标清单：扫描 icons/ 动态生成；图标文件也从同一目录读取，避免 dist 与根目录不同步
  if (pathname === '/icons/index.json') {
    return send(res, 200, JSON.stringify(buildIconManifest(), null, 2), 'application/json; charset=utf-8');
  }
  if (pathname === '/icons' || pathname.startsWith('/icons/')) {
    return serveStatic(res, iconsDir, pathname.replace(/^\/icons\/?/, '') || 'index.json');
  }

  // 3) 模板清单：扫描 tplDir 动态生成（增删改 templates/*.json 即自动反映，不依赖 index.json）
  if (pathname === '/templates/index.json') {
    return send(res, 200, JSON.stringify(templateApi.buildIndex(), null, 2), 'application/json; charset=utf-8');
  }

  // 4) 后台字段字典：扫描 dic/ 合并（device/* 与其它资源走静态托管）
  if (pathname === '/dic/index.json') {
    return send(res, 200, JSON.stringify(buildDicManifest(), null, 2), 'application/json; charset=utf-8');
  }

  // 5) /templates/* 静态读取：指向可写的 tplDir，确保读到的就是最新落盘内容
  if (pathname === '/templates' || pathname.startsWith('/templates/')) {
    return serveStatic(res, tplDir, pathname.replace(/^\/templates\/?/, '') || 'index.json');
  }

  // 6) 其余 → 编辑器静态资源（dist 或项目根）
  if (pathname === '/') pathname = '/topo.html';
  return serveStatic(res, staticRoot, pathname);
});

server.on('error', (err) => { warn(err.stack || String(err)); process.exit(1); });
server.listen(port, host, () => {
  log(`Topo production server: http://${host}:${port}/topo.html`);
  log(`Static root : ${staticRoot}`);
  log(`Templates    : ${tplDir} (read + write, persistent)`);
  log(`Icons        : ${iconsDir} (dynamic manifest + files)`);
});
