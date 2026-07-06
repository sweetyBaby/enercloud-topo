// ═════════ 拓扑核心接线层 + 编辑器交互几何 ═════════
// 几何/端口/布线算法已抽到 packages/topology-runtime（headless 单一事实源，
// 与前端渲染器共同消费）。本文件负责：
//   1) 用编辑器全局状态实例化 runtime（TR），并把常用函数落回全局名（其余分段照旧裸调用）；
//   2) 保留纯编辑器交互几何（命中测试 / 吸附 / 拖放建节点等）。
// ⚠️ 布线/几何算法请改 packages/topology-runtime/topology-runtime.js，不要在编辑器里 fork。
let _dragging=false, _dragIds=new Set();   // 拖拽状态（03-input 写、runtime 经 env 读）
const TR = createTopoRuntime({
  getNodes: ()=>nodes,
  getEdges: ()=>edges,
  setEdges: (v)=>{ edges=v; },
  getZoom: ()=>zoom,
  getLang: ()=>lang,
  getValueDicts: ()=>effectiveValueDicts(),   // 值字典：共享库 + 文档内嵌快照（转义逻辑在包内，编辑器/前端同款）
  getConfig: ()=>({busMergeGap, busAggregation, routeStyle, busOffsets, busShareTrunk, ET}),
  // 编辑器的视口自适应尺寸基准：min(canvas.w,canvas.h)/zoom/600（与原 nsz 逐字等价）
  sizeUnit: ()=>Math.min(canvas.width,canvas.height)/zoom/600,
  isDragging: ()=>_dragging,
  dragIds: ()=>_dragIds,
});
// ── 落回全局名（分段脚本沿用原函数名裸调用）──
const nodeLabel=TR.nodeLabel, dataKey=TR.dataKey, nsz=TR.nsz, nodeBox=TR.nodeBox,
      findValueDict=TR.findValueDict, resolveValueDict=TR.resolveValueDict,
      valueDictLabel=TR.valueDictLabel, translateFieldValue=TR.translateFieldValue,
      fieldDisplayValue=TR.fieldDisplayValue,
      anchorPoint=TR.anchorPoint, clamp=TR.clamp, isLinearBusNode=TR.isLinearBusNode,
      linearBusSpan=TR.linearBusSpan, linearBusPort=TR.linearBusPort,
      nodePortPoint=TR.nodePortPoint, nearestNodePort=TR.nearestNodePort,
      directionalNodePort=TR.directionalNodePort, edgeAnchorPoint=TR.edgeAnchorPoint,
      portSide=TR.portSide, segRectHit=TR.segRectHit, pathHitsNodes=TR.pathHitsNodes,
      segBoxClip=TR.segBoxClip, ptInBox=TR.ptInBox, clipEnds=TR.clipEnds,
      sideOf=TR.sideOf, approachSide=TR.approachSide,
      topoSig=TR.topoSig, invalidatePathCache=TR.invalidatePathCache,
      invalidateRouting=TR.invalidateRouting, buildObstacleGrid=TR.buildObstacleGrid,
      routeOrtho=TR.routeOrtho, orthogonalize=TR.orthogonalize, edgePathRaw=TR.edgePathRaw,
      channelRoute=TR.channelRoute, alignJunctions=TR.alignJunctions,
      straightVariants=TR.straightVariants, optimizeChannel=TR.optimizeChannel,
      buildCorridorVariants=TR.buildCorridorVariants, recomputeAllPaths=TR.recomputeAllPaths,
      detourRoute=TR.detourRoute, applyBusMerge=TR.applyBusMerge,
      shareNearbyTrunks=TR.shareNearbyTrunks, dedupe=TR.dedupe, simplifyPath=TR.simplifyPath,
      computeSmartEdge=TR.computeSmartEdge, edgePath=TR.edgePath, edgeAt=TR.edgeAt,
      segsCross=TR.segsCross, pathsCross=TR.pathsCross,
      _pathLen=TR._pathLen, _pathBends=TR._pathBends,
      _pathDetourPenalty=TR._pathDetourPenalty, _pathScore=TR._pathScore,
      _dedupCollinear=TR._dedupCollinear, _countCross=TR._countCross,
      markOccupied=TR.markOccupied;
// 接线自检：包导出与别名清单是两处手工同步的清单——加载期断言,防止包改名/漏导出后
// 别名静默绑定 undefined、直到低频路径被点到才炸。
[['createTopoRuntime 实例', {nodeLabel,dataKey,nsz,nodeBox,anchorPoint,edgePath,edgePathRaw,channelRoute,
  findValueDict,resolveValueDict,valueDictLabel,translateFieldValue,fieldDisplayValue,
  recomputeAllPaths,applyBusMerge,straightVariants,detourRoute,dedupe,simplifyPath,computeSmartEdge,edgeAt,
  segsCross,pathsCross,clipEnds,edgeAnchorPoint,nodePortPoint,nearestNodePort,directionalNodePort,
  invalidateRouting,invalidatePathCache,_pathScore,_countCross}],
].forEach(([label,fns])=>Object.entries(fns).forEach(([k,v])=>{
  if(typeof v!=='function')throw new Error('topology-runtime 接线断言失败:'+label+' 缺少函数「'+k+'」');
}));

// ═════════ 编辑器交互几何（命中测试 / 吸附 / 建节点）═════════
function onDragStart(e,t){window._dt=t;e.dataTransfer.setData('text/plain',t);}
cwrap.addEventListener('dragover',e=>e.preventDefault());
cwrap.addEventListener('drop',e=>{e.preventDefault();const t=window._dt;if(!t)return;const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);addNode(t,wx,wy);window._dt=null;});
function addNode(type,x,y){
  const def=NODE_DEFAULTS[type]||{data:[]};const id=genId(type);
  const isC=type.startsWith('custom_');
  const dev=DEVICE_GROUPS.flatMap(g=>g.devices).find(d=>d.type===type);
  let labelZh,labelEn;
  if(isC&&CUSTOM_LABELS[type]){ labelZh=CUSTOM_LABELS[type].zh; labelEn=CUSTOM_LABELS[type].en; }
  else { labelZh=dev?.label||type; labelEn=dev?.label_en||type; }
  snapshot();
  if(type==='text'){
    nodes.push({id,type,labelZh:'文本内容',labelEn:'Text',x,y,fontSize:18,fontColor:'#ffffff',scale:1,
      data:[{key:'数值',keyEn:'Value',dv:''}]});
    snapshot();selectNode(id);return;
  }
  if(type==='variable'){
    // 变量节点：label 段 + value 段，各自字体属性独立；value 默认绑定第一条数据字段（实时值），可静态兜底
    nodes.push({id,type,labelZh:'变量',labelEn:'Variable',x,y,scale:1,
      fontSize:16,fontColor:'#e8f4ff',labelBold:true,
      valFontSize:16,valColor:'#4dd0ff',valBold:true,
      varLayout:'h',
      data:[{key:'数值',keyEn:'Value',dv:'--'}]});
    snapshot();selectNode(id);return;
  }
  nodes.push({id,type,labelZh,labelEn,x,y,fontSize:14,fontColor:'#e8f4ff',scale:(type==='anchor'?0.5:1),
    hideLabel:(type==='anchor'),hideFields:(type==='anchor'),
    ...(type==='anchor'?{fill:'#4dd0ff',opacity:1}:{}),
    data:(def.data||[]).map(k=>({key:k,keyEn:(DATA_LABEL_EN[k]||k),dv:''}))});
  snapshot();selectNode(id);
}
// 字段的「信号键段」：端到端统一用【英文名】作信号标识（规则条件/导出/实时数据契约都用它）。
// 英文名为必填项（见字段校验）；为防内部报错，缺失时暂兜底中文名。字段卡片显示仍走 dataKey（中文标签）。
function fieldSigKey(f){ return (f&&(f.keyEn||f.key))||''; }
function fieldSig(n,f){ return n.id+'.'+fieldSigKey(f); }
// ───── 连线标签信号：连线可选 id（绑定后台字段时自动生成，如 edge_1），信号键=「连线id.标签英文名」 ─────
function edgeById(id){ return id?edges.find(e=>e.id===id):null; }
function edgeLabelSigKey(e){ return (e&&String(e.lblEn||'').trim())||''; }
function edgeLabelSig(e){ const k=edgeLabelSigKey(e); return (e&&e.id&&k)?(e.id+'.'+k):null; }
// 连线的人读名称（注入面板/规则列表用）：连线 起点→终点 · 标签
function edgeLabelDisplayName(e){
  const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);
  return (lang==='en'?'Edge ':'连线 ')+(a?nodeLabel(a):e.from)+'→'+(b?nodeLabel(b):e.to)+(e.lbl?(' · '+e.lbl):'');
}
// 数据字段名称校验：同一节点内「中文名」「英文名」各自必填且不可重复（中、英分开判定，故允许同一字段中英文同名，如 P(kW)）。
// 返回与 n.data 等长的数组，每项 {emptyZh,emptyEn,dupZh,dupEn}。
// 通用名称校验：items=[{zh,en}] → [{emptyZh,emptyEn,dupZh,dupEn}]（zh、en 各自必填且组内唯一；允许同一项 zh===en）
function _nameIssues(items){
  const zhCount={},enCount={};
  items.forEach(it=>{const zh=String(it.zh||'').trim(),en=String(it.en||'').trim();
    if(zh)zhCount[zh]=(zhCount[zh]||0)+1; if(en)enCount[en]=(enCount[en]||0)+1;});
  return items.map(it=>{const zh=String(it.zh||'').trim(),en=String(it.en||'').trim();
    return {emptyZh:!zh,emptyEn:!en,dupZh:!!zh&&zhCount[zh]>1,dupEn:!!en&&enCount[en]>1};});
}
function fieldNameIssues(n){ return _nameIssues(((n&&n.data)||[]).map(f=>({zh:f.key,en:f.keyEn}))); }
// 全局信号名称校验：全局范围内中文名、英文名各自必填且唯一
function globalSigIssues(){ return _nameIssues((customSignals||[]).map(s=>({zh:s.key,en:s.keyEn}))); }
function fieldNameOk(s){ return s&&!s.emptyZh&&!s.emptyEn&&!s.dupZh&&!s.dupEn; }
function nodeHasFieldNameError(n){ return fieldNameIssues(n).some(s=>!fieldNameOk(s)); }
// 文本框 + 变量节点：都用 _textBox 包围盒（命中/对齐/缩放等几何逻辑一致）
function usesTextBox(t){ return t==='text'||t==='variable'; }
// 注：status / online 已彻底移除，节点的可用信号 = 仅其「已绑定数据字段」

function nodeAt(wx,wy){for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(usesTextBox(n.type)){const b=n._textBox;if(b&&wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h)return n;continue;}const s=nsz(n);if(n.type==='anchor'){const vcy=n.y-s*0.22, hit=Math.max(s*0.5, 11/zoom);if(Math.abs(wx-n.x)<hit&&Math.abs(wy-vcy)<hit)return n;continue;}if(Math.abs(wx-n.x)<s*.55&&Math.abs(wy-n.y)<s*.5)return n;}return null;}
function nodeSnapBox(n){
  if(usesTextBox(n.type)&&n._textBox)return n._textBox;
  const b=nodeBox(n), s=nsz(n), lfs=(n.fontSize||14);
  const labelBottom=(n.y+s*0.28)+lfs*1.45;
  const out={x:b.left,y:b.top,w:b.hw*2,h:Math.max(b.hh*2,labelBottom-b.top)};
  if(!n.hideFields&&showFieldChips&&n.data&&n.data.length){
    n.data.forEach((f,i)=>{
      if(f.hidden)return;
      const pos=fieldChipPos(n,i);
      const txt=fieldChipText(n,f);
      let tw=Math.max(74/zoom,120/zoom);
      try{ctx.save();ctx.font=pos.cfs+"px -apple-system,'Microsoft YaHei',sans-serif";tw=Math.max(tw,ctx.measureText(txt).width+14/zoom);ctx.restore();}catch(_){}
      const bx=pos.x,by=pos.y-pos.cfs,bw=tw,bh=pos.cfs+8/zoom;
      const minX=Math.min(out.x,bx),minY=Math.min(out.y,by),maxX=Math.max(out.x+out.w,bx+bw),maxY=Math.max(out.y+out.h,by+bh);
      out.x=minX;out.y=minY;out.w=maxX-minX;out.h=maxY-minY;
    });
  }
  return out;
}
function edgeSnapAt(wx,wy,excludeId){
  const direct=nodeAt(wx,wy);
  let best=null,bd=Infinity;
  nodes.forEach(n=>{
    if(n.id===excludeId)return;
    const port=nearestNodePort(n,wx,wy);
    if(!port)return;
    const sb=nodeSnapBox(n);
    const pad=Math.max(44/zoom, nsz(n)*0.55);
    const nearBox=wx>=sb.x-pad&&wx<=sb.x+sb.w+pad&&wy>=sb.y-pad&&wy<=sb.y+sb.h+pad;
    if(!nearBox&&n!==direct)return;
    const d=Math.hypot(wx-port.point[0],wy-port.point[1]);
    port.dist=d;
    const score=(n===direct?d*0.25:d);
    if(score<bd){bd=score;best={node:n,port};}
  });
  return best;
}
function trimWaypointsNearPort(wps, portPoint){
  const out=(wps||[]).map(p=>p.slice());
  if(!portPoint)return out;
  const tol=Math.max(64/zoom,28);
  while(out.length){
    const p=out[out.length-1];
    if(Math.hypot(p[0]-portPoint[0],p[1]-portPoint[1])>tol)break;
    out.pop();
  }
  return out;
}
function trimWaypointsNearStartPort(wps, portPoint){
  const out=(wps||[]).map(p=>p.slice());
  if(!portPoint)return out;
  const tol=Math.max(64/zoom,28);
  while(out.length){
    const p=out[0];
    if(Math.hypot(p[0]-portPoint[0],p[1]-portPoint[1])>tol)break;
    out.shift();
  }
  return out;
}
function looseSnapNodeAt(wx,wy,excludeIds){
  const exclude=new Set((excludeIds||[]).filter(Boolean));
  let best=null,bd=Infinity;
  nodes.forEach(n=>{
    if(exclude.has(n.id))return;
    const sb=nodeSnapBox(n), b=nodeBox(n);
    const pad=Math.max(56/zoom,nsz(n)*0.75);
    const nearBox=wx>=sb.x-pad&&wx<=sb.x+sb.w+pad&&wy>=sb.y-pad&&wy<=sb.y+sb.h+pad;
    const d=Math.hypot(wx-b.cx,wy-b.cy);
    if(nearBox&&d<bd){bd=d;best=n;}
  });
  return best;
}
function autoAttachLooseEdgeEnds(e){
  if(!e||!e.waypoints||!e.waypoints.length)return false;
  let changed=false;
  const first=e.waypoints[0],last=e.waypoints[e.waypoints.length-1];
  const fromHit=looseSnapNodeAt(first[0],first[1],[e.to,e.from]);
  if(fromHit){
    e.from=fromHit.id;
    e.fromPort=(directionalNodePort(fromHit,first[0],first[1])||{}).name;
    e.waypoints=trimWaypointsNearStartPort(e.waypoints,nodePortPoint(fromHit,e.fromPort));
    changed=true;
  }
  const tail=e.waypoints.length?e.waypoints[e.waypoints.length-1]:null;
  const toHit=tail&&looseSnapNodeAt(tail[0],tail[1],[e.from,e.to]);
  if(toHit){
    e.to=toHit.id;
    e.toPort=(directionalNodePort(toHit,tail[0],tail[1])||{}).name;
    e.waypoints=trimWaypointsNearPort(e.waypoints,nodePortPoint(toHit,e.toPort));
    changed=true;
  }
  if(changed){
    if(e.waypoints.length===0){delete e.waypoints;if(e.route==='manual')e.route='smart';}
    else simplifyWaypoints(e);
  }
  return changed;
}
