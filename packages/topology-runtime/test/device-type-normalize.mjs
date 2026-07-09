// 回归护栏:后台设备归类必须以 archiveDeviceType 为准(2026-07 修复)。
// device-info.json 的原始 deviceType 字段不可靠(可能带 "Rack" 等字典外杂值),
// 若归类时 deviceType 优先,设备会落入 device-type.json(仅 BCU/EMS/PCS)之外的孤儿类型,
// 症状:BCU 实例下拉丢设备、项目下拉丢项目、字段字典级联查不到字段。
// 本测试从 01-core.js 抽出 loadBackendBindingData/devicesOfType/projectsOfType 原文执行把关。
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const topoRoot = path.resolve(here, "..", "..", "..")
const coreSrc = fs.readFileSync(path.join(topoRoot, "topo-editor", "topology-editor-01-core.js"), "utf8")

// 按函数名抽体(兼容 async function)
function extractFn(src, name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`)
  const mm = re.exec(src)
  if (!mm) return null
  let i = src.indexOf("{", mm.index)
  let depth = 0
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(mm.index, i + 1) }
  }
  return null
}

const parts = ["loadBackendBindingData", "devicesOfType", "projectsOfType"].map(n => {
  const s = extractFn(coreSrc, n)
  if (!s) { console.error(`✗ 01-core.js 中找不到 ${n}`); process.exit(1) }
  return s
})

// 夹具:p1 = 同项目两条 BCU,其中一条 deviceType 带杂值 "Rack"(即线上鄂尔多斯场景);
// p2 = 项目下唯一设备也带杂值(归类错时整个项目会从项目下拉消失);另有 delFlag=2 的已删设备。
const FIXTURE = {
  "device/device-type.json": [
    { dictValue: "BCU", dictLabel: "BCU", status: "0" },
    { dictValue: "EMS", dictLabel: "EMS", status: "0" },
    { dictValue: "PCS", dictLabel: "PCS", status: "0" },
  ],
  "device/device-info.json": [
    { deviceId: "d1", projectId: "p1", projectName: "鄂尔多斯", deviceName: "Rack01", deviceType: null,   archiveDeviceType: "BCU", delFlag: "0" },
    { deviceId: "d2", projectId: "p1", projectName: "鄂尔多斯", deviceName: "Rack02", deviceType: "Rack", archiveDeviceType: "BCU", delFlag: "0" },
    { deviceId: "d3", projectId: "p2", projectName: "单机站",   deviceName: "Rack01", deviceType: "Rack", archiveDeviceType: "BCU", delFlag: "0" },
    { deviceId: "d4", projectId: "p1", projectName: "鄂尔多斯", deviceName: "Rack99", deviceType: null,   archiveDeviceType: "BCU", delFlag: "2" },
  ],
  "dic/index.json": {},
}
const fetchStub = async (url) => ({ ok: url in FIXTURE, json: async () => FIXTURE[url] })

const harness = new Function("fetch", `
  let DEVICE_TYPES=[],DEVICE_LIST=[],DEVICE_DICTS={};
  ${parts.join("\n")}
  return { load: loadBackendBindingData, devicesOfType, projectsOfType, list: () => DEVICE_LIST };
`)(fetchStub)

await harness.load()

let fail = 0
const check = (ok, msg) => { if (ok) console.log(`  ✓ ${msg}`); else { fail++; console.error(`  ✗ ${msg}`) } }

const bcuP1 = harness.devicesOfType("BCU", "p1").map(d => d.deviceName).sort()
check(bcuP1.join(",") === "Rack01,Rack02", `devicesOfType('BCU','p1') 含杂值 deviceType 的设备:得到 [${bcuP1}]`)
check(harness.list().find(d => d.deviceId === "d2").deviceType === "BCU", "deviceType:'Rack'/archiveDeviceType:'BCU' 归一化为 BCU(archiveDeviceType 优先)")
check(harness.projectsOfType("BCU").some(p => p.id === "p2"), "唯一设备带杂值 deviceType 的项目仍出现在 projectsOfType('BCU')")
check(!harness.devicesOfType("BCU", "p1").some(d => d.deviceId === "d4"), "delFlag='2' 的已删设备被过滤")
check(harness.devicesOfType("Rack", "").length === 0, "字典外类型 'Rack' 下无孤儿设备")

console.log(fail === 0 ? "✓ 设备归类回归通过:archiveDeviceType 优先" : `✗ ${fail} 项失败`)
process.exit(fail ? 1 : 0)
