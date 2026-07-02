const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');
const { createTemplateApi } = require('./template-store');
const { createIconApi, buildManifest: buildIconManifest } = require('./icon-store');

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

// ───── 图标库：清单由 icon-store.buildManifest 统一生成（扫描 icons/ + 合并 index.json；未登记图片归「未分组」） ─────
const iconsDir = path.join(root, 'icons');
// ───── 后台字段字典：扫描 dic/ 目录，按 deviceType 合并所有 *.json ─────
//  每个字典文件形如 [{deviceType, location, fields:[...]}, ...]；增删改 dic/*.json 即自动反映。
const dicDir = path.join(root, 'dic');
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
// ───── 图标库读写 API：上传/重命名/替换/删除自动落盘到 icons/ + index.json（dev 与生产共用 icon-store） ─────
const iconApi = createIconApi({ dir: iconsDir, log, warn });

function createServer() {
  return http.createServer((req, res) => {
    const pathname = url.parse(req.url).pathname || '/';
    if (iconApi.matches(pathname)) {
      return iconApi.handle(req, res, pathname);
    }
    if (pathname === '/icons/index.json') {
      return send(res, 200, JSON.stringify(buildIconManifest(iconsDir), null, 2), types['.json']);
    }
    // 后台字段字典：扫描 dic/ 合并（增删改 dic/*.json 即自动反映）。device/* 走静态，内容变更经 no-store 重新拉取即可。
    if (pathname === '/dic/index.json') {
      return send(res, 200, JSON.stringify(buildDicManifest(), null, 2), types['.json']);
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
