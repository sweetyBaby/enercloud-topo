// @enercloud/topology-runtime/rules 类型声明

export type SignalValue = string | number | boolean | null | undefined

export interface TopoCondLeaf {
  var?: string
  op?: string
  val?: unknown
  ref?: string
}
export interface TopoCondGroup {
  all?: TopoCond[]
  any?: TopoCond[]
  not?: TopoCond
}
export type TopoCond = TopoCondLeaf & TopoCondGroup

export interface RulesTopologyNode {
  id: string
  type: string
  data?: Array<{ key?: string | { zh?: string; en?: string }; value?: unknown }>
  visibleWhen?: TopoCond | null
  iconRules?: Array<{ when?: TopoCond; icon?: string }>
  [k: string]: unknown
}
export interface RulesTopologyEdge {
  from: string
  to: string
  dir?: string
  showWhen?: TopoCond | null
  dirRules?: Array<{ when?: TopoCond; dir: string }>
  [k: string]: unknown
}
export interface RulesTopology {
  nodes?: RulesTopologyNode[]
  edges?: RulesTopologyEdge[]
  signals?: Array<
    | { key?: { zh?: string; en?: string }; value?: unknown }
    | { name?: string; sample?: unknown }
  >
  sampleSignals?: Record<string, SignalValue>
  [k: string]: unknown
}

export interface ResolvedState {
  ctx: Record<string, SignalValue>
  nodes: Array<RulesTopologyNode & { visible: boolean; iconType: string }>
  edges: Array<RulesTopologyEdge & { visible: boolean; dir: string }>
}

/**
 * ⚠️ buildContext/resolveDynamic 面向**导出文档格式**（静态值在 f.value、信号键英文名优先）。
 * 前端 dashboard 的 rule-engine.ts 直接消费它们（2026-07-02 起语义已完全收敛）；
 * 编辑器内部画布是另一种形态（字段值在 f.dv），走 09-rules 自己的 collectSignals/buildCtx，勿混用。
 * evalCond/cmpOp 为纯条件树求值，各宿主通用。
 */
export function _num(x: unknown): number
export function _looseEq(a: unknown, b: unknown): boolean
export function _toList(rv: unknown): string[]
export function cmpOp(lv: SignalValue, op: string, rv: unknown): boolean
export function evalCond(cond: TopoCond | null | undefined | unknown, ctx: Record<string, SignalValue>): boolean

/** 计算绑定：多操作数「链式」计算/比较（左→右依次结合，无括号/优先级）。
 *  operands=[{field,deviceType?,deviceId?}|{const:值}...]，operators.length=operands-1，
 *  op ∈ + - * / % > >= < <= == !=（比较结果 1/0）；decimals=数值结果小数位(0~3,缺省2)。
 *  get(operand,i) 由宿主提供取值（读 ctx[主信号键+'@'+i]，常量直接取 const）；
 *  任一字段操作数无值或算术结果非有限数 → 返回 undefined（宿主保留静态默认）。 */
export function calcValue(
  calc: { operands: Array<{ field?: string; const?: unknown; [k: string]: unknown }>; operators?: string[]; decimals?: number } | null | undefined,
  get: (operand: { field?: string; const?: unknown; [k: string]: unknown }, i: number) => SignalValue,
): SignalValue
/** 计算绑定在导出文档格式上的落值：主信号 = calcValue(操作数信号 ctx[sig@i])；就地写入 ctx。
 *  buildContext 末尾自动调用——算不出（操作数缺值）时保留 ctx 里的静态默认/直推值。 */
export function applyCalcSignals(topology: RulesTopology, ctx: Record<string, SignalValue>): void
export function buildContext(topology: RulesTopology, signals?: Record<string, SignalValue> | null): Record<string, SignalValue>
export function resolveDynamic(topology: RulesTopology, signals?: Record<string, SignalValue> | null): ResolvedState
