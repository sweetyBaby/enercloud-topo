# 储能拓扑 · 模板存储 API 契约

> 给后端同学对接（或在父平台后端重新实现）用。后端要做的事只有一句：**把模板的增删改查映射成「读写一个目录里的 JSON 文件 + 维护一份清单」**。无数据库、无鉴权耦合——一个目录、一份 `index.json` 清单、每个模板一个文件。
>
> 本仓库的参考实现：`scripts/template-store.js`（核心逻辑，dev 与生产共用）· `scripts/dev-server.js`（开发）· `scripts/server.js`（生产 `npm start`）。本页描述的就是这套 Node 原生实现的对外契约。

---

## 1. 请求如何流转

读取走纯静态文件（任何托管都行）；写入走 `/api/templates` 接口，由服务器自动落盘。两条链路各自独立。

```
                    请求                 读 / 写
  前端编辑器  ───────────────▶  Node 服务器  ───────────────▶  📁 templates/
 topology-editor.js ◀───────  dev-server·server.js ◀───────   index.json（清单）
                  JSON 响应   └ template-store.js ┘  文件内容   <id>.json（每个模板）
```

**读取 · 加载模板**

1. 前端打开模板库，`GET templates/index.json` 拿清单
2. 选中某个，按 `entry.file` `GET templates/<id>.json`
3. 解析 `seed` / `canvas` 还原画布

**写入 · 保存模板**

1. 前端 `POST /api/templates` 带画布 JSON
2. 服务器写 `<id>.json`
3. 把条目并入并写回 `index.json`
4. 返回 `{ ok:true, entry }`

配色约定（仅文档/前端视觉，沿用编辑器连线语义）：**读=青 GET / 建=绿 POST / 改=金 PUT / 删=红 DELETE**。

---

## 2. 四个接口

路径前缀 `/api/templates`。请求/响应均为 JSON（UTF-8）。`:id` 为模板标识，服务端会消毒为 `[A-Za-z0-9_-]`。

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/templates` | 取模板清单 |
| `POST` | `/api/templates` | 新建（保存为模板） |
| `PUT` | `/api/templates/:id` | 重命名 / 编辑内容 |
| `DELETE` | `/api/templates/:id` | 删除模板 |

通用错误：未匹配的方法返回 `405`；请求体解析失败或其它异常统一 `400 { ok:false, error }`。

### GET `/api/templates`

返回 `index.json` 原文。状态码 `200`。

```jsonc
{
  "schemaVersion": "tpl-index-1",
  "default": "t1",                  // 初始画布加载的模板 id
  "templates": [
    { "id":"t1", "name":"发散式拓扑", "nameEn":"Radial", "desc":"…",
      "file":"t1.json", "builtin":true,
      "preview": { "pts":[[450,300], …], "edges":[[0,1,"#4dd0ff"], …] } }
  ]
}
```

> 前端列表也可直接静态读 `templates/index.json`，不一定经此接口。`preview` 是给列表画缩略图的轻量坐标，免去加载整份模板。

### POST `/api/templates`

**请求体**

```jsonc
{
  "template": {
    "name": "园区储能拓扑",   // 必填
    "nameEn": "Campus ESS", // 选填
    "desc": "…",            // 选填
    "id": "…"               // 选填，缺省自动 tpl_N
  },
  "canvas": { … },          // 完整画布 JSON（与 seed 二选一）
  "preview": { "pts":[…], "edges":[…] }   // 选填，缺省服务端自动算
}
```

**响应 `200`**

```jsonc
{
  "ok": true,
  "entry": { "id":"tpl_1", "name":"…", "file":"tpl_1.json",
             "builtin":false, "preview":{ … } },
  "default": "t1"
}
```

| 状态码 | 含义 |
|---|---|
| `200` | 成功 |
| `400` | 缺少 `template.name` |
| `409` | `id` 已存在 |

> `canvas`（用户保存，保留布局）与 `seed`（种子，加载时自动布局）二选一。无 `preview` 时服务端会从节点坐标自动算。

### PUT `/api/templates/:id`

只传需要改的部分。

```jsonc
// 重命名：只给 template 元信息
{ "template": { "name":"新名", "nameEn":"…", "desc":"…" } }

// 编辑内容：给 canvas（或 seed）
{ "canvas": { … }, "preview": { … } }

// 两者可同时给
```

**响应 `200`**

```jsonc
{ "ok": true, "entry": { …更新后的清单条目… } }
```

| 状态码 | 含义 |
|---|---|
| `200` | 成功 |
| `404` | `id` 不存在 |

> 同步更新 `<id>.json` 与 `index.json` 里的对应条目。给了 `canvas` 会清掉旧的 `seed`，反之亦然。

### DELETE `/api/templates/:id`

**响应 `200`**

```jsonc
{ "ok": true, "default": "t2" }   // 删的若是默认模板，default 自动改为剩余第一个
```

| 状态码 | 含义 |
|---|---|
| `200` | 成功 |
| `404` | `id` 不存在 |

> 删除 `<id>.json` 文件并从清单移除。

---

## 3. 数据模型

一份清单索引所有模板；每个模板一个文件，两种形态由 `seed` / `canvas` 字段区分（互斥）。

**`templates/index.json`** — 唯一的“目录”，前端打开模板库只读它：

```jsonc
{
  "schemaVersion": "tpl-index-1",
  "default": "t1",
  "templates": [ /* 见 GET 响应 */ ]
}
```

**`templates/<id>.json`** — 每个模板：

```jsonc
{
  "schemaVersion": "tpl-1",
  "template": { "id", "name", "nameEn", "desc", "builtin" },

  // 内置：种子，加载时自动布局
  "seed":   { "nodes":[…], "edges":[…] }

  // 用户：完整画布，保留原布局/规则（与 seed 互斥）
  "canvas": { …导出的画布 JSON… }
}
```

---

## 4. 在父平台后端重新实现

若模板由平台自有后端管理，前端无需改动——只要把端点指过去，后端实现上面同样的四个动词与 JSON 形态即可。

**前端切换端点**：加载 `topology-editor.js` 前设置两个全局变量（支持绝对 URL，跨域需配 CORS）：

```js
window.TOPO_TPL_BASE = "https://api.example.com/topo/templates/"; // 读：清单与模板文件的基路径
window.TOPO_TPL_API  = "https://api.example.com/topo/api/templates";  // 写：增删改接口
```

| 后端需保证 | 说明 |
|---|---|
| **列表可读** | `GET {BASE}index.json` 与 `GET {BASE}<file>` 能取到清单与模板原文（或让 `{API}` 的 GET 返回等价清单）。 |
| **四个动词** | POST/PUT/DELETE 行为与本页一致，返回 `{ ok, entry|default }`。 |
| **持久化分离** | 模板存储**不要**放进会被前端构建（`dist/`）清空的目录；用独立表或持久卷。 |
| **preview 兜底** | 前端不传 `preview` 时，从 `nodes[].position` 坐标 + `edges` 端点算出 `{ pts, edges }` 写入清单。 |

---

## 5. 边界与校验

| 项 | 规则 | 原因 |
|---|---|---|
| **id 消毒** | `replace(/[^A-Za-z0-9_-]/g,'')`，截断 64 字符 | 防目录穿越（`../` 被清除），文件名安全 |
| **请求体上限** | 16 MB，超限断开 | 避免超大画布拖垮内存 |
| **编码** | 读写一律 UTF-8 | 模板名/描述含中文 |
| **编号生成** | 取最小空缺的 `tpl_N` | 与清单已有 id 不冲突 |
| **无后端时** | 前端写失败 → 回退“下载 JSON” | 纯静态托管（仅 `dist/`）仍可读，写则手动放入目录 |

---

## 6. 部署一览

| 场景 | 命令 | 模板写入 |
|---|---|---|
| 本地开发（热重载） | `npm run dev` | ✅ 写 `templates/` |
| 生产（可写） | `npm run build` 后 `npm start`（`node scripts/server.js`） | ✅ 写 `templates/`（持久） |
| 纯静态托管（Nginx 直接挂 `dist/`） | 部署 `dist/` | ❌ 仅能读；保存回退为“下载 JSON” |

生产服务器 `scripts/server.js` 环境变量：`PORT`（默认 3009）、`HOST`（默认 0.0.0.0）、`STATIC_ROOT`（默认 `dist/`）、`TEMPLATES_DIR`（默认项目根 `templates/`；容器部署建议挂为持久卷）。
