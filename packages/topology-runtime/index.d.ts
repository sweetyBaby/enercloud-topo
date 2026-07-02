// @enercloud/topology-runtime 类型声明（手写，随 topology-runtime.js 维护）

export type Pt = [number, number]

export interface TopoRuntimeNode {
  id: string
  type: string
  x: number
  y: number
  scale?: number
  sizeWorld?: number
  fontSize?: number
  labelZh?: string
  labelEn?: string
  label?: string
  [k: string]: unknown
}

export interface TopoRuntimeEdge {
  from: string
  to: string
  route?: string
  fromPort?: string
  toPort?: string
  et?: string
  dir?: string
  waypoints?: Pt[]
  orthoSnap?: boolean
  orthoDir?: string
  /** 布线器写入的内部字段 */
  _cacheKey?: string
  _sideFrom?: string
  _sideTo?: string
  _mergeSkipped?: boolean
  [k: string]: unknown
}

export interface NodeBoxRect {
  cx: number; cy: number; hw: number; hh: number
  left: number; right: number; top: number; bottom: number
}

export interface PortHit { name: string; point: Pt; dist: number }

export interface BusTrunk {
  horiz: boolean; x?: number; y?: number
  a: number; b: number; color: string
  joinPt: Pt; bkey: string; side: string
  _shared?: boolean
}

export interface TopoRuntimeConfig {
  busMergeGap?: number
  busAggregation?: boolean
  routeStyle?: number
  busOffsets?: Record<string, number>
  busShareTrunk?: boolean
  ET?: Record<string, { color: string; [k: string]: unknown }>
}

export interface TopoRuntimeEnv {
  /** 必填：节点数组（宿主持有，实时读取） */
  getNodes(): TopoRuntimeNode[]
  /** 必填：连线数组（宿主持有，实时读取） */
  getEdges(): TopoRuntimeEdge[]
  /** recomputeAllPaths 清除悬空连线时回写 */
  setEdges?(edges: TopoRuntimeEdge[]): void
  /** 仅 edgeAt 命中容差用，默认 1 */
  getZoom?(): number
  /** nodeLabel/dataKey 语言，默认 'zh' */
  getLang?(): 'zh' | 'en'
  /** 布线配置（缺省值与编辑器默认一致） */
  getConfig?(): TopoRuntimeConfig
  /** nsz 尺寸基准倍率：编辑器 = min(canvas.w,canvas.h)/zoom/600；前端 = 1（默认） */
  sizeUnit?(): number
  /** 前端整体图标缩放联动，默认 1 */
  nodeScale?(): number
  /** true=节点带 sizeWorld 时优先采用（前端消费运营端导出尺寸），默认 false */
  useSizeWorld?: boolean
  /** 障碍盒底部延伸用的世界坐标标签字号，默认 n.fontSize||14 */
  labelWorldFontPx?(n: TopoRuntimeNode): number
  /** 编辑器拖拽中只重算相关连线，默认 false */
  isDragging?(): boolean
  dragIds?(): Set<string>
}

export interface TopoRuntime {
  // ── 几何 / 端口 ──
  nodeLabel(n: TopoRuntimeNode): string
  dataKey(f: { key?: string; keyEn?: string }): string | undefined
  nsz(typeOrNode: string | TopoRuntimeNode): number
  nodeBox(n: TopoRuntimeNode): NodeBoxRect
  anchorPoint(n: TopoRuntimeNode, tx: number, ty: number): Pt
  clamp(v: number, min: number, max: number): number
  isLinearBusNode(n: TopoRuntimeNode | null | undefined): boolean
  linearBusSpan(n: TopoRuntimeNode): { y: number; left: number; right: number; cx: number }
  linearBusPort(n: TopoRuntimeNode, wx: number): PortHit
  nodePortPoint(n: TopoRuntimeNode, port: string | undefined): Pt | null
  nearestNodePort(n: TopoRuntimeNode, wx: number, wy: number): PortHit | null
  directionalNodePort(n: TopoRuntimeNode, wx: number, wy: number): PortHit
  edgeAnchorPoint(n: TopoRuntimeNode, tx: number, ty: number, port?: string): Pt
  portSide(port: string | undefined): 'L' | 'R' | 'T' | 'B' | null
  segRectHit(x1: number, y1: number, x2: number, y2: number, n: TopoRuntimeNode, pad: number): boolean
  pathHitsNodes(pts: Pt[], fromId: string, toId: string): boolean
  segBoxClip(p1: Pt, p2: Pt, box: NodeBoxRect): { tmin: number; tmax: number } | null
  ptInBox(p: Pt, box: NodeBoxRect): boolean
  clipEnds(pts: Pt[], a: TopoRuntimeNode, b: TopoRuntimeNode, e?: TopoRuntimeEdge): Pt[]
  sideOf(node: TopoRuntimeNode, other: TopoRuntimeNode): 'L' | 'R' | 'T' | 'B'
  approachSide(pt: Pt, box: NodeBoxRect): 'L' | 'R' | 'T' | 'B'
  // ── 布线 ──
  topoSig(): string
  invalidatePathCache(): void
  invalidateRouting(): void
  buildObstacleGrid(): Array<{ id: string; l: number; r: number; t: number; b: number }>
  ptInObstacle(x: number, y: number, obs: unknown[], exFrom: string, exTo: string): boolean
  segInObstacle(x1: number, y1: number, x2: number, y2: number, obs: unknown[], exFrom: string, exTo: string): boolean
  markOccupied(pts: Pt[]): void
  segOverlapPenalty(x1: number, y1: number, x2: number, y2: number): number
  routeOrtho(a: TopoRuntimeNode, b: TopoRuntimeNode, e: TopoRuntimeEdge): Pt[]
  orthogonalize(pts: Pt[]): Pt[]
  edgePathRaw(e: TopoRuntimeEdge): Pt[] | null
  channelRoute(): void
  alignJunctions(): void
  straightVariants(a: TopoRuntimeNode, b: TopoRuntimeNode, e: TopoRuntimeEdge): Pt[][]
  optimizeChannel(edgeCands: Record<string, unknown>): void
  buildCorridorVariants(e: TopoRuntimeEdge): Pt[][]
  recomputeAllPaths(): void
  detourRoute(a: TopoRuntimeNode, b: TopoRuntimeNode, e: TopoRuntimeEdge): Pt[]
  applyBusMerge(): void
  shareNearbyTrunks(): void
  dedupe(pts: Pt[]): Pt[]
  simplifyPath(pts: Pt[], fromId: string, toId: string): Pt[]
  computeSmartEdge(e: TopoRuntimeEdge): Pt[] | null
  edgePath(e: TopoRuntimeEdge): Pt[] | null
  edgeAt(wx: number, wy: number): TopoRuntimeEdge | null
  segsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean
  pathsCross(p1: Pt[], p2: Pt[]): boolean
  _pathLen(p: Pt[] | null): number
  _pathBends(p: Pt[] | null): number
  _pathDetourPenalty(p: Pt[] | null, a: TopoRuntimeNode, b: TopoRuntimeNode): number
  _pathScore(p: Pt[] | null, a: TopoRuntimeNode, b: TopoRuntimeNode): number
  _dedupCollinear(pts: Pt[]): Pt[]
  _countCross(): number
  // ── 状态访问（宿主绘制层用）──
  busTrunks(): BusTrunk[]
  cachedPath(e: TopoRuntimeEdge): Pt[] | null
}

export function createTopoRuntime(env: TopoRuntimeEnv): TopoRuntime
