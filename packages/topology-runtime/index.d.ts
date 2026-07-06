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
  /** 可选连线 id（标签绑定后台字段时生成；信号键=「id.标签英文名」，与节点 id 同一命名空间） */
  id?: string
  route?: string
  fromPort?: string
  toPort?: string
  et?: string
  dir?: string
  waypoints?: Pt[]
  orthoSnap?: boolean
  orthoDir?: string
  /** ── 连线标签（可拖拽/绑定后台字段/值字典转义/横竖走向/旋转缩放）── */
  /** 标签文字（中文；显示语言随 getLang 切换） */
  lbl?: string
  /** 标签英文文字；绑定后同时作信号键段 */
  lblEn?: string
  /** 后台绑定（导出字段名 labelBind）；显示值 = translateFieldValue({bind,dict}, 实时值) */
  lblBind?: { field: string; deviceType?: string; deviceId?: string }
  /** 值字典显式指定（导出字段名 labelDict）：undefined=自动匹配 applyTo；''=不转义；'xxx'=强制 */
  lblDict?: string
  /** 当前值（实时数据回写；导出字段名 labelValue） */
  lblVal?: unknown
  /** 拖拽偏移（屏幕像素；导出 labelOffset.x/y） */
  lblOx?: number
  lblOy?: number
  /** 旋转角(度，导出 labelRot)；缩放倍数(导出 labelScale) */
  lblRot?: number
  lblScale?: number
  /** 文字走向（导出 labelDir）：'auto'(缺省)=随标签所在线段方向；'h' 横排；'v' 竖排(基准旋转90°) */
  lblDir?: 'auto' | 'h' | 'v'
  /** 展示内容（导出 labelShow）：'value'(缺省)=只显示值；'name'=只显示标签名；'both'=「标签名: 值」。未绑定后台字段时一律只显示标签文字 */
  lblShow?: 'value' | 'name' | 'both'
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

/** 值字典条目：一个 code 码的中/英显示文案 */
export interface ValueDictItem {
  /** code 码（后台原始值；匹配时统一 String() 比较，数字/字符串均可） */
  code: string | number
  /** 中文文案 */
  zh?: string
  /** 英文文案（缺失时回退中文） */
  en?: string
}

/** 值字典：code 码 → 显示文案 的转义表（编辑器与前端渲染器共用） */
export interface ValueDict {
  /** 唯一键（dictType），字段/信号的 dict 属性引用它 */
  type: string
  /** 字典名（中文，仅管理界面显示） */
  name?: string
  nameEn?: string
  /** 自动匹配声明：绑定了这些后台字段的画布字段/信号自动应用本字典；field='location.field' */
  applyTo?: Array<{ deviceType?: string; field: string }>
  items?: ValueDictItem[]
}

/** 数据字段 / 全局信号（值字典解析用到的最小形状） */
export interface ValueDictField {
  key?: string
  keyEn?: string
  /** 当前值/默认值（可能是 code 码） */
  dv?: unknown
  /** 显式字典指定：undefined=自动匹配；''=强制不转义；'xxx'=强制用该字典 */
  dict?: string
  bind?: { field?: string; deviceType?: string; deviceId?: string }
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
  /** nodeLabel/dataKey/值字典转义 语言，默认 'zh' */
  getLang?(): 'zh' | 'en'
  /** 值字典注册表（code 码 → 中/英文案），默认 []。谁调用谁供数据：
   *  编辑器传「共享字典库 + 文档内嵌」合并结果；前端传导出 JSON 的 valueDicts 或自有后台字典（注入覆盖） */
  getValueDicts?(): ValueDict[]
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
  // ── 值字典（code → 中/英文案；展示层专用，规则引擎仍用原始 code）──
  /** 按 dictType 查字典对象；未注册返回 null */
  findValueDict(type: string | undefined): ValueDict | null
  /** 解析字段应用的字典：f.dict 显式（''=不转义）> f.bind 命中 applyTo > null。
   *  deviceType=bind「跟随节点」缺省时的兜底设备类型（编辑器传 nodeDeviceType(n)；前端可省略） */
  resolveValueDict(f: ValueDictField | null | undefined, deviceType?: string): ValueDict | null
  /** 查字典项文案（String() 匹配 code；当前语言，en 缺失回退 zh）；未命中返回 null */
  valueDictLabel(dictOrType: ValueDict | string, code: unknown): string | null
  /** 任意原始值 → 展示文案：命中字典则转义，否则原样字符串；null/'' 返回 '' */
  translateFieldValue(f: ValueDictField | null | undefined, v: unknown, deviceType?: string): string
  /** 字段当前值 f.dv 的展示文案（= translateFieldValue(f, f.dv, deviceType)） */
  fieldDisplayValue(f: ValueDictField | null | undefined, deviceType?: string): string
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
