# @enercloud/topology-runtime

储能拓扑 **headless 核心**：几何 / 端口 / 正交布线 / 规则求值。

**单一事实源**：本 topo 工程的编辑器（`topo.html`）与前端仪表盘
（`v0-energy-system-dashboard` 的 `lib/topo/engine.ts` 自研渲染器）**共同消费本包**。
布线算法只在这里维护一份——改一次，编辑器与前端同时生效，不存在两边手动同步。

## 文件

| 文件 | 内容 | 消费方式 |
|---|---|---|
| `topology-runtime.js` | `createTopoRuntime(env)`：nsz/nodeBox/端口、A* 正交路由、通道布线、汇流合并、交叉消除 | 浏览器 `<script>` 得全局 `createTopoRuntime`；Node/打包器 `require/import` |
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

## 溯源

2026-07-02 从编辑器分段脚本（04-geometry / 05-routing / 07 的相交判定 / RUNTIME_JS）抽出；
抽出时已用 vm 沙箱证明「包输出 == 原编辑器算法输出」逐点相等（3 套拓扑 × 2 模式，80 项全对），
该基准固化为 `test/golden.json`。
