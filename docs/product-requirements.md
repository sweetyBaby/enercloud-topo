# 储能拓扑编辑器 PRD

版本：v1.2
日期：2026-07-06
适用项目：`topo` 储能拓扑编辑器与运行态渲染器
维护者：juan.zheng

> 本文是**详细需求文档**，目标是同时支撑三类工作：**功能迭代**（每个功能点有明确边界与数据结构）、**测试**（每个需求有可执行的验收标准，第 12 章为集中用例清单）、**维护**（第 6 章代码结构索引、第 13 章附录把需求映射到 `topology-editor.js` 的函数/行号）。
>
> 关联文档：`Readme.md`（运营端+前端接入总览、规则结构参考）、`docs/realtime-data-api.md`（实时数据契约 + 值字典消费）、`docs/template-api.md`（模板存储 API 契约）、`docs/dict-api.md`（值字典存储 API 契约）。本文尽量不重复上述文档的细节，而是给出汇总与交叉引用。

## 修订记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-07-01 | 首版，梳理编辑器与运行态整体能力 |
| v1.1 | 2026-07-01 | 依据源码逐项核对：补充快捷键/交互、导出校验（4 阻断+1 风险）、11 个运算符与取值语义、画布 JSON 完整字段、seed/canvas 两种表示、草稿自动保存、元素库包（`runtime.js`/`resolveDynamic`）、URL 参数（`mode=embed/view`、`fit`、`interactive`）、代码结构索引与测试用例章节 |
| v1.2 | 2026-07-06 | 新增：**值字典**（§7.18，code→中/英转义 + `applyTo` 自动匹配 + 字段/信号/标签三态 `dict` + `/api/value-dicts` 存储 + 导入导出/重扫）、**连线标签数据绑定**（§7.6 扩展，绑后台字段动态显示 + 值字典转义 + 展示模式/走向/旋转缩放/拖拽 + 连线 id 作信号键）；同步 §8.3 edges、§8.4 signals、§8.5 dataBindings、新增 §8.8 valueDicts、§9.4 值字典文件规范；属性面板分组化（节点/连线均按 基本/外观/数据驱动/绑定 分组） |

---

## 1. 产品概述

### 1.1 背景

储能、光伏、负载、PCS、BMS、EMS 等设备在运营平台中需要以拓扑图方式展示设备关系、能量流向、实时状态和关键指标。传统静态图无法满足运行状态动态变化、设备字段绑定、前端大屏复用和模板复用的需求。

本项目提供一套储能拓扑编辑与运行展示能力：运营端通过可视化编辑器配置拓扑、数据字段、后台绑定、动态规则和模板；前端运行态复用同一份渲染器，根据拓扑 JSON 和实时信号渲染只读运行画面。

### 1.2 产品定位

面向储能/能源管理系统的可视化拓扑配置工具，核心定位为：

- 运营端低代码配置拓扑图。
- 前端运行态像素级复用编辑器渲染能力（同一个 `topo.html`，加 `?mode=runtime` 即只读运行）。
- 后端只需按约定提供扁平实时信号。
- 模板、图标、字段字典、数据绑定可持续沉淀（均为文件化管理，增删改文件即生效）。

### 1.3 一句话目标

让运营人员无需写代码即可搭建储能系统拓扑图，并让前端通过同一份拓扑 JSON 和实时数据自动展示设备显隐、图标变化、字段值和流向动画。

### 1.4 技术形态与关键事实

| 项 | 事实 |
|---|---|
| 交付形态 | 单页应用：`topo.html` + `topo-editor/topology-editor.js`（约 5920 行，编辑与运行态同源）+ `topology-editor.css` + `topology-editor-icons.js`（空桩）|
| 运行环境 | 纯前端 Canvas 渲染，无框架依赖；Node 原生服务仅用于模板读写与静态托管 |
| 画布 JSON 版本 | `schemaVersion: "2.0"` |
| 模板文件版本 | 单模板 `"tpl-1"`；清单 `"tpl-index-1"` |
| 图标清单版本 | `icons/index.json` 的 `schemaVersion: "1.0"` |
| 规则引擎 | 纯声明式 JSON，内置解释器（`evalCond`），**不使用 `eval`** |
| 无后端依赖 | 图标、字典、设备档案、模板均为文件；读取走静态 `fetch`，仅模板「写」需要 Node 服务 |

---

## 2. 用户与场景

### 2.1 用户角色

| 角色 | 主要诉求 |
|---|---|
| 运营配置人员 | 拖拽搭建拓扑、配置设备字段、设置动态规则、保存模板 |
| 前端开发人员 | 复用编辑器运行态，快速接入拓扑 JSON 与实时数据 |
| 后端开发人员 | 根据画布导出的字段绑定清单提供实时数据接口 |
| 项目实施人员 | 针对不同站点快速复用模板并调整设备关系 |
| 运维/大屏用户 | 查看实时拓扑、设备状态、能量流向和关键指标 |

### 2.2 核心使用场景

1. 运营人员创建园区储能拓扑，包含电网、光伏、PCS、电池、负载、EMS 等元素。
2. 为每个元素配置名称、图标、数据字段、后台设备实例和字段来源。
3. 配置规则：SOC 低于阈值隐藏连线、PCS 功率正负决定流向、BMS 状态决定图标切换等。
4. 用「注入信号」在编辑器中验证规则效果（勾选「预览效果」看真实运行态）。
5. 导出画布 JSON 或保存为模板。
6. 前端以 runtime/embed 模式加载同一页面，通过 URL 轮询、postMessage 或 JS API 下发实时数据。
7. 运行态根据实时信号自动更新字段值、显隐、图标和流向。

---

## 3. 产品目标

### 3.1 业务目标

- 降低储能拓扑图配置成本，减少前端重复开发。
- 提升不同项目拓扑复用能力，支持模板沉淀。
- 统一运营端编辑效果与前端运行展示效果。
- 让后端实时数据接口保持简单、可枚举、可联调。

### 3.2 用户目标

- 配置人员可通过拖拽完成拓扑搭建、直观看到规则是否生效。
- 前端可最小成本嵌入拓扑运行态。
- 后端可从导出的 `dataBindings` 和 `nodes[].data[]` 明确知道要推哪些信号。

### 3.3 成功指标

| 指标 | 目标 |
|---|---|
| 新建常规储能拓扑耗时 | 小于 30 分钟 |
| 前端接入运行态耗时 | 小于 1 天 |
| 规则配置后本地验证闭环 | 支持编辑器内即时预览 |
| 模板复用 | 支持保存、编辑、重命名、删除、按需加载 |
| 数据接口复杂度 | 实时数据为单层扁平 JSON |

---

## 4. 范围说明

### 4.1 本期范围

- 拓扑画布编辑（拖拽、平移缩放、多选、撤销重做、草稿自动保存）。
- 元素库与图标库（文件化清单、搜索、上传、重新扫描、ZIP 导出）。
- 节点、连线、字段、样式配置。
- 自动布局、智能走线、母线汇流。
- 数据字段与后台设备字段绑定。
- 全局信号配置。
- 数据驱动规则：节点显隐、节点图标、连线显隐、连线流向。
- 信号注入测试与运行视图预览。
- 画布 JSON 导入导出与导出校验。
- 元素库包（含 `runtime.js`）导出。
- 模板库读写（文件化 + Node 写接口）。
- 只读运行态渲染（runtime / view / embed）。
- 实时数据接入契约（URL 轮询 / postMessage / JS API）。
- 中英文界面与中英文字段名。

### 4.2 非本期范围

- 用户登录、权限、审计。
- 多人协同编辑。
- 数据库模板管理后台。
- WebSocket 服务端实现（前端只约定 postMessage/merge 入口）。
- 告警中心、工单、报表等业务闭环。
- 大规模图性能专项优化。
- 复杂版本管理与模板审批流。

---

## 5. 术语与概念模型

### 5.1 术语表

| 术语 | 含义 |
|---|---|
| 节点 / Node / 元素 | 画布上的一个设备、文本框、变量、占位点 |
| 连线 / Edge | 两个节点之间的连接线 |
| 数据字段 / Data Field | 节点上的一个实时数据项（有中/英文名、默认值、可绑定后台字段）|
| 全局信号 / Global Signal | 不属于某个节点的运行量（如 `mode`），任意规则可引用 |
| 信号 / Signal | 实时数据的一个键值；键 = `节点id.字段英文名` 或 `全局信号英文名` |
| 规则 / Rule | 声明式条件，驱动显隐/图标/流向 |
| 条件树 / Condition | 规则的判断表达式（`all`/`any`/`not` + 叶子 `{var,op,val|ref}`）|
| 模板 / Template | 可复用的整张画布（`seed` 或 `canvas` 两种形态）|
| 数据绑定 / DataBinding | 信号 → 后台设备字段的映射，导出到 `dataBindings[]` 供后端枚举 |
| 元素库 / Element Library | 元素类型 + 图标文件 + 默认字段 + 连线样式的集合，可导出 ZIP |
| 注入 / Injection | 编辑器内临时给信号赋值的测试数据（不进入正式接口）|
| 预览效果 / Run View | 编辑器内切到只读渲染，被规则隐藏的元素彻底消失 |
| 母线 / 主干线 / Busbar / Trunk | 多条同侧连线汇聚到共享干线的视觉效果 |

### 5.2 核心实体关系

```
Template ──1:1── Canvas(画布 JSON)
Canvas ──1:N── Node ──1:N── DataField ──0:1── DataBinding.source(后台字段)
Canvas ──1:N── Edge (from/to 指向 Node.id)
Canvas ──0:N── GlobalSignal ──0:1── DataBinding.source
Node.visibleWhen / Edge.showWhen / iconRules.when / dirRules.when ──引用── Signal(节点字段或全局信号)
ElementLibrary ──定义── Node.type 的默认图标/字段/尺寸、Edge 的样式
```

### 5.3 两种数据表示（维护重点）

> 编辑器内部有两套形态，导入时会互相兼容。混淆这两者是历史 bug 的常见来源。

| 表示 | 出现位置 | 节点键 | 字段键 | 说明 |
|---|---|---|---|---|
| **seed（种子/精简）** | 内置模板 `templates/*.json` 的 `seed`；旧版导出 | `labelZh` `labelEn` `x` `y` `status` `data[].key` `data[].keyEn` `data[].dv` | 扁平 | 加载时自动布局；`importCanvasJSON`/`parseImportedNode` 可读 |
| **canvas（完整导出）** | `buildJSON()` 输出、用户保存模板的 `canvas` | `label:{zh,en}` `position:{x,y}` `data[].key:{zh,en}` `data[].value` | 结构化 | 保留精确布局与规则；运行态直接消费 |

导入兼容点（`importCanvasJSON` / `normalizeSignal` / `migrateSignalKeys`）：
- `key` 允许字符串（旧）或 `{zh,en}`（新）。
- `value` 缺失回退 `dv`；`offset` 缺失回退 `ox/oy`；`edgeType` 回退 `et`；`width` 回退 `w`；`label` 回退 `lbl`。
- 旧规则里用中文字段名作信号键的，`migrateSignalKeys()` 会把 `id.中文` 统一迁移为 `id.英文`。
- 全局信号支持三种旧格式（`{name,label,sample}`、`{key:string,keyEn,dv}`、`{key:{zh,en},value}`）。

---

## 6. 系统架构与代码结构（维护）

### 6.1 架构总览

```
┌─────────────┐   画布 JSON(拓扑+规则)    ┌──────────────┐
│  运营端       │ ────────────────────────▶ │   前端         │
│ 编辑器(配置)  │   元素库包(图标+runtime.js) │ 运行渲染(只读)  │
└─────────────┘                            └──────┬───────┘
        同一个 topo.html + topology-editor.js        │ 实时数据(信号)
                                            ┌────────▼────────┐
                                            │  后端 / 数据网关   │
                                            └─────────────────┘
```

### 6.2 目录结构

| 路径 | 作用 |
|---|---|
| `topo.html` | 页面骨架 + 全部工具栏/面板/弹框 DOM（约 486 行）|
| `topo-editor/topology-editor-01..12-*.js` | 全部逻辑，按职责拆为 12 个有序片段（详见下表）。均为普通 `<script>`，共享同一全局作用域，`topo.html` 按 01→12 顺序引入——顺序即执行顺序，等价于原单文件，**不可乱序**。|
| `topo-editor/topology-editor.css` | 样式 |
| `topo-editor/topology-editor-icons.js` | 历史遗留空桩 `IMG_DATA={};IMGS={}`（图标已文件化，见 §9）|
| `icons/` + `icons/index.json` | 图标文件 + 清单（面板单一事实来源）|
| `device/device-type.json` `device/device-info.json` | 后台设备类型 / 设备实例档案 |
| `dic/*.json` + `dic/index.json`（构建生成）| 设备字段字典（`deviceType→location→fields`）|
| `templates/*.json` | 单模板文件；清单由扫描生成（无存储的 index.json）|
| `scripts/dev-server.js` | 开发服务器（热重载 + 模板写 + 图标/字典/模板动态扫描路由）|
| `scripts/server.js` | 生产服务器（托管 `dist/`，读写项目根 `templates/`）|
| `scripts/template-store.js` | 模板 API 共享逻辑（dev 与生产共用）|
| `scripts/icon-store.js` | 图标库 API 共享逻辑（dev 与生产共用）|
| `scripts/dict-store.js` | 值字典 API 共享逻辑（`/api/value-dicts`，dev 与生产共用）|
| `scripts/build.py` | 构建：压缩资源到 `dist/`，扫描生成 `icons/`、`templates/`、`dic/`、`value-dicts/` 的 index.json |

#### 6.2.1 编辑器 JS 分片（原 `topology-editor.js` 约 5920 行拆分而来）

> 原单文件里所有函数声明在任何代码运行前就已解析；拆成多个 `<script>` 后，函数声明**不跨 `<script>` 提升**，每个标签「先执行、再加载下一个」。因此把「初始主题 + 应用启动」统一放到最后加载的 `12-bootstrap.js`——`init()` 体内会调用分布在 02/03/06/11 等后续文件的函数，若启动代码留在 01 且 `Promise.all` 提前 resolve，`init()` 会抛 `ReferenceError`。**新增分片必须同步维护 `topo.html` 的 `<script>` 顺序与 `scripts/build.py` 的 `EDITOR_JS_PARTS`，且 12-bootstrap 恒为最后。**

| # | 文件 | 职责 |
|---|---|---|
| 01 | `topology-editor-01-core.js` | 主题/ET 常量、图标/后台加载、核心状态、undo/redo、草稿、`init` |
| 02 | `topology-editor-02-toolbar.js` | 侧栏、连线栏、下拉、背景、主题切换 |
| 03 | `topology-editor-03-input.js` | `canvas` 常量、i18n、全部鼠标/键盘/右键事件 |
| 04 | `topology-editor-04-geometry.js` | 节点/连线几何、端口、吸附、裁剪 |
| 05 | `topology-editor-05-routing.js` | A\* 正交走线、母线汇流、`edgePath` |
| 06 | `topology-editor-06-render.js` | `drawAll`/`drawNode`/`drawEdge`、字段 chip 绘制 |
| 07 | `topology-editor-07-editing.js` | chip 交互、绑定 UI、对齐、复制粘贴、上传 |
| 08 | `topology-editor-08-serialize.js` | JSON 生成/导入/迁移、校验报告、导出 |
| 09 | `topology-editor-09-rules.js` | 数据驱动引擎、规则编辑器、信号面板 |
| 10 | `topology-editor-10-library-export.js` | `RUNTIME_JS` 模板、元素库 ZIP 导出 |
| 11 | `topology-editor-11-templates-runtime.js` | 模板系统、走线样式、只读运行态 |
| **12** | **`topology-editor-12-bootstrap.js`** | **入口：`setTheme('blue_screen')` + `Promise.all(...).then(init)`（必须最后加载）** |
| `demo.html` | iframe + postMessage 接入示例（可运行）|

### 6.3 关键函数索引

> 完整清单见第 13 章附录。此处列高频维护入口。

| 领域 | 关键函数 |
|---|---|
| 图标库加载 | `loadIconLibrary()`、`reloadIconLibrary()` |
| 渲染循环 | `drawNode()`、`drawEdge()`、`edgePathRaw()`、`orthogonalize()`、`alignJunctions()` |
| 交互 | `keydown` 监听、`selectNode()`、`copySelection()`/`pasteClipboard()`、`snapshot()`/`undo()`/`redo()` |
| 布局对齐 | `autoLayout()`、`alignSel()`、`alignChips()` |
| 规则引擎 | `evalCond()`、`cmpOp()`、`buildCtx()`、`computeDynamic()`、`parseSignal()` |
| 导出/导入 | `buildJSON()`、`serNode()`、`importCanvasJSON()`、`parseImportedNode()`/`parseImportedEdge()` |
| 校验 | `duplicateIdReport()`、`missingFieldNameReport()`、`duplicateFieldNameReport()`、`globalSignalNameReport()`、`unboundBindingReport()`、`blockExportForIds()` |
| 运行态 | `topoRuntimeConfig()`、`enterRuntimeMode()`、`rtLoadTopology()`、`applyLiveSignals()`、`window.TopoRuntime` |

---

## 7. 功能需求

> 每个需求含：需求描述 / 功能点 / 规则与限制 / 验收标准。集中测试用例见第 12 章。

### 7.1 拓扑编辑画布

#### 需求描述
提供可视化画布，支持从左侧元素库拖拽设备到画布，编辑节点、连线、字段和布局。

#### 功能点
- 节点拖拽创建（从侧栏拖到画布，落点为世界坐标）。
- 画布平移（空白处左键拖拽 / 中键拖拽 / 按住空格拖拽）、缩放（滚轮，缩放因子 ×1.12，范围 10%–500%）、缩放复位 100%。
- 节点拖动、框选（Shift+空白拖拽，或「选择模式」下直接拖拽）、多选、成组拖动、复制、删除。
- 撤销、重做（历史栈最多 21 帧，见规则）。
- 复制 / 粘贴 / 直接复制（粘贴偏移 +40px）。
- 清空画布（需确认）。
- 左侧元素面板与右侧属性面板可折叠。
- 画布背景色、主题、全局字体样式配置。
- 显示开关：网格（步长 40px）、数据字段卡片、连线标签、占位点标记。
- 草稿自动保存到 localStorage（防误关，见 §7.16）。

#### 规则与限制
- 键盘快捷键仅在焦点不在 `input`/`select`/`textarea` 时生效。
- 撤销/重做历史栈上限 **21 帧**，快照内容含 `nodes`、`edges`、`bgColor`、`routeStyle`；执行新操作会裁掉当前指针之后的重做分支。
- 撤销/重做后清空当前选择（`selNode`/`selEdge`）。

#### 快捷键与鼠标操作（完整清单）

| 操作 | 触发 | 说明 |
|---|---|---|
| 撤销 | `Ctrl+Z` | |
| 重做 | `Ctrl+Y` | |
| 复制 | `Ctrl/Cmd+C` | 复制选中节点及两端都在选区内的连线 |
| 粘贴 | `Ctrl/Cmd+V` | 新 ID，偏移 +40px，自动选中新元素 |
| 直接复制 | `Ctrl/Cmd+D` | = 复制+粘贴 |
| 删除 | `Delete` / `Backspace` | 删除选中节点（连带其连线）或连线 |
| 取消连线 | `Esc` | 退出连线创建，清 `edgeFrom` |
| 平移 | 空白左键拖 / 中键拖 / 空格+拖 | 光标变 grab |
| 缩放 | 滚轮 | 以指针为中心，×1.12 / 步 |
| 框选 | Shift+空白拖 或 选择模式下拖 | 中心落在框内的节点入选 |
| 旋转吸附 | 旋转时按 Shift | 15° 步进 |
| 端口吸附 | 连线端点靠近节点端口 | `≤18/zoom` 锁定端口，记录 `fromPort/toPort` |
| 拐点/网格吸附 | 加拐点 | 节点 H/V 线或 25px 网格，`10/zoom` 容差，L 形约束 |
| 右键菜单 | 节点/连线上右键 | 见下 |

右键菜单：节点 →「从此连线 / 复制 / 删除」；连线 →「从此处引出连线 / 智能走线 / 直线走线 / 删除连线」。

标注元素与连线的关系：
- 文本框/变量/占位点**不参与连线避障**——可紧贴连线、设备任意摆放，直线不会因此变折线；挪动游离标注元素也不触发全局重路由。
- 占位点拖到连线上（`12/zoom` 容差）会吸附到线上最近点并高亮，松手即**分接为汇合点**：原边 A→B 分裂为 A→占位点、占位点→B 两段（原边的 id/标签/数据绑定留在前半段，后半段继承线型/流向/走线样式）；从元素库新拖入占位点落在线上同理。之后从该占位点可引出新连线，形成 T 型汇合。
- 连线右键「从此处引出连线」= 在点击处自动插入占位点分接 + 立即进入连线模式从该点起线。

#### 验收标准
- 可从元素库拖入节点并在画布中移动。
- 滚轮可缩放画布，缩放百分比实时显示。
- 可撤销和重做主要编辑操作，连续 22 次编辑后最早一帧不可再撤销。
- 选中节点或连线后右侧属性面板展示对应属性。
- 关闭页面再打开可恢复草稿（若未清除）。

### 7.2 元素库与图标库

#### 需求描述
内置储能拓扑常用元素，支持图标库扫描和自定义图标上传；图标为文件化管理，增删改图片即生效，无需改代码。

#### 元素分类（见 `icons/index.json` 的 groups）
- 电源侧：主电网、光伏板、发电机。
- 储能设备：PCS、电池 BMS（含充/放/待机图标）、电池柜、氢储能。
- 母线/主干线：母线、交流主干线、直流主干线、联络线。
- 电气设备：变压器、断路器、高压箱。
- 计量与负载：计量表、关口表、用电负载、充电桩。
- 开关元件：断路器、隔离开关、刀闸、接触器、熔断器等。
- 辅助系统：EMS、空调、消防、传感器。
- 无源元件：电阻、电感、电容、CT、PT、SPD、接地。
- 辅助元素：占位点（anchor）、文本框（text）、变量（variable）。

#### 功能点
- 左侧元素库按分组展示，支持搜索、分组展开/折叠。
- 「重新扫描图标库」`reloadIconLibrary()`：cache-bust 重拉清单与图片，保留当前选择。
- 上传自定义图标（PNG/SVG/JPEG），需填中/英文名。
- 导出完整元素库包 ZIP（见 §7.17）。

#### 规则与限制
- `icons/index.json` 的 `devices[]` 是面板单一事实来源；`file` 字段指向图片。
- 文本框/变量节点在清单中**无 `file`**（纯 Canvas 绘制），合并时保留。
- 构建/开发服务器会扫描 `icons/` 与清单合并：替换同名图片=换样式；删图片=元素移除；新增未登记图片=按文件名前缀归入对应类型分组，否则进「自定义图标」分组。

#### 验收标准
- 清单登记的元素出现在左侧元素库。
- 未登记但存在于 `icons/` 的图标归入自定义图标分组。
- 自定义图标添加后可拖入画布并参与导出。
- 删除某图片并重扫/重构建后，对应元素从面板消失。

### 7.3 节点属性配置

#### 需求描述
用户可配置节点的身份、展示、样式、数据字段、后台绑定和运行态交互。

#### 功能点（对应导出字段见 §8.2）
- 节点 `id`。
- 中文标签 `label.zh` / 英文标签 `label.en`。
- 节点 `type`（元素类型）。
- 图标缩放 `scale`、旋转 `rotation`、字号 `fontSize`、标签颜色 `fontColor`。
- 是否显示名称 `display.showLabel`、是否显示数据字段 `display.showFields`。
- 文本框样式 `textStyle`（背景/边框/边框色/边框宽/圆角/内边距）。
- 变量样式 `variableStyle`（横/竖布局、标签与值各自字号/颜色/加粗）。
- 占位点样式 `anchorStyle`（填充色 `fill`、透明度 `opacity`）。
- 运行态事件绑定 `action`：`trigger`（click/右键/双击）+ `url` + `target`（same/blank）。
- 节点坐标 `position`（展示）。
- 节点级后台设备绑定 `deviceType`/`deviceId`（作为字段绑定的默认来源）。

#### 规则与限制
- 节点 `id` 是实时信号键和 `dataBindings` 的主键来源，必须**唯一且非空**。
- 节点 `id` 为空或重复会**阻断导出**（`duplicateIdReport`）。
- 中文标签用于中文界面，英文标签用于英文界面。

#### 验收标准
- 修改节点属性后画布即时更新。
- 节点 `id` 重复或为空时，导出被阻断并提示「Export blocked: duplicate/empty node IDs」。
- 运行态点击事件只在预览/运行态触发，不在编辑态触发。

### 7.4 数据字段配置

#### 需求描述
为节点添加数据字段，配置中英文名、默认值、显示位置和后台字段绑定。

#### 功能点
- 添加、删除数据字段。
- 字段中文名 `key.zh` 与英文名 `key.en`。
- 字段默认值 `value`（导出前内部为 `dv`；字符串会按 `true/false/数字` 自动推断类型）。
- 拖动字段卡片位置（`offset.x/y`），支持多选卡片对齐（`alignChips`）。
- 批量显示/隐藏所选元素字段（`batchVis('fields',...)`）与名称（`batchVis('label',...)`）。
- 字段可绑定后台设备字段 `bind`：`followNode=true` 跟随节点设备；`false` 指定跨设备来源（`deviceType`/`deviceId`/`field`）。

#### 规则与限制
- 字段中文名、英文名**均必填**（缺任一阻断导出，`missingFieldNameReport`）。
- 同一节点内字段中文名不能重复、英文名不能重复（阻断导出，`duplicateFieldNameReport`）。
- 字段英文名是实时数据键的字段段，如 `pcs_1.P(kW)` 的 `P(kW)`。
- 未绑定后台字段允许导出，但列入风险提示（`unboundBindingReport`，非阻断）。

#### 验收标准
- 字段名缺失或重复时界面高亮并阻断导出。
- 已绑定字段在导出 JSON 的 `dataBindings` 中生成对应记录。
- 实时数据命中字段键（`节点id.英文名`）时，字段卡片显示值更新。
- 值为 `0` 显示 `0`；值为 `null`/`""`/未传显示为空。

### 7.5 后台设备绑定

#### 需求描述
支持从后台设备类型、设备实例、字段字典中选择字段来源，形成可供后端对接的数据绑定清单。

#### 数据来源
运行时由 `loadBackendBindingData()` 以 `no-store` 拉取以下三份（`dic` 用**合并后的 index.json**，非逐个 `dic/*.json`）：
- `device/device-type.json`：设备类型（字典项，`dictLabel`/`dictValue`，如 BCU/EMS/PCS；仅取 `status==="0"` 项）。
- `device/device-info.json`：设备实例（`deviceId`/`deviceName`/`archiveDeviceType`/`projectName` 等）。
- `dic/index.json`：字段字典（构建/开发服务器把 `dic/*.json` 按 `deviceType` 归并；结构 `deviceType → [{location, fields[]}]`）。

> `dic/*.json` 是源文件（`deviceType`/`location`/`fields[]`），运行时消费的是合并产物 `dic/index.json`。见 §9.2。

#### 功能点
- 节点选择默认后台设备类型和设备实例。
- 字段绑定选择设备实例、字段分类 `location` 和字段 `field`。
- 全局信号绑定必须选择具体设备实例和字段。
- 刷新后台设备/字典数据（`no-store` 重拉）。
- 导出时生成 `dataBindings`。

#### 交给后台的绑定字段（核心，导出即契约）

> 后端拿到画布 JSON 后，**只看 `dataBindings[]`** 即可知道：每个实时信号键要从哪台设备的哪个后台字段取值。每条记录如下（源码 `buildJSON()`）：

| 字段 | 含义 | 取值来源 |
|---|---|---|
| `signal` | **后端要输出的实时数据键**（前端 `applyLiveSignals` 直接消费）| 节点字段：`节点id + "." + 字段英文名(keyEn)`；全局信号：`信号英文名(keyEn)` |
| `node` | 所属节点 id | 节点字段=节点 id；**全局信号=`null`** |
| `label` | 人读名（排错用，非键）| 中文名（字段 `key.zh` / 信号 `key.zh`）|
| `source.deviceType` | 后台设备类型 | `field.bind.deviceType` → 节点 `deviceType` → 由元素类型推断（`CANVAS_TYPE_TO_DEVICE`：`bms`/`cabinet`→`BCU`、`pcs`→`PCS`、`ems`→`EMS`）→ `""` |
| `source.deviceId` | 后台设备实例 id | `field.bind.deviceId` → 节点 `deviceId` → `""` |
| `source.field` | **后台字段路径** = `location + "." + field` | 来自字典，如 `AuxDataLogs.SystemSOC`、`CellStatisticsLogs.MaxCellVolt` |
| `source.deviceName` | 设备名（可选，排错用）| 由 `deviceId` 在 `device-info.json` 反查得到 |

绑定与信号键的对应关系（务必对齐）：

```
后台读取：  source.deviceType + source.deviceId 定位设备实例
            → 读该实例的 source.field（location.field）字段值
前端消费：  把该值以 signal 为键放进实时数据 JSON
            → 例如  { "bms_1.SOC(%)": 55 }
```

- 只有 `field.bind.field` 存在的字段/信号才进入 `dataBindings`（未绑定字段不生成记录，改由风险区提示）。
- 导出时来源被「显式化」：即便字段跟随节点设备（`followNode=true`），`source.deviceType/deviceId` 也会写全，后端无需再推断。
- `source.field` 的点号分隔：**最后一个点之前是 `location`，之后是 `field`**（`AuxDataLogs.SystemSOC` → location=`AuxDataLogs`、field=`SystemSOC`）。

#### 规则与限制
- 全局信号绑定必须显式选设备实例 + 字段（无节点可继承）。
- 绑定不影响导出阻断，仅在风险区提示：`未绑定字段` / `缺设备实例` / `设备实例不存在`（已加载设备档案时）/ `字段不在字典`（已加载该类型字典时）。

#### 验收标准
- 可为节点选择设备实例、为字段选择后台字段。
- 导出 JSON 的 `dataBindings` 单条含：`signal`、`node`、`label`、`source.deviceType`、`source.deviceId`、`source.field`（可含 `source.deviceName`）。全局信号 `node` 为 `null`。
- `signal` 与画布中的 `节点id` + 字段英文名逐字一致（含大小写、括号）。
- `source.field` 与字典中的 `location.field` 一致。
- 设备实例或字典字段失效时，导出风险区提示（缺设备实例/设备实例不存在/字段不在字典）。

### 7.6 连线配置

#### 需求描述
支持节点间连线，配置类型、颜色、样式、走线方式、流向、标签和动态规则。

#### 功能点（对应导出字段见 §8.3）
- 连线模式（`toggleEdgeMode`）与「连续连线」。
- 连线类型 `edgeType`（如 `ac_power`/`dc_power`/`charge`/`discharge`/`comm`/`busbar` 等，样式定义见 `edgeStyles`）。
- 全局线宽（`meta.view.globalWidth`）与单条线宽 `width`（0.5×–3×）。
- 连线颜色跟随类型或自定义（`style.color`）。
- 线条样式 `style.lineStyle`：solid/dashed；`dash` 数组控制虚线节奏。
- 走线方式 `route`：`smart`（智能避障）/`line`（直线）/`arc`（弧线）/`manual`（手动拐点 `waypoints`）。
- 拖动拐点并吸附对齐（节点线/网格）。
- 固定流向 `dir`：`forward`/`reverse`/`both`/`none`。
- 单独显示连线标签 `showLabel` + 标签配置（见「连线标签」子节）。
- 端口锁定 `fromPort`/`toPort`。
- 右键重置为智能走线或直线走线。
- 属性面板分组：**外观 / 走线 / 数据驱动 / 标签**（`.psec` 分组标题）。

#### 连线标签（数据绑定 · 值字典转义 · 可拖拽旋转）
标签用于在连线上展示辅助信息，能像数据字段一样绑定后台字段动态显示。对应导出字段见 §8.3，值字典机制见 §7.18。

- **文字**：中文 `label` + 英文 `labelEn`（随语言切换）；`labelEn` 兼作信号键段，绑定时必填。
- **后台绑定** `labelBind`：设备类型（必选，驱动分类/字段级联）→ 设备实例（**可不指定**，未指定时导出为黄色风险提示、由后台按类型对应）→ `location.field`。绑定成立自动生成连线 `id`（`genId('edge')`），信号键 = `连线id.标签英文名`（如 `edge_1.Power`），进 `dataBindings`（条目带 `edge`、`node=null`）。
- **展示内容** `labelShow`：`value`（默认，只显示值）/ `name`（只显示标签名）/ `both`（`标签名: 值`）；未绑定后台字段时一律只显示文字。
- **值字典** `labelDict`：与字段同一三态语义（缺省=自动匹配 `applyTo` / `''`=强制不转义 / `'type'`=强制某字典）。
- **样式**：文字走向 `labelDir`（`auto` 随线段方向 / `h` 横排 / `v` 竖排=基准旋转 90°）；`labelRot` 旋转、`labelScale` 缩放；`labelOffset{x,y}` 拖拽偏移（屏幕像素）。
- **交互**：画布上直接拖动标签（拖离 >40px 显示回连锚点的引导虚线）；选中连线后标签带旋转手柄（Shift 吸附 15°）与缩放手柄，与面板滑杆联动。
- **静态默认值 + 当前值溯源**：`labelValue` 为无实时数据时的显示值（也用于模拟后台值）；面板底部实时显示「原始值 → 转义结果 · 来源 · 命中字典」。
- **渲染实现**：`edgeLabelText`（取值+转义+展示模式）、`edgeLabelAt`（含旋转逆变换的命中盒）、`segAngleAt`（auto 走向判横竖）；实时值经 `applyLiveSignals` 回写 `lblVal`。

#### 规则与限制
- `route:"smart"` 的实际避障路径**不写入 JSON**；自研渲染（方案 B）需自行实现走线，或改用方案 A 同源渲染。
- 连线 `id` 与节点 `id` 同一命名空间（都是信号键前缀），不可重复：导出查重把连线一并纳入，导入自动去重。
- 「选中连线显示线型名」的旧提示仅对**完全未配置标签**的连线生效，避免线型名冒充标签值。

#### 验收标准
- 可连接两个节点形成可见连线。
- 选中连线后可改类型和流向。
- 智能走线尽量避开节点并减少交叉。
- 手动拐点可被拖动调整并吸附。
- 标签绑定后台字段后随实时数据/注入值更新；命中值字典时显示转义文案，切语言切中/英。
- 标签可拖动、旋转、缩放；`labelShow` 三种模式与预期一致；未绑定时只显示文字。
- 导出/导入往返保留全部标签字段；连线 id 不与节点 id 冲突。

### 7.7 自动布局与对齐

#### 需求描述
提供自动布局和多选对齐能力。

#### 功能点
- 一键自动布局 `autoLayout()`：自适应间距 → 连通分量分解（并查集）→ 分层布局 → 空白压缩 → 逐行装箱 → 整理走线（母线合并 + 智能寻路）。
- 智能整理走线。
- 多选对齐/分布（`alignSel(mode)`，模式如下）：
  - 对齐：`left`/`hcenter`/`right`/`top`/`vcenter`/`bottom`。
  - 分布：`hdist`/`vdist`（中心等距）、`hdistedge`/`vdistedge`（边缘等距）。
  - 固定间距：`hgap`/`vgap`（间距取 `align-gap` 输入值）。
  - 排列：`row`/`col`/`matrix`。
  - 画布居中：`canvasH`/`canvasV`。
- 字段卡片多选对齐（`alignChips`）。

#### 验收标准
- 多选两个及以上节点时显示对齐工具栏。
- 点击对齐按钮后所选节点坐标按预期变化。
- 自动布局后节点和连线保持可读。

### 7.8 母线与主干线展示

#### 需求描述
支持储能拓扑常见的母线汇流视觉，使多条连线汇聚为主干线。

#### 功能点（对应 `meta.view` 字段）
- 样式 `busStyle`：母线汇流排（busbar）、加粗实线、双线母线、发光母线等。
- 主干加粗 `busTrunkBold`。
- 跨设备共享主干 `busShareTrunk`。
- 主干通道间距 `busMergeGap`。
- 合并开关 `busMerge`、聚合开关 `busAggregation`。
- 拖动主干线中点手柄微调（`busOffsets`），重置所有主干位置。

#### 实现要点（维护）
- 每个节点每侧（L/R/T/B）有一条主干通道 `trunkInfo[nodeId|side]`；同侧连线汇到共享通道后再分叉；命中节点时回退 `routeOrtho()`/`detourRoute()`。近平行拐点由 `alignJunctions()` 吸附（阈值 40 世界单位）。

#### 验收标准
- 多条相近连线可合并显示为主干线。
- 可调整主干线样式和间距。
- 主干线位置重置后恢复自动计算效果。

### 7.9 数据驱动规则

#### 需求描述
支持声明式规则，根据实时信号动态控制节点显隐、节点图标、连线显隐、连线流向。

#### 规则类型

| 规则 | 作用对象 | 字段 | 结构 |
|---|---|---|---|
| 节点显示条件 | 节点 | `visibleWhen` | 条件树 |
| 节点图标规则 | 节点 | `iconRules` | `[{when:条件, icon:类型}]` 顺序匹配 |
| 连线显示条件 | 连线 | `showWhen` | 条件树 |
| 连线流向规则 | 连线 | `dirRules` | `[{when:条件, dir:方向}]` 顺序匹配 |

#### 条件树结构
```jsonc
// 叶子
{ "var": "信号名", "op": "运算符", "val": 比较常量 }
{ "var": "信号名", "op": "运算符", "ref": "另一信号名" }  // 与另一信号比
// 组合
{ "all": [条件, ...] }   // 且
{ "any": [条件, ...] }   // 或
{ "not": 条件 }          // 非
// null / 不写 = 恒为真；op 缺省为 truthy
```

#### 运算符（共 11 个，源码 `RULE_OPS`）

| op | 含义 | 语义 |
|---|---|---|
| `==` `!=` | 等/不等 | 双方可数值化则按数值比，否则按字符串比（`0=="0"`、`true=="true"` 成立）|
| `>` `>=` `<` `<=` | 数值比较 | 非数字/无值 → NaN → 不命中 |
| `in` | 属于列表 | `val` 逗号分隔，如 `"运行,充电"`；成员按 `==` 语义 |
| `between` | 闭区间 | `val` 形如 `"20,80"`，含端点，内部取 min/max |
| `truthy` | 为真 | `!!lv && lv!=='false' && lv!=='0'` |
| `falsy` | 为假 | `!lv || lv==='false' || lv==='0'` |
| `exists` | 存在 | `lv!==undefined && lv!==null && lv!==''`（`0`/`false` 算存在）|

#### 取值语义（无值处理）
- `null` / `""` / 未传该键 = 无值：数值比较一律不命中，`exists` 为假，`truthy` 为假，`falsy` 为真。
- `0` 是真实值：参与数值比较；`truthy` 为假、`falsy` 为真、`exists` 为真。
- 布尔 `true/false` 参与 `truthy/falsy/==`，数值化为 1/0。
- 信号键解析 `parseSignal`：取最后一个 `.`，左侧若匹配现有节点 id 则为节点信号，否则整串为全局信号；对不上的键静默失效（不报错、不更新）。

#### 执行规则
- 节点 `visibleWhen` 不满足 → 隐藏节点；节点隐藏后其相连连线也不展示。
- `iconRules` 顺序匹配，首个命中的 `icon` 生效，都不命中回落节点 `type` 自身图标；只换显示图标，不改类型/尺寸/字段。
- 连线 `showWhen` 不满足、或任一端点被隐藏 → 不绘制。
- `dirRules` 顺序匹配，首个命中的 `dir` 生效，都不命中回落连线固定 `dir`（缺省 `forward`）。

#### 编辑态 vs 运行态渲染
- 编辑态：被规则隐藏的元素**虚化**（未选中 `GHOST_A=0.16`，选中 `GHOST_SEL=0.5`），带 ⊘ 徽标，仍可点选编辑。
- 运行态/预览（`previewMode=true`）：被隐藏元素**彻底不绘制**，无徽标。

#### 验收标准
- 规则保存后在编辑器中实时生效。
- 编辑态被隐藏元素虚化并可编辑；运行视图彻底隐藏。
- 规则总览（📏 规则面板）列出全部已配置规则。
- 图标规则命中顺序、流向规则命中顺序符合「首个命中」。

### 7.10 信号管理与注入测试

#### 需求描述
提供信号面板，管理全局信号、注入测试数据和批量样例 JSON。

#### 功能点
- 添加全局信号；配置中文名 `key.zh`、英文名 `key.en`、默认值 `value`。
- 全局信号可绑定后台字段 `bind`（选具体设备实例 + 字段）。
- 按元素/全局信号添加注入行、输入注入值、分组展开/折叠。
- 生成当前信号模板 JSON、粘贴 JSON 批量应用注入值、清空注入。

#### 规则与限制
- 全局信号中文名、英文名均必填且**全局唯一**（英文名重复=信号键冲突）。
- 全局信号英文名作为实时数据键（如 `mode`）。
- 命名问题阻断导出（`globalSignalNameReport`）。
- 注入数据只用于编辑器测试，不作为正式实时数据接口，不写入正式导出（作为 `sampleSignals` 样例导出）。

#### 验收标准
- 可新增全局信号并在规则中引用。
- 注入信号后画布规则和字段展示即时更新。
- 全局信号缺名或英文名重复时导出被阻断。

### 7.11 画布 JSON 导入导出

#### 需求描述
支持导入和导出完整画布 JSON，作为运营配置与前端运行态之间的核心契约。完整字段见第 8 章。

#### 导出内容
`schemaVersion`、`meta`（app/generatedAt/lang/libraryRef/canvas/view）、`edgeStyles`、`nodes`、`edges`、`signals`（有全局信号时）、`sampleSignals`（有注入样例时）、`dataBindings`（有绑定时）。

#### 功能点
- 显示 / 复制 / 下载画布 JSON。
- 导入 JSON 并还原画布（含旧格式迁移，见 §5.3）。
- 导出前校验：节点 ID、字段名、全局信号名（阻断）+ 未绑定/失效绑定（风险）。

#### 导出校验（源码级）

阻断（任一命中即禁止导出，`blockExportForIds`）：
1. 节点 ID 重复或为空 —— "Export blocked: duplicate/empty node IDs — fix first"。
2. 字段缺中文名或英文名 —— "Export blocked: N field(s) missing zh/en name — fill first"。
3. 同一节点内字段中文名或英文名重复 —— "Export blocked: N duplicate field name(s) in a node — fix first"。
4. 全局信号缺名或英文名全局重复 —— "Export blocked: N global signal name issue(s) — fix first"。

风险（允许导出，仅提示，`renderBindRisk` 黄色区）：
5. 字段未绑定后台字段 / 缺设备实例 / 设备实例不存在 / 字段不在字典 —— "⚠ N field(s) not bound — export allowed"。

#### 验收标准
- 导出的 JSON 可再次导入并还原主要画布内容（含规则、视图、连线样式）。
- 导出的 JSON 可被运行态加载。
- 4 类严重问题阻断导出；风险类提示但允许导出。

### 7.12 模板库

#### 需求描述
将当前画布保存为模板，支持浏览、加载、编辑、重命名和删除。契约详情见 `docs/template-api.md`。

#### 功能点
- 打开模板库、展示名称/英文名/描述/缩略图；弹框右上角为无边框关闭按钮。
- 加载模板到画布、编辑内容、重命名、删除。
- 保存当前画布为模板：入口在顶部菜单「💾 保存为模板」（非模板库弹框内）。
- 默认模板（`template.default===true`，缺省取第一个）。
- 清单按需加载：先取清单，选中后再加载完整模板 JSON。

#### 数据模型
- 无存储的 `index.json`：清单由**扫描 `templates/*.json`** 动态生成（dev-server / server / build.py 三处一致）。
- 单模板 `templates/<id>.json`：内置用 `seed`（加载时自动布局），用户保存用 `canvas`（保留精确布局）；二者互斥。

#### 接口（`/api/templates`）

| 方法 | 路径 | 用途 | 关键状态码 |
|---|---|---|---|
| GET | `/api/templates` | 取清单（等价扫描结果）| 200 |
| POST | `/api/templates` | 新建 | 200 / 400 缺 name / 409 id 冲突 |
| PUT | `/api/templates/:id` | 重命名或编辑 | 200 / 404 |
| DELETE | `/api/templates/:id` | 删除 | 200 / 404 |

边界：`id` 消毒为 `[A-Za-z0-9_-]` 且截断 64 字符（防目录穿越）；请求体上限 16MB；自动分配最小空缺 `tpl_N`。前端端点可用 `window.TOPO_TPL_BASE`（读）/`window.TOPO_TPL_API`（写）改指父平台后端。

#### 验收标准
- 本地开发和生产 Node 服务下，模板写入落盘到 `templates/`。
- 纯静态托管下模板可读；写入失败回退为下载 JSON。
- 删除默认模板后，默认模板自动切换到剩余第一个。

### 7.13 运行态渲染

#### 需求描述
只读运行模式，使前端或大屏直接复用编辑器渲染能力。运行态激活条件：URL `mode=runtime|view|embed`、或 `embed` 参数、或存在 `window.__TOPO_RUNTIME__`。

#### 接入方式

1. URL 参数：
```text
topo.html?mode=runtime&topology=<画布JSON地址>&signals=<实时数据地址>&interval=2000
```
| 参数 | 说明 |
|---|---|
| `mode` | `runtime`/`view`/`embed` 进入只读 |
| `topology`（或 `topo`）| 画布 JSON 的 URL |
| `signals` | 实时数据 URL（`no-store` 轮询）|
| `interval` | 轮询毫秒；不填只拉一次 |
| `fit=0` | 关闭自动适配（默认自动缩放铺满）|
| `interactive=1` | 允许平移/缩放（默认只读锁定）|

2. iframe + postMessage（收到 `topo:ready` 后再推）：

| type | 方向 | 语义 |
|---|---|---|
| `topo:topology` | 父→iframe | 加载/切换拓扑（画布 JSON 对象）|
| `topo:signals` | 父→iframe | 整批覆盖（先清空规则上下文再写入）|
| `topo:merge` | 父→iframe | 增量合并（只更新传入键，保留其余）|
| `topo:ready` | iframe→父 | 渲染器已就绪 |

3. JS API（`window.TopoRuntime`）：
```js
TopoRuntime.loadTopology(objOrUrl); // 加载拓扑（对象或 URL）
TopoRuntime.setSignals(obj);        // 整批覆盖（= topo:signals）
TopoRuntime.mergeSignals(obj);      // 增量合并（= topo:merge）
TopoRuntime.fit();                  // 重新适配容器
TopoRuntime.config();               // 返回运行态配置
```

#### 功能点
- 运行态隐藏编辑器外壳（CSS 类 `rt`，锁定时加 `rt-lock`）。
- 加载拓扑 JSON、整批覆盖信号、增量合并信号。
- 自动适配容器、可选平移缩放。
- 向父页面发送 `topo:ready`。

#### 验收标准
- `mode=runtime` 时页面只显示拓扑画布。
- 下发拓扑 JSON 后完成渲染。
- 下发实时信号后字段值和规则效果更新。
- `topo:merge` 只更新传入信号，保留其它信号上次值；`topo:signals` 整批覆盖后未传信号回退画布静态默认值。

### 7.14 实时数据接口

#### 需求描述
后端提供扁平 JSON 对象作为实时数据，键为信号名，值为当前测量值。完整契约见 `docs/realtime-data-api.md`。

#### 数据格式
```json
{
  "grid_1.P(kW)": 383,
  "pcs_1.P(kW)": -9,
  "pcs_1.Status": "放电",
  "bms_1.SOC(%)": 55,
  "mode": "island"
}
```

#### 信号命名

| 信号类型 | 命名规则 | 示例 |
|---|---|---|
| 节点字段 | `节点id.字段英文名` | `pcs_1.P(kW)` |
| 全局信号 | `全局信号英文名` | `mode` |

#### 值语义
- 数字、字符串、布尔按原值参与规则和展示。
- `0` 是真实值，显示为 `0`。
- `null`、空串、未提供表示无值；数值比较遇无值不命中。

#### 覆盖与合并
- URL 轮询 / `topo:signals` / `setSignals` = 整批覆盖（未含信号回退静态默认）。
- `topo:merge` / `mergeSignals` = 增量合并（保留上次值）。
- 轮询每次必须返回全量快照。

#### 验收标准
- 返回顶层扁平 JSON，不嵌套、不包裹元信息。
- 键名与画布 JSON 中的节点 ID 和字段英文名逐字一致。
- 错误键名不会更新目标字段（对不上=无效），联调时按画布 JSON 枚举核对。

### 7.15 多语言

#### 需求描述
支持中英文界面，节点/字段/模板/元素名称支持中英文配置。实现：全局 `lang`（默认 `zh`），`toggleLang()` 切换，`tr()` + `I18N` 映射 + 大量 `lang==='en'?en:zh` 三元。

#### 功能点
- 工具栏中英文切换。
- 元素库、节点、数据字段、全局信号、模板均支持中/英文名。

#### 验收标准
- 切换语言后已有节点和字段展示切换到对应语言。
- 字段英文名仍作为信号键，不因界面语言改变。

### 7.16 草稿自动保存（本地）

#### 需求描述
为防误关，编辑变更自动保存到浏览器 localStorage，可手动保存/恢复/清除。

#### 功能点
- 每次变更 260ms 防抖写 localStorage。
- 文件菜单：保存草稿（`saveDraftNow`）、恢复草稿（`restoreDraftManual`）、清除草稿（`clearDraft`）。

#### 规则与限制
- 草稿是浏览器本地数据，非模板、非导出；换浏览器/清缓存即丢失。

#### 验收标准
- 编辑后不导出直接刷新，可恢复到最近草稿。
- 清除草稿后刷新不再恢复。

### 7.17 元素库包导出（前端复用）

#### 需求描述
导出一份自包含 ZIP，供前端方案 A/B 复用（`dlAllIconsZip()`）。

#### 内容
- `element-library.json`：版本、tabs、分组（图标文件名/默认字段/尺寸）、连线类型、状态字典、数据标签字典。
- `runtime.js`：规则引擎，暴露 `resolveDynamic(topology, liveSignals)` → `{nodes:[{...,visible,iconType}], edges:[{...,visible,dir}]}`（方案 B 自研渲染用）。
- `icons/`：全部图标文件（含自定义）。
- `README.md`：部署说明。

#### 验收标准
- ZIP 可解压得到上述四类内容。
- `runtime.js` 的 `resolveDynamic` 与编辑器规则引擎行为一致（避免逻辑漂移）。

### 7.18 值字典（code 码转义）

#### 需求描述
把字段/信号/连线标签的 **code 码值转义成中/英文案**显示在画布上；规则求值与实时数据推送始终用原始 code，转义只在显示层，随语言切换，查不到回退原值。字典为**共享库资产**（跨拓扑复用，类似图标库/模板库），文件化管理。

#### 数据结构
一张字典 = 一套 `code→中/英文案` 表 + 认领的后台字段，见 §8.8 与 [`docs/dict-api.md`](dict-api.md)：
```jsonc
{ "type":"bms_status", "name":"电池状态", "nameEn":"Battery Status",
  "applyTo":[ {"deviceType":"BCU","field":"StringDataLogs.String1State"} ],
  "items":[ {"code":"0","zh":"待机","en":"Standby"}, {"code":"1","zh":"充电","en":"Charging"} ] }
```

#### 关联方式（两条路径）
- **自动匹配（主）**：字典 `applyTo` 认领后台字段（`deviceType + location.field`）；画布字段/信号/连线标签**绑定了**该后台字段即自动转义（匹配键与设备实例无关，不指定实例也命中）。
- **手动指定（兜底/覆盖）**：字段/信号的 `dict` 属性、连线标签的 `labelDict`，三态语义：`undefined`=自动匹配 / `''`=强制不转义 / `'type'`=强制某字典（优先级最高）。

#### 转义规则（`packages/topology-runtime`，编辑器与前端同一实现）
- 匹配：统一 `String(code)` 比较（数字 `1` 与字典 `"1"` 视为同一 code）。
- 语言：取 `zh`/`en` 列；`en` 缺失回退 `zh`（运行期容错）。
- 回退：code 未命中 / 字典不存在 → 原样显示原始值（不吞值）。
- 导出函数：`resolveValueDict`（解析生效字典，优先级同上）、`valueDictLabel`、`translateFieldValue`、`fieldDisplayValue`；env 钩子 `getValueDicts()` 供数据（编辑器传「共享库+文档内嵌」合并结果，前端可传自有字典覆盖）。

#### 功能点
- **字典管理弹框**（菜单栏「📖 值字典」）：CRUD、`items` 行编辑（code/中/英）、`applyTo` 级联多选（数据源 `DEVICE_DICTS`/`dictLocations`/`dictFields`）；校验字典名中/英文必填、条目 `code·zh·en` 必填、`code` 同字典内唯一。
- **导入 / 导出**：单个 `<type>.json` / 全部 `{dicts:[…]}` 清单导出；导入兼容单对象/数组/清单三形态，宽松归一化（`nameEn/en` 兜底、`code` 去重、非法项剔除）后过服务端强校验，同名 `type` 询问后覆盖。
- **动态加载**：清单由服务端实时扫描 `value-dicts/` 目录生成；手改 JSON 文件后「🔄 重新扫描」即时生效（该目录已排除 dev-server 热重载）。
- **存储 API** `/api/value-dicts`（`GET/POST/PUT/DELETE`，`scripts/dict-store.js`，dev/生产共用；`build.py` 拷贝目录并生成清单）。
- **导出内嵌**：画布 JSON 顶层 `valueDicts` 只内嵌本图实际用到（显式指定 + `applyTo` 命中）的字典快照，前端零依赖。

#### 规则与限制
- 字典是「一套码表」的复用单元；码表不同的字段各建一张字典。
- 存储接口与图标/模板库同姿态，**写接口无鉴权**（内部运营工具），生产环境如需收紧应在网关层统一处理。

#### 验收标准
- 建字典 → 认领 BCU·StringDataLogs.String1State → 给绑定该字段的画布元素注入 `1`，显示「充电」，切英文显示「Charging」，注入 `9`（未收录）原样显示。
- 字段行 📖 手动指定「不转义」时强制显示原始 code；「强制某字典」覆盖自动匹配。
- 导入导出往返、目录手改 + 重扫、同名覆盖询问均按预期。
- 导出画布 JSON 含 `valueDicts` 快照且仅含用到的字典。

---

## 8. 数据需求与画布 JSON Schema（附录级）

### 8.1 顶层结构

```jsonc
{
  "schemaVersion": "2.0",
  "meta": {
    "app": "储能拓扑编辑器",
    "generatedAt": "<ISO 时间>",
    "lang": "zh",
    "libraryRef": { "name": "energy-topology", "version": "2.0.0" },
    "canvas": { "bgColor":"#0a1f40", "zoom":1, "panX":0, "panY":0,
                "grid":{ "show":true, "stepPx":40 }, "showAnchors":true },
    "view": { "showEdgeLabels":true, "showFieldChips":true, "globalWidth":1,
              "routeStyle":3, "busMerge":true, "busMergeGap":16, "busTrunkBold":true,
              "busStyle":"busbar", "busShareTrunk":false, "busAggregation":false }
  },
  "edgeStyles": { "ac_power": { "labelZh":"交流电力","labelEn":"AC Power",
                    "color":"#e74c3c","width":2.5,"dash":[],"anim":"flow","speed":0.5 } },
  "nodes": [ /* §8.2 */ ],
  "edges": [ /* §8.3 */ ],
  "signals": [ /* §8.4，有全局信号时 */ ],
  "valueDicts": [ /* §8.8，本图用到的值字典快照，有则内嵌 */ ],
  "sampleSignals": { "bms_1.SOC(%)": 55 },   /* 有注入样例时 */
  "dataBindings": [ /* §8.5，有绑定时 */ ]
}
```

`edgeStyles[*].anim` 取值：`none`/`flow`/`pipe`/`glow`/`pulse`/`dash`/`alarm`。

### 8.2 节点（nodes[]）

```jsonc
{
  "id": "pcs_1",
  "type": "pcs",
  "label": { "zh": "PCS变流器", "en": "PCS" },
  "position": { "x": 480, "y": 220 },
  "sizeWorld": 417,
  "scale": 1,
  "rotation": 0,
  "fontSize": 14,
  "fontColor": "#e8f4ff",
  "display": { "showLabel": true, "showFields": true },
  "data": [ /* §8.6 */ ],

  // 可选
  "deviceType": "PCS",           // 节点级后台设备（作为字段默认来源）
  "deviceId": "xxx",
  "icon": "custom_x.png",        // 仅 custom_* 类型
  "textStyle": { "bg":"none","border":"solid","borderColor":"#333",
                 "borderWidth":1,"radius":4,"padX":6,"padY":4 },  // text 节点
  "variableStyle": { "layout":"horizontal",
                     "label":{"fontSize":12,"color":"#fff","bold":false},
                     "value":{"fontSize":14,"color":"#4dd0ff","bold":true} }, // variable 节点
  "anchorStyle": { "fill":"none","opacity":0.6 },                 // anchor 节点
  "action": { "trigger":"click","url":"https://...","target":"blank" },
  "visibleWhen": { /* 条件树 */ },
  "iconRules": [ { "when": { /* 条件 */ }, "icon": "bms_charge" } ]
}
```

### 8.3 连线（edges[]）

```jsonc
{
  "from": "pv_1",
  "to": "pcs_1",
  "edgeType": "ac_power",
  "edgeTypeLabel": { "zh":"交流电力","en":"AC Power" },
  "color": "#e74c3c",
  "dash": [],
  "route": "smart",              // smart|line|arc|manual
  "dir": "forward",              // forward|reverse|both|none
  "width": 1,
  "label": "并网",               // 标签中文文字
  "showLabel": true,
  "orthoSnap": true,
  "waypoints": [ { "x":300,"y":200 } ],   // manual 路由
  "active": true,

  // 可选
  "style": { "color":"#e74c3c","lineStyle":"solid" },  // solid|dashed|inherit
  "fromPort": "right",
  "toPort": "left",
  "showWhen": { /* 条件树 */ },
  "dirRules": [ { "when": { /* 条件 */ }, "dir":"reverse" } ],

  // 可选：连线标签（绑定后台字段时带 id 作信号键前缀；详见 §7.6 连线标签）
  "id": "edge_1",                          // 标签绑定后自动生成；信号键=id.labelEn
  "labelEn": "Power",                      // 英文文字，兼作信号键段
  "labelBind": { "field":"RunLogs.ActivePower", "deviceType":"PCS", "deviceId":"..." },
  "labelDict": "",                         // 三态：省略=自动匹配 / ''=不转义 / 'type'=强制
  "labelValue": "1",                       // 静态默认值（无实时数据时显示）
  "labelShow": "value",                    // value(默认)|name|both
  "labelDir": "auto",                      // auto(随线)|h|v
  "labelRot": 0, "labelScale": 1,          // 旋转(度)/缩放(倍)，缺省 0/1 不导出
  "labelOffset": { "x":12, "y":-8 }        // 拖拽偏移(屏幕像素)
}
```

### 8.4 全局信号（signals[]）

```jsonc
{
  "key": { "zh":"运行模式","en":"mode" },   // en = 信号键
  "value": "island",
  "bind": { "field":"loc.field","deviceType":"EMS","deviceId":"..." },  // 可选
  "dict": "ems_mode"   // 可选：值字典三态（省略=自动匹配 / ''=不转义 / 'type'=强制）
}
```

### 8.5 数据绑定（dataBindings[]）

```jsonc
// 节点字段绑定
{
  "signal": "bms_1.SOC(%)",   // 后端要输出的实时键 = 节点id.字段英文名(keyEn)
  "node": "bms_1",            // 所属节点；全局信号为 null
  "label": "SOC(%)",          // 中文名(key.zh)，仅供人读
  "source": {
    "deviceType": "BCU",      // 后台设备类型（缺省可由节点/元素类型推断）
    "deviceId": "e072699f1f8d427b9d81daf4e32b26fc",
    "field": "AuxDataLogs.SystemSOC",   // 后台字段路径 = location.field（来自字典）
    "deviceName": "Rack"      // 可选，由 deviceId 反查
  }
}
// 全局信号绑定：node 为 null，signal 无节点前缀
{
  "signal": "mode",
  "node": null,
  "label": "运行模式",
  "source": { "deviceType":"EMS", "deviceId":"...", "field":"RunLogs.Mode" }
}
// 连线标签绑定：node 为 null、edge=连线 id，signal=连线id.标签英文名
{
  "signal": "edge_1.Power",
  "node": null,
  "edge": "edge_1",
  "label": "充电功率",
  "source": { "deviceType":"PCS", "deviceId":"...", "field":"RunLogs.ActivePower" }
}
```

### 8.6 数据字段（node.data[]）

```jsonc
{
  "key": { "zh":"SOC(%)", "en":"SOC(%)" },   // zh/en 均必填；en 作信号键的字段段
  "value": 55,                                // 默认值（0 有效；null/"" 表无值）
  "hidden": false,
  "offset": { "x":0, "y":0 },
  "bind": {
    "field": "AuxDataLogs.SystemSOC",   // 后台字段路径 location.field
    "deviceType": "BCU",
    "deviceId": "e072699f1f8d427b9d81daf4e32b26fc",
    "followNode": false     // true=跟随节点设备（节点改设备它跟着变）；导出时 deviceType/deviceId 仍写全
  },
  "dict": "bms_status"      // 可选：值字典三态（省略=自动匹配 / ''=不转义 / 'type'=强制）
}
```

### 8.7 画布 JSON 约束（校验依据）
- 必须含 `schemaVersion`。
- 节点 `id` **与连线 `id`（标签绑定时生成）** 同一命名空间，全局唯一且非空。
- 节点内字段 `key.zh`、`key.en` 各自唯一且非空。
- 全局信号 `key.en` 全局唯一且非空。
- 连线标签绑定后台字段时 `labelEn` 必填（作信号键段）；未指定设备实例为风险提示（不阻断）。
- 规则为声明式 JSON，不含可执行代码。
- 导出 JSON 自包含运行态所需的视图设置、连线样式、规则与**用到的值字典 `valueDicts`**。

### 8.8 值字典（valueDicts[]）

导出时内嵌本图实际用到（显式 `dict`/`labelDict` 指定 + `applyTo` 命中）的字典快照，前端零依赖即可转义。单条结构见 §7.18 / [`docs/dict-api.md`](dict-api.md)：

```jsonc
{
  "type": "bms_status",
  "name": "电池状态", "nameEn": "Battery Status",
  "applyTo": [ { "deviceType":"BCU", "field":"StringDataLogs.String1State" } ],
  "items":   [ { "code":"0","zh":"待机","en":"Standby" },
               { "code":"1","zh":"充电","en":"Charging" } ]
}
```

> 字段/信号/连线标签的 `dict`/`labelDict` 为**引用**（dictType 字符串）；`valueDicts[]` 为随图内嵌的**定义快照**。前端也可用 `env.getValueDicts()` 传自有字典覆盖。

---

## 9. 图标 / 字典 / 设备数据文件规范

### 9.1 `icons/index.json`
```jsonc
{ "schemaVersion":"1.0",
  "groups":[ { "title":"电源侧","title_en":"Power Source","color":"#4dd0ff","tab":"device",
    "devices":[ { "type":"grid","label":"主电网","label_en":"Grid","badge":"grid",
                  "file":"grid.png","data":["P(kW)","Q(kvar)"] } ] } ] }
```
- `file` 指向 `icons/` 图片；无 `file` = 纯绘制节点（text/variable）。
- 增删改图片后，dev-server/build.py 自动扫描合并（见 §7.2）。

### 9.2 字段字典 `dic/*.json`（构建合并 `dic/index.json`）
> 注意区分：此处「字段字典」定义**每种设备类型有哪些后台字段**（供绑定时选 `location.field`）；§9.4 的「值字典」定义**字段值 code 如何转义成文案**，两者不同。
```jsonc
[ { "deviceType":"BCU","location":"AuxDataLogs",
    "fields":["AmbientT1","BusVoltage","PackVoltage","SystemSOC", "..."] } ]
```
合并后 `dic/index.json` 按 `deviceType` 归并为 `{ "BCU":[{location,fields}, ...] }`。

### 9.3 设备档案
- `device/device-type.json`：字典项数组（`dictLabel`/`dictValue`/`isDefault`/`default` 等）。
- `device/device-info.json`：设备实例数组（`deviceId`/`deviceName`/`archiveDeviceType`/`projectName`/`delFlag` 等）。

### 9.4 值字典 `value-dicts/*.json`（构建/服务端扫描生成 `value-dicts/index.json`）
每张字典一个 `<type>.json`（code→中/英文案 + 认领的后台字段），清单由服务端**实时扫描目录**生成（`build.py` 静态部署时预生成）。详见 §7.18 与 [`docs/dict-api.md`](dict-api.md)。
```jsonc
{ "schemaVersion":"vd-1", "type":"bms_status", "name":"电池状态", "nameEn":"Battery Status",
  "applyTo":[ {"deviceType":"BCU","field":"StringDataLogs.String1State"} ],
  "items":[ {"code":"0","zh":"待机","en":"Standby"}, {"code":"1","zh":"充电","en":"Charging"} ] }
```
- 清单 `value-dicts/index.json`：`{ "schemaVersion":"vd-index-1", "dicts":[ … ] }`。
- 读写 API `/api/value-dicts`（`scripts/dict-store.js`）；增删改文件后编辑器「🔄 重新扫描」即生效（该目录已排除 dev-server 热重载）。

---

## 10. 非功能需求

### 10.1 易用性
- 常用操作可通过工具栏完成；关键编辑动作即时反馈。
- 导出阻断/风险问题清晰提示（红=阻断、黄=风险）。
- 规则配置可通过注入测试闭环验证。

### 10.2 性能
- 常规拓扑图保持编辑交互流畅。
- 实时数据更新按动画帧自动重绘，无需手动刷新。
- 图标库、模板库、字典按需加载或用轻量清单。

### 10.3 安全性
- 规则为声明式 JSON，不使用 `eval`。
- 模板 API 的 `id` 消毒为 `[A-Za-z0-9_-]` 并截断 64 字符（防目录穿越）。
- 模板请求体上限 16MB。
- 纯静态部署下不尝试在浏览器本地写服务器文件（回退下载）。

### 10.4 兼容性
- 支持现代桌面浏览器。
- 支持本地开发、生产 Node 服务、纯静态托管三种部署。
- 支持 iframe 内嵌；URL 轮询需考虑 CORS（或改用 postMessage 规避）。
- 导入兼容 seed/canvas 两种表示与多种旧字段（见 §5.3）。

### 10.5 可维护性
- 图标清单、设备类型、设备实例、字段字典、模板均文件化管理。
- 模板单文件存储，清单扫描生成（无手动维护的 index.json）。
- 编辑器与运行态复用同一套渲染逻辑；`runtime.js` 与编辑器规则引擎需保持一致，避免漂移。
- ✅ 已将原 `topology-editor.js`（约 5920 行单文件）按职责拆为 11 个有序片段（见 §6.2）；仍为共享全局作用域的普通脚本，纯行切分、构建产物与原文件逐 token 等价，行为不变。

---

## 11. 部署需求

### 11.1 本地开发
```bash
npm run dev   # node scripts/dev-server.js --port 3009
```
托管源码、自动扫描图标/字典/模板、支持模板写入与热重载。

### 11.2 生产可写部署
```bash
npm run build   # python scripts/build.py → 生成 dist/
npm start       # node scripts/server.js
```
托管 `dist/` 静态资源；模板读写指向项目根 `templates/` 或 `TEMPLATES_DIR`（`build` 重建 dist 不清空已保存模板）；图标读取指向项目根 `icons/` 或 `ICONS_DIR`，`/icons/index.json` 由服务端动态扫描生成，新图标按已有元素 type 前缀自动归组，无法匹配时才进入自定义图标分组。环境变量：`PORT`(3009)/`HOST`(0.0.0.0)/`STATIC_ROOT`(dist)/`TEMPLATES_DIR`/`ICONS_DIR`。

### 11.3 纯静态部署
可读模板与静态资源；不支持模板写入；保存失败回退为下载 JSON。

### 11.4 构建产物（build.py）
- 压缩 `topo.html`、CSS、JS 到 `dist/`。
- 扫描 `icons/` + 合并清单 → `dist/icons/index.json`。
- 拷贝 `templates/*.json` + 扫描生成 `dist/templates/index.json`。
- 拷贝 `dic/*.json` + 合并生成 `dist/dic/index.json`。
- 拷贝 `value-dicts/*.json` + 扫描生成 `dist/value-dicts/index.json`。
- 原样拷贝 `device/`。

---

## 12. 测试需求与用例清单

> 供测试与回归使用；勾选式验收。P0=核心必过，P1=重要，P2=增强。

### 12.1 画布编辑（P0）
- [ ] 从元素库拖入 5 类节点，均可移动、选中、删除。
- [ ] 滚轮缩放在 10%–500% 之间夹取，百分比实时更新。
- [ ] 空白拖 / 中键 / 空格拖三种平移均可用。
- [ ] Shift 框选 与「选择模式」框选都能多选；成组拖动整体移动。
- [ ] Ctrl+Z/Y 正确撤销/重做；连续 22 次编辑后最早一帧不可撤销。
- [ ] Ctrl+C/V 粘贴偏移 +40px 且生成新 ID；Ctrl+D 直接复制。
- [ ] 焦点在输入框内时快捷键不触发全局动作。

### 12.2 节点/字段（P0）
- [ ] 空/重复节点 ID 阻断导出并显示对应提示。
- [ ] 字段缺中/英文名、同节点内重名，均阻断导出。
- [ ] 字段 `value=0` 显示 `0`；`null`/`""` 显示空。
- [ ] 已绑定字段导出后出现在 `dataBindings`。

### 12.3 连线（P1）
- [ ] 四种走线（smart/line/arc/manual）可切换；手动拐点可拖动吸附。
- [ ] 固定流向四态（forward/reverse/both/none）渲染正确。
- [ ] 右键「智能走线/直线走线」清空拐点。
- [ ] 连线标签：绑定后台字段后随注入/实时值更新；`labelShow` 三态显示正确；未绑定只显示文字。
- [ ] 标签可拖动（拖远显示引导线）、旋转手柄（Shift 吸附 15°）、缩放手柄，与面板滑杆联动。
- [ ] 标签走向 auto/h/v 正确；命中值字典时转义、切语言切中英。
- [ ] 标签绑定生成的连线 id 不与节点 id 冲突；导出/导入往返保留全部 label* 字段与 `dataBindings` 的 edge 条目。

### 12.4 规则引擎（P0）
- [ ] 11 个运算符逐一验证（含 `in`/`between`/`truthy`/`falsy`/`exists`）。
- [ ] `all`/`any`/`not` 与嵌套条件求值正确。
- [ ] 无值（null/""/未传）在数值比较不命中、`exists` 为假、`falsy` 为真；`0` 为真实值。
- [ ] `visibleWhen` 隐藏节点时其连线连带隐藏。
- [ ] `iconRules`/`dirRules` 首个命中生效，都不命中回落默认。
- [ ] 编辑态虚化+⊘徽标可编辑；预览态彻底隐藏。
- [ ] `ref` 引用另一信号比较可用。

### 12.5 信号与注入（P1）
- [ ] 新增全局信号可在规则下拉中引用。
- [ ] 注入值后规则/字段即时更新。
- [ ] 全局信号缺名/英文名重复阻断导出。
- [ ] 「生成模板 JSON」「粘贴批量应用」「清空注入」可用。

### 12.6 导入导出（P0）
- [ ] 导出→导入往返后节点/连线/规则/视图/连线样式一致。
- [ ] 导入旧 seed 格式与旧信号键（中文）正确迁移。
- [ ] 4 类阻断校验、1 类风险提示均按预期。

### 12.7 模板库（P1）
- [ ] 保存/编辑/重命名/删除模板落盘（dev 与 `npm start`）。
- [ ] 纯静态下写入回退为下载 JSON。
- [ ] 删除默认模板后默认自动切换。
- [ ] 新增/删除 `templates/*.json` 后清单自动反映（重扫/重构建）。

### 12.8 运行态（P0）
- [ ] `mode=runtime` 隐藏编辑器外壳。
- [ ] URL `topology`+`signals`+`interval` 轮询更新。
- [ ] `fit=0` 关闭自适应；`interactive=1` 开放平移缩放。
- [ ] iframe 收到 `topo:ready` 后 `topo:topology`/`topo:signals`/`topo:merge` 均生效。
- [ ] `topo:merge` 仅更新传入键；`topo:signals` 整批覆盖后未传信号回退静态默认。
- [ ] `TopoRuntime.loadTopology/setSignals/mergeSignals/fit/config` 可用。
- [ ] 运行态与编辑器「预览效果」显隐/图标/流向一致。

### 12.9 图标库（P1）
- [ ] 替换同名图片→样式变；删图片→元素消失；新增未登记图片→归入自定义分组。
- [ ] 上传 PNG/SVG/JPEG 自定义图标可拖入并参与 ZIP 导出。
- [ ] 元素库包 ZIP 含 `element-library.json`/`runtime.js`/`icons/`/`README.md`。

### 12.10 多语言/草稿（P2）
- [ ] 中英切换后节点/字段展示切换，信号键不变。
- [ ] 编辑后刷新可恢复草稿；清除后不再恢复。

### 12.11 值字典（P1）
- [ ] 建字典 + `applyTo` 认领后台字段；绑定该字段的元素注入 code 后显示转义文案，切语言切中/英。
- [ ] 字段/信号/连线标签的 `dict`/`labelDict` 三态：自动匹配 / `''` 不转义 / 强制某字典。
- [ ] 未命中 code、字典不存在 → 原样显示原始值（不吞值）。
- [ ] 字典名中/英文必填、条目 `code·zh·en` 必填、`code` 同字典内唯一（弹框 + 服务端 400 双校验）。
- [ ] 导入（单对象/数组/清单三形态）、导出（单个/全部）、同名覆盖询问、手改文件 + 重扫均按预期。
- [ ] 导出画布 JSON 内嵌 `valueDicts` 且仅含用到的字典。

### 12.12 后端联调（P0）
- [ ] 后端按画布 JSON（`nodes[].id`+`data[].key.en`+`signals[].key.en`+连线标签 `edges[].id`/`labelEn`）枚举全部信号键。
- [ ] 返回顶层扁平 JSON；轮询返回全量；增量只推变化。
- [ ] `0`/`null`/空串语义与文档一致。
- [ ] 错误键名不更新目标字段。
- [ ] `dataBindings[]` 覆盖节点字段、全局信号、连线标签三类来源（连线标签条目带 `edge`）。

---

## 13. 附录：代码位置索引（维护）

> 行号基于 v1.1 核对时的 `topo-editor/topology-editor.js`（约 5920 行），仅供定位，重构后以函数名为准。

| 功能 | 函数 / 位置 |
|---|---|
| 图标库加载/重扫 | `loadIconLibrary()`≈39-70、`reloadIconLibrary()`≈72-85 |
| 语言 | 全局 `lang`（≈行4）、`toggleLang()`≈534、`tr()`≈523 |
| 键盘快捷键 | `keydown` 监听≈1004-1014 |
| 右键菜单 | ≈1015-1026（HTML `topo.html` 421-429）|
| 缩放/滚轮 | ≈436 |
| 指针交互 | mousedown/move/up ≈569-888 |
| 撤销/重做 | `snapshot()`/`history`/`histIdx`≈126,143-146；上限 21 |
| 复制/粘贴 | `copySelection()`/`pasteClipboard()`≈3508-3547（偏移 +40）|
| 对齐/分布 | `alignSel()`≈3359-3465、`alignChips()`≈3336 |
| 自动布局 | `autoLayout()`≈3671-3715、`_layoutComponent`/`_compactAxis` |
| 走线/母线 | `orthogonalize()`≈1481、`edgePathRaw()`≈1505、母线≈1595-1670、`alignJunctions()`≈1674 |
| 规则求值 | `cmpOp()`≈4410、`evalCond()`≈4427、`buildCtx()`≈4452、`computeDynamic()`≈4475 |
| 运算符表 | `RULE_OPS`≈4401、`RULE_DIRS`≈4403 |
| 图标/流向解析 | `nodeIconFor()`≈4470、`edgeDirFor()`≈4465 |
| 信号键解析 | `parseSignal()`≈5011、`injSignalName()`≈5009 |
| 条件编辑互转 | `condToEdit()`≈4532、`editToCond()`≈4547 |
| 导出 | `buildJSON()`≈3911、`serNode()`≈3852、`showJSON()`≈4108、`copyJSON()`/`dlJSON()`≈4145-4146 |
| 导入 | `importCanvasJSON()`≈4315、`parseImportedNode()`≈4192、`parseImportedEdge()`≈4226、`normalizeSignal()`≈5199、`migrateSignalKeys()`≈4302 |
| 校验 | `unboundBindingReport()`≈3988、`duplicateIdReport()`≈4013、`missingFieldNameReport()`≈4020、`duplicateFieldNameReport()`≈4033、`globalSignalNameReport()`≈4046、`renderBindRisk()`≈4062、`blockExportForIds()`≈4118 |
| 隐藏渲染 | `GHOST_A/GHOST_SEL`≈131、`drawHiddenBadge()`≈4520、`previewMode` 判定≈2173-2177 |
| 运行态 | `topoRuntimeConfig()`≈5842、`applyLiveSignals()`≈5859、`rtLoadTopology()`≈5873、`enterRuntimeMode()`≈5889、`window.TopoRuntime`≈5902、postMessage≈5908-5918 |
| 元素库包 | `dlAllIconsZip()`≈5498、`buildLibraryObj()`≈5498 附近 |

---

## 14. 风险与待确认

| 风险/问题 | 说明 | 建议 |
|---|---|---|
| ~~单文件 JS 过大~~（已拆）| 原 `topology-editor.js` 约 5920 行 → 已拆为 11 个有序片段（§6.2）| 后续可进一步 ES 模块化 + 单测（当前仍为共享全局作用域的普通脚本）|
| 规则与 runtime 逻辑重复 | 元素库包 `runtime.js` 与编辑器规则引擎并存 | 抽共享规则模块，加一致性测试防漂移 |
| 后端字段命名不一致 | 信号键依赖节点 ID 和字段英文名，大小写/符号不一致会失效 | 联调前以画布 JSON 枚举键名 |
| 模板写入依赖服务端 | 纯静态部署无法写模板 | 用 Node 服务或对接平台后端 `/api/templates` |
| seed/canvas 双表示 | 两种节点表示混淆易致导入 bug | 维护时严格区分（见 §5.3），补充往返测试 |
| 复杂拓扑性能 | 大量节点/连线影响智能走线与渲染 | 建立性能基准和大图压测 |
| 权限缺失 | 模板 API 无鉴权 | 集成父平台时由网关控制权限 |

---

## 15. 里程碑建议

| 阶段 | 目标 | 产出 |
|---|---|---|
| M1 | 固化当前编辑器能力 | PRD、接口文档、验收/测试清单 |
| M2 | 完成平台联调 | 拓扑 JSON、实时数据接口、模板 API 对接 |
| M3 | 运行态上线 | iframe/runtime 接入大屏或管理端 |
| M4 | 模块化重构 | 拆分规则、渲染、模板、导出、交互模块 + 回归测试 |
| M5 | 权限与版本治理 | 模板权限、版本、发布流程 |
