# 储能拓扑系统 · 运营端与前端接入文档

> 一句话总览：**运营端**用编辑器把拓扑图和规则配好、导出 JSON；**前端**动态拉取这份 JSON + 实时数据，用**同一份渲染器**把图画出来，元素/连线的显隐与流向全部由规则自动驱动。

---

## 1. 整体架构

```
┌─────────────┐     画布 JSON（拓扑+规则）      ┌──────────────┐
│   运营端     │ ──────────────────────────────▶ │    前端       │
│ 编辑器(配置) │                                  │ 运行渲染(只读) │
└─────────────┘     元素库包(图标/runtime.js)    └──────┬───────┘
                                                         │ 实时数据(信号)
                                                ┌────────▼────────┐
                                                │ 后端 / 数据网关  │
                                                └─────────────────┘
```

- **同一个 HTML 文件**既是运营端编辑器，也是前端渲染器（带 `?mode=runtime` 即只读运行）。好处：前端**零重写**，渲染、智能走线、母线汇流、流向动画、字段卡片与运营端**像素级一致**。
- 规则是**纯数据（JSON）**，由内置引擎解释执行（无 `eval`），动态下发安全。

---

## 2. 运营端：如何配置

打开 `拓扑结构编辑器-V3.html`，按下面步骤操作。

### 2.1 搭建拓扑
1. 从左侧元素库拖入设备（电网/光伏/PCS/电池/负载…）。
2. 用「连线模式」连接元素，选中连线可设类型、走线方式、流向、标签。
3. 选中元素可改 ID、名称（中/英）、状态、数据字段、缩放/旋转等。

> **元素 ID 很重要**：它是规则与实时数据里「信号名」的前缀（如 `pcs_1.P(kW)`），配置后尽量不要随意改。

### 2.2 配置数据字段
- 选中元素 → 「数据字段」里增删字段（如 `P(kW)`、`SOC(%)`、`状态`）。
- 字段值留空 = **无值**（前端显示为空）；填 `0` = 真实的 0（前端显示 `0`）。

### 2.3 配置数据驱动规则（核心）
在属性面板里给元素/连线加规则，**保存后实时生效**（编辑态被规则隐藏的元素会虚化，勾选「预览效果」看真实运行态）：

| 规则 | 作用对象 | 说明 |
|---|---|---|
| **显示条件** `visibleWhen` | 元素 | 条件不满足 → 该元素（及其连线）隐藏 |
| **显示条件** `showWhen` | 连线 | 条件不满足 → 该连线不画（适合"动态建立的连线"） |
| **流向（按规则确定）** `dirRules` | 连线 | 按顺序匹配，第一个命中的规则决定流向；都不命中用连线自身的「固定流向」兜底 |

流向取值：`正向 →` / `反向 ←` / `双向 ↔` / `无流向`。

### 2.4 全局信号 & 注入测试
- 「⚙ 规则与信号」面板可新增**全局信号**（如 `mode`、`islanding`），任意规则都能引用，随图导出。
- 「注入信号（测试）」可临时给某信号赋值，验证规则效果（仅本地测试，不影响导出）。

### 2.5 导出
- **⬇ 下载画布 JSON**（文件菜单 / JSON 面板）：得到 `topology.json`，含节点、连线、规则、全局信号、视图设置。**这份给前端。**
- **🗂 元素库包(ZIP)**：含 `element-library.json`（图标/默认值/连线样式/字典）、`runtime.js`（规则引擎）、`icons/`、`README.md`。**部署一次给前端复用。**

---

## 3. 前端：如何渲染

### 方案 A（推荐 · 零重写 · 与运营端完全一致）

把编辑器 HTML 以「只读运行模式」托管或内嵌，复用同一份渲染器。三种用法任选：

#### A1. URL 参数（直接托管）
```
拓扑结构编辑器-V3.html?mode=runtime&topology=<画布JSON地址>&signals=<实时数据地址>&interval=2000
```
| 参数 | 说明 |
|---|---|
| `mode=runtime` | 进入只读运行模式（隐藏所有编辑器外壳，画布铺满） |
| `topology` | 画布 JSON 的 URL（前端动态提供） |
| `signals` | 实时数据 JSON 的 URL（轮询拉取） |
| `interval` | 轮询间隔毫秒（如 `2000`；不填只拉一次） |
| `fit=0` | 关闭自动适配（默认自动缩放铺满容器） |
| `interactive=1` | 允许平移/缩放（默认只读不可交互） |

#### A2. iframe 内嵌 + postMessage（推荐用于大屏/管理后台）
```html
<iframe id="topo" src="拓扑结构编辑器-V3.html?mode=embed&interactive=0"
        style="width:100%;height:100%;border:0"></iframe>
<script>
const frame = document.getElementById('topo');
// iframe 就绪后再下发数据
window.addEventListener('message', (ev) => {
  if (ev.data && ev.data.type === 'topo:ready') {
    // 1) 下发拓扑（从你的接口拉到的画布 JSON 对象）
    frame.contentWindow.postMessage({ type: 'topo:topology', data: 画布JSON对象 }, '*');
    // 2) 下发实时数据（整批覆盖）
    frame.contentWindow.postMessage({ type: 'topo:signals',
      data: { 'grid_1.P(kW)': 383, 'pcs_1.P(kW)': -9, 'bms_1.SOC(%)': 55, 'grid_1.online': true } }, '*');
  }
});
// 之后每次实时数据更新（增量合并，只传变化的信号）
function onTick(payload){ frame.contentWindow.postMessage({ type: 'topo:merge', data: payload }, '*'); }
</script>
```
postMessage 消息类型：
| type | data | 含义 |
|---|---|---|
| `topo:topology` | 画布 JSON 对象 | 加载/切换拓扑 |
| `topo:signals` | `{信号:值}` | **整批覆盖**所有信号 |
| `topo:merge` | `{信号:值}` | **增量合并**（只更新传入的信号，推荐高频用） |
| `topo:ready` | — | （iframe → 父页面）渲染器已就绪，可开始推数据 |

#### A3. JS API（同源/直接托管时）
```js
TopoRuntime.loadTopology(对象或URL);   // 加载拓扑
TopoRuntime.setSignals({...});         // 整批覆盖信号
TopoRuntime.mergeSignals({...});       // 增量合并
TopoRuntime.fit();                     // 重新适配容器尺寸
```

### 方案 B（自研渲染器）
只想用规则引擎、自己画图：用元素库包里的 `runtime.js`。
```js
import { resolveDynamic } from './runtime.js';
const state = resolveDynamic(topology, liveSignals);
// state.nodes: [{...node, visible}]            visible=false 不渲染
// state.edges: [{...edge, visible, dir}]        visible 决定是否画，dir=动态流向
```
> ⚠️ 注意：连线 `route:"smart"`（智能走线）的实际避障路径**不在 JSON 里**，自研渲染需自己实现走线算法，否则线形可能与运营端不一致。**优先用方案 A 可避免该问题。**

---

## 4. 数据契约（前后端必须对齐 · 最重要）

### 4.1 信号命名规则
实时数据是一个**扁平对象** `{ 信号名: 值 }`，信号名规则：

| 信号类型 | 命名 | 示例 |
|---|---|---|
| 节点数据字段 | `节点id.字段名` | `pcs_1.P(kW)`、`bms_1.SOC(%)` |
| 节点状态 | `节点id.status` | `pcs_1.status` = `"运行"` |
| 节点在线 | `节点id.online` | `grid_1.online` = `true` |
| 全局信号 | `信号名` | `mode` = `"island"` |

> 字段名用的是运营端配置的**中文字段名**（如 `P(kW)`、`今日用电(kWh)`）。前后端务必一致。

实时数据示例：
```json
{
  "grid_1.P(kW)": 383,
  "grid_1.online": true,
  "pcs_1.P(kW)": -9,
  "pcs_1.status": "放电",
  "bms_1.SOC(%)": 55,
  "mode": "island"
}
```

### 4.2 同一份数据，两个用途
推送的实时数据**同时**：① 驱动规则（决定显隐/流向）；② 显示在元素的字段卡片上。无需分两份。

### 4.3 字段值显示规则
- **有值就显示**：`P(kW): 0`、`SOC(%): 55`。其中 **`0` 会如实显示为 `0`**。
- **无值显示空**：字段值为 `null`、未提供、或空串 `""` → 显示 `字段名: `（值留空）。
- 想让某字段"暂无数据"，实时数据里给它 `null`/`""` 或干脆不传该键（保留上次值）。要清空就显式传空。

### 4.4 显隐与流向如何被驱动
- 每帧用当前信号实时求值：节点 `visibleWhen` 不满足→隐藏；连线 `showWhen` 不满足或两端节点被隐藏→不画；连线 `dirRules` 顺序匹配出流向（箭头/流动动画方向随之变化）。
- 没传的信号回退到画布里的静态默认值（节点字段值 / 状态 / 在线=true / 全局信号样例）。

---

## 5. 规则结构参考

规则就是一棵**条件树**：

```jsonc
// 叶子（单条件）
{ "var": "信号名", "op": "运算符", "val": 比较值 }     // 与常量比
{ "var": "信号名", "op": "运算符", "ref": "另一信号名" } // 与另一个信号比

// 组合
{ "all": [ 条件, 条件, ... ] }   // 且（全部满足）
{ "any": [ 条件, 条件, ... ] }   // 或（任一满足）
{ "not": 条件 }                  // 非
// null / 不写 = 恒为真
```

支持的运算符 `op`：

| op | 含义 | 备注 |
|---|---|---|
| `==` `!=` | 等于 / 不等于 | 数字与字符串可互通（`true=="true"`、`0=="0"` 成立） |
| `>` `>=` `<` `<=` | 数值比较 | 非数字/无值 → 不命中 |
| `in` | 属于列表 | `val` 用逗号分隔，如 `"运行,充电"` |
| `between` | 区间 | `val` 形如 `"20,80"`（含端点） |
| `truthy` `falsy` | 为真 / 为假 | `"false"`、`"0"`、空 视为假 |
| `exists` | 存在 | 非 null/undefined/空串（`0`、`false` 算存在） |

> **无值字段的规则语义**：一个还没有值的字段（空），数值比较一律不命中（"没有数据 ≠ 0"）；一旦有了真实值（含 `0`）就按实际值判定。

连线流向 `dirRules` 示例（PCS 功率正充负放）：
```json
"dirRules": [
  { "when": {"var":"pcs_1.P(kW)","op":">","val":0}, "dir":"forward" },
  { "when": {"var":"pcs_1.P(kW)","op":"<","val":0}, "dir":"reverse" },
  { "when": {"var":"pcs_1.P(kW)","op":"==","val":0}, "dir":"none" }
]
```

---

## 6. 画布 JSON 结构速览

```jsonc
{
  "schemaVersion": "2.0",
  "meta": {
    "libraryRef": { "name": "...", "version": "..." },   // 引用的元素库版本
    "canvas": { "bgColor": "...", "zoom": 1, "panX": 0, "panY": 0, "grid": {...}, "showAnchors": true },
    "view":   { "showEdgeLabels": true, "showFieldChips": true, "globalWidth": 1, "routeStyle": 3, "busMerge": true, ... }
  },
  "edgeStyles": { "ac_power": {...} },                    // 本图用到的连线样式(自带)
  "nodes": [
    { "id":"pcs_1", "type":"pcs", "label":{"zh":"PCS变流器","en":"PCS"},
      "position":{"x":480,"y":220}, "data":[{"key":{"zh":"P(kW)","en":"P(kW)"},"value":0}],
      "visibleWhen": {...} }                              // 可选：显示条件
  ],
  "edges": [
    { "from":"pv_1", "to":"pcs_1", "edgeType":"ac_power", "route":"smart", "dir":"forward",
      "showWhen": {...}, "dirRules": [...] }              // 可选：显示/流向规则
  ],
  "signals": [ { "name":"mode", "label":"运行模式", "sample":"island", "type":"enum", "options":["grid","island"] } ],
  "sampleSignals": { "grid_1.online": true }              // 导出时的样例值(可作默认)
}
```

---

## 7. 注意事项 / FAQ

- **版本一致**：画布 JSON 的 `meta.libraryRef.version` 需与前端加载的 `element-library.json` 一致；自定义图标缺失时需在运营端重新上传。
- **跨域(CORS)**：方案 A1 的 `topology`/`signals` URL 走 fetch，需后端允许跨域；用 iframe + postMessage（A2）可规避。
- **更新频率**：实时数据高频更新建议用 `topo:merge`（增量）；渲染按动画帧自动重绘，无需手动触发。
- **`0` 值**：会如实显示为 `0` 并参与规则；想表示"无数据"请传 `null`/空串。
- **smart 走线**：要与运营端线形完全一致，请用方案 A（同一渲染器）；方案 B 需自研走线算法。
- **安全**：规则为声明式 JSON，引擎不执行任意代码，可放心动态下发。

---

## 8. 最小联调清单

**运营端**：① 配好拓扑+规则 → ② 「预览效果」自检显隐/流向 → ③ 导出画布 JSON + 元素库包 → 交付前端。

**前端**：① 部署元素库包（图标/runtime.js）→ ② 用方案 A 嵌入编辑器 HTML → ③ 下发画布 JSON → ④ 按信号命名规则推送实时数据（轮询或 WebSocket → postMessage/merge）→ ⑤ 核对显隐/流向/字段与运营端一致。

> 可参考随附的 **`demo.html`**（iframe + postMessage + 模拟实时数据的可运行示例）。
