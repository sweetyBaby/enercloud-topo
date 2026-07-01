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
  nodes.push({id,type,labelZh,labelEn,x,y,fontSize:14,fontColor:'#e8f4ff',scale:(type==='anchor'?0.1:1),
    hideLabel:(type==='anchor'),hideFields:(type==='anchor'),
    ...(type==='anchor'?{fill:'#4dd0ff',opacity:1}:{}),
    data:(def.data||[]).map(k=>({key:k,keyEn:(DATA_LABEL_EN[k]||k),dv:''}))});
  snapshot();selectNode(id);
}
// 获取节点当前语言标签
function nodeLabel(n){ return lang==='en' ? (n.labelEn||n.labelZh||n.id) : (n.labelZh||n.label||n.id); }
function dataKey(f){ return lang==='en' ? (f.keyEn||f.key) : f.key; }
// 字段的「信号键段」：端到端统一用【英文名】作信号标识（规则条件/导出/实时数据契约都用它）。
// 英文名为必填项（见字段校验）；为防内部报错，缺失时暂兜底中文名。字段卡片显示仍走 dataKey（中文标签）。
function fieldSigKey(f){ return (f&&(f.keyEn||f.key))||''; }
function fieldSig(n,f){ return n.id+'.'+fieldSigKey(f); }
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

function nsz(typeOrNode){
  const type=typeof typeOrNode==='string'?typeOrNode:typeOrNode.type;
  const scale=typeof typeOrNode==='string'?1:(typeOrNode.scale||1);
  const base=Math.min(canvas.width,canvas.height)/zoom;
  const s={grid:80,pcs:66,bms:66,meter:56,meter2:60,load:66,solar:74,transformer:64,switch:60,generator:68,cabinet:64,highvolt:60,ems:64,aircon:60,fire:58,sensor:58,busbar:70,charger:60,h2_storage:64,
    // 开关元件：默认偏大，统一缩小为更紧凑的尺寸
    cb_closed:44,switch_open:44,disconnector:44,contactor:44,fuse:44,iso_g:44,lbs_g:44,disc_v_g:44,
    trunk_ac:70,trunk_dc:70,tie_line:66,
    anchor:26}[type]||62;
  return s*(base/600)*scale;
}
function nodeAt(wx,wy){for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(usesTextBox(n.type)){const b=n._textBox;if(b&&wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h)return n;continue;}const s=nsz(n);if(n.type==='anchor'){const vcy=n.y-s*0.22, hit=Math.max(s*0.5, 11/zoom);if(Math.abs(wx-n.x)<hit&&Math.abs(wy-vcy)<hit)return n;continue;}if(Math.abs(wx-n.x)<s*.55&&Math.abs(wy-n.y)<s*.5)return n;}return null;}
// 返回节点边界上的锚点（从中心朝目标方向，落在图标外缘）
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
function nodeSnapBox(n){
  if(usesTextBox(n.type)&&n._textBox)return n._textBox;
  const b=nodeBox(n), s=nsz(n), lfs=(n.fontSize||14);
  const labelBottom=(n.y+s*0.28)+lfs*1.45;
  const out={x:b.left,y:b.top,w:b.hw*2,h:Math.max(b.hh*2,labelBottom-b.top)};
  if(!n.hideFields&&showFieldChips&&n.data&&n.data.length){
    n.data.forEach((f,i)=>{
      if(f.hidden)return;
      const pos=fieldChipPos(n,i);
      const txt=fieldChipText(f);
      let tw=Math.max(74/zoom,120/zoom);
      try{ctx.save();ctx.font=pos.cfs+"px -apple-system,'Microsoft YaHei',sans-serif";tw=Math.max(tw,ctx.measureText(txt).width+14/zoom);ctx.restore();}catch(_){}
      const bx=pos.x,by=pos.y-pos.cfs,bw=tw,bh=pos.cfs+8/zoom;
      const minX=Math.min(out.x,bx),minY=Math.min(out.y,by),maxX=Math.max(out.x+out.w,bx+bw),maxY=Math.max(out.y+out.h,by+bh);
      out.x=minX;out.y=minY;out.w=maxX-minX;out.h=maxY-minY;
    });
  }
  return out;
}
function nodePortPoint(n, port){
  const b=nodeBox(n);
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
  for(const n of nodes){
    if(n.id===fromId||n.id===toId) continue;
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
