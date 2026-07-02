// 布线回归测试（golden 快照）：对 fixtures 里的拓扑逐边算路径、逐节点算几何盒，
// 与 golden.json 基准逐字比较。基准生成于 2026-07-02 从编辑器单体脚本抽包时，
// 当时已用 vm 沙箱证明「包输出 == 编辑器原始算法输出」逐点相等（80 项全对）。
//
// 用法：
//   node packages/topology-runtime/test/routing-golden.mjs            # 校验
//   node packages/topology-runtime/test/routing-golden.mjs --update   # 有意改进布线算法后重录基准
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const here = path.dirname(fileURLToPath(import.meta.url))
const require_ = createRequire(import.meta.url)
const { createTopoRuntime } = require_(path.join(here, "..", "topology-runtime.js"))
const goldenPath = path.join(here, "golden.json")
const update = process.argv.includes("--update")

const ET_STUB = {
  ac_power: { color: "#e74c3c" }, dc_power: { color: "#e67e22" }, pv_power: { color: "#f9ca24" },
  charge: { color: "#2ecc71" }, discharge: { color: "#3498db" }, busbar: { color: "#4dd0ff" },
}
const CONFIGS = [
  { name: "smart", busMergeGap: 16, busAggregation: false, routeStyle: 3, busOffsets: {}, busShareTrunk: false, ET: ET_STUB },
  { name: "busAgg", busMergeGap: 16, busAggregation: true, routeStyle: 3, busOffsets: {}, busShareTrunk: false, ET: ET_STUB },
]

// 前端 TopologyDoc(schema 2.0) → 编辑器内部节点/连线格式
function docToEditor(doc) {
  const nodes = (doc.nodes || []).map((n) => ({
    id: n.id, type: n.type,
    x: n.position ? n.position.x : n.x, y: n.position ? n.position.y : n.y,
    scale: n.scale || 1, fontSize: n.fontSize || 14,
  }))
  const edges = (doc.edges || []).map((e) => ({
    from: e.from, to: e.to, route: e.route || "smart",
    fromPort: e.fromPort, toPort: e.toPort, et: e.edgeType || e.et,
    dir: e.dir, orthoSnap: e.orthoSnap,
    waypoints: (e.waypoints || []).map((p) => (Array.isArray(p) ? p.slice() : [p.x, p.y])),
  }))
  return { nodes, edges }
}

const round3 = (v) => Math.round(v * 1000) / 1000
const roundPath = (p) => (p ? p.map(([x, y]) => [round3(x), round3(y)]) : null)

function compute() {
  const out = {}
  const fixtures = fs.readdirSync(path.join(here, "fixtures")).filter((f) => f.endsWith(".json")).sort()
  for (const fx of fixtures) {
    const doc = JSON.parse(fs.readFileSync(path.join(here, "fixtures", fx), "utf8"))
    for (const config of CONFIGS) {
      const { nodes, edges } = docToEditor(doc)
      let liveEdges = edges
      const rt = createTopoRuntime({
        getNodes: () => nodes,
        getEdges: () => liveEdges,
        setEdges: (v) => { liveEdges = v },
        getConfig: () => config,
        sizeUnit: () => Math.min(1200, 800) / 600, // 与录制基准时的编辑器视口一致
      })
      const paths = liveEdges.map((e) => roundPath(rt.edgePath(e)))
      rt.applyBusMerge()
      out[`${fx}|${config.name}`] = {
        nsz: nodes.map((n) => round3(rt.nsz(n))),
        boxes: nodes.map((n) => { const b = rt.nodeBox(n); return [round3(b.left), round3(b.top), round3(b.right), round3(b.bottom)] }),
        paths,
        busTrunks: JSON.parse(JSON.stringify(rt.busTrunks(), (k, v) => (typeof v === "number" ? round3(v) : v))),
      }
    }
  }
  return out
}

const actual = compute()
if (update) {
  fs.writeFileSync(goldenPath, JSON.stringify(actual, null, 1))
  console.log(`✓ 已更新基准 golden.json（${Object.keys(actual).length} 个场景）`)
} else {
  if (!fs.existsSync(goldenPath)) { console.error("✗ 缺少 golden.json，先运行 --update 生成"); process.exit(1) }
  const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"))
  let fail = 0
  for (const key of new Set([...Object.keys(golden), ...Object.keys(actual)])) {
    const a = JSON.stringify(golden[key]), b = JSON.stringify(actual[key])
    if (a !== b) { fail++; console.error(`✗ 与基准不一致：${key}`) }
  }
  console.log(fail === 0 ? `✓ 布线回归通过：${Object.keys(actual).length} 个场景与基准一致` : `✗ ${fail} 个场景偏离基准（若是有意的算法改进，用 --update 重录）`)
  process.exit(fail ? 1 : 0)
}
