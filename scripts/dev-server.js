const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');
const { createTemplateApi } = require('./template-store');

const root = path.resolve(__dirname, '..');
const startPort = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
const clients = new Set();
const logFile = path.join(root, '.dev-server.log');
const tplDir = path.join(root, 'templates');

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

// ───── 图标库：自动扫描 icons/ 目录，与 icons/index.json 合并 ─────
//  · 替换图片（同名）→ 直接生效；删除图片 → 对应元素从面板移除；
//  · 新增未登记的图片 → 自动归入「自定义图标」分组；无需改动任何代码。
const iconsDir = path.join(root, 'icons');
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
        if (!d.file) return true; // 纯绘制元素（文本框/变量节点）无图片，保留
        if (existing.has(d.file)) {
          referenced.add(d.file);
          return true;
        }
        return false; // 图片已删除 → 该元素从面板移除
      });
      return Object.assign({}, g, { devices });
    })
    .filter((g) => g.devices.length); // 丢弃空分组
  const extras = [...existing].filter((f) => !referenced.has(f)).sort();
  // 自动归组：未登记的图片按文件名前缀匹配已有元素类型（最长匹配），落到该类型所在分组；
  //  例如 bms_charge.png → 前缀 bms → 归入「储能设备」。无任何匹配时才进「自定义图标」兜底。
  const typeToGroupIdx = {};
  groups.forEach((g, gi) => (g.devices || []).forEach((d) => { typeToGroupIdx[d.type] = gi; }));
  const knownTypes = Object.keys(typeToGroupIdx);
  const customDevices = [];
  extras.forEach((f) => {
    const stem = f.replace(/\.[^.]+$/, '');
    if (knownTypes.includes(stem)) return; // 与已有类型同名，跳过避免重复
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

function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFile, `${line}\n`);
}

function warn(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  console.warn(line);
  fs.appendFileSync(logFile, `${line}\n`);
}

const liveReloadSnippet = `
<script>
(() => {
  const es = new EventSource('/__live-reload');
  es.addEventListener('reload', () => location.reload());
})();
</script>`;

fs.writeFileSync(logFile, '');
log(`Starting dev server in ${root}`);

function insideRoot(file) {
  const rel = path.relative(root, file);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function serveFile(req, res) {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname === '/') pathname = '/topo.html';

  let file = path.join(root, pathname);
  if (!insideRoot(file)) return send(res, 403, 'Forbidden');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return send(res, 404, 'Not Found');

  const ext = path.extname(file).toLowerCase();
  let body = fs.readFileSync(file);
  if (ext === '.html') {
    body = body.toString('utf8').replace('</body>', `${liveReloadSnippet}\n</body>`);
  }
  send(res, 200, body, types[ext] || 'application/octet-stream');
}

// ───── 模板读写 API：保存/编辑/重命名/删除自动落盘到 templates/（dev 与生产共用 template-store） ─────
const templateApi = createTemplateApi({ dir: tplDir, log, warn });

function createServer() {
  return http.createServer((req, res) => {
    const pathname = url.parse(req.url).pathname || '/';
    if (pathname === '/icons/index.json') {
      return send(res, 200, JSON.stringify(buildIconManifest(), null, 2), types['.json']);
    }
    // 模板清单由目录扫描动态生成（增删改 templates/*.json 即自动反映，不依赖 index.json）
    if (pathname === '/templates/index.json') {
      return send(res, 200, JSON.stringify(templateApi.buildIndex(), null, 2), types['.json']);
    }
    if (templateApi.matches(pathname)) {
      return templateApi.handle(req, res, pathname);
    }
    if (req.url === '/__live-reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      res.write('\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    serveFile(req, res);
  });
}

function notifyReload() {
  for (const client of clients) client.write('event: reload\ndata: now\n\n');
}

let timer = null;
function scheduleReload(file) {
  const rel = path.relative(root, file);
  if (!rel || rel.startsWith('dist') || rel.startsWith('.git') || rel.includes('node_modules')) return;
  clearTimeout(timer);
  timer = setTimeout(notifyReload, 80);
}

try {
  fs.watch(root, { recursive: true }, (_event, filename) => {
    if (filename) scheduleReload(path.join(root, filename));
  });
} catch (err) {
  warn(`File watch disabled: ${err.message}`);
}

function listen(port) {
  const server = createServer();
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      warn(`Port ${port} is in use, trying ${port + 1}...`);
      server.close();
      listen(port + 1);
      return;
    }
    warn(err.stack || String(err));
    process.exit(1);
  });
  server.listen(port, host, () => {
    log(`Dev server ready: http://${host}:${port}/topo.html`);
    log('Hot reload enabled. Press Ctrl+C to stop.');
  });
}

listen(startPort);
