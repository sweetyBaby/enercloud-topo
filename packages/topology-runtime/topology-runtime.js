/*!
 * @enercloud/topology-runtime —— 储能拓扑 headless 核心（几何 / 端口 / 正交布线）
 *
 * 单一事实源：编辑器（topo.html）与前端自研渲染器（v0-energy-system-dashboard 的
 * lib/topo/engine.ts）共同消费本文件，布线算法只在这里维护一份。
 *
 * 双形态加载（本文件是普通脚本 + CJS 尾巴，无需构建）：
 *   · 浏览器 <script src=".../topology-runtime.js"> → 得到全局 createTopoRuntime
 *   · Node / 打包器  require/import '@enercloud/topology-runtime' → { createTopoRuntime }
 *
 * 设计约束（改代码前必读）：
 *   1. 算法函数体与拆分前的 topo-editor/topology-editor-04/05/07 逐字一致，只把对
 *      宿主全局（nodes/edges/zoom/canvas/布线配置）的直接引用改为经 env 取用 ——
 *      每个函数只在开头加一行取用语句，函数体其余部分保持原文，便于回溯对照。
 *   2. 本文件不得出现任何 DOM / canvas 绘制 / 编辑器 UI 依赖（headless 红线）。
 *      唯一的视口耦合点是 nsz 的尺寸基准，已抽成 env.sizeUnit 钩子。
 *   3. 消费方定制（前端 nodeScale/sizeWorld/标签字号避让）一律走 env 钩子，
 *      不允许消费方 fork 或补丁本文件的函数体。
 *
 * env 契约（所有取值函数都是"活"的，每次运算实时读取宿主状态）：
 *   getNodes(): Node[]            必填。节点数组（宿主持有）
 *   getEdges(): Edge[]            必填。连线数组（宿主持有）
 *   setEdges(edges): void         选填。recomputeAllPaths 清除悬空连线时回写
 *   getZoom(): number             选填，默认 1。仅命中测试 edgeAt 用
 *   getLang(): 'zh'|'en'          选填，默认 'zh'。nodeLabel/dataKey/值字典转义 用
 *   getValueDicts(): ValueDict[]  选填，默认 []。值字典（code 码 → 中/英文案）注册表：
 *                                   [{type,name,nameEn,applyTo:[{deviceType,field}],items:[{code,zh,en}]}]
 *                                   编辑器传「共享字典库 + 文档内嵌」合并结果；前端传导出 JSON 的 valueDicts
 *                                   （或自有后台字典，谁调用谁供数据，天然支持注入覆盖）
 *   getConfig(): {                选填。布线配置（缺省值与编辑器默认一致）
 *     busMergeGap?, busAggregation?, routeStyle?, busOffsets?, busShareTrunk?, ET?
 *   }
 *   sizeUnit(): number            选填，默认 1。nsz 尺寸基准倍率：
 *                                   编辑器 = Math.min(canvas.width,canvas.height)/zoom/600
 *                                   前端   = 1（世界坐标直出，由 nodeScale 归一）
 *   nodeScale(): number           选填，默认 1。前端整体图标缩放联动
 *   useSizeWorld: boolean         选填，默认 false。true=节点带 sizeWorld 时优先采用
 *                                   （运营端导出的世界坐标尺寸；编辑器内部不消费）
 *   labelWorldFontPx(n): number   选填，默认 n.fontSize||14。障碍盒底部延伸用的
 *                                   "世界坐标标签字号"（前端传 labelFontPx(n)/zoom）
 *   isDragging(): boolean         选填，默认 false。编辑器拖拽中只重算相关连线
 *   dragIds(): Set<string>        选填。被拖拽节点 id 集合
 */
function createTopoRuntime(env) {
  if (!env || typeof env.getNodes !== 'function' || typeof env.getEdges !== 'function')
    throw new Error('createTopoRuntime: env.getNodes/getEdges 必填');
  const getNodes = env.getNodes;
  const getEdges = env.getEdges;
  const setEdges = env.setEdges || function () {};
  const getZoom = env.getZoom || function () { return 1; };
  const getLang = env.getLang || function () { return 'zh'; };
  const getValueDicts = env.getValueDicts || function () { return _EMPTY_ARR; };
  const getConfig = env.getConfig || function () { return {}; };
  const sizeUnit = env.sizeUnit || function () { return 1; };
  const nodeScaleF = env.nodeScale || function () { return 1; };
  const useSizeWorld = !!env.useSizeWorld;
  const labelWorldFontPx = env.labelWorldFontPx || function (n) { return n.fontSize || 14; };
  const isDragging = env.isDragging || function () { return false; };
  const dragIds = env.dragIds || function () { return _EMPTY_SET; };
  const _EMPTY_SET = new Set();
  const _EMPTY_ARR = [];
  let _warnedNoET = false;
  function cfg() {
    const c = getConfig() || {};
    if (c.ET == null && !_warnedNoET) {
      // 布线数值配置有"与编辑器默认一致"的缺省语义,但 ET(线型表)缺失只可能是宿主接线遗漏——
      // 汇流主干颜色会静默降级为默认色,这里可感知地提醒一次而不中断纯算法路径。
      _warnedNoET = true;
      if (typeof console !== 'undefined' && console.warn) console.warn('[topology-runtime] env.getConfig() 未提供 ET(线型表),母线主干将使用默认色');
    }
    return {
      busMergeGap: c.busMergeGap != null ? c.busMergeGap : 16,
      busAggregation: !!c.busAggregation,
      routeStyle: c.routeStyle != null ? c.routeStyle : 3,
      busOffsets: c.busOffsets || {},
      busShareTrunk: !!c.busShareTrunk,
      ET: c.ET || {},
    };
  }

  // ═════════ 几何 / 端口（原 topology-editor-04-geometry.js）═════════

  // 获取节点当前语言标签
  function nodeLabel(n){ const lang=getLang(); return lang==='en' ? (n.labelEn||n.labelZh||n.id) : (n.labelZh||n.label||n.id); }
  function dataKey(f){ const lang=getLang(); return lang==='en' ? (f.keyEn||f.key) : f.key; }

  // ═════════ 值字典（code 码 → 中/英显示文案；编辑器画布与前端渲染器共用的单一实现）═════════
  // 字典结构：{type, name, nameEn, applyTo:[{deviceType, field:'location.field'}], items:[{code, zh, en}]}
  // 解析优先级：字段显式 f.dict（''=强制不转义）> f.bind 命中某字典 applyTo（自动匹配）> 不转义。
  // 规则引擎不经过这里——signalValues 永远存原始 code，规则比较用 code；转义只发生在展示层。
  function findValueDict(type){
    if(!type)return null;
    const ds=getValueDicts()||[];
    for(let i=0;i<ds.length;i++){ if(ds[i]&&ds[i].type===type)return ds[i]; }
    return null;
  }
  // f=数据字段/全局信号；deviceType=bind「跟随节点」缺省时的兜底设备类型
  //   （编辑器传 nodeDeviceType(n)；前端可省略——导出 JSON 的 bind.deviceType 已显式写全）
  function resolveValueDict(f, deviceType){
    if(!f)return null;
    if(f.dict!==undefined&&f.dict!==null) return f.dict===''?null:findValueDict(f.dict);   // 显式指定：''=强制不转义
    const b=f.bind;
    if(!b||!b.field)return null;
    const dt=b.deviceType||deviceType||'';
    const ds=getValueDicts()||[];
    for(let i=0;i<ds.length;i++){
      const d=ds[i];
      if(!d||!Array.isArray(d.applyTo))continue;
      if(d.applyTo.some(a=>a&&a.field===b.field&&(a.deviceType||'')===dt))return d;
    }
    return null;
  }
  // 查字典项：String() 匹配（后台 code 可能是数字/字符串），命中返回当前语言文案（en 缺失回退 zh），未命中返回 null
  function valueDictLabel(dictOrType, code){
    const d=typeof dictOrType==='string'?findValueDict(dictOrType):dictOrType;
    if(!d||code==null||code==='')return null;
    const it=(d.items||[]).find(i=>i&&String(i.code)===String(code));
    if(!it)return null;
    const s=getLang()==='en'?(it.en||it.zh):(it.zh||it.en);
    return (s==null||s==='')?null:String(s);
  }
  // 任意原始值 → 展示文案：命中字典项则转义，否则原样返回（查不到不吞值）；null/空串返回 ''
  function translateFieldValue(f, v, deviceType){
    if(v==null||v==='')return '';
    const d=resolveValueDict(f, deviceType);
    if(!d)return String(v);
    const s=valueDictLabel(d, v);
    return s!=null?s:String(v);
  }
  // 字段当前值(f.dv)的展示文案（实时值已由宿主回写进 f.dv）
  function fieldDisplayValue(f, deviceType){ return translateFieldValue(f, f&&f.dv, deviceType); }

  // 节点绘制尺寸（世界坐标）。
  //   · sizeUnit：编辑器的视口自适应基准 (base/600)；前端恒为 1
  //   · useSizeWorld：前端优先消费运营端导出的 sizeWorld（保留各节点相对几何）
  //   · nodeScale：前端按拓扑归一化的整体缩放
  function nsz(typeOrNode){
    const type=typeof typeOrNode==='string'?typeOrNode:typeOrNode.type;
    const scale=typeof typeOrNode==='string'?1:(typeOrNode.scale||1);
    const sw=(useSizeWorld&&typeof typeOrNode==='object'&&typeOrNode.sizeWorld>0)?Number(typeOrNode.sizeWorld):0;
    const s=sw||{grid:80,pcs:66,bms:66,meter:56,meter2:60,load:66,solar:74,transformer:64,switch:60,generator:68,cabinet:64,highvolt:60,ems:64,aircon:60,fire:58,sensor:58,busbar:70,charger:60,h2_storage:64,
      // 开关元件：默认偏大，统一缩小为更紧凑的尺寸
      cb_closed:44,switch_open:44,disconnector:44,contactor:44,fuse:44,iso_g:44,lbs_g:44,disc_v_g:44,
      trunk_ac:70,trunk_dc:70,tie_line:66,
      anchor:26}[type]||62;
    return s*sizeUnit()*scale*nodeScaleF();
  }
  // 节点的视觉包围盒（图标实际绘制区域，中心略偏上）
  function nodeBox(n){
    const s=nsz(n);
    // 图标绘制 y 从 n.y - s*0.72 到 n.y + s*0.28，视觉中心在 n.y - s*0.22
    const cx=n.x, cy=n.y - s*0.22;
    const hw=s*0.50, hh=s*0.50;
    return {cx,cy,hw,hh,left:cx-hw,right:cx+hw,top:cy-hh,bottom:cy+hh};
  }
  function isLinearBusNode(n){
    return !!(n&&['busbar','trunk_ac','trunk_dc','tie_line'].includes(n.type));
  }
  // 标注类元素（文本框/变量/占位点）不参与连线避障：它们本就常被贴近连线/设备放置，
  // 且 text/variable 的真实包围盒由编辑器动态测量（_textBox），runtime 的估算盒并不准。
  // 占位点作为连线端点/汇合点时不受影响（避障检测本就排除 from/to）。
  function isRouteObstacle(n){ return !!n && n.type!=='text' && n.type!=='variable' && n.type!=='anchor'; }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function linearBusSpan(n){
    const b=nodeBox(n), s=nsz(n);
    // 母线/主干线图标主体是横向线段，不是完整方盒；连接点应落在线段上。
    const half=s*0.42;
    return {y:b.cy,left:b.cx-half,right:b.cx+half,cx:b.cx};
  }
  function linearBusPort(n, wx){
    const sp=linearBusSpan(n);
    const x=clamp(wx,sp.left,sp.right);
    const ratio=(sp.right===sp.left)?0.5:(x-sp.left)/(sp.right-sp.left);
    return {name:'line:'+ratio.toFixed(3),point:[x,sp.y],dist:0};
  }
  function nodePortPoint(n, port){
    const b=nodeBox(n);
    if(n.type==='anchor')return port?[b.cx,b.cy]:null;   // 占位点：任何端口都是中心（多条线交于同一点，不贴盒边）
    if(isLinearBusNode(n)){
      if(typeof port==='string'&&port.startsWith('line:')){
        const sp=linearBusSpan(n), r=clamp(parseFloat(port.slice(5)),0,1);
        return [sp.left+(sp.right-sp.left)*(isFinite(r)?r:0.5),sp.y];
      }
      if(port==='left'||port==='right'||port==='top'||port==='bottom'||port==='center'){
        const sp=linearBusSpan(n);
        if(port==='left')return [sp.left,sp.y];
        if(port==='right')return [sp.right,sp.y];
        return [sp.cx,sp.y];
      }
    }
    switch(port){
      case 'top': return [b.cx,b.top];
      case 'right': return [b.right,b.cy];
      case 'bottom': return [b.cx,b.bottom];
      case 'left': return [b.left,b.cy];
      case 'center': return [b.cx,b.cy];
      default: return null;
    }
  }
  function nearestNodePort(n, wx, wy){
    if(isLinearBusNode(n)){
      const p=linearBusPort(n,wx);
      p.dist=Math.hypot(wx-p.point[0],wy-p.point[1]);
      return p;
    }
    const ports=['top','right','bottom','left'];
    let best=null,bd=Infinity;
    ports.forEach(name=>{
      const p=nodePortPoint(n,name);
      const d=Math.hypot(wx-p[0],wy-p[1]);
      if(d<bd){bd=d;best={name,point:p,dist:d};}
    });
    return best;
  }
  function directionalNodePort(n, wx, wy){
    if(isLinearBusNode(n))return linearBusPort(n,wx);
    const b=nodeBox(n);
    const dx=wx-b.cx,dy=wy-b.cy,adx=Math.abs(dx),ady=Math.abs(dy);
    if(ady>adx*0.8)return {name:dy<0?'top':'bottom',point:nodePortPoint(n,dy<0?'top':'bottom'),dist:0};
    if(adx>ady*0.8)return {name:dx<0?'left':'right',point:nodePortPoint(n,dx<0?'left':'right'),dist:0};
    return nearestNodePort(n,wx,wy);
  }
  // 从节点视觉中心朝目标方向，求与包围盒边界的交点（连线起止贴边，不进图标内部）
  function anchorPoint(n, tx, ty){
    const bx=nodeBox(n);
    const dx=tx-bx.cx, dy=ty-bx.cy;
    if(dx===0&&dy===0) return [bx.cx,bx.cy];
    const sx=dx===0?Infinity:bx.hw/Math.abs(dx);
    const sy=dy===0?Infinity:bx.hh/Math.abs(dy);
    const t=Math.min(sx,sy);
    return [bx.cx+dx*t, bx.cy+dy*t];
  }
  function edgeAnchorPoint(n, tx, ty, port){
    if(n.type==='anchor'){const b=nodeBox(n);return [b.cx,b.cy];}   // 占位点：连线端点落中心（T 型汇合交于一点）
    const explicit=nodePortPoint(n,port);
    if(explicit)return explicit;
    const inferred=directionalNodePort(n,tx,ty);
    return inferred?inferred.point:anchorPoint(n,tx,ty);
  }
  // 矩形与线段是否相交（用于碰撞检测，基于视觉盒）
  function segRectHit(x1,y1,x2,y2,n,pad){
    const bx=nodeBox(n);
    const minX=bx.left-pad, maxX=bx.right+pad, minY=bx.top-pad, maxY=bx.bottom+pad;
    function inside(x,y){return x>=minX&&x<=maxX&&y>=minY&&y<=maxY;}
    if(inside(x1,y1)||inside(x2,y2)) return true;
    function segSeg(ax,ay,bx2,by,cx,cy,dx,dy){
      const d=(bx2-ax)*(dy-cy)-(by-ay)*(dx-cx);if(Math.abs(d)<1e-9)return false;
      const t=((cx-ax)*(dy-cy)-(cy-ay)*(dx-cx))/d;
      const u=((cx-ax)*(by-ay)-(cy-ay)*(bx2-ax))/d;
      return t>=0&&t<=1&&u>=0&&u<=1;
    }
    return segSeg(x1,y1,x2,y2,minX,minY,maxX,minY)||segSeg(x1,y1,x2,y2,maxX,minY,maxX,maxY)||
           segSeg(x1,y1,x2,y2,maxX,maxY,minX,maxY)||segSeg(x1,y1,x2,y2,minX,maxY,minX,minY);
  }
  // 路径是否穿过其他节点
  function pathHitsNodes(pts, fromId, toId){
    const nodes=getNodes();
    for(const n of nodes){
      if(n.id===fromId||n.id===toId) continue;
      if(!isRouteObstacle(n)) continue;   // 标注类元素不算障碍：贴线放置不再把直线顶成折线
      for(let i=0;i<pts.length-1;i++)
        if(segRectHit(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],n,6)) return true;
    }
    return false;
  }
  // 线段与轴对齐矩形求交（返回离 p1 最近的交点参数 t，无交返回 null）
  function segBoxClip(p1,p2,box){
    const x1=p1[0],y1=p1[1],x2=p2[0],y2=p2[1];
    const dx=x2-x1,dy=y2-y1;
    let tmin=0,tmax=1;
    const edges=[[-dx,x1-box.left],[dx,box.right-x1],[-dy,y1-box.top],[dy,box.bottom-y1]];
    for(const[p,q]of edges){
      if(Math.abs(p)<1e-9){ if(q<0)return null; }
      else{ const t=q/p; if(p<0){ if(t>tmax)return null; if(t>tmin)tmin=t; } else { if(t<tmin)return null; if(t<tmax)tmax=t; } }
    }
    return {tmin,tmax};
  }
  function ptInBox(p,box){ return p[0]>=box.left&&p[0]<=box.right&&p[1]>=box.top&&p[1]<=box.bottom; }
  // 把折线两端裁剪到节点视觉盒边界（彻底移除盒内点，连线只到设备边缘）
  function clipEnds(pts,a,b,e){
    const ba=nodeBox(a), bb=nodeBox(b);
    pts=pts.map(p=>p.slice());
    // ── 头部：找路径离开 a 盒的那一段，在盒边界处截断（沿该段方向，保持轴对齐）──
    let hi=0;
    while(hi<pts.length-1 && ptInBox(pts[hi+1],ba)) hi++;
    // pts[hi] 在盒内或盒上, pts[hi+1] 在盒外
    if(hi<pts.length-1){
      const p=pts[hi],q=pts[hi+1];
      const r=segBoxClip(p,q,ba);
      let cp=p;
      if(r){ const t=r.tmax; cp=[p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t]; }
      pts=pts.slice(hi); pts[0]=cp;
    }
    // ── 尾部：同理 ──
    let ti=pts.length-1;
    while(ti>0 && ptInBox(pts[ti-1],bb)) ti--;
    if(ti>0){
      const p=pts[ti],q=pts[ti-1];
      const r=segBoxClip(p,q,bb);
      let cp=p;
      if(r){ const t=r.tmax; cp=[p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t]; }
      pts=pts.slice(0,ti+1); pts[pts.length-1]=cp;
    }
    if(pts.length>=2){
      pts[0]=edgeAnchorPoint(a,pts[1][0],pts[1][1],e&&e.fromPort);
      pts[pts.length-1]=edgeAnchorPoint(b,pts[pts.length-2][0],pts[pts.length-2][1],e&&e.toPort);
    }
    // ── 兜底：若首/尾段仍是斜的，插入拐点矫正为 L ──
    if(pts.length>=2){
      const p0=pts[0],p1=pts[1];
      if(Math.abs(p0[0]-p1[0])>0.5&&Math.abs(p0[1]-p1[1])>0.5)
        pts.splice(1,0,[p1[0],p0[1]]);
    }
    if(pts.length>=2){
      const i=pts.length-1,q0=pts[i],q1=pts[i-1];
      if(Math.abs(q0[0]-q1[0])>0.5&&Math.abs(q0[1]-q1[1])>0.5)
        pts.splice(i,0,[q1[0],q0[1]]);
    }
    return pts;
  }

  // ═════════ 正交网格 A* 路由（原 topology-editor-05-routing.js）═════════
  // 绕开节点障碍 + 惩罚与已有连线交叉
  let _pathCache={}, _pathCacheSig='', _busTrunks=[];
  function topoSig(){
    const nodes=getNodes(), edges=getEdges();
    // 拓扑签名：节点位置 + 边连接，变化时缓存失效。
    // 非障碍且未被任何边引用的标注节点（文本框/变量/游离占位点）不影响布线 → 不计入签名，
    // 挪动它们不再触发全局重路由（消除“挪个文本，别的线跟着变形”的抖动）
    const linked=new Set(); edges.forEach(e=>{linked.add(e.from);linked.add(e.to);});
    return nodes.filter(n=>isRouteObstacle(n)||linked.has(n.id)).map(n=>n.id+':'+Math.round(n.x)+','+Math.round(n.y)+':'+n.type).join('|')+'##'+
           edges.map(e=>e.from+'>'+e.to+':'+(e.route||'')+':'+(e.fromPort||'')+'>'+(e.toPort||'')).join('|');
  }
  function invalidatePathCache(){ _pathCache={}; }
  // 强制下次 edgePath 整体重算（等价旧编辑器的 _pathCacheSig=''：只重置签名，
  // 不清缓存 —— 重算前旧路径仍可读，避免拖拽间隙读到空路径）
  function invalidateRouting(){ _pathCacheSig=''; }
  function buildObstacleGrid(){
    const nodes=getNodes();
    // 收集节点视觉盒作为障碍（标注类元素除外）；底部延伸覆盖图标底边下方的标签区域
    return nodes.filter(isRouteObstacle).map(n=>{
      const b=nodeBox(n);
      const s=nsz(n);
      const lfs=labelWorldFontPx(n);
      // 标签位于图标底边(n.y+0.28s)之下，覆盖到标签底部
      const labelBottom=(n.y + s*0.28) + lfs*1.4;
      return {id:n.id,l:b.left-14,r:b.right+14,t:b.top-14,b:Math.max(b.bottom+14,labelBottom)};
    });
  }
  function ptInObstacle(x,y,obs,exFrom,exTo){
    for(const o of obs){ if(o.id===exFrom||o.id===exTo)continue; if(x>=o.l&&x<=o.r&&y>=o.t&&y<=o.b)return true; }
    return false;
  }
  function segInObstacle(x1,y1,x2,y2,obs,exFrom,exTo){
    const steps=Math.max(2,Math.ceil(Math.hypot(x2-x1,y2-y1)/10));
    for(let i=0;i<=steps;i++){const x=x1+(x2-x1)*i/steps,y=y1+(y2-y1)*i/steps;if(ptInObstacle(x,y,obs,exFrom,exTo))return true;}
    return false;
  }
  // 已占用点集（让后续连线避开已有连线,减少重叠/交叉）。
  // 注意:markOccupied 自上游单体时代起就没有任何调用方接线,_occPts 只在
  // recomputeAllPaths 里被重置 —— 因此 segOverlapPenalty 目前恒为 0(routeOrtho 的
  // overlap 惩罚是空转)。保留导出以维持上游 API 面;真正接线属于上游算法决策。
  let _occPts=new Set();
  function ptKey(x,y){return Math.round(x/6)+','+Math.round(y/6);}
  function markOccupied(pts){
    for(let i=0;i<pts.length-1;i++){
      const[x1,y1]=pts[i],[x2,y2]=pts[i+1];
      const steps=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/6));
      for(let s=0;s<=steps;s++){const x=x1+(x2-x1)*s/steps,y=y1+(y2-y1)*s/steps;_occPts.add(ptKey(x,y));}
    }
  }
  function segOverlapPenalty(x1,y1,x2,y2){
    const steps=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/6));
    let hits=0;
    for(let s=0;s<=steps;s++){const x=x1+(x2-x1)*s/steps,y=y1+(y2-y1)*s/steps;if(_occPts.has(ptKey(x,y)))hits++;}
    return hits*400; // 与已有连线交叉/重叠的强惩罚
  }
  // 正交路由：加密网格（节点边界 + 多条中间车道）+ A*，强避让
  function routeOrtho(a,b,e){
    const nodes=getNodes();
    const ba=nodeBox(a), bb=nodeBox(b);
    const sp=edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort), tp=edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort);
    const obs=buildObstacleGrid();
    const GAP=20;
    const xsSet=new Set(),ysSet=new Set();
    xsSet.add(sp[0]);xsSet.add(tp[0]);ysSet.add(sp[1]);ysSet.add(tp[1]);
    obs.forEach(o=>{xsSet.add(o.l-GAP);xsSet.add(o.r+GAP);ysSet.add(o.t-GAP);ysSet.add(o.b+GAP);});
    // 在起止之间加入多条中间车道，给并行连线更多分流空间
    const lo_x=Math.min(sp[0],tp[0]),hi_x=Math.max(sp[0],tp[0]);
    const lo_y=Math.min(sp[1],tp[1]),hi_y=Math.max(sp[1],tp[1]);
    for(let k=1;k<=3;k++){
      xsSet.add(lo_x+(hi_x-lo_x)*k/4);
      ysSet.add(lo_y+(hi_y-lo_y)*k/4);
    }
    // 额外的全局车道线（基于所有节点的间隙中点）
    const allX=nodes.map(n=>nodeBox(n).cx).sort((p,q)=>p-q);
    const allY=nodes.map(n=>nodeBox(n).cy).sort((p,q)=>p-q);
    for(let i=0;i<allX.length-1;i++)xsSet.add((allX[i]+allX[i+1])/2);
    for(let i=0;i<allY.length-1;i++)ysSet.add((allY[i]+allY[i+1])/2);
    const xs=[...xsSet].sort((p,q)=>p-q), ys=[...ysSet].sort((p,q)=>p-q);
    const xi=new Map(xs.map((v,i)=>[v,i])), yi=new Map(ys.map((v,i)=>[v,i]));
    const W=xs.length,H=ys.length;
    const sx=xi.get(sp[0]),sy=yi.get(sp[1]),tx=xi.get(tp[0]),ty=yi.get(tp[1]);
    function key(ix,iy){return ix*2000+iy;}
    const open=[{ix:sx,iy:sy,g:0,f:0,dir:-1,prev:null}];
    const seen=new Map();
    let goal=null,iter=0;
    while(open.length&&iter++<12000){
      open.sort((p,q)=>p.f-q.f);
      const cur=open.shift();
      if(cur.ix===tx&&cur.iy===ty){goal=cur;break;}
      const k=key(cur.ix,cur.iy);
      if(seen.has(k)&&seen.get(k)<=cur.g)continue;
      seen.set(k,cur.g);
      const moves=[[1,0,0],[-1,0,0],[0,1,1],[0,-1,1]];
      for(const[dx,dy,axis]of moves){
        const nx=cur.ix+dx,ny=cur.iy+dy;
        if(nx<0||nx>=W||ny<0||ny>=H)continue;
        const x1=xs[cur.ix],y1=ys[cur.iy],x2=xs[nx],y2=ys[ny];
        if(segInObstacle(x1,y1,x2,y2,obs,e.from,e.to))continue;
        const segLen=Math.abs(x2-x1)+Math.abs(y2-y1);
        const turn=(cur.dir!==-1&&cur.dir!==axis)?30:0;
        const overlap=segOverlapPenalty(x1,y1,x2,y2);
        const ng=cur.g+segLen+turn+overlap;
        const h=Math.abs(xs[tx]-x2)+Math.abs(ys[ty]-y2);
        open.push({ix:nx,iy:ny,g:ng,f:ng+h,dir:axis,prev:cur});
      }
    }
    if(!goal){
      const mx=(sp[0]+tp[0])/2;
      return [sp,[mx,sp[1]],[mx,tp[1]],tp];
    }
    const path=[];let c=goal;while(c){path.unshift([xs[c.ix],ys[c.iy]]);c=c.prev;}
    const merged=[path[0]];
    for(let i=1;i<path.length-1;i++){
      const[px,py]=merged[merged.length-1],[cx,cy]=path[i],[nx,ny]=path[i+1];
      const col=(px===cx&&cx===nx)||(py===cy&&cy===ny);
      if(!col)merged.push(path[i]);
    }
    merged.push(path[path.length-1]);
    return merged;
  }
  // 把折线强制为正交（横平竖直）：相邻两点若是斜线，插入一个直角拐点
  function orthogonalize(pts){
    if(pts.length<2)return pts;
    const out=[pts[0].slice()];
    for(let i=1;i<pts.length;i++){
      const prev=out[out.length-1], cur=pts[i].slice();
      const dx=Math.abs(cur[0]-prev[0]), dy=Math.abs(cur[1]-prev[1]);
      if(dx>0.5&&dy>0.5){
        // 斜线 → 插入直角拐点。最后一段优先竖直进入（更自然），其余水平优先
        const last=(i===pts.length-1);
        if(last) out.push([cur[0],prev[1]]);   // 先水平再竖直到终点
        else     out.push([cur[0],prev[1]]);   // 先水平再竖直
      }
      out.push(cur);
    }
    // 合并共线冗余点
    const merged=[out[0]];
    for(let i=1;i<out.length-1;i++){
      const p=merged[merged.length-1],c=out[i],n=out[i+1];
      const col=(p[0]===c[0]&&c[0]===n[0])||(p[1]===c[1]&&c[1]===n[1]);
      if(!col)merged.push(c);
    }
    merged.push(out[out.length-1]);
    return merged;
  }
  function edgePathRaw(e){
    const nodes=getNodes(), edges=getEdges();
    const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);if(!a||!b)return null;
    const ba=nodeBox(a), bb=nodeBox(b);
    const route=e.route||'straight';
    if(route==='manual' && e.waypoints && e.waypoints.length>0){
      // 手动拐点：起点→各拐点→终点，端点裁剪到设备边缘
      let pts=[[a.x,ba.cy], ...e.waypoints.map(p=>p.slice()), [b.x,bb.cy]];
      pts[0]=edgeAnchorPoint(a, pts[1][0], pts[1][1], e.fromPort);
      pts[pts.length-1]=edgeAnchorPoint(b, pts[pts.length-2][0], pts[pts.length-2][1], e.toPort);
      // 强制正交：在非横平竖直的段之间插入直角拐点
      if(e.orthoSnap!==false){ pts=orthogonalize(pts); }
      return pts;
    }
    if(route==='arc'){
      const p0=edgeAnchorPoint(a, bb.cx, bb.cy, e.fromPort);
      const p1=edgeAnchorPoint(b, ba.cx, ba.cy, e.toPort);
      const mx=(p0[0]+p1[0])/2, my=(p0[1]+p1[1])/2;
      const dx=p1[0]-p0[0], dy=p1[1]-p0[1], len=Math.hypot(dx,dy)||1;
      const sib=edges.filter(x=>x.from===e.from); const idx=sib.indexOf(e);
      const bow=(40+idx*18)*((idx%2)?-1:1);
      const cx=mx-dy/len*bow, cy=my+dx/len*bow;
      const pts=[];
      for(let t=0;t<=1.001;t+=0.1){
        const x=(1-t)*(1-t)*p0[0]+2*(1-t)*t*cx+t*t*p1[0];
        const y=(1-t)*(1-t)*p0[1]+2*(1-t)*t*cy+t*t*p1[1];
        pts.push([x,y]);
      }
      return pts;
    }
    if(route==='ortho'){
      let pts;
      try{ pts=routeOrtho(a,b,e); }catch(err){ pts=null; }
      let cl = pts?clipEnds(pts,a,b,e):null;
      if(!cl || pathHitsNodes(cl,e.from,e.to)) cl=detourRoute(a,b,e);
      return cl;
    }
    if(route==='lshape'){
      // 简单 L 型：按 orthoDir 选择先横后竖或先竖后横（用于消除交叉，方向可切换）
      const p0=edgeAnchorPoint(a, bb.cx, bb.cy, e.fromPort);
      const p1=edgeAnchorPoint(b, ba.cx, ba.cy, e.toPort);
      let pts;
      if(e.orthoDir==='vh') pts=[p0,[p0[0],p1[1]],p1];
      else pts=[p0,[p1[0],p0[1]],p1];
      // 若该 L 穿设备，退回保底避障路由
      if(pathHitsNodes(pts,e.from,e.to)){
        pts=detourRoute(a,b,e);
        return pts;
      }
      return clipEnds(pts,a,b,e);
    }
    if(route==='line'){
      // 纯直线：起止锚点直连，始终保持为一条直线（不横平竖直、不自动避障、不汇流）
      return [edgeAnchorPoint(a, bb.cx, bb.cy, e.fromPort), edgeAnchorPoint(b, ba.cx, ba.cy, e.toPort)];
    }
    // 直线：动态锚点（随节点位置自适应）
    const p0=edgeAnchorPoint(a, bb.cx, bb.cy, e.fromPort);
    const p1=edgeAnchorPoint(b, ba.cx, ba.cy, e.toPort);
    // 若直线穿过其他设备，自动改用避障路由（默认直线·遇障碍转L）
    if(pathHitsNodes([p0,p1], e.from, e.to)){
      let pts;
      try{ pts=routeOrtho(a,b,e); }catch(err){ pts=null; }
      let cl = pts?clipEnds(pts,a,b,e):null;
      if(!cl || pathHitsNodes(cl,e.from,e.to)) cl=detourRoute(a,b,e);
      return cl;
    }
    return [p0,p1];
  }
  // ═══════════════════════════════════════════════════════════════
  // 确定性通道布线引擎（v67）
  // 一次性计算所有连线路径：同侧必汇合、横平竖直、不穿设备、不交叉、无断线、最少拐点
  // ═══════════════════════════════════════════════════════════════
  function sideOf(node, other){
    // 对端相对本节点的主方位
    const dx=other.x-node.x, dy=other.y-node.y;
    return (Math.abs(dx)>=Math.abs(dy)) ? (dx<0?'L':'R') : (dy<0?'T':'B');
  }
  function portSide(port){return {left:'L',right:'R',top:'T',bottom:'B'}[port]||null;}
  function channelRoute(){
    const nodes=getNodes(), edges=getEdges();
    const {busMergeGap,busAggregation,routeStyle}=cfg();
    _pathCache={};
    // 1) 每个节点：按侧分组其所有连线
    const sideMap={}; // nodeId -> {L:[edge..],R:[],T:[],B:[]}
    nodes.forEach(n=>sideMap[n.id]={L:[],R:[],T:[],B:[]});
    edges.forEach(e=>{
      const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
      if(!a||!b)return;
      e._sideFrom=portSide(e.fromPort)||sideOf(a,b);
      e._sideTo=portSide(e.toPort)||sideOf(b,a);
      sideMap[a.id][e._sideFrom].push(e);
      sideMap[b.id][e._sideTo].push(e);
    });
    // 2) 每个节点每侧分配一条主干通道（trunk）+ 统一汇流接入点（join）
    //    join 固定在该侧边缘中点；trunk 在该侧外延 gap 处
    const trunkInfo={}; // key node|side -> {trunkC, horiz, join}
    nodes.forEach(n=>{
      const box=nodeBox(n);
      ['L','R','T','B'].forEach(side=>{
        const arr=sideMap[n.id][side];
        if(arr.length===0)return;
        const gap=busMergeGap+Math.max(box.hw,box.hh);
        let trunkC, horiz, join;
        if(side==='L'){trunkC=box.left-gap;horiz=false;join=[box.left,box.cy];}
        else if(side==='R'){trunkC=box.right+gap;horiz=false;join=[box.right,box.cy];}
        else if(side==='T'){trunkC=box.top-gap;horiz=true;join=[box.cx,box.top];}
        else {trunkC=box.bottom+gap;horiz=true;join=[box.cx,box.bottom];}
        trunkInfo[n.id+'|'+side]={trunkC,horiz,join,box};
      });
    });
    // 3) 逐条连线生成路径（默认用「合并版」：强制经过共享主干点，使同侧完全合并成一条主干）
    const edgeCands={}; // cacheKey -> {merged, natural, variants:[...]}
    edges.forEach((e,i)=>{
      const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
      e._cacheKey=e.from+'>'+e.to+':'+i;
      if(!a||!b){_pathCache[e._cacheKey]=null;return;}
      const ba=nodeBox(a), bb=nodeBox(b);
      // 手动/弧线：按各自规则直接出图，不进入布线优化。
      if(e.route==='manual' || e.route==='arc' || e.route==='line'){ _pathCache[e._cacheKey]=edgePathRaw(e); return; }
      // 默认「智能最短」：能直连就直连，否则最短 L/Z（避开设备），再做交叉消除。
      if(!busAggregation){
        const vs=straightVariants(a,b,e);
        _pathCache[e._cacheKey]=vs[0]||edgePathRaw(e);
        edgeCands[e._cacheKey]={straight:true, variants:vs};
        return;
      }
      // 「母线汇流」模式：同侧多条连线合并到共享主干（竖直/水平母干）再接入对端。

      const tf=trunkInfo[a.id+'|'+e._sideFrom];
      const tt=trunkInfo[b.id+'|'+e._sideTo];
      const fJoin=isLinearBusNode(a)?edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort):tf.join.slice();
      const tJoin=isLinearBusNode(b)?edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort):tt.join.slice();
      // 直连快速通道
      const aligned = Math.abs(ba.cx-bb.cx)<14 || Math.abs(ba.cy-bb.cy)<14;
      if(routeStyle!==1 && aligned){
        const p0=edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort), p1=edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort);
        if(!pathHitsNodes([p0,p1],e.from,e.to)){ _pathCache[e._cacheKey]=[p0,p1]; edgeCands[e._cacheKey]=null; return; }
      }
      const fTrunkPt = tf.horiz ? [fJoin[0], tf.trunkC] : [tf.trunkC, fJoin[1]];
      const tTrunkPt = tt.horiz ? [tJoin[0], tt.trunkC] : [tt.trunkC, tJoin[1]];
      const safe=(p)=>{ if(!pathHitsNodes(p,e.from,e.to))return simplifyPath(p,e.from,e.to);
        let pts; try{ pts=routeOrtho(a,b,e); }catch(err){ pts=null; }
        let cl=pts?clipEnds(pts,a,b,e):null; if(!cl||pathHitsNodes(cl,e.from,e.to)) cl=detourRoute(a,b,e); return cl; };
      // 合并版：fJoin → fTrunkPt →(沿 to 主干法线收拢)→ tTrunkPt(共享) → tJoin
      let mPath=[fJoin, fTrunkPt];
      if(Math.abs(fTrunkPt[0]-tTrunkPt[0])>1 && Math.abs(fTrunkPt[1]-tTrunkPt[1])>1){
        const midX = tt.horiz ? fTrunkPt[0] : tTrunkPt[0];
        const midY = tt.horiz ? tTrunkPt[1] : fTrunkPt[1];
        mPath.push([midX,midY]);
      }
      mPath.push(tTrunkPt, tJoin);
      const merged=safe(dedupe(mPath));
      // 自然版：v67 走廊（交叉更少，但末段不一定重叠）
      let nPath=[fJoin, fTrunkPt];
      if(Math.abs(fTrunkPt[0]-tTrunkPt[0])>1 && Math.abs(fTrunkPt[1]-tTrunkPt[1])>1){
        const midX = tf.horiz ? tTrunkPt[0] : fTrunkPt[0];
        const midY = tf.horiz ? fTrunkPt[1] : tTrunkPt[1];
        nPath.push([midX,midY]);
      }
      nPath.push(tTrunkPt, tJoin);
      const natural=safe(dedupe(nPath));
      edgeCands[e._cacheKey]={merged, natural, fJoin, tJoin, tTrunkPt};
      _pathCache[e._cacheKey]=merged; // 默认优先合并
    });
    // 4) 合并优先 + 交叉消除：对造成交叉的边，依次尝试 自然版/走廊变体，取交叉最少
    optimizeChannel(edgeCands);
    // 5) 拐点汇合对齐：把相近的拐点(竖直/水平方向)对齐到同一通道并合并为共享节点，减少多余拐点、更整齐
    alignJunctions();
  }
  // 拐点汇合：把所有正交连线的拐点按"竖直段同列、水平段同行"约束聚类，
  // 相近的通道(阈值内)对齐到同一坐标 → 平行段并入同一条线、相近拐点合并为一个汇合点；
  // 端点(贴节点的锚点)与斜线不动，保证不破坏正交与连接。
  function alignJunctions(){
    const edges=getEdges();
    const T=40; // 汇合/对齐阈值（世界坐标）——足够大以便"对齐后微小偏差也自动汇合为同一通道/拐点，两条近平行线并为一条"；
                // 不同设备的主干间距(≈节点间距 sRef*2.5 ≈ 280)远大于此值，故不会误并相邻独立主干
    const verts=[]; const paths=[];
    edges.forEach(e=>{ const p=_pathCache[e._cacheKey];
      if(!p||p.length<3||e.route==='arc'||e.route==='manual'||e.route==='line') return; // 仅自动正交路径
      const base=verts.length;
      p.forEach((pt,i)=>verts.push({x:pt[0],y:pt[1],anchored:(i===0||i===p.length-1)}));
      paths.push({key:e._cacheKey,base,len:p.length});
    });
    if(verts.length<2)return;
    const px=verts.map((_,i)=>i), py=verts.map((_,i)=>i);
    const fx=a=>{while(px[a]!==a)a=px[a]=px[px[a]];return a;};
    const fy=a=>{while(py[a]!==a)a=py[a]=py[py[a]];return a;};
    // 段方向约束：竖直段两端必须同 X；水平段两端必须同 Y；斜线段两端锚定不动
    paths.forEach(pa=>{ for(let i=0;i<pa.len-1;i++){ const a=pa.base+i,b=pa.base+i+1;
      const dx=Math.abs(verts[a].x-verts[b].x), dy=Math.abs(verts[a].y-verts[b].y);
      if(dx<1 && dy>=1){ px[fx(a)]=fx(b); }
      else if(dy<1 && dx>=1){ py[fy(a)]=fy(b); }
      else { verts[a].anchored=true; verts[b].anchored=true; } // 斜线：固定
    }});
    function snapAxis(find,getC,setC){
      const groups={}; verts.forEach((v,i)=>{const r=find(i);(groups[r]=groups[r]||[]).push(i);});
      let cl=Object.values(groups).map(mem=>{ let anc=null,sum=0; mem.forEach(i=>{ if(verts[i].anchored&&anc==null)anc=getC(verts[i]); sum+=getC(verts[i]); }); return {mem,n:mem.length,anchored:anc!=null,val:anc!=null?anc:sum/mem.length}; });
      cl.sort((a,b)=>a.val-b.val);
      const out=[];
      for(const c of cl){ const last=out[out.length-1];
        if(last && Math.abs(c.val-last.val)<=T && !(last.anchored&&c.anchored)){
          if(last.anchored){ last.mem=last.mem.concat(c.mem); last.n+=c.n; }
          else if(c.anchored){ last.val=c.val; last.anchored=true; last.mem=last.mem.concat(c.mem); last.n+=c.n; }
          else { last.val=(last.val*last.n+c.val*c.n)/(last.n+c.n); last.mem=last.mem.concat(c.mem); last.n+=c.n; }
        } else out.push(c);
      }
      out.forEach(c=>c.mem.forEach(i=>setC(verts[i],c.val)));
    }
    snapAxis(fx, v=>v.x, (v,x)=>v.x=x);
    snapAxis(fy, v=>v.y, (v,y)=>v.y=y);
    // 写回并清理重复/共线点（去掉冗余拐点）
    paths.forEach(pa=>{
      let pts=[]; for(let i=0;i<pa.len;i++){const v=verts[pa.base+i]; pts.push([v.x,v.y]);}
      _pathCache[pa.key]=_dedupCollinear(pts);
    });
  }
  function _dedupCollinear(pts){
    if(pts.length<2)return pts;
    const out=[];
    for(const p of pts){ const l=out[out.length-1]; if(l && Math.abs(l[0]-p[0])<0.5 && Math.abs(l[1]-p[1])<0.5) continue; out.push(p.slice()); }
    if(out.length<3)return out;
    const res=[out[0]];
    for(let i=1;i<out.length-1;i++){ const a=res[res.length-1],b=out[i],c=out[i+1];
      const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
      const dot=(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]);
      if(Math.abs(cross)<0.5 && dot>=0) continue; // 共线同向 → 去掉中间点
      res.push(b);
    }
    res.push(out[out.length-1]);
    return res;
  }
  function _allPaths(){ const edges=getEdges(); return edges.map(e=>_pathCache[e._cacheKey]).filter(Boolean); }
  function _countCross(){ const ps=_allPaths(); let n=0; for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)if(pathsCross(ps[i],ps[j]))n++; return n; }
  function _pathLen(p){ if(!p||p.length<2)return 0; let d=0; for(let i=0;i<p.length-1;i++)d+=Math.abs(p[i+1][0]-p[i][0])+Math.abs(p[i+1][1]-p[i][1]); return d; }
  function _pathBends(p){
    if(!p||p.length<3)return 0;
    let n=0;
    for(let i=1;i<p.length-1;i++){
      const a=p[i-1],b=p[i],c=p[i+1];
      const dx1=Math.sign(b[0]-a[0]),dy1=Math.sign(b[1]-a[1]);
      const dx2=Math.sign(c[0]-b[0]),dy2=Math.sign(c[1]-b[1]);
      if(dx1!==dx2||dy1!==dy2)n++;
    }
    return n;
  }
  function _pathDetourPenalty(p,a,b){
    if(!p||p.length<2||!a||!b)return 0;
    const ba=nodeBox(a),bb=nodeBox(b);
    const direct=Math.hypot(bb.cx-ba.cx,bb.cy-ba.cy);
    const margin=Math.max(80,Math.min(180,direct*0.35));
    const minX=Math.min(ba.left,bb.left)-margin,maxX=Math.max(ba.right,bb.right)+margin;
    const minY=Math.min(ba.top,bb.top)-margin,maxY=Math.max(ba.bottom,bb.bottom)+margin;
    let pen=0;
    p.forEach(pt=>{
      if(pt[0]<minX)pen+=minX-pt[0]; else if(pt[0]>maxX)pen+=pt[0]-maxX;
      if(pt[1]<minY)pen+=minY-pt[1]; else if(pt[1]>maxY)pen+=pt[1]-maxY;
    });
    return pen;
  }
  function _pathScore(p,a,b){
    return _pathLen(p)+_pathBends(p)*18+_pathDetourPenalty(p,a,b)*4;
  }
  // 直线模式候选：直连优先，其次最短 L，再 Z 中线，最后 A* 兜底；全部已避开设备。
  // 顺序即「偏好度」，优化器在交叉数相同的情况下取更靠前/更短者。
  function straightVariants(a,b,e){
    const ba=nodeBox(a), bb=nodeBox(b);
    const p0=edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort), p1=edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort);
    const out=[];
    const seen=new Set();
    const push=(pts)=>{ if(!pts||pts.length<2)return; const k=pts.map(p=>Math.round(p[0])+','+Math.round(p[1])).join(';'); if(seen.has(k))return; seen.add(k); out.push(pts); };
    const add=(raw)=>{ const cl=clipEnds(raw.map(p=>p.slice()),a,b,e); if(cl&&!pathHitsNodes(cl,e.from,e.to)) push(simplifyPath(cl,e.from,e.to)); };
    // 0) 直线（端点直连）
    if(!pathHitsNodes([p0,p1],e.from,e.to)) push([p0.slice(),p1.slice()]);
    // 1) 两种 L 型
    add([p0,[p1[0],p0[1]],p1]);  // 先横后竖
    add([p0,[p0[0],p1[1]],p1]);  // 先竖后横
    // 2) Z 型中线（横/竖各取若干分割比例）
    for(const f of [0.5,0.35,0.65,0.25,0.75]){
      const mx=p0[0]+(p1[0]-p0[0])*f, my=p0[1]+(p1[1]-p0[1])*f;
      add([p0,[mx,p0[1]],[mx,p1[1]],p1]);
      add([p0,[p0[0],my],[p1[0],my],p1]);
    }
    // 3) A* 正交避障兜底
    try{ const o=routeOrtho(a,b,e); add(o); }catch(_){}
    if(out.length===0) out.push(detourRoute(a,b,e)||[p0.slice(),p1.slice()]);
    // 按长度排序，但直连（含 2 点的真直线）永远排第一
    const straightFirst = out[0] && out[0].length===2 ? out.shift() : null;
    out.sort((u,v)=>_pathScore(u,a,b)-_pathScore(v,a,b));
    if(straightFirst) out.unshift(straightFirst);
    return out;
  }
  function optimizeChannel(edgeCands){
    const nodes=getNodes(), edges=getEdges();
    let best=_countCross();
    if(best===0)return;
    for(let iter=0; iter<20 && best>0; iter++){
      let improved=false;
      const ranked=edges.map(e=>{const p=_pathCache[e._cacheKey];let c=0;if(p)edges.forEach(o=>{if(o!==e){const op=_pathCache[o._cacheKey];if(op&&pathsCross(p,op))c++;}});return{e,c};}).filter(x=>x.c>0).sort((p,q)=>q.c-p.c);
      for(const {e} of ranked){
        const ck=e._cacheKey; const cand=edgeCands[ck]; if(!cand)continue;
        const orig=_pathCache[ck];
        // 候选列表：直线模式用其 L/Z 候选；通道模式用 合并/自然/走廊变体。
        const tries = cand.straight ? cand.variants.slice() : (()=>{const t=[];if(cand.merged)t.push(cand.merged);if(cand.natural)t.push(cand.natural);t.push(...buildCorridorVariants(e));return t;})();
        // 选交叉最少；并列时取更短；再并列时取更靠前（偏好度更高）的候选。
        const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);
        let bc=best, bestV=null, bestScore=Infinity, bestTi=Infinity;
        for(let ti=0;ti<tries.length;ti++){ const v=tries[ti]; if(!v)continue; _pathCache[ck]=v; const now=_countCross(); const score=_pathScore(v,a,b);
          if(now<bc || (now===bc && (score<bestScore-0.5 || (Math.abs(score-bestScore)<=0.5 && ti<bestTi)))){bc=now;bestV=v;bestScore=score;bestTi=ti;} }
        if(bestV && bc<=best){_pathCache[ck]=bestV; if(bc<best)improved=true; best=bc;}
        else _pathCache[ck]=orig;
        if(best===0)break;
      }
      if(!improved)break;
    }
  }
  function buildCorridorVariants(e){
    const nodes=getNodes();
    // 为一条边生成走廊变体，但保留最后两点（共享主干接入段）不变，避免破坏同侧合并
    const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
    if(!a||!b)return [];
    const cur=_pathCache[e._cacheKey];
    if(!cur||cur.length<3)return [];
    // 锁定尾段：共享主干点 + join（最后两点）
    const tail=cur.slice(-2);          // [sharedTrunkPt, tJoin]
    const head=cur[0];                  // fJoin
    const entry=tail[0];                // 共享主干点（必须到达此点）
    const variants=[];
    // 在 head→entry 之间尝试不同的 L / Z 走法
    const Hx=head[0],Hy=head[1],Ex=entry[0],Ey=entry[1];
    const mids=[
      [[Ex,Hy]],                        // 先横后竖
      [[Hx,Ey]],                        // 先竖后横
    ];
    for(const f of [0.35,0.5,0.65]){
      const mx=Hx+(Ex-Hx)*f, my=Hy+(Ey-Hy)*f;
      mids.push([[mx,Hy],[mx,Ey]]);     // 竖直中线
      mids.push([[Hx,my],[Ex,my]]);     // 水平中线
    }
    for(const mid of mids){
      const cand=dedupe([head, ...mid, entry, tail[1]]);
      variants.push(cand);
    }
    return variants.map(v=>simplifyPath(v,e.from,e.to)).filter(v=>!pathHitsNodes(v,e.from,e.to));
  }
  function recomputeAllPaths(){
    const nodes=getNodes();
    // 清除悬空连线
    const nodeIds=new Set(nodes.map(n=>n.id));
    setEdges(getEdges().filter(e=>nodeIds.has(e.from)&&nodeIds.has(e.to)));
    _occPts=new Set();
    channelRoute();
  }
  // 汇流合并：把共享同一端点、且从同方向接入的多条连线，在临近节点处合并到一条主干通道
  function approachSide(pt, box){
    // 判断 pt 相对节点盒在哪一侧
    const dx=pt[0]-box.cx, dy=pt[1]-box.cy;
    if(Math.abs(dx)>Math.abs(dy)) return dx<0?'L':'R';
    return dy<0?'T':'B';
  }
  // 保底避障路由：尝试多条正交折线，返回第一条不穿任何设备的；都不行则返回穿越最少的
  function detourRoute(a,b,e){
    const nodes=getNodes();
    const ba=nodeBox(a), bb=nodeBox(b);
    const p0=edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort), p1=edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort);
    // 收集所有障碍（排除 a、b 与标注类元素）的边界，作为候选绕行通道
    const obs=nodes.filter(n=>n.id!==a.id&&n.id!==b.id&&isRouteObstacle(n)).map(n=>nodeBox(n));
    const cands=[];
    // 基本 L 型两种
    cands.push([p0,[p1[0],p0[1]],p1]);
    cands.push([p0,[p0[0],p1[1]],p1]);
    // Z 型：在中间某 x 或 y 处转折（尝试障碍上下/左右边缘外侧）
    const xsMid=[(p0[0]+p1[0])/2];
    const ysMid=[(p0[1]+p1[1])/2];
    obs.forEach(o=>{ xsMid.push(o.left-22,o.right+22); ysMid.push(o.top-22,o.bottom+22); });
    xsMid.forEach(mx=>cands.push([p0,[mx,p0[1]],[mx,p1[1]],p1]));
    ysMid.forEach(my=>cands.push([p0,[p0[0],my],[p1[0],my],p1]));
    // 选第一条完全不穿设备的；否则穿越最少的
    let best=null, bestHits=Infinity;
    for(const c of cands){
      const cl=clipEnds(c,a,b,e);
      let hits=0;
      for(const n of nodes){ if(n.id===a.id||n.id===b.id||!isRouteObstacle(n))continue;
        for(let i=0;i<cl.length-1;i++) if(segRectHit(cl[i][0],cl[i][1],cl[i+1][0],cl[i+1][1],n,6)){hits++;break;}
      }
      if(hits===0) return cl;
      if(hits<bestHits){bestHits=hits;best=cl;}
    }
    return best||clipEnds([p0,p1],a,b,e);
  }
  function applyBusMerge(){
    const nodes=getNodes(), edges=getEdges();
    const {busMergeGap,busOffsets,busShareTrunk,ET}=cfg();
    _busTrunks=[];
    nodes.forEach(node=>{
      ['to','from'].forEach(role=>{
        // 仅合并已是正交折线（≥3 点）的连线
        const grp=edges.filter(e=>e[role]===node.id && _pathCache[e._cacheKey] && _pathCache[e._cacheKey].length>=3);
        if(grp.length<2)return;
        const box=nodeBox(node);
        const bySide={};
        grp.forEach(e=>{
          const otherId=(role==='to')?e.from:e.to;
          const other=nodes.find(n=>n.id===otherId);
          let side;
          if(other){
            const dx=other.x-node.x, dy=other.y-node.y;
            side=(Math.abs(dx)>=Math.abs(dy))?(dx<0?'L':'R'):(dy<0?'T':'B');
          }else{
            const pts=_pathCache[e._cacheKey];const endPt=(role==='to')?pts[pts.length-1]:pts[0];
            side=approachSide(endPt, box);
          }
          (bySide[side]=bySide[side]||[]).push(e);
        });
        Object.entries(bySide).forEach(([side,es])=>{
          if(es.length<2)return;
          const bkey=node.id+'|'+role+'|'+side;
          const userOff=busOffsets[bkey]||0;
          const TRUNK=Math.max(box.hw,box.hh)+busMergeGap+userOff;
          let horiz, trunkC, joinPt;
          if(side==='L'){trunkC=box.left-TRUNK;horiz=false;joinPt=[box.left,box.cy];}
          else if(side==='R'){trunkC=box.right+TRUNK;horiz=false;joinPt=[box.right,box.cy];}
          else if(side==='T'){trunkC=box.top-TRUNK;horiz=true;joinPt=[box.cx,box.top];}
          else {trunkC=box.bottom+TRUNK;horiz=true;joinPt=[box.cx,box.bottom];}
          // 重建每条线的完整路径（从对端到本节点），保证几何干净、无残段：
          //   对端锚点 →(L型)→ 主干车道点 → 主干交点 → 沿主干到汇流点 → 节点汇流点
          //   若重建路径穿过其它设备，则该线退出合并、改用 A* 正交避障路由
          es.forEach(e=>{
            const otherId=(role==='to')?e.from:e.to;
            const other=nodes.find(n=>n.id===otherId);
            if(!other)return;
            const ob=nodeBox(other);
            const laneC = horiz ? ob.cx : ob.cy;
            const trunkPtLane = horiz?[laneC,trunkC]:[trunkC,laneC];
            const trunkPtJoin = horiz?[joinPt[0],trunkC]:[trunkC,joinPt[1]];
            const oAnchor = anchorPoint(other, trunkPtLane[0], trunkPtLane[1]);
            let pre;
            if(horiz){ pre=[oAnchor,[oAnchor[0],trunkC],trunkPtLane]; }
            else{ pre=[oAnchor,[trunkC,oAnchor[1]],trunkPtLane]; }
            const full=[...pre, trunkPtJoin, joinPt.slice()];
            const merged = role==='to' ? dedupe(full) : dedupe(full.slice().reverse());
            // 障碍物避让检测：合并后的路径不得穿过任何其它设备
            if(pathHitsNodes(merged, e.from, e.to)){
              // 退出合并：用避障正交路由重算这条线
              const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
              let pts; try{ pts=routeOrtho(a,b,e); }catch(err){ pts=null; }
              let clipped = pts? clipEnds(pts,a,b,e) : null;
              // 若 A* 仍穿设备（或失败），用「绕到障碍上/下方」的保底正交折线
              if(!clipped || pathHitsNodes(clipped, e.from, e.to)){
                clipped = detourRoute(a,b,e);
              }
              _pathCache[e._cacheKey]=clipped;
              e._mergeSkipped=true;
            }else{
              _pathCache[e._cacheKey]=merged;
              e._mergeSkipped=false;
            }
          });
          // 记录主干用于（可选）加粗母线绘制：跨度取所有车道交点 + 汇流点
          const laneVals=es.map(e=>{const pts=_pathCache[e._cacheKey];
            // 找主干线上的点（坐标≈trunkC 的那些点的另一轴值）
            const onTrunk=pts.filter(p=>Math.abs((horiz?p[1]:p[0])-trunkC)<0.5);
            return onTrunk.map(p=>horiz?p[0]:p[1]);
          }).flat();
          const allVals=[...laneVals, horiz?joinPt[0]:joinPt[1]];
          const etColor=(ET[es[0].et]||ET.ac_power||{color:'#4dd0ff'}).color;
          if(horiz) _busTrunks.push({horiz:true, y:trunkC, a:Math.min(...allVals), b:Math.max(...allVals), color:etColor, joinPt, bkey, side});
          else _busTrunks.push({horiz:false, x:trunkC, a:Math.min(...allVals), b:Math.max(...allVals), color:etColor, joinPt, bkey, side});
        });
      });
    });
    if(busShareTrunk) shareNearbyTrunks();
  }
  // 跨设备共享主干：把坐标接近、同朝向的主干通道对齐到同一条线，并把相关连线改走该共享线
  function shareNearbyTrunks(){
    const edges=getEdges();
    const THRESH=42; // 主干间距小于此值视为可共享
    // 分别处理竖直主干（按 x 聚类）和水平主干（按 y 聚类）
    ['v','h'].forEach(orient=>{
      const group=_busTrunks.filter(t=>orient==='v'?!t.horiz:t.horiz);
      if(group.length<2)return;
      // 按坐标排序聚类
      const coordOf=t=>orient==='v'?t.x:t.y;
      const sorted=[...group].sort((p,q)=>coordOf(p)-coordOf(q));
      let cluster=[sorted[0]];
      const flush=cl=>{
        if(cl.length<2)return;
        // 仅当这些主干属于不同设备且同侧朝向时才共享
        const shared=cl.reduce((s,t)=>s+coordOf(t),0)/cl.length;
        // 收集所有相关连线在该共享线上的实际坐标点，用于确定母线真实跨度
        const along=[]; // 沿主干方向的坐标值
        cl.forEach(t=>{
          const old=coordOf(t);
          if(orient==='v')t.x=shared; else t.y=shared;
          t._shared=true;
          edges.forEach(e=>{
            const pts=_pathCache[e._cacheKey];if(!pts)return;
            let touched=false;
            pts.forEach(p=>{
              if(orient==='v'&&Math.abs(p[0]-old)<0.5){p[0]=shared;touched=true;}
              if(orient==='h'&&Math.abs(p[1]-old)<0.5){p[1]=shared;touched=true;}
            });
            if(touched){
              _pathCache[e._cacheKey]=dedupe(pts);
              // 记录这条线落在共享主干上的点（沿主干方向坐标）
              pts.forEach(p=>{
                if(orient==='v'&&Math.abs(p[0]-shared)<0.5)along.push(p[1]);
                if(orient==='h'&&Math.abs(p[1]-shared)<0.5)along.push(p[0]);
              });
            }
          });
        });
        // 母线跨度按实际连线落点确定，避免画出没有连线的游离段
        if(along.length){
          const lo=Math.min(...along), hi=Math.max(...along);
          cl.forEach(t=>{t.a=lo;t.b=hi;});
        }
      };
      for(let i=1;i<sorted.length;i++){
        if(Math.abs(coordOf(sorted[i])-coordOf(cluster[cluster.length-1]))<THRESH)cluster.push(sorted[i]);
        else{flush(cluster);cluster=[sorted[i]];}
      }
      flush(cluster);
    });
  }
  function dedupe(pts){
    const out=[pts[0]];
    for(let i=1;i<pts.length;i++){const p=out[out.length-1],c=pts[i];if(Math.abs(p[0]-c[0])>0.5||Math.abs(p[1]-c[1])>0.5)out.push(c);}
    return out;
  }
  // 路径简化：去掉共线的中间点（把能拉直的拐点拉直），减少多余台阶
  function simplifyPath(pts, fromId, toId){
    if(!pts||pts.length<3)return pts;
    let p=dedupe(pts);
    // 1) 移除共线点：若 a-b-c 三点共线，去掉 b
    let changed=true;
    while(changed){
      changed=false;
      const out=[p[0]];
      for(let i=1;i<p.length-1;i++){
        const a=out[out.length-1], b=p[i], c=p[i+1];
        const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
        if(Math.abs(cross)<1){ changed=true; continue; } // 共线，跳过 b
        out.push(b);
      }
      out.push(p[p.length-1]);
      p=out;
    }
    // 2) 捷径化：去掉单个拐点（直连不穿设备且保持正交）
    changed=true;
    while(changed && p.length>2){
      changed=false;
      for(let i=1;i<p.length-1;i++){
        const a=p[i-1], c=p[i+1];
        if(!pathHitsNodes([a,c], fromId, toId)){
          const isOrtho=Math.abs(a[0]-c[0])<1||Math.abs(a[1]-c[1])<1;
          if(isOrtho){ p=p.slice(0,i).concat(p.slice(i+1)); changed=true; break; }
        }
      }
    }
    return dedupe(p);
  }
  // 单条连线的智能路径（最短·避障；手动/弧线按各自规则），并写入缓存
  function computeSmartEdge(e){
    const nodes=getNodes(), edges=getEdges();
    const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
    if(!a||!b) return null;
    if(!e._cacheKey) e._cacheKey=e.from+'>'+e.to+':'+edges.indexOf(e);
    let p;
    if(e.route==='manual' || e.route==='arc' || e.route==='line') p=edgePathRaw(e);
    else { const vs=straightVariants(a,b,e); p=vs[0]||edgePathRaw(e); }
    _pathCache[e._cacheKey]=p;
    return p;
  }
  function edgePath(e){
    // 拖动中：只对「与被拖动节点相连」的连线做实时重算，其余连线复用缓存（其几何未变），大幅提速
    if(isDragging() && dragIds().size){
      if(dragIds().has(e.from) || dragIds().has(e.to)) return computeSmartEdge(e);
      if(e._cacheKey && _pathCache[e._cacheKey]) return _pathCache[e._cacheKey];
      return computeSmartEdge(e);
    }
    // 非拖动：拓扑变化时整体重算（含交叉消除优化）
    const sig=topoSig();
    if(sig!==_pathCacheSig){ _pathCacheSig=sig; recomputeAllPaths(); }
    if(e._cacheKey && _pathCache[e._cacheKey]) return _pathCache[e._cacheKey];
    // 回退
    const ek=e.from+'>'+e.to+':'+getEdges().indexOf(e);
    if(_pathCache[ek]) return _pathCache[ek];
    const p=edgePathRaw(e); return p;
  }
  function edgeAt(wx,wy){
    const edges=getEdges(), zoom=getZoom();
    for(const e of edges){const pts=edgePath(e);if(!pts)continue;
      for(let i=0;i<pts.length-1;i++){
        const[x1,y1]=pts[i],[x2,y2]=pts[i+1];const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy);if(len<1)continue;
        const t=((wx-x1)*dx+(wy-y1)*dy)/(len*len);if(t<0||t>1)continue;
        if(Math.sqrt((wx-x1-t*dx)**2+(wy-y1-t*dy)**2)<9/zoom)return e;
      }}return null;
  }
  // edgeAt 的增强版：返回连线上离 (wx,wy) 最近的点及所在段（占位点吸附/分接用）。
  // tol：世界坐标容差（缺省 9/zoom）；skip(e)：返回 true 的连线跳过（如排除占位点自己的连线）
  function edgeHitInfo(wx,wy,tol,skip){
    const edges=getEdges(), zoom=getZoom();
    const T=(tol!=null)?tol:9/zoom;
    let best=null;
    for(const e of edges){
      if(skip&&skip(e))continue;
      const pts=edgePath(e);if(!pts)continue;
      for(let i=0;i<pts.length-1;i++){
        const[x1,y1]=pts[i],[x2,y2]=pts[i+1];const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy;if(len2<1)continue;
        let t=((wx-x1)*dx+(wy-y1)*dy)/len2;t=Math.max(0,Math.min(1,t));
        const px=x1+t*dx,py=y1+t*dy,d=Math.hypot(wx-px,wy-py);
        if(d<T&&(!best||d<best.dist))best={edge:e,point:[px,py],segIndex:i,dist:d};
      }
    }
    return best;
  }

  // ═════════ 线段相交判定（原 topology-editor-07-editing.js）═════════
  function segsCross(a,b,c,d){
    function ccw(p,q,r){return (r[1]-p[1])*(q[0]-p[0]) - (q[1]-p[1])*(r[0]-p[0]);}
    const d1=ccw(c,d,a),d2=ccw(c,d,b),d3=ccw(a,b,c),d4=ccw(a,b,d);
    if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0)))return true;
    return false;
  }
  function pathsCross(p1,p2){
    for(let i=0;i<p1.length-1;i++)for(let j=0;j<p2.length-1;j++){
      if(segsCross(p1[i],p1[i+1],p2[j],p2[j+1]))return true;
    }
    return false;
  }

  return {
    // 值字典（code → 中/英文案）
    findValueDict, resolveValueDict, valueDictLabel, translateFieldValue, fieldDisplayValue,
    // 几何 / 端口
    nodeLabel, dataKey, nsz, nodeBox, anchorPoint, clamp, isLinearBusNode, isRouteObstacle,
    linearBusSpan, linearBusPort, nodePortPoint, nearestNodePort, directionalNodePort,
    edgeAnchorPoint, portSide, segRectHit, pathHitsNodes, segBoxClip, ptInBox,
    clipEnds, sideOf, approachSide,
    // 布线
    topoSig, invalidatePathCache, invalidateRouting, buildObstacleGrid,
    ptInObstacle, segInObstacle, markOccupied, segOverlapPenalty,
    routeOrtho, orthogonalize, edgePathRaw, channelRoute, alignJunctions,
    straightVariants, optimizeChannel, buildCorridorVariants, recomputeAllPaths,
    detourRoute, applyBusMerge, shareNearbyTrunks, dedupe, simplifyPath,
    computeSmartEdge, edgePath, edgeAt, edgeHitInfo, segsCross, pathsCross,
    _pathLen, _pathBends, _pathDetourPenalty, _pathScore, _dedupCollinear, _countCross,
    // 状态访问（宿主绘制层用）
    busTrunks: function () { return _busTrunks; },
    cachedPath: function (e) { return (e && e._cacheKey) ? (_pathCache[e._cacheKey] || null) : null; },
  };
}

// CJS 尾巴：Node / 打包器（Next.js 等）消费；浏览器 <script> 引入时 module 未定义，走全局
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createTopoRuntime };
}
