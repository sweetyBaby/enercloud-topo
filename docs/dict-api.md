# 储能拓扑 · 值字典存储 API 契约

> 给后端同学对接（或在父平台后端重新实现）用。值字典把字段/信号/连线标签的 **code 码值转义成中/英文案**显示在画布上。后端要做的事只有一句：**把字典的增删改查映射成「读写一个目录里的 JSON 文件 + 维护一份清单」**——一个目录、一份 `index.json` 清单、每个字典一个文件，与模板库完全同构。
>
> 本仓库的参考实现：`scripts/dict-store.js`（核心逻辑，dev 与生产共用）· `scripts/dev-server.js`（开发）· `scripts/server.js`（生产 `npm start`）。转义逻辑本身在 `packages/topology-runtime`（编辑器与前端渲染器共用），本页只描述字典**数据存储**的对外契约。
>
> 📑 值字典「怎么被画布消费/如何自动匹配字段/前端如何调用」见 [`docs/realtime-data-api.md` 第 9 节](realtime-data-api.md)。

---

## 1. 值字典是什么

一张字典 = 一套 **code → 中/英文案** 的转义表 + 它「认领」的后台字段清单：

```jsonc
{
  "type": "bms_status",            // 唯一键(dictType)，字段/信号/连线标签用它引用
  "name": "电池状态",               // 字典名(中文，管理界面显示)
  "nameEn": "Battery Status",
  "applyTo": [                     // ★ 自动匹配：认领的后台字段(deviceType + location.field)
    { "deviceType": "BCU", "field": "StringDataLogs.String1State" }
  ],
  "items": [                       // ★ code → 中/英文案；code 统一按字符串匹配(数字/字符串均可)
    { "code": "0", "zh": "待机", "en": "Standby" },
    { "code": "1", "zh": "充电", "en": "Charging" },
    { "code": "2", "zh": "放电", "en": "Discharging" }
  ]
}
```

- **一张字典可认领多个后台字段**（`applyTo` 多项）：状态码相同的字段共用一份码表。
- **码表不同的字段** → 各建一张字典。字典是「一套码表」的复用单元，与 Ruoyi 的 `dictType` 语义一致。
- 画布字段/信号/连线标签**绑定了**被 `applyTo` 认领的后台字段 → 自动转义（零配置）；也可在元素上手动指定字典/强制不转义（见 realtime-data-api.md 第 9 节的三态 `dict` 属性）。

---

## 2. 请求如何流转

读取走纯静态文件（任何托管都行）；写入走 `/api/value-dicts` 接口，由服务器自动落盘。清单由**服务端实时扫描目录**动态生成——手动增删改目录里的 JSON 文件后，重新请求清单即反映（编辑器「📖 值字典 → 🔄 重新扫描」即触发一次重拉）。

```
                    请求                 读 / 写
  前端编辑器  ───────────────▶  Node 服务器  ───────────────▶  📁 value-dicts/
 topology-editor.js ◀───────  dev-server·server.js ◀───────   index.json（扫描生成）
                  JSON 响应   └ dict-store.js ┘   文件内容   <type>.json（每张字典）
```

配色约定（沿用编辑器连线语义）：**读=青 GET / 建=绿 POST / 改=金 PUT / 删=红 DELETE**。

---

## 3. 四个接口

路径前缀 `/api/value-dicts`。请求/响应均为 JSON（UTF-8）。`:type` 为字典标识，服务端消毒为 `[A-Za-z0-9_-]`。

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/value-dicts` | 取字典清单 |
| `POST` | `/api/value-dicts` | 新建字典 |
| `PUT` | `/api/value-dicts/:type` | 整体更新（名称 / applyTo / items） |
| `DELETE` | `/api/value-dicts/:type` | 删除字典 |

通用错误：未匹配的方法返回 `405`；请求体解析失败或其它异常统一 `400 { ok:false, error }`。

### GET `/api/value-dicts`

返回扫描目录得到的清单。状态码 `200`。前端列表也可直接静态读 `value-dicts/index.json`（同一结果）。

```jsonc
{
  "schemaVersion": "vd-index-1",
  "dicts": [
    { "type":"bms_status", "name":"电池状态", "nameEn":"Battery Status",
      "applyTo":[ {"deviceType":"BCU","field":"StringDataLogs.String1State"} ],
      "items":[ {"code":"0","zh":"待机","en":"Standby"}, … ] }
  ]
}
```

> `type` 冲突（多份文件同 type）时先到先得：按文件名排序取第一个，结果稳定。

### POST `/api/value-dicts`

**请求体**

```jsonc
{
  "type": "bms_status",            // 必填，[A-Za-z0-9_-]
  "name": "电池状态",               // 必填
  "nameEn": "Battery Status",      // 必填
  "applyTo": [ {"deviceType":"BCU","field":"StringDataLogs.String1State"} ],  // 选填
  "items": [ {"code":"0","zh":"待机","en":"Standby"}, … ]                      // 选填
}
```

**响应 `200`**：`{ "ok": true, "dict": { …归一化后的完整字典… } }`

| 状态码 | 含义 |
|---|---|
| `200` | 成功 |
| `400` | 缺 `type` / 缺 `name` / 缺 `nameEn` / 某条目 `code`、`zh`、`en` 缺失 / 同字典内 `code` 重复 |
| `409` | `type` 已存在 / `name` 或 `nameEn` 与其它字典重复 |

### PUT `/api/value-dicts/:type`

整体更新一张已存在字典。未提供的字段沿用现有值（`name`/`nameEn`），`applyTo`/`items` 传了即整体替换。

```jsonc
{ "name":"电池状态", "nameEn":"Battery Status",
  "applyTo":[ … ], "items":[ … ] }
```

**响应 `200`**：`{ "ok": true, "dict": { …更新后的完整字典… } }`

| 状态码 | 含义 |
|---|---|
| `200` | 成功 |
| `400` | `name`/`nameEn` 为空 / 条目 `code·zh·en` 缺失 / `code` 重复 |
| `404` | `type` 不存在 |
| `409` | `name` / `nameEn` 与其它字典重复 |

### DELETE `/api/value-dicts/:type`

**响应 `200`**：`{ "ok": true }`

| 状态码 | 含义 |
|---|---|
| `200` | 成功 |
| `404` | `type` 不存在 |

> 删除 `<type>.json`。引用该字典的字段将不再转义，回退显示原始 code（不报错）。

---

## 4. 数据模型

一份清单索引所有字典（扫描生成，不落盘 `index.json`）；每张字典一个文件。

**`value-dicts/index.json`**（服务端扫描生成，前端只读）：结构见 GET 响应。

**`value-dicts/<type>.json`**（每张字典）：

```jsonc
{
  "schemaVersion": "vd-1",
  "type": "bms_status",
  "name": "电池状态",
  "nameEn": "Battery Status",
  "applyTo": [ { "deviceType": "BCU", "field": "location.field" } ],
  "items":   [ { "code": "0", "zh": "待机", "en": "Standby" } ]
}
```

---

## 5. 导入 / 导出（编辑器「📖 值字典管理」）

导入导出格式与落盘/清单**同构**，三者可自由互转：

| 操作 | 产物 / 接受 |
|---|---|
| **单个导出** | `<type>.json`（`{schemaVersion:'vd-1',type,name,nameEn,applyTo,items}`），可直接放入 `value-dicts/` 目录或再导入 |
| **导出全部** | `value-dicts.json`（`{schemaVersion:'vd-index-1',dicts:[…]}` 清单） |
| **导入** | 多选文件；每个文件兼容 **单个字典对象 / 字典数组 / `{dicts:[…]}` 清单** 三种形态 |

导入时前端做**宽松归一化**（`nameEn←name`、条目 `en←zh` 互兜底、`type` 非法字符清洗、无 `code` 条目剔除、同字典内 `code` 去重、`applyTo` 只保留合法 `location.field`），再逐条走 POST/PUT，因此手写的不完整 JSON 也能通过服务端强校验。同名 `type` 统一询问一次是否覆盖（覆盖走 PUT，跳过则只导新增）。

---

## 6. 在父平台后端重新实现

若字典由平台自有后端管理（如对接 Ruoyi 字典），前端无需改动——把端点指过去，实现上面同样的四个动词与 JSON 形态即可。

**前端切换端点**：加载 `topology-editor.js` 前设置全局变量（支持绝对 URL，跨域需配 CORS）：

```js
window.TOPO_DICT_BASE = "https://api.example.com/topo/value-dicts/";  // 读：清单与字典文件的基路径
window.TOPO_DICT_API  = "https://api.example.com/topo/api/value-dicts"; // 写：增删改接口
```

| 后端需保证 | 说明 |
|---|---|
| **清单可读** | `GET {BASE}index.json` 返回 `{schemaVersion:'vd-index-1',dicts:[…]}`（或让 `{API}` 的 GET 返回等价清单）。 |
| **四个动词** | POST/PUT/DELETE 行为与本页一致，返回 `{ ok, dict? }`。 |
| **必填校验** | `type`/`name`/`nameEn` 必填；条目 `code·zh·en` 必填、同字典内 `code` 唯一。 |
| **持久化分离** | 字典存储**不要**放进会被前端构建（`dist/`）清空的目录；用独立表或持久卷。 |

> 也可完全绕过存储接口：前端渲染器的值字典数据由 `env.getValueDicts()` 提供，父平台可直接把自有字典（结构同 §1）传进去，运行期覆盖——见 realtime-data-api.md 第 9.3 节。

---

## 7. 边界与校验

| 项 | 规则 | 原因 |
|---|---|---|
| **type 消毒** | `replace(/[^A-Za-z0-9_-]/g,'')`，截断 64 字符 | 防目录穿越，文件名安全 |
| **请求体上限** | 4 MB，超限断开 | 字典体量小，避免异常大 body |
| **编码** | 读写一律 UTF-8 | 字典名/文案含中文 |
| **code 匹配** | 转义时统一 `String(code)` 比较 | 后台推数字 `1` 与字典 `"1"` 视为同一 code |
| **回退** | 未命中 code / 字典不存在 → 原样显示原始值 | 转义非强制，不吞值 |
| **无后端时** | 写接口不可用 → 管理弹框提示；导入/新建失败 | 纯静态托管仅能读清单文件 |

---

## 8. 部署一览

| 场景 | 命令 | 字典写入 |
|---|---|---|
| 本地开发（热重载） | `npm run dev` | ✅ 写 `value-dicts/`（该目录已排除热重载，落盘不刷整页） |
| 生产（可写） | `npm run build` 后 `npm start`（`node scripts/server.js`） | ✅ 写 `value-dicts/`（持久） |
| 纯静态托管（Nginx 直接挂 `dist/`） | 部署 `dist/`（`build.py` 已拷贝 `value-dicts/` 并生成清单） | ❌ 仅能读；增删改需手改文件或走后端 |

生产服务器 `scripts/server.js` 环境变量：`VALUE_DICTS_DIR`（默认项目根 `value-dicts/`；容器部署建议挂为持久卷），其余同模板（`PORT`/`HOST`/`STATIC_ROOT` 等，见 template-api.md §6）。
