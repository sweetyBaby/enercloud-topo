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
2. 用「连线模式」连接元素，选中连线可设类型、走线方式、流向、标签（标签可绑后台字段动态显示，见 §2.6）。
3. 选中元素可改 ID、名称（中/英）、状态、数据字段、缩放/旋转等。属性面板按 **基本 / 外观 / 数据驱动 / 后台绑定与数据（连线为标签）** 分组。
4. **文本框/变量/占位点**为纯标注元素，可紧贴连线或设备摆放（不参与连线避障，直线不会被顶成折线）。**占位点（anchor）**可当**汇合/分接点**：拖到连线上松手即把该线分接为两段并成为汇合点，再从它引出新线即形成 T 型汇合；拖到另一占位点上则合并为一个点。多条线汇合后画面上只保留一条线、一个汇合点（自动去重、不叠线；连线右键「从此处引出连线」一步完成插点+起线）。

> **元素 ID 很重要**：它是规则与实时数据里「信号名」的前缀（如 `pcs_1.P(kW)`），配置后尽量不要随意改。连线标签绑定后台字段时会自动生成连线 id（如 `edge_1`），作标签信号键前缀，同样不宜再改。

### 2.2 配置数据字段
- 选中元素 → 「数据字段」里增删字段（如 `P(kW)`、`SOC(%)`、`状态`）。
- 字段值留空 = **无值**（前端显示为空）；填 `0` = 真实的 0（前端显示 `0`）。
- 🔗 绑定后台字段的弹窗有两种模式（数据字段与全局信号均支持）：
  - **单字段**：来源设备 → 分类 → 字段，直连一个后台字段（现状）。
  - **计算/比较**：多个后台字段与常量做链式计算/比较（如 `pcs1.P ＋ pcs2.P × 0.95`、`P > RatedP`），从上到下依次结合（无括号/优先级）；比较结果为 `1/0`，可再配值字典转成文案；数值结果可设**保留小数位**（0~3，默认 2）。后台只推各操作数原始值（`dataBindings` 里带 `calcOf` 的条目），计算在画布/前端完成——后端零改动，见 [`docs/realtime-data-api.md` §8.6](docs/realtime-data-api.md)。

### 2.3 配置数据驱动规则（核心）
在属性面板里给元素/连线加规则，**保存后实时生效**（编辑态被规则隐藏的元素会虚化，勾选「预览效果」看真实运行态）：

| 规则 | 作用对象 | 说明 |
|---|---|---|
| **显示条件** `visibleWhen` | 元素 | 条件不满足 → 该元素（及其连线）隐藏 |
| **图标规则** `iconRules` | 元素 | 按信号顺序匹配，第一个命中的规则决定显示哪个图标；都不命中用元素自身图标（如电池 BMS 充电/放电/待机切换不同图标） |
| **显示条件** `showWhen` | 连线 | 条件不满足 → 该连线不画（适合"动态建立的连线"） |
| **流向（按规则确定）** `dirRules` | 连线 | 按顺序匹配，第一个命中的规则决定流向；都不命中用连线自身的「固定流向」兜底 |

流向取值：`正向 →` / `反向 ←` / `双向 ↔` / `无流向`。

**图标规则怎么配**：选中元素 → 属性面板「图标规则（数据驱动）」→「编辑」。每条规则 = 一个条件 + 一个目标图标（从元素库里选，如 `bms_charge` / `bms_discharge` / `bms_standby`）；从上到下匹配，命中即用该图标，都不命中回落到元素自身图标。图标切换**只换显示图标**，不改元素类型/尺寸/数据字段。前端拿到的目标图标是元素库里的 `type`，用 `type→图标文件` 同一张映射解析（见 §5、§6）。

### 2.4 全局信号 & 注入测试
工具栏拆成两个独立面板：**「⚡ 信号」**（管理全局信号 + 注入测试 + 批量样例 JSON）和 **「📏 规则」**（运行视图 + 规则总览）。
- **「⚡ 信号」面板 → 全局信号**：与数据字段**完全一致**的网格——每个信号有**中文名、英文名（都必填且全局唯一）、默认值**（普通输入框，类型按值自动推断，无单独类型列），还可**绑定后台字段**（选具体设备实例 + 字段）。**英文名即信号键**（如中文名`运行模式`/英文名`mode`，规则与实时数据都用 `mode`）；随图导出，任意规则均可引用。
- 「注入信号（测试）」可临时给某信号赋值，验证规则效果（仅本地测试，不影响导出）。
- 校验：全局信号缺中/英文名或名称重复（英文名重复=信号键冲突）会**阻断导出**，直到修正。

### 2.5 值字典（code 码转义 · 显示中/英文案）

后台很多字段的值是 **code 码**（如 `RunStatus=1`）。值字典把 code 转义成中/英文文案后显示在画布上——**规则求值与实时数据推送始终用原始 code，转义只发生在显示层**，切语言自动切文案，查不到的 code 回退原样显示。

- **菜单栏「📖 值字典」**：管理共享字典库（增删改），每张字典 = 一套 `code → 中/英文案` 表 + 它「认领」的后台字段（`applyTo`）。
- **两条关联路径**：
  - **自动匹配（主）**：字典在 `applyTo` 里认领后台字段后，画布上**绑定了**该后台字段的数据字段/全局信号/连线标签**自动转义**，零配置。
  - **手动指定（兜底/覆盖）**：字段/信号/标签行的 📖 按钮里可选「自动 / 不转义 / 强制某字典」，优先级最高。
- **中英文与校验**：字典名中/英文必填；每个 code 的中文、英文文案都必填、code 同字典内唯一。
- **条件条目**：除「code 等值」外，条目还可按**与常量比较/区间**转义（如 SOC `<20 → 低`、`between 20,80 → 正常`）；区间可选**端点是否包含**（含两端 / 含左 / 含右 / 不含两端，存储用括号写法如 `"(20,80]"`，纯 `"a,b"`=含两端）；还有**「其他(兜底)」**条目（`when.op='else'`，无比较值）——任何未命中的值归入，兜底文案自定义，建议放最后。求值顺序：code 精确匹配优先 → 条件按顺序首中即用 → 都不中原样显示（有兜底则归入兜底）。与**另一后台字段**的计算/比较请用「计算绑定」（见 §2.4 绑定弹窗）算出 `1/0` 再配枚举字典。
- **导入 / 导出 / 重扫**：管理弹框支持导出（单个 `<type>.json` / 全部 `{dicts:[…]}` 清单）与导入（兼容单对象/数组/清单三形态，同名询问后覆盖）；手改 `value-dicts/` 目录里的 JSON 后点「🔄 重新扫描」即时生效。
- 导出画布 JSON 时**自动内嵌本图用到的字典快照**（顶层 `valueDicts`），前端零依赖即可正确转义。

> 📑 字典存储 CRUD 接口契约见 [`docs/dict-api.md`](docs/dict-api.md)；画布如何消费、前端如何调用见 [`docs/realtime-data-api.md` 第 9 节](docs/realtime-data-api.md)。

### 2.6 连线标签（辅助展示 · 可绑数据 · 可拖拽旋转）

连线标签用于在连线上展示辅助信息，能像数据字段一样绑定后台字段动态展示：

- **文字**：中/英双语（随语言切换），English 兼作信号键（绑定时必填）。
- **绑定后台字段**：设备类型（必选，驱动分类/字段级联）→ 设备实例（**可不指定**，由后台按类型对应）→ 分类 → 字段。标签值 = 该字段实时值，命中值字典则自动转义（非强制）。
- **展示内容**：`只显示值`（默认）/ `只显示标签名` / `标签名: 值`；未绑定时只显示文字。
- **样式**：文字走向 自动（随线）/横排/竖排；可旋转、缩放；**画布上直接拖动**标签移动位置（拖远显示回连锚点的引导虚线），选中后带旋转/缩放手柄；面板也有对应滑杆。
- **静态默认值 + 当前值溯源**：无实时数据时显示静态默认值（也可用来模拟后台值看效果）；面板底部实时显示「原始值 → 转义结果 · 来源 · 经过哪个字典」。

> 标签信号键 = `连线id.标签英文名`（如 `edge_1.Power`），随图导出、进 `dataBindings`，后端推送方式与节点字段完全一致（见 §4.1、§6）。

### 2.7 导出
- **⬇ 下载画布 JSON**（文件菜单 / JSON 面板）：得到 `topology.json`，含节点、连线（含标签绑定）、规则、全局信号、**用到的值字典快照 `valueDicts`**、视图设置。**这份给前端。**
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
      data: { 'grid_1.P(kW)': 383, 'pcs_1.P(kW)': -9, 'bms_1.SOC(%)': 55 } }, '*');
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
// state.nodes: [{...node, visible, iconType}]   visible=false 不渲染；iconType=当前应绘制的图标(默认=node.type)
// state.edges: [{...edge, visible, dir}]         visible 决定是否画，dir=动态流向

// 画节点图标时，用 iconType 取图标文件（与 node.type 同一张映射表）：
state.nodes.forEach(n => {
  if (!n.visible) return;                          // 被显示条件隐藏 → 跳过
  const iconUrl = ICON_BASE + ICON_PATHS[n.iconType];   // ← 图标规则命中时 iconType≠type，自动换图
  drawImage(iconUrl, n.position, n.sizeWorld);
});
```
> ⚠️ 注意：连线 `route:"smart"`（智能走线）的实际避障路径**不在 JSON 里**，自研渲染需自己实现走线算法，否则线形可能与运营端不一致。**优先用方案 A 可避免该问题。**
> 方案 A（同一渲染器）会**自动按 `iconRules` 换图标**，前端无需任何处理。

---

## 4. 数据契约（前后端必须对齐 · 最重要）

> 📑 **实时数据接口的完整结构、下发方式、覆盖/合并语义与后端对接清单**见 [`docs/realtime-data-api.md`](docs/realtime-data-api.md)。本节是速览。

### 4.1 信号命名规则
实时数据是一个**扁平对象** `{ 信号名: 值 }`，信号名规则：

| 信号类型 | 命名 | 示例 |
|---|---|---|
| 节点数据字段 | `节点id.英文字段名` | `pcs_1.P(kW)`、`bms_1.SOC(%)`、`pcs_1.Status` |
| 连线标签 | `连线id.标签英文名` | `edge_1.Power`、`edge_2.ChargeState`（连线 id 绑定标签时生成） |
| 全局信号 | `信号英文名` | `mode` = `"island"`（中文名`运行模式`，键用英文名 `mode`） |

> **字段名用的是运营端配置的「英文名」**（`data[].key.en`），如 `P(kW)`、`Today(kWh)`、`Status`。运营端每个数据字段**中文名、英文名都是必填**（缺任一无法绑定、且会阻断导出）；英文名作为端到端信号键，前后端务必逐字一致。字段卡片在图上仍显示中文名，仅信号键用英文。
> 节点信号**只有「已绑定的数据字段」**——旧的 `节点id.status` / `节点id.online` 自动隐藏字段已移除；如需状态/在线，请在画布上给节点**显式加数据字段**（中文名 `状态`/`在线`，英文名 `Status`/`Online`），用 `节点id.英文名`（如 `pcs_1.Status`）下发。

实时数据示例：
```json
{
  "grid_1.P(kW)": 383,
  "pcs_1.P(kW)": -9,
  "pcs_1.Status": "放电",
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
- **值字典转义**：字段/信号/连线标签若命中值字典（见 §2.5），显示的是转义后的中/英文案（如 code `1` → `充电`/`Charging`），随语言切换；**推送的仍是原始 code**，转义只在显示层，查不到的 code 原样显示。

### 4.4 显隐 / 图标 / 流向如何被驱动
- 每帧用当前信号实时求值：节点 `visibleWhen` 不满足→隐藏；节点 `iconRules` 顺序匹配出当前图标（首个命中生效，都不命中用自身图标）；连线 `showWhen` 不满足或两端节点被隐藏→不画；连线 `dirRules` 顺序匹配出流向（箭头/流动动画方向随之变化）。
- 没传的信号回退到画布里的静态默认值（节点字段值 / 全局信号样例）。

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
| `between` | 区间 | `val` 形如 `"20,80"`（含两端）；括号写法控制端点：`"[20,80)"` 含左、`"(20,80]"` 含右、`"(20,80)"` 不含两端 |
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

节点图标规则 `iconRules` 示例：`icon` 是元素库里的 `type`（前端用 `type→图标文件` 同一张映射解析）。

用**离散状态字段**驱动（后台推一个中文名`状态`/英文名`Status`的字段，值为 充电/放电/待机；信号键用英文名）：
```json
"iconRules": [
  { "when": {"var":"bms_1.Status","op":"==","val":"充电"}, "icon":"bms_charge" },
  { "when": {"var":"bms_1.Status","op":"==","val":"放电"}, "icon":"bms_discharge" },
  { "when": {"var":"bms_1.Status","op":"==","val":"待机"}, "icon":"bms_standby" }
]
```

或用**数值字段**驱动（后台只推功率，充电为正、放电为负、约 0 为待机）：
```json
"iconRules": [
  { "when": {"var":"bms_1.P(kW)","op":">","val":1},  "icon":"bms_charge" },
  { "when": {"var":"bms_1.P(kW)","op":"<","val":-1}, "icon":"bms_discharge" },
  { "when": {"var":"bms_1.P(kW)","op":"between","val":"-1,1"}, "icon":"bms_standby" }
]
```
> 顺序匹配、首个命中生效；都不命中时用节点自身 `type` 的图标兜底。

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
      "visibleWhen": {...},                               // 可选：显示条件
      "iconRules": [ {"when":{...},"icon":"bms_charge"} ] // 可选：图标规则(icon=元素库type，顺序匹配首个命中，否则用自身type图标)
    }
  ],
  "edges": [
    { "from":"pv_1", "to":"pcs_1", "edgeType":"ac_power", "route":"smart", "dir":"forward",
      "showWhen": {...}, "dirRules": [...],               // 可选：显示/流向规则
      // 可选：连线标签(绑定后台字段则带 id 作信号键前缀)
      "id":"edge_1", "label":"充电功率", "labelEn":"Power",
      "labelBind":{"field":"RunLogs.ActivePower","deviceType":"PCS","deviceId":"..."},
      "labelShow":"value",                                // value(默认)/name/both；未绑定只显示文字
      "labelDict":"",                                     // 可选：''=强制不转义 / 'type'=强制某字典(缺省=自动匹配)
      "labelOffset":{"x":12,"y":-8}, "labelRot":0, "labelScale":1, "labelDir":"auto" }
  ],
  "signals": [ { "key":{"zh":"运行模式","en":"mode"}, "value":"island",
                 "bind":{"field":"loc.field","deviceType":"EMS","deviceId":"..."},
                 "dict":"ems_mode" } ],  // 与数据字段同构：key.en=信号键；value=默认值；bind/dict 可选
  "valueDicts": [ { "type":"bms_status", "name":"电池状态", "nameEn":"Battery Status",
                    "applyTo":[{"deviceType":"BCU","field":"loc.field"}],
                    "items":[{"code":"1","zh":"充电","en":"Charging"}] } ],  // 本图用到的值字典快照(自包含)
  "sampleSignals": { "bms_1.SOC(%)": 55 }                 // 导出时的样例值(可作默认)
}
```

> 节点数据字段 `data[]` 与全局信号 `signals[]` 均可带 `dict` 字段（`undefined`=自动匹配 / `''`=不转义 / `'type'`=强制某字典）；连线标签用 `labelDict` 表达同一语义。`dataBindings[]` 里连线标签的条目带 `edge` 字段、`node` 为 `null`（见 realtime-data-api.md §8）。
>
> 字段/全局信号的 `bind` 也可以是**计算绑定** `{"calc":{"operands":[{field,deviceType,deviceId}|{const:v},…],"operators":["+","*",…]}}`（链式左→右结合；比较结果 1/0）；此时 `dataBindings[]` 展开为每个字段操作数一条（`signal=主信号键@下标`、带 `calcOf`），主信号由前端 `TopoRules.calcValue` 算出，后端只推操作数原始值（见 realtime-data-api.md §8.6）。值字典 `items` 里除 `code` 等值项外还支持条件项 `{"when":{"op":">","val":"80"},…}`（见 realtime-data-api.md §9）。

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

---

## 9. 模板库与部署（运营端「保存/编辑/重命名/删除模板」）

运营端可把当前画布**保存为模板**，并对模板**编辑 / 重命名 / 删除**。每个模板是 `templates/` 下的**单独 JSON 文件**，由 `templates/index.json` 清单索引；打开模板库只拉清单，选中某个才按需加载它自己的 JSON（初始画布自动加载清单里的 `default`）。

- **读取**（列模板 / 加载模板）：纯静态 `fetch('templates/...')`，任何托管都可用。
- **写入**（保存 / 编辑 / 重命名 / 删除）：调用同源 `/api/templates` 接口，由服务器**自动落盘**到 `templates/` 并更新 `index.json`，**无需手动改文件**。

### 部署方式

| 场景 | 命令 | 模板写入 |
|---|---|---|
| 本地开发（热重载） | `npm run dev` | ✅ 写 `templates/` |
| **生产（可写）** | `npm run build` 后 `npm start`（`node scripts/server.js`） | ✅ 写 `templates/` |
| 纯静态托管（如 Nginx 直接挂 `dist/`） | 部署 `dist/` | ❌ 仅能读；保存会回退为「下载 JSON」 |

生产服务器 `scripts/server.js`：静态资源默认取 `dist/`（压缩、无热重载），模板的**读和写都指向项目根的 `templates/` 目录**（版本受控、持久，`build` 重建 `dist/` 不会清空已保存模板）；图标读取/写入可通过 `ICONS_DIR` 指向独立目录。可用环境变量覆盖：`PORT`（默认 3009）、`HOST`（默认 0.0.0.0）、`STATIC_ROOT`、`TEMPLATES_DIR`、`ICONS_DIR`（建议在容器部署时分别把 templates 和 icons 挂载为持久卷）。

> **对接父平台后端**：若模板由平台自有后端管理，可在加载 `topology-editor.js` 前设置 `window.TOPO_TPL_BASE`（读取列表/模板的基路径）与 `window.TOPO_TPL_API`（写接口，支持绝对 URL），前端即改走该后端；后端只需实现与 `/api/templates` 相同的 `GET/POST/PUT/DELETE` 契约。

> 📑 **接口契约详情**见 [`docs/template-api.md`](docs/template-api.md)：四个接口的请求/响应/状态码、数据模型、后端重新实现要点、边界与校验，供后端同学对接。

---

## 10. 值字典库与部署（运营端「code 码转义」）

值字典（§2.5）与模板库**完全同构**：每张字典是 `value-dicts/` 下的单独 `<type>.json`，清单由服务端**实时扫描目录**动态生成（手改文件后重扫即生效，无需重启）。读走静态 `fetch`，写走同源 `/api/value-dicts`（`GET/POST/PUT/DELETE`）自动落盘。

| 场景 | 命令 | 字典写入 |
|---|---|---|
| 本地开发（热重载） | `npm run dev` | ✅ 写 `value-dicts/`（该目录已排除热重载） |
| 生产（可写） | `npm run build` 后 `npm start` | ✅ 写 `value-dicts/`（持久） |
| 纯静态托管（挂 `dist/`） | 部署 `dist/`（`build.py` 已拷贝目录并生成清单） | ❌ 仅能读；增删改需手改文件或走后端 |

环境变量新增 `VALUE_DICTS_DIR`（默认项目根 `value-dicts/`，建议挂持久卷）。对接父平台后端：加载前设 `window.TOPO_DICT_BASE` / `window.TOPO_DICT_API` 即改走该后端；也可让前端渲染器的 `env.getValueDicts()` 直接吃平台自有字典，运行期覆盖。

> 📑 **接口契约详情**见 [`docs/dict-api.md`](docs/dict-api.md)：四个接口、数据模型、导入导出格式、后端重新实现要点、边界与校验。
