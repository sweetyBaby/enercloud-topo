// 一致性护栏:元素库包导出的 RUNTIME_JS(topology-editor-10-library-export.js 里的模板字符串,
// 随导出 zip 分发给第三方渲染端)必须与 rules.js 的求值逻辑逐字一致——
// 否则"线上 = 编辑器预览"的承诺只对编辑器/前端成立,对用导出包的第三方失效。
// 改了 rules.js 求值逻辑 → 必须同步改 RUNTIME_JS 字符串,本测试机械把关。
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const topoRoot = path.resolve(here, "..", "..", "..")
const rulesSrc = fs.readFileSync(path.join(here, "..", "rules.js"), "utf8")
const exportSrc = fs.readFileSync(path.join(topoRoot, "topo-editor", "topology-editor-10-library-export.js"), "utf8")

// 取出 RUNTIME_JS 模板字符串内容
const m = /const RUNTIME_JS=`([\s\S]*?)`;/.exec(exportSrc)
if (!m) { console.error("✗ 10-library-export.js 中找不到 RUNTIME_JS 模板"); process.exit(1) }
const runtimeJs = m[1]

// 按函数名抽体并归一化(去注释/空白/export 前缀/var|const 差异)比较
const FNS = ["_num", "_looseEq", "_toList", "cmpOp", "evalCond", "calcValue", "applyCalcSignals", "buildContext", "resolveDynamic"]
function extractFn(src, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\(`)
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
const norm = (s) => s.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "")

let fail = 0
for (const name of FNS) {
  const a = extractFn(rulesSrc, name), b = extractFn(runtimeJs, name)
  if (!a || !b) { fail++; console.error(`✗ ${name}:${!a ? " rules.js 缺失" : ""}${!b ? " RUNTIME_JS 缺失" : ""}`); continue }
  if (norm(a) !== norm(b)) { fail++; console.error(`✗ ${name}: rules.js 与 RUNTIME_JS 不一致(改了求值逻辑要两处同步)`) }
}
console.log(fail === 0 ? `✓ 规则一致性通过:rules.js 与导出 RUNTIME_JS 的 ${FNS.length} 个函数逐字等义` : `✗ ${fail} 处不一致`)
process.exit(fail ? 1 : 0)
