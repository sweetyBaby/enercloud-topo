# @enercloud/topology-runtime

储能拓扑 **headless 核心**：几何 / 端口 / 正交布线 / 规则求值。

**单一事实源**：本 topo 工程的编辑器（`topo.html`）与前端仪表盘
（`v0-energy-system-dashboard` 的 `lib/topo/engine.ts` 自研渲染器）**共同消费本包**。
布线算法只在这里维护一份——改一次，编辑器与前端同时生效，不存在两边手动同步。

## 文件

| 文件 | 内容 | 消费方式 |
|---|---|---|
| `topology-runtime.js` | `createTopoRuntime(env)`：nsz/nodeBox/端口、A* 正交路由、通道布线、汇流合并、交叉消除；占位点/文本框/变量避障排除（`isRouteObstacle`）、连线命中投影（`edgeHitInfo`） | 浏览器 `<script>` 得全局 `createTopoRuntime`；Node/打包器 `require/import` |
| `rules.js` | `TopoRules`：`evalCond`/`cmpOp`/`buildContext`/`resolveDynamic`（声明式规则求值，无 eval） | 浏览器 `<script>` 得全局 `TopoRules`；子路径 `@enercloud/topology-runtime/rules` |
| `index.d.ts` / `rules.d.ts` | TS 类型声明 | — |
| `test/routing-golden.mjs` | 布线回归（golden 快照，fixtures 为三套真实拓扑 × 2 种布线模式） | `node packages/topology-runtime/test/routing-golden.mjs` |

无构建、无依赖：源文件即产物（普通脚本 + CJS 尾巴双形态）。

## 消费方

- **编辑器**：`topo.html` 在 01→12 分段前 `<script>` 引入两个文件；
  `topo-editor/topology-editor-04-geometry.js` 顶部的接线层用编辑器全局状态实例化 `TR`，
  并把常用函数落回原全局名（其余分段照旧裸调用）。
- **前端仪表盘**：`pnpm` 以 `file:` 依赖引入（需同级检出本工程）；
  `lib/topo/engine.ts` 顶部实例化，定制（`nodeScale`/`sizeWorld`/标签避让字号）全部经 env 钩子注入。

## 维护约定（改代码前必读）

1. **headless 红线**：包内不得出现 DOM / canvas 绘制 / 编辑器 UI 依赖。
   唯一的视口耦合点是 `nsz` 的尺寸基准，已抽成 `env.sizeUnit` 钩子。
2. **宿主定制一律走 env 钩子**（见 `topology-runtime.js` 头注释的 env 契约），
   不允许任何消费方 fork / 补丁包内函数体。需要新定制点 → 加钩子（带默认值，保持旧行为）。
3. **改布线算法后**跑 `node packages/topology-runtime/test/routing-golden.mjs`：
   - 行为不该变的重构 → 必须全绿；
   - 有意的算法改进 → `--update` 重录基准，并在提交说明里写明变化。
4. env 钩子签名的破坏性变化 = 破坏两个消费方，需同步改编辑器接线层（04 分段）
   与前端接线块（engine.ts），并通知前端仓库升级。

## 占位点作汇合点（跨消费方注意）

占位点（`type:'anchor'`）可作连线汇合/分接点。**包内已处理**、两个消费方自动一致的部分：
- `isRouteObstacle` 让 anchor/text/variable 退出避障（`pathHitsNodes`/`buildObstacleGrid`/`detourRoute`）；
- `edgeAnchorPoint`/`nodePortPoint` 对 anchor 返回**几何中心**——接入同一占位点的多条线端点交于一点。

**不在包内**、消费方各自负责的部分：
- 分接/合并/汇合规整（`attachAnchorToEdge`/`mergeAnchorInto`/`normalizeAnchorJunctions`）是**编辑期拓扑编辑**，只在 `topo-editor/topology-editor-07-editing.js`。它们改的是 nodes/edges 数据，导出 JSON 里就是普通的多节点+多边，**前端零改动**即可正确渲染（多条边、anchor 节点）。
- **汇合点视觉去重**（≥2 条线接入的 anchor 隐藏自身填充圆、进出不画箭头，汇合处只留一个线色实心点）是**编辑器 render 层**逻辑（`topology-editor-06-render.js` 的 `isJunctionAnchor`/`drawJunctionDots`）。前端自研渲染器（`engine.ts`）若要同样的"单点无双箭头"观感，需自行按"某 anchor 的接入边数 ≥2"复刻该判定；否则会把 anchor 当普通节点画出填充圆、并对每条边各画一个箭头。

## 溯源

2026-07-02 从编辑器分段脚本（04-geometry / 05-routing / 07 的相交判定 / RUNTIME_JS）抽出；
抽出时已用 vm 沙箱证明「包输出 == 原编辑器算法输出」逐点相等（3 套拓扑 × 2 模式，80 项全对），
该基准固化为 `test/golden.json`。
