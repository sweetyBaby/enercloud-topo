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
 * ⚠️ buildContext/resolveDynamic 面向导出文档格式（f.value / 英文键优先）。
 * 前端 dashboard 请勿直接使用它们——lib/topo/rule-engine.ts 的外壳保留了三处历史差异
 * （中文键、.status/.online、旧 signals 格式），直接换用会改变显隐判定。
 * evalCond/cmpOp 为纯条件树求值，各宿主通用。
 */
export function _num(x: unknown): number
export function _looseEq(a: unknown, b: unknown): boolean
export function _toList(rv: unknown): string[]
export function cmpOp(lv: SignalValue, op: string, rv: unknown): boolean
export function evalCond(cond: TopoCond | null | undefined | unknown, ctx: Record<string, SignalValue>): boolean
export function buildContext(topology: RulesTopology, signals?: Record<string, SignalValue> | null): Record<string, SignalValue>
export function resolveDynamic(topology: RulesTopology, signals?: Record<string, SignalValue> | null): ResolvedState
