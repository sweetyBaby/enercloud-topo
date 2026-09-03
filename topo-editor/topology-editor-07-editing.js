// 命中测试：返回 {node, fieldIndex} 若点中某 chip
function fieldChipAt(wx,wy){
  if(!showFieldChips)return null;
  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];if(!n.data)continue;
    for(let j=0;j<n.data.length;j++){
      const b=n.data[j]._chipBox;if(!b)continue;
      if(wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h)return {node:n,fi:j};
    }
  }
  return null;
}
// 命中选中连线的拐点手柄
function waypointAt(e,wx,wy){
  if(!e||!e.waypoints)return -1;
  const tol=8/zoom;
  for(let i=0;i<e.waypoints.length;i++){
    const p=e.waypoints[i];
    if(Math.abs(wx-p[0])<tol&&Math.abs(wy-p[1])<tol)return i;
  }
  return -1;
}
// 命中选中连线某段的中点「+」（返回应插入的 waypoint 索引）
function segMidAt(e,wx,wy){
  if(!e||!e._drawPts)return -1;
  const pts=e._drawPts, tol=9/zoom;
  for(let i=0;i<pts.length-1;i++){
    const mx=(pts[i][0]+pts[i+1][0])/2, my=(pts[i][1]+pts[i+1][1])/2;
    if(Math.hypot(wx-mx,wy-my)<tol){
      // 段 i 对应在 waypoints 中插入的位置：起点段=0，之后每段+1
      return {insertAt:i, x:mx, y:my};
    }
  }
  return -1;
}
// 命中非手动连线的拐点(方向变化处)，返回拐点坐标 {x,y}；用于"抓住拐点直接拖动对齐/汇合"
// 点是否落在折线（任一段）上（容差 tol）——用于判断"某拐点是否与另一条线重叠"
function ptOnPolyline(p,pts,tol){
  for(let i=0;i<pts.length-1;i++){ const a=pts[i],b=pts[i+1];
    const dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy||1; let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2; t=Math.max(0,Math.min(1,t));
    if(Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy))<tol)return true;
  }
  return false;
}
function cornerAt(e,wx,wy){
  if(!e||!e._drawPts)return null;
  const pts=e._drawPts, tol=8/zoom;
  for(let i=1;i<pts.length-1;i++){
    const a=pts[i-1],c=pts[i],d=pts[i+1];
    if(Math.abs((c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0]))<=1)continue; // 共线
    if(Math.abs(wx-c[0])<tol&&Math.abs(wy-c[1])<tol)return {x:c[0],y:c[1]};
  }
  return null;
}
function ensureManual(e){
  // 将连线转为可编辑的手动折线：用当前绘制点作为初始 waypoints（去掉首尾锚点）
  if(e.route==='manual' && e.waypoints) return;
  const pts=edgePath(e)||[];
  const inner=pts.slice(1,-1).map(p=>p.slice());
  e.route='manual';
  e.waypoints=inner;
  simplifyWaypoints(e);  // 自动布线常带很多台阶拐点，转手动后先精简，避免“越点越多”
}
// 精简手动连线的拐点：删除共线/重复的冗余拐点，只保留真正改变走向的点。
// 目的：加拐点是为了快速汇合/对齐，而不是堆出越来越多的台阶。
function simplifyWaypoints(e){
  if(!e||e.route!=='manual'||!e.waypoints||e.waypoints.length<1)return;
  const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);
  if(!a||!b)return;
  let wps=e.waypoints.map(p=>p.slice());
  const start=edgeAnchorPoint(a, wps[0][0], wps[0][1], e.fromPort);
  const end=edgeAnchorPoint(b, wps[wps.length-1][0], wps[wps.length-1][1], e.toPort);
  let pts=dedupe([start,...wps,end]);
  // 去掉共线中间点（端点也参与判断，能把整段拉直）
  let changed=true;
  while(changed && pts.length>2){
    changed=false;
    for(let i=1;i<pts.length-1;i++){
      const p=pts[i-1],c=pts[i],n=pts[i+1];
      const cross=(c[0]-p[0])*(n[1]-p[1])-(c[1]-p[1])*(n[0]-p[0]);
      if(Math.abs(cross)<1.5){ pts.splice(i,1); changed=true; break; }
    }
  }
  e.waypoints=pts.slice(1,-1).map(p=>p.slice());
}
// 在当前（已精简）路径上，按坐标求新拐点应插入的 waypoint 索引
function waypointInsertIndex(e,x,y){
  const pts=edgePath(e)||[];
  let best=0,bestD=Infinity;
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1]=pts[i],[x2,y2]=pts[i+1];
    const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy||1;
    let t=((x-x1)*dx+(y-y1)*dy)/len2; t=Math.max(0,Math.min(1,t));
    const px=x1+t*dx,py=y1+t*dy,d=Math.hypot(x-px,y-py);
    if(d<bestD){bestD=d;best=i;}
  }
  return best; // 段 i（pts[i]→pts[i+1]）对应在 inner waypoints 中的插入位置
}
// ── 占位点 ⇢ 连线汇合点（T 型分接）──
// 把占位点 n 接入 hit（edgeHitInfo 结果）：原边 A→B 在分接点分裂为 A→n 与 n→B 两条边。
// 原边保留 id/标签/数据绑定（信号键 edgeId.En 不断链）；后半段继承线型/流向/走线样式。
// 调用方负责前后 snapshot()。
function attachAnchorToEdge(n, hit){
  const e=hit&&hit.edge;
  if(!n||!e||e.from===n.id||e.to===n.id)return false;
  // 头/尾段查重：分接出的段落若与既有连线端点重复则去重共用（不产生叠线）
  const dupOther=(f,t)=>edges.some(x=>x!==e&&((x.from===f&&x.to===t)||(x.from===t&&x.to===f)));
  const headDup=dupOther(e.from,n.id), tailDup=dupOther(n.id,e.to);
  // 占位点视觉中心（y - s*0.22）对齐到分接点
  const s=nsz(n);
  n.x=hit.point[0]; n.y=hit.point[1]+s*0.22;
  if(headDup&&tailDup){ edges=edges.filter(x=>x!==e); invalidateRouting(); return true; }   // 两段都已有共用线 → 整条冗余
  // 手动折线：按当前绘制路径在分接段拆分拐点（前半 = 段 0..segIndex 的内点，后半 = 其余内点）
  let headW=null,restW=null;
  if(e.route==='manual'&&e.waypoints&&e.waypoints.length){
    const pts=edgePath(e)||[];
    headW=pts.slice(1,hit.segIndex+1).map(p=>p.slice());
    restW=pts.slice(hit.segIndex+1,Math.max(hit.segIndex+1,pts.length-1)).map(p=>p.slice());
  }
  const setWps=(edge,wps)=>{ if(wps===null)return; if(wps.length)edge.waypoints=wps; else {delete edge.waypoints;edge.route='smart';} };
  if(tailDup){   // 占位点→终点已有共用线 → 本线截到占位点为止
    e.to=n.id; delete e.toPort; setWps(e,headW);
    if(e.route==='manual')simplifyWaypoints(e);
    invalidateRouting(); return true;
  }
  if(headDup){   // 起点→占位点已有共用线 → 本线改从占位点出发（id/标签随线保留）
    e.from=n.id; delete e.fromPort; setWps(e,restW);
    if(e.route==='manual')simplifyWaypoints(e);
    invalidateRouting(); return true;
  }
  const tail={from:n.id,to:e.to,et:e.et,dir:e.dir||'forward',route:e.route||'smart',lbl:''};
  if(e.toPort)tail.toPort=e.toPort;
  if(e.w)tail.w=e.w;
  if(e.lineColor)tail.lineColor=e.lineColor;
  if(e.lineStyle)tail.lineStyle=e.lineStyle;
  if(e.orthoSnap===false)tail.orthoSnap=false;
  if(e.showWhen!=null)tail.showWhen=e.showWhen;
  if(Array.isArray(e.dirRules)&&e.dirRules.length)tail.dirRules=JSON.parse(JSON.stringify(e.dirRules));
  if(restW!==null&&restW.length){tail.waypoints=restW;tail.route='manual';}else if(restW!==null)tail.route='smart';
  setWps(e,headW);
  e.to=n.id; delete e.toPort;
  edges.splice(edges.indexOf(e)+1,0,tail);   // 紧跟原边插入，保持绘制/序列化顺序稳定
  if(e.route==='manual')simplifyWaypoints(e);
  if(tail.route==='manual')simplifyWaypoints(tail);
  invalidateRouting();
  return true;
}
// ── 汇合规整：连线路径「穿过」某个占位点（非自身端点）时，在该点自动分接；
//    分接出的段落若与既有连线端点重复则去重共用 → 多条线汇合后共用同一条线段（只画一条、一个箭头）。
//    仅在离散提交点调用（新建连线/占位点落点或合并/端点重连），拖拽过程中不调用。调用方负责 snapshot()。
function splitEdgeThroughAnchor(e,n,segIndex){
  // 在占位点中心分接（点即占位点中心 → 不挪动占位点）；头/尾段查重逻辑统一在 attachAnchorToEdge 内
  const s=nsz(n);
  return attachAnchorToEdge(n,{edge:e,point:[n.x,n.y-s*0.22],segIndex});
}
function normalizeAnchorJunctions(){
  // 上限按结构规模推导：每次分接最多让边数 +1，穿过 k 个占位点需 k 次 → 边数+占位点数 足够收敛
  const maxPass=edges.length+nodes.length+12;
  let changed=false,guard=0;
  while(guard++<maxPass){
    let did=false;
    outer:
    for(const e of edges.slice()){
      if(!edges.includes(e))continue;
      if(!nodes.find(x=>x.id===e.from)||!nodes.find(x=>x.id===e.to))continue;
      const pts=edgePath(e); if(!pts||pts.length<2)continue;
      for(const n of nodes){
        if(n.type!=='anchor'||n.id===e.from||n.id===e.to)continue;
        const s=nsz(n), cx=n.x, cy=n.y-s*0.22, tol=Math.max(s*0.45,4);
        for(let i=0;i<pts.length-1;i++){
          const[x1,y1]=pts[i],[x2,y2]=pts[i+1];const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;if(l2<1)continue;
          let t=((cx-x1)*dx+(cy-y1)*dy)/l2;t=Math.max(0,Math.min(1,t));
          const px=x1+t*dx,py=y1+t*dy;
          if(Math.hypot(cx-px,cy-py)>=tol)continue;
          // 投影点不能贴着连线自己的端点（否则是端点相邻，不是"穿过"）
          if(Math.hypot(px-pts[0][0],py-pts[0][1])<=tol||Math.hypot(px-pts[pts.length-1][0],py-pts[pts.length-1][1])<=tol)continue;
          if(splitEdgeThroughAnchor(e,n,i)){did=true;changed=true;break outer;}
        }
      }
    }
    if(!did)break;
  }
  if(changed)invalidateRouting();
  return changed;
}
// ── 占位点合并：把 src 的所有连线改接到 dst 后删除 src → 多个相邻汇合点聚为一个 ──
// 自环（原本连接两点之间的线）删除；同一对端点的重复线只留一条（与创建连线的防重规则一致），
// 重复时优先保留带 id/标签绑定的那条（信号键不丢）。调用方负责前后 snapshot()。
function mergeAnchorInto(src,dst){
  if(!src||!dst||src===dst||src.type!=='anchor'||dst.type!=='anchor')return false;
  edges.forEach(e=>{ if(e.from===src.id)e.from=dst.id; if(e.to===src.id)e.to=dst.id; });
  edges=edges.filter(e=>e.from!==e.to);   // 去自环
  // 同端点对去重：优先保留「带信号键/标签绑定/数据驱动规则」的那条；双方都带元数据时保留先出现的，
  // 并明确告警被丢的信号键/规则（不静默丢链路）
  const meta=e=>!!(e.id||(e.lblBind&&e.lblBind.field)||e.showWhen!=null||(Array.isArray(e.dirRules)&&e.dirRules.length));
  const keep=new Map(),droppedMeta=[];
  edges.forEach(e=>{
    const k=e.from<e.to?(e.from+'>'+e.to):(e.to+'>'+e.from);
    const cur=keep.get(k);
    if(!cur){keep.set(k,e);return;}
    let drop=e;
    if(!meta(cur)&&meta(e)){keep.set(k,e);drop=cur;}
    if(meta(drop))droppedMeta.push(edgeLabelSig(drop)||edgeLabelDisplayName(drop));
  });
  const kept=new Set(keep.values());
  edges=edges.filter(e=>kept.has(e));
  nodes=nodes.filter(n=>n!==src);
  if(selNode===src.id)selNode=dst.id;
  invalidateRouting();
  if(droppedMeta.length)flashHint('⚠ 合并去重删除了带绑定/规则的重复连线：'+droppedMeta.join('、')+'（如需保留请撤销）');
  return true;
}
// 标签背景板颜色（用纯背景色不透明，彻底遮住下方连线，避免文字与线叠加）
function bgPlate(){
  return bgColor;
}

// ── 滑杆+数字输入 成对联动（约定：数字框 id = 滑杆 id + '-num'）──
// 键入值超出滑杆量程时自动扩展量程（不回缩），两控件始终同步；apply* 一律经 pairVal 读数字框
function pairSet(id,val){const s=document.getElementById(id),n=document.getElementById(id+'-num');if(s){if(+val>+s.max)s.max=val;if(+val<+s.min)s.min=val;s.value=val;}if(n)n.value=val;}
function pairFromSlider(id){const s=document.getElementById(id),n=document.getElementById(id+'-num');if(s&&n)n.value=s.value;}
function pairFromNum(id){const s=document.getElementById(id),n=document.getElementById(id+'-num');if(!s||!n)return;const v=parseFloat(n.value);if(!Number.isFinite(v))return;if(v>+s.max)s.max=v;if(v<+s.min)s.min=v;s.value=v;}
function pairVal(id,def){const el=document.getElementById(id+'-num')||document.getElementById(id);const v=el?parseFloat(el.value):NaN;return Number.isFinite(v)?v:def;}

function selectNode(id){
  ensurePropsOpen();
  _devBindProj='';   // 切换节点重置设备绑定的项目筛选(随新节点已选设备在 refreshDeviceBindUI 内重新派生)
  selNode=id;selEdge=null;const n=nodes.find(x=>x.id===id);if(!n){showPanel('none');return;}
  showPanel('node');
  document.getElementById('p-id').value=n.id;
  document.getElementById('p-label-zh').value=n.labelZh||n.label||'';
  document.getElementById('p-label-en').value=n.labelEn||'';
  document.getElementById('p-type').value=n.type;
  pairSet('p-fs',n.fontSize||14);
  pairSet('p-scale',Math.round((n.scale||1)*100));
  pairSet('p-rot',n.rotation||0);
  document.getElementById('p-fc').value=n.fontColor||'#e8f4ff';document.getElementById('p-fc-hex').value=n.fontColor||'#e8f4ff';
  document.getElementById('p-x').textContent=n.x.toFixed(0);document.getElementById('p-y').textContent=n.y.toFixed(0);
  // 文本框 / 变量 / 表格节点：隐藏类型/图标大小，数据字段走标准配置
  const isText=n.type==='text';
  const isVariable=n.type==='variable';
  const isTable=n.type==='table';
  const isTextBox=isText||isVariable||isTable;
  {const el=document.getElementById('prow-type');if(el)el.style.display=isTextBox?'none':'';}
  // 图标大小滑杆：文本/变量按字号缩放（隐藏）；表格用它做「整体缩放」（行高/列宽/内边距/字号一起缩）
  {const el=document.getElementById('prow-scale');if(el){el.style.display=(isText||isVariable)?'none':'';
    const lb=el.querySelector('label');if(lb)lb.textContent=isTable?'整体缩放':(lang==='en'?'Icon Size':'图标大小');}}
  // 图标规则：仅对「有图标」的设备节点开放（文本/变量/表格无图标、占位点走独立绘制，均隐藏此入口）
  {const el=document.getElementById('prow-iconrule');if(el)el.style.display=(isTextBox||n.type==='anchor')?'none':'';}
  // 数据字段列表：表格的绑定在「表格」分组按单元格编辑（字段由绑定格自动生成），隐藏原始字段列表防误改
  ['prow-data','prow-datasep'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=isTable?'none':'';});
  // 画布显示开关：反映当前节点的 hideLabel / hideFields
  const slEl=document.getElementById('p-show-label'),sfEl=document.getElementById('p-show-fields');
  if(slEl)slEl.checked=!n.hideLabel; if(sfEl)sfEl.checked=!n.hideFields;
  const slTxt=document.getElementById('p-show-label-text'),sfWrap=document.getElementById('p-show-fields-wrap');
  if(slTxt){const t=isTable?'显示标题':(isTextBox?'显示文本':'显示名称');slTxt.textContent=lang==='en'?(isTable?'Show Title':(isTextBox?'Show Text':'Show Name')):t;slTxt.setAttribute('data-i18n',t);}
  if(sfWrap)sfWrap.style.display=isTextBox?'none':'flex';
  // 占位点外观：仅 anchor 类型显示填充/不透明度
  const isAnchor=n.type==='anchor';
  document.getElementById('anchor-style').style.display=isAnchor?'block':'none';
  if(isAnchor){
    const hasFill=(n.fill&&n.fill!=='none');
    document.getElementById('p-anchor-fill').value=hasFill?n.fill:'#4dd0ff';
    document.getElementById('p-anchor-fill-hex').value=hasFill?n.fill:'';
    const op=Math.round((n.opacity!=null?n.opacity:1)*100);
    document.getElementById('p-anchor-op').value=op;document.getElementById('p-anchor-op-v').textContent=op;
  }
  const fsLabelTxt=isText?'文字字号':(isVariable?'标签(label)字号':(isTable?'单元格字号':'标签字号'));
  document.getElementById('p-fs-label').textContent=fsLabelTxt;
  pairSet('p-fs',n.fontSize||(isText?18:14));
  document.getElementById('p-fc-label').textContent=isText?'文字颜色':(isVariable?'标签(label)颜色':(isTable?'文字颜色（静态格/标题）':'标签颜色'));
  document.querySelector('#pnode .pr label').textContent=isText?'文本框 ID':(isVariable?'变量 ID':(isTable?'表格 ID':'节点 ID'));
  // 盒子样式（背景/边框/圆角）：文本框 + 变量节点共用
  document.getElementById('text-style').style.display=isTextBox?'block':'none';
  if(isTextBox){
    document.getElementById('p-bg').value=(n.bg&&n.bg!=='none')?n.bg:'#102a52';
    document.getElementById('p-bg-hex').value=(n.bg&&n.bg!=='none')?n.bg:'';
    document.getElementById('p-border').value=n.border||'none';
    document.getElementById('p-border-color').value=n.borderColor||'#4dd0ff';
    document.getElementById('p-border-color-hex').value=n.borderColor||'#4dd0ff';
    pairSet('p-bw',n.borderWidth!=null?n.borderWidth:1.5);
    // 边框细项（颜色/线宽）仅在选了边框样式时展示
    document.getElementById('border-detail').style.display=(n.border&&n.border!=='none')?'':'none';
    // 圆角：内部存 数字=px / 'NN%'=百分比（按盒子高度），回填到 数值+单位 两个控件
    fillRadiusControls('p-radius','p-radius-unit',n.radius!=null?n.radius:6);
  }
  // 表格节点专属：行列/表头/网格样式 + 单元格内容编辑
  {const el=document.getElementById('table-style');if(el)el.style.display=isTable?'block':'none';}
  if(isTable){
    pairSet('p-tbl-rows',Math.max(1,(n.rows|0)||1));
    pairSet('p-tbl-cols',Math.max(1,(n.cols|0)||1));
    document.getElementById('p-tbl-hrow').checked=!!n.headerRow;
    document.getElementById('p-tbl-hcol').checked=!!n.headerCol;
    const hb=(n.headerBg&&n.headerBg!=='none');
    document.getElementById('p-tbl-hbg').value=hb?n.headerBg:'#143560';
    document.getElementById('p-tbl-hbg-hex').value=hb?n.headerBg:'';
    document.getElementById('p-tbl-hfc').value=n.headerColor||'#cfe4ff';
    document.getElementById('p-tbl-hfc-hex').value=n.headerColor||'#cfe4ff';
    document.getElementById('p-tbl-grid').value=n.gridColor||'#2a5a9a';
    document.getElementById('p-tbl-grid-hex').value=n.gridColor||'#2a5a9a';
    pairSet('p-tbl-gw',n.gridWidth!=null?n.gridWidth:1);
    document.getElementById('p-tbl-vc').value=n.valColor||'#4dd0ff';
    document.getElementById('p-tbl-vc-hex').value=n.valColor||'#4dd0ff';
    pairSet('p-tbl-minw',n.colMinW!=null?n.colMinW:64);
    pairSet('p-tbl-rowh',n.rowH>0?n.rowH:0);
    pairSet('p-tbl-colw',n.colW>0?n.colW:0);
    pairSet('p-tbl-padx',n.padX!=null?n.padX:10);
    pairSet('p-tbl-pady',n.padY!=null?n.padY:6);
    renderTableCells(n);
  }
  // 变量节点专属：排列方式 + label/value 字体属性
  document.getElementById('variable-style').style.display=isVariable?'block':'none';
  if(isVariable){
    document.getElementById('p-var-layout').value=(n.varLayout==='v'?'v':'h');
    document.getElementById('p-label-bold').checked=(n.labelBold!==false);
    const vfs=(n.valFontSize!=null?n.valFontSize:(n.fontSize||16));
    pairSet('p-val-fs',vfs);
    document.getElementById('p-val-color').value=n.valColor||'#4dd0ff';
    document.getElementById('p-val-color-hex').value=n.valColor||'#4dd0ff';
    document.getElementById('p-val-bold').checked=!!n.valBold;
  }
  // 数据字段卡片样式：仅设备类节点（文本框/变量/占位点无字段卡片）
  const showFieldStyle=!isTextBox&&!isAnchor;
  document.getElementById('field-style').style.display=showFieldStyle?'block':'none';
  if(showFieldStyle){
    document.getElementById('p-df-bg').value=n.fieldBg||'#0a1628';
    document.getElementById('p-df-bg-hex').value=n.fieldBg||'';
    document.getElementById('p-df-border').value=n.fieldBorder||'inherit';
    document.getElementById('p-df-bc').value=n.fieldBorderColor||'#7896b4';
    document.getElementById('p-df-bc-hex').value=n.fieldBorderColor||'';
    pairSet('p-df-bw',n.fieldBorderWidth!=null?n.fieldBorderWidth:1.2);
    fillRadiusControls('p-df-radius','p-df-radius-unit',n.fieldRadius!=null?n.fieldRadius:5);
    document.getElementById('df-border-detail').style.display=(n.fieldBorder==='solid'||n.fieldBorder==='dashed')?'':'none';
  }
  renderNodeActionControls(n);
  renderDFs(n);
  refreshNodeRuleSummary(n);
  refreshNodeIconRuleSummary(n);
  updGfdSelBtn();   // 单选/点选字段卡片路径不经 updateAlignBar，这里兜底刷新「仅选中节点」计数
}
// 数据字段卡片样式（单节点）：背景/边框/线宽/圆角 → n.fieldBg/fieldBorder/fieldBorderColor/fieldBorderWidth/fieldRadius
// 未设置(删除属性)=沿用默认外观；告警/选中态配色在渲染层优先于自定义
function applyFieldStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const act=document.activeElement?document.activeElement.id:'';
  const bgPick=document.getElementById('p-df-bg'),bgHex=document.getElementById('p-df-bg-hex');
  if(act==='p-df-bg'){ n.fieldBg=bgPick.value; bgHex.value=bgPick.value; }
  else if(act==='p-df-bg-hex'){
    const v=bgHex.value.trim();
    if(v==='')delete n.fieldBg;
    else if(/^#?[0-9a-fA-F]{6}$/.test(v)){n.fieldBg=(v[0]==='#'?v:'#'+v);bgPick.value=n.fieldBg;}
  }
  const bs=document.getElementById('p-df-border').value;
  // 仅 实线/虚线 才保留边框颜色/线宽；「默认（浅色细边）」和「无边框」都要清掉这两个细项，
  // 否则渲染/导出会继续沿用旧的自定义颜色/线宽（默认细边不再是默认样式）
  if(bs==='solid'||bs==='dashed'){
    n.fieldBorder=bs;
    const bcPick=document.getElementById('p-df-bc'),bcHex=document.getElementById('p-df-bc-hex');
    if(act==='p-df-bc'){ n.fieldBorderColor=bcPick.value; bcHex.value=bcPick.value; }
    else if(act==='p-df-bc-hex'){
      const v=bcHex.value.trim();
      if(/^#?[0-9a-fA-F]{6}$/.test(v)){n.fieldBorderColor=(v[0]==='#'?v:'#'+v);bcPick.value=n.fieldBorderColor;}
    }
    n.fieldBorderWidth=Math.max(0.5,Math.min(20,pairVal('p-df-bw',1.2)));
  }else{
    if(bs==='inherit')delete n.fieldBorder; else n.fieldBorder=bs;   // 'none'=显式无边框
    delete n.fieldBorderColor;delete n.fieldBorderWidth;
  }
  n.fieldRadius=readRadiusControls('p-df-radius','p-df-radius-unit');
  // 属性面板是「节点级整体设置」：清掉各字段的字段级覆盖（外观面板④框选单卡片写入的 chip*），否则这里的修改会被盖住看不到效果
  if(n.data)n.data.forEach(f=>{['chipBg','chipBorder','chipBorderColor','chipBorderWidth','chipRadius'].forEach(k=>delete f[k]);});
  document.getElementById('df-border-detail').style.display=(n.fieldBorder==='solid'||n.fieldBorder==='dashed')?'':'none';
}
function resetFieldBg(){const n=nodes.find(x=>x.id===selNode);if(!n)return;delete n.fieldBg;document.getElementById('p-df-bg-hex').value='';}
function resetFieldStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  snapshot();
  ['fieldBg','fieldBorder','fieldBorderColor','fieldBorderWidth','fieldRadius'].forEach(k=>delete n[k]);
  // 同时清掉各字段的字段级覆盖，真正回到默认外观
  if(n.data)n.data.forEach(f=>{['chipBg','chipBorder','chipBorderColor','chipBorderWidth','chipRadius'].forEach(k=>delete f[k]);});
  snapshot();
  selectNode(n.id);
}
function applyTextStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  // 颜色一律以「正在编辑的那个控件」为准：此前 hex 旧值总覆盖取色器新值，导致背景只生效一次、边框颜色改不动
  const act=document.activeElement?document.activeElement.id:'';
  const bgPick=document.getElementById('p-bg'),bgHex=document.getElementById('p-bg-hex');
  if(act==='p-bg'){ n.bg=bgPick.value; bgHex.value=bgPick.value; }
  else if(act==='p-bg-hex'){
    const v=bgHex.value.trim();
    if(v==='')n.bg='none';
    else if(/^#?[0-9a-fA-F]{6}$/.test(v)){n.bg=(v[0]==='#'?v:'#'+v);bgPick.value=n.bg;}
  }
  n.border=document.getElementById('p-border').value;
  const bcPick=document.getElementById('p-border-color'),bcHex=document.getElementById('p-border-color-hex');
  if(act==='p-border-color'){ n.borderColor=bcPick.value; bcHex.value=bcPick.value; }
  else if(act==='p-border-color-hex'){
    const v=bcHex.value.trim();
    if(/^#?[0-9a-fA-F]{6}$/.test(v)){n.borderColor=(v[0]==='#'?v:'#'+v);bcPick.value=n.borderColor;}
  }
  n.borderWidth=Math.max(0.5,Math.min(20,pairVal('p-bw',1.5)));
  // 圆角：数值+单位。px 存数字；% 存 'NN%'（绘制时按盒子高度换算，50%=胶囊）
  n.radius=readRadiusControls('p-radius','p-radius-unit');
  document.getElementById('border-detail').style.display=(n.border&&n.border!=='none')?'':'none';
}
function clearTextBg(){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.bg='none';document.getElementById('p-bg-hex').value='';}
// 圆角「数值+单位」通用逻辑（盒子 p-radius / 字段卡片 p-df-radius、gfd-radius 共用）：
// % 模式量程 0–50（50%=胶囊）；px 模式恢复滑杆自带量程(data-pxmax)，键入更大值经 pairFromNum 自动扩展
function radiusUnitRange(sliderId,unit){const s=document.getElementById(sliderId);if(!s)return;if(unit==='%'){s.max=50;if(+s.value>50)s.value=50;}else s.max=Math.max(+(s.dataset.pxmax||60),+s.value);}
function onRadiusUnit(sliderId,unitId,applyFn){
  const unit=document.getElementById(unitId).value;
  let v=pairVal(sliderId,unit==='%'?25:6);
  if(unit==='%')v=Math.max(0,Math.min(50,v));
  radiusUnitRange(sliderId,unit);
  pairSet(sliderId,v);
  if(typeof applyFn==='function')applyFn();
}
// 圆角控件回填：内部值 数字=px / 'NN%'=百分比 → 拆到 数值+单位
function fillRadiusControls(sliderId,unitId,val){
  const pct=(typeof val==='string'&&val.trim().endsWith('%'));
  document.getElementById(unitId).value=pct?'%':'px';
  radiusUnitRange(sliderId,pct?'%':'px');
  pairSet(sliderId,pct?Math.max(0,Math.min(50,parseFloat(val)||0)):Math.max(0,(typeof val==='number'?val:parseFloat(val))||0));
}
// 圆角控件读值 → 内部存储值（px 数字 / 'NN%'）
function readRadiusControls(sliderId,unitId){
  const unit=document.getElementById(unitId).value;
  let v=Math.max(0,pairVal(sliderId,6));
  if(unit==='%'){
    v=Math.min(50,v);
    document.getElementById(sliderId).max=50;
    if(parseFloat(document.getElementById(sliderId+'-num').value)>50)pairSet(sliderId,v);
    return v+'%';
  }
  return v;
}
// 变量节点：排列方式 + label/value 字体属性（label 复用 p-fs/p-fc/p-label-bold，value 用 p-val-*）
function applyVarStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='variable')return;
  n.varLayout=document.getElementById('p-var-layout').value==='v'?'v':'h';
  n.labelBold=document.getElementById('p-label-bold').checked;
  n.valFontSize=Math.max(4,Math.min(300,Math.round(pairVal('p-val-fs',16))));
  n.valBold=document.getElementById('p-val-bold').checked;
  // 以「正在编辑的控件」为准，避免 hex 旧值覆盖取色器新值（同 applyTextStyle）
  const act=document.activeElement?document.activeElement.id:'';
  const vcPick=document.getElementById('p-val-color'),vcHex=document.getElementById('p-val-color-hex');
  if(act==='p-val-color'){ n.valColor=vcPick.value; vcHex.value=vcPick.value; }
  else if(act==='p-val-color-hex'){
    const v=vcHex.value.trim();
    if(/^#?[0-9a-fA-F]{6}$/.test(v)){ n.valColor=(v[0]==='#'?v:'#'+v); vcPick.value=n.valColor; }
  }
}
function syncVarColor(v){if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById('p-val-color').value=v;applyVarStyle();}}
// ───── 表格节点：行列/表头/网格样式 + 单元格内容编辑（绑定复用 openFieldBind/openFieldDict 全链路）─────
// 表格 UI 双语：动态拼接的字符串统一走 TT（面板静态文案走 data-i18n 字典）
function TT(zh,en){return lang==='en'?en:zh;}
function applyTableStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  // 样式面板撤销：首个改动前快照一次（保底回退点），停止调整 800ms 后再补一张「定稿」快照——
  // 没有定稿快照的话 redo 只会回放改动前状态、样式调整永远重做不出来；逐键快照则会刷爆历史
  if(_tblStyleSnapId!==n.id){snapshot();_tblStyleSnapId=n.id;}
  clearTimeout(_tblStyleSnapT);
  _tblStyleSnapT=setTimeout(()=>{snapshot();_tblStyleSnapId=null;},800);
  const hadHR=!!n.headerRow, hadHC=!!n.headerCol;
  n.headerRow=document.getElementById('p-tbl-hrow').checked;
  n.headerCol=document.getElementById('p-tbl-hcol').checked;
  // 勾上表头时该行/列已有绑定格 → 提示（表头格显示表头文字而非绑定值；单元格弹框仍可解绑，非死角）
  if(!hadHR&&n.headerRow&&(n.data||[]).some(f=>f.tr===0))
    flashHint(TT('注意：首行已有绑定格——勾为表头后显示表头文字而非绑定值，可在「编辑单元格」里解绑','Row 1 has bound cells — as header they show text, unbind in cell editor'));
  if(!hadHC&&n.headerCol&&(n.data||[]).some(f=>f.tr!=null&&f.tc===0))
    flashHint(TT('注意：首列已有绑定格——勾为表头后显示表头文字而非绑定值，可在「编辑单元格」里解绑','Column 1 has bound cells — as header they show text, unbind in cell editor'));
  n.gridWidth=Math.max(0.5,Math.min(10,pairVal('p-tbl-gw',1)));
  n.colMinW=Math.max(20,Math.min(600,Math.round(pairVal('p-tbl-minw',64))));
  // 行高 / 固定列宽：0=自动（行高按字号+内边距，列宽按内容自适应）；>0 为屏幕 px（随整表缩放）
  const rh=Math.max(0,Math.round(pairVal('p-tbl-rowh',0)));
  if(rh>0)n.rowH=rh;else delete n.rowH;
  const cw=Math.max(0,Math.round(pairVal('p-tbl-colw',0)));
  if(cw>0)n.colW=cw;else delete n.colW;
  // 单元格内边距：横=左右留白；纵=上下留白（自动行高时即「行间距」）
  n.padX=Math.max(0,Math.min(80,Math.round(pairVal('p-tbl-padx',10))));
  n.padY=Math.max(0,Math.min(80,Math.round(pairVal('p-tbl-pady',6))));
  // 颜色一律以「正在编辑的那个控件」为准（同 applyTextStyle），hex 框留空=清除表头底色
  const act=document.activeElement?document.activeElement.id:'';
  const pick=(pid,hid,key,allowNone)=>{
    const p=document.getElementById(pid),h=document.getElementById(hid);
    if(act===pid){n[key]=p.value;h.value=p.value;}
    else if(act===hid){
      const v=h.value.trim();
      if(v===''&&allowNone)n[key]='none';
      else if(/^#?[0-9a-fA-F]{6}$/.test(v)){n[key]=(v[0]==='#'?v:'#'+v);p.value=n[key];}
    }
  };
  pick('p-tbl-hbg','p-tbl-hbg-hex','headerBg',true);
  pick('p-tbl-hfc','p-tbl-hfc-hex','headerColor',false);
  pick('p-tbl-grid','p-tbl-grid-hex','gridColor',false);
  pick('p-tbl-vc','p-tbl-vc-hex','valColor',false);
}
// 行列数变更：缩小时若会丢弃绑定格先确认；被裁掉的静态文字/绑定字段一并清除（可撤销）
async function applyTableSize(){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  const rows=Math.max(1,Math.min(100,Math.round(pairVal('p-tbl-rows',n.rows||1))));
  const cols=Math.max(1,Math.min(30,Math.round(pairVal('p-tbl-cols',n.cols||1))));
  if(rows===(n.rows||1)&&cols===(n.cols||1))return;
  const dropped=(n.data||[]).filter(f=>f.tr!=null&&(f.tr>=rows||f.tc>=cols));
  if(dropped.length){
    const ok=await uiConfirm(TT('缩小行列会删除 ','Shrinking removes ')+dropped.length+TT(' 个超出范围的绑定单元格，确定？',' out-of-range bound cell(s). Continue?'),true);
    if(!ok){pairSet('p-tbl-rows',n.rows||1);pairSet('p-tbl-cols',n.cols||1);return;}
  }
  snapshot();
  n.rows=rows;n.cols=cols;
  n.data=(n.data||[]).filter(f=>f.tr==null||(f.tr<rows&&f.tc<cols));
  if(n.cells)Object.keys(n.cells).forEach(k=>{const p=k.split(',');if(+p[0]>=rows||+p[1]>=cols)delete n.cells[k];});
  // 存活合并锚点的 span 钳制到新表内（否则渲染只是裁剪、导出仍带越界 span，再扩表会诡异复活）
  (n.data||[]).forEach(f=>{
    if(f.tr==null)return;
    if(f.spanR>1){f.spanR=Math.min(f.spanR,rows-f.tr);if(f.spanR<=1)delete f.spanR;}
    if(f.spanC>1){f.spanC=Math.min(f.spanC,cols-f.tc);if(f.spanC<=1)delete f.spanC;}
  });
  if(n.cells)Object.keys(n.cells).forEach(k=>{
    const v=n.cells[k];if(!v||typeof v!=='object')return;
    const p=k.split(','),r=+p[0],c=+p[1];
    if(v.spanR>1){v.spanR=Math.min(v.spanR,rows-r);if(v.spanR<=1)delete v.spanR;}
    if(v.spanC>1){v.spanC=Math.min(v.spanC,cols-c);if(v.spanC<=1)delete v.spanC;}
  });
  snapshot();
  renderTableCells(n);
}
// ── 单元格编辑弹框：面板太窄放不下多列，抽成独立宽弹框（绑定/字典/生成弹窗 z-index 更高，可叠加打开）──
// 保存/取消语义：打开时快照表格状态（含绑定弹窗/生成向导在弹框内造成的改动），「保存」生效并入历史，
// 「取消 / ✕ / 点遮罩」有改动时确认后整体回滚。keepOrig=true 表示弹框内重建（生成向导后刷新），沿用最初快照。
function _tblEdState(n){return JSON.stringify({rows:n.rows,cols:n.cols,headerRow:!!n.headerRow,headerCol:!!n.headerCol,cells:n.cells||{},data:n.data||[]});}
function openTableCellEditor(keepOrig){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  const prev=document.getElementById('tbl-ed-overlay');
  const prevOrig=(keepOrig&&prev)?prev._orig:null;
  closeTableCellEditor();
  const ov=document.createElement('div');ov.id='tbl-ed-overlay';
  ov._orig=prevOrig||_tblEdState(n);
  ov._nid=n.id;
  ov._selCells=new Set();
  ov.onclick=e=>{if(e.target===ov)tblEdCancel();};
  ov.innerHTML='<div id="tbl-ed-box"><button class="dlg-close" onclick="tblEdCancel()" title="'+TT('取消（不保存）','Cancel (discard)')+'" aria-label="'+TT('关闭','Close')+'">✕</button>'+
    '<div id="fb-title">📝 '+TT('单元格内容','Cell contents')+' · '+tplEsc(n.id)+'（'+n.rows+' × '+n.cols+'）</div>'+
    '<div class="phint" style="margin:2px 0 8px">'+TT(
      '静态格填中/英文字；🔗 绑定后台字段（输入框变为默认值）；📖 值字典；🎨 格样式（颜色/加粗/对齐）；⇊ 绑定按各行设备应用到整列。'+
      '在空白处<b>拖拽框选</b>、点<b>行/列序号</b>整行整列选择（<b>右键序号</b>可插入/删除/移动行列、设列宽与对齐）；'+
      '选中矩形区域可「合并」为一格。修改需点「保存」生效，取消则全部回滚。',
      'Static cells: type zh/en text. 🔗 bind backend field (input becomes default value); 📖 value dict; 🎨 cell style; ⇊ fill column. '+
      '<b>Drag</b> to select, click <b>row/col headers</b> to toggle lines (<b>right-click headers</b> to insert/delete/move, set width & align); '+
      'a rectangular selection can be <b>merged</b>. Click Save to apply; Cancel rolls everything back.')+'</div>'+
    '<div id="tbl-ed-grid"></div>'+
    '<div style="display:flex;gap:8px;margin-top:10px;flex-shrink:0;flex-wrap:wrap">'+
    '<button class="tb" id="tbl-ed-del" onclick="tblEdDeleteSel()" disabled>🗑 '+TT('删除选中','Delete sel.')+'</button>'+
    '<button class="tb" id="tbl-ed-copy" onclick="tblCopySel()" disabled>⧉ '+TT('复制','Copy')+'</button>'+
    '<button class="tb" id="tbl-ed-paste" onclick="tblPasteSel()" disabled>📥 '+TT('粘贴','Paste')+'</button>'+
    '<button class="tb" id="tbl-ed-merge" onclick="tblMergeSel()" disabled>▦ '+TT('合并','Merge')+'</button>'+
    '<button class="tb" id="tbl-ed-unmerge" onclick="tblUnmergeSel()" disabled>▤ '+TT('取消合并','Unmerge')+'</button>'+
    '<button class="tb grn" onclick="openTableGen()">⚡ '+TT('从设备生成表格','Generate from devices')+'</button>'+
    '<button class="tb" onclick="tblClearAll()">'+TT('清空内容','Clear all')+'</button>'+
    '<span style="flex:1"></span>'+
    '<button class="tb" onclick="tblEdCancel()">'+TT('取消','Cancel')+'</button>'+
    '<button class="tb grn" onclick="tblEdSave()">✓ '+TT('保存','Save')+'</button></div></div>';
  document.body.appendChild(ov);
  // 捕获期按键：Del 删除选中格（同时挡住画布全局 Del 误删表格节点）；Esc 先清选择、再退出（=取消）；
  // Ctrl+Z/Y 拦下画布全局撤销（undo() 会清 selNode，弹框将整体失联）——输入框内放行原生文本撤销
  ov._keydown=e=>{
    if(!document.getElementById('tbl-ed-overlay'))return;
    const tag=(document.activeElement&&document.activeElement.tagName)||'';
    const inField=(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA');
    if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z'||e.key==='y'||e.key==='Y')){
      e.stopPropagation();
      if(!inField)e.preventDefault();
      return;
    }
    if((e.key==='Delete'||e.key==='Backspace')&&!inField){
      e.preventDefault();e.stopPropagation();
      if(!document.getElementById('fb-overlay'))tblEdDeleteSel();   // 绑定/生成弹窗开着时只挡按键，不误删
    }else if(e.key==='Escape'&&!document.getElementById('fb-overlay')){
      e.stopPropagation();
      const s=ov._selCells;
      if(s&&s.size){s.clear();tblEdSyncSel();}else tblEdCancel();
    }
  };
  document.addEventListener('keydown',ov._keydown,true);
  renderTableCells(n);
}
function closeTableCellEditor(){
  const ov=document.getElementById('tbl-ed-overlay');
  if(ov){if(ov._keydown)document.removeEventListener('keydown',ov._keydown,true);ov.remove();}
  const mq=document.getElementById('tbl-marquee');if(mq)mq.remove();
}
// 取消：有改动时确认后整体回滚到打开时的状态（含弹框内的绑定/生成/清空/删除）
async function tblEdCancel(){
  const ov=document.getElementById('tbl-ed-overlay');if(!ov)return;
  const n=nodes.find(x=>x.id===ov._nid);
  if(n&&n.type==='table'&&_tblEdState(n)!==ov._orig){
    const ok=await uiConfirm(TT('取消将放弃本次弹框中的全部修改（含绑定/生成/删除），确定？','Cancel discards ALL changes made in this dialog (bindings/generation/deletions). Continue?'),true);
    if(!ok)return;
    const o=JSON.parse(ov._orig);
    n.rows=o.rows;n.cols=o.cols;n.headerRow=o.headerRow;n.headerCol=o.headerCol;n.cells=o.cells;n.data=o.data;
    if(selNode===n.id)selectNode(n.id);
  }
  closeTableCellEditor();
}
function tblEdSave(){
  const ov=document.getElementById('tbl-ed-overlay');if(!ov)return;
  const n=nodes.find(x=>x.id===ov._nid);
  const changed=n&&_tblEdState(n)!==ov._orig;
  closeTableCellEditor();
  if(n&&changed){
    // 弹框内的绑定/生成/删除操作已各自入历史；这里只兜底「直接键入的文字/默认值」——与最近历史一致则不再重复快照，
    // 否则撤销要多按一次才能回到修改前
    const cur=JSON.stringify({nodes,edges,bgColor,routeStyle});
    if(history[histIdx]!==cur)snapshot();
    if(selNode===n.id)selectNode(n.id);
    flashHint(TT('表格修改已保存','Table changes saved'));
  }
}
// 删除框选/序号选中的单元格：静态文字与绑定字段一并清除
function tblEdDeleteSel(){
  const ov=document.getElementById('tbl-ed-overlay');
  const sel=ov&&ov._selCells;if(!sel||!sel.size)return;
  const n=nodes.find(x=>x.id===ov._nid);if(!n||n.type!=='table')return;
  snapshot();
  sel.forEach(k=>{
    const p=k.split(','),r=+p[0],c=+p[1];
    const i=tblFieldIndex(n,r,c);if(i>=0)n.data.splice(i,1);
    if(n.cells)delete n.cells[k];
  });
  const cnt=sel.size;sel.clear();
  snapshot();
  renderDFs(n);
  flashHint(TT('已清除 ','Cleared ')+cnt+TT(' 个单元格的内容与绑定',' cell(s)'));
}
// 选中集的包围矩形；isRect=选中格恰好铺满该矩形（合并的前提）
function _tblSelRect(sel){
  if(!sel||!sel.size)return null;
  let r0=1e9,c0=1e9,r1=-1,c1=-1;
  sel.forEach(k=>{const p=k.split(','),r=+p[0],c=+p[1];r0=Math.min(r0,r);c0=Math.min(c0,c);r1=Math.max(r1,r);c1=Math.max(c1,c);});
  return {r0,c0,r1,c1,isRect:sel.size===(r1-r0+1)*(c1-c0+1)};
}
// 选中态同步：格子高亮 + 底部操作按钮启停（删除/复制/粘贴/合并/取消合并）
function tblEdSyncSel(){
  const ov=document.getElementById('tbl-ed-overlay');if(!ov)return;
  const sel=ov._selCells;
  ov.querySelectorAll('.tblc[data-rc]').forEach(el=>el.classList.toggle('sel',sel.has(el.dataset.rc)));
  const b=document.getElementById('tbl-ed-del');
  if(b){b.disabled=!sel.size;b.textContent='🗑 '+TT('删除选中','Delete sel.')+(sel.size?('('+sel.size+')'):'');}
  const n=nodes.find(x=>x.id===ov._nid);
  const rect=_tblSelRect(sel);
  const cp=document.getElementById('tbl-ed-copy');if(cp)cp.disabled=!sel.size;
  const ps=document.getElementById('tbl-ed-paste');if(ps)ps.disabled=!(_tblClip&&sel.size);
  // 合并：矩形铺满选择 + 至少 2 格 + 不与选区外的既有合并区交叠
  let canMerge=false,touchMerged=false;
  if(n&&rect){
    const cover=tblCoverMap(n);
    let overlapOut=false;
    sel.forEach(k=>{const p=k.split(','),a=cover[+p[0]]&&cover[+p[0]][+p[1]];
      if(a){touchMerged=true;
        if(a.ar<rect.r0||a.ac<rect.c0)overlapOut=true;
        else{const src=tableCellField(n,a.ar,a.ac)||((n.cells||{})[a.ar+','+a.ac])||{};
          if(a.ar+(src.spanR||1)-1>rect.r1||a.ac+(src.spanC||1)-1>rect.c1)overlapOut=true;}
      }});
    canMerge=rect.isRect&&sel.size>1&&!overlapOut;
  }
  const mg=document.getElementById('tbl-ed-merge');if(mg)mg.disabled=!canMerge;
  const um=document.getElementById('tbl-ed-unmerge');if(um)um.disabled=!touchMerged;
}
// 单元格编辑网格（渲染到弹框内）：行/列序号条 + 每格输入框（静态格=文字；绑定格=默认值，实时数据覆盖）。
// 普通格 🔗绑定 / 🖼图标 / 🎨样式 / 📖字典 / ⇊整列 / ✕解绑；表头格保留 🎨 与（已有绑定时的）🔗/✕——
// 先绑定后勾表头的格由此仍可解绑，不再是死角。被合并覆盖的格渲染为不可编辑的占位（内容在锚点格）。
function renderTableCells(n){
  const host=document.getElementById('tbl-ed-grid');if(!host||!n||n.type!=='table')return;
  const rows=Math.max(1,(n.rows|0)||1), cols=Math.max(1,(n.cols|0)||1);
  const cover=tblCoverMap(n);
  const st=host.scrollTop, sl=host.scrollLeft;   // 重渲染（绑定确定/整列填充后）保持滚动位置
  let html='<div class="tblgrid" style="grid-template-columns:34px repeat('+cols+',minmax(150px,1fr))">';
  html+='<span class="tbl-idx"></span>';
  const idxTip=TT('点击选择/取消整列；右键：插入/删除/移动/列宽/对齐','Click: toggle column; right-click: insert/delete/move/width/align');
  const idxTipR=TT('点击选择/取消整行；右键：插入/删除/移动','Click: toggle row; right-click: insert/delete/move');
  for(let c=0;c<cols;c++)html+='<span class="tbl-idx" data-c="'+c+'" title="'+idxTip+'">C'+(c+1)+'</span>';
  for(let r=0;r<rows;r++){
    html+='<span class="tbl-idx" data-r="'+r+'" title="'+idxTipR+'">R'+(r+1)+'</span>';
    for(let c=0;c<cols;c++){
      const cvr=cover[r]&&cover[r][c];
      if(cvr&&(cvr.ar!==r||cvr.ac!==c)){   // 被合并区覆盖：占位、不可编辑（选择仍可点，用于取消合并）
        html+='<div class="tblc cov" data-rc="'+r+','+c+'" title="'+TT('合并区（锚点 R','Merged cell (anchor R')+(cvr.ar+1)+'C'+(cvr.ac+1)+'）">⧉</div>';
        continue;
      }
      const i=tblFieldIndex(n,r,c), f=i>=0?n.data[i]:null, bound=!!(f&&bindHasSource(f.bind));
      const hdr=(n.headerRow&&r===0)||(n.headerCol&&c===0);
      const cv=n.cells&&n.cells[r+','+c];
      const zh=(cv&&typeof cv==='object')?(cv.zh||''):(cv==null?'':String(cv));
      const en=(cv&&typeof cv==='object')?(cv.en||''):'';
      const hasIcon=!!(f&&(f.cellShow||f.icon||(Array.isArray(f.iconRules)&&f.iconRules.length)));
      const hasStyle=!!((f&&(f.cellColor||f.cellBg||f.cellBold||f.cellAlign))||(cv&&typeof cv==='object'&&(cv.color||cv.bg||cv.bold||cv.align)));
      const spanR=(f?f.spanR:(cv&&cv.spanR))||1, spanC=(f?f.spanC:(cv&&cv.spanC))||1;
      const tip=bound?(TT('已绑定：','Bound: ')+fieldBindSummary(n,f)+TT('（输入框=无实时数据时的默认值）',' (input = default when no live data)'))
        :(hdr?TT('表头文字（静态，中英双语）','Header text (static, zh/en)'):TT('静态文字（中英双语）；🔗 绑定数据字段，🖼 配置动态图标','Static text (zh/en); 🔗 bind field, 🖼 dynamic icon'));
      const hasDict=bound&&f.dict!==undefined&&f.dict!==null;
      let srcTxt=bound?fieldBindSummary(n,f):'';
      if(hasIcon)srcTxt+=(srcTxt?' · ':'')+'🖼 '+({icon:TT('仅图标','icon'),both:TT('图标+值','icon+value')}[f.cellShow]||TT('仅值','value'))+((f.iconRules&&f.iconRules.length)?('，'+f.iconRules.length+TT(' 条规则',' rules')):'');
      if(spanR>1||spanC>1)srcTxt=(srcTxt?srcTxt+' · ':'')+'▦ '+spanR+'×'+spanC;
      if(f&&f.decimals!=null)srcTxt+=(srcTxt?' · ':'')+TT('小数','dp ')+f.decimals+TT(' 位','');
      const paintBtn='<button class="df-bind'+(hasStyle?' bound':'')+'" onclick="tblCellStylePopover('+r+','+c+',event)" title="'+TT('格样式：文字色/底色/加粗/对齐（多选时应用到所有选中格）','Cell style: color/bg/bold/align (applies to selection)')+'">🎨</button>';
      html+='<div class="tblc'+(bound?' bound':'')+(hdr?' hdr':'')+'" data-rc="'+r+','+c+'" title="'+tplEsc(tip)+'">'+
        (bound
          ?('<input value="'+tplEsc(f.dv==null?'':String(f.dv))+'" placeholder="'+TT('默认值','default')+'" oninput="tblCellInput('+r+','+c+',\'dv\',this.value)">')
          :('<input value="'+tplEsc(zh)+'" placeholder="'+(hdr?TT('表头·中文','header zh'):TT('中文','zh'))+'" oninput="tblCellInput('+r+','+c+',\'zh\',this.value)">'+
            '<input class="tblc-en" value="'+tplEsc(en)+'" placeholder="English" oninput="tblCellInput('+r+','+c+',\'en\',this.value)">'))+
        (srcTxt?('<div class="tblc-src" title="'+tplEsc(srcTxt)+'">↳ '+tplEsc(srcTxt)+'</div>'):'')+
        '<span class="tblc-acts">'+
          (hdr?'':('<button class="df-bind'+(bound?' bound':'')+'" onclick="tblBindCell('+r+','+c+')" title="'+(bound?TT('修改绑定','Edit binding'):TT('绑定数据字段','Bind field'))+'">🔗</button>'+
            '<button class="df-bind'+(hasIcon?' bound':'')+'" onclick="tblCellIconRules('+r+','+c+')" title="'+TT('动态图标：按信号规则切换单元格图标（仅图标 / 图标+值）','Dynamic icon by signal rules (icon / icon+value)')+'">🖼</button>'))+
          paintBtn+
          (hdr&&bound?('<button class="df-bind bound" onclick="tblBindCell('+r+','+c+')" title="'+TT('修改绑定（此格已被勾成表头，值不再显示）','Edit binding (cell is now a header)')+'">🔗</button>'):'')+
          (!hdr&&bound?('<button class="df-bind df-dict'+(hasDict?' bound':'')+'" onclick="tblDictCell('+r+','+c+')" title="'+TT('值字典','Value dict')+'">📖</button>'):'')+
          (!hdr&&(bound||hasIcon)?('<button class="df-bind" onclick="tblFillColumn('+r+','+c+')" title="'+TT('应用到整列：把此格的绑定/图标规则/样式复制到本列所有行——绑定设备替换为各行设备，规则里本行信号（RxCy）改写为各行信号','Fill column: copy binding/icon rules/style to every row (device follows each row)')+'">⇊</button>'):'')+
          (f?('<button class="df-del" onclick="tblUnbindCell('+r+','+c+')" title="'+TT('清除绑定与图标配置（恢复为静态文字格）','Clear binding & icon config')+'">✕</button>'):'')+
        '</span>'+
        '</div>';
    }
  }
  html+='</div>';
  host.innerHTML=html;
  host.scrollTop=st;host.scrollLeft=sl;
  // ── 选择交互：行/列序号点击整行整列切换、右键结构菜单；空白处拖拽框选（Ctrl 追加）；单击格子空白区选中该格 ──
  const ov=document.getElementById('tbl-ed-overlay');
  if(!ov)return;
  const sel=ov._selCells;
  host.querySelectorAll('.tbl-idx[data-r]').forEach(el=>{
    el.onclick=()=>{
      const r=+el.dataset.r,ks=[];for(let c=0;c<cols;c++)ks.push(r+','+c);
      const all=ks.every(k=>sel.has(k));ks.forEach(k=>{if(all)sel.delete(k);else sel.add(k);});tblEdSyncSel();
    };
    el.oncontextmenu=e=>{e.preventDefault();tblStructMenu('row',+el.dataset.r,e.clientX,e.clientY);};
  });
  host.querySelectorAll('.tbl-idx[data-c]').forEach(el=>{
    el.onclick=()=>{
      const c=+el.dataset.c,ks=[];for(let r2=0;r2<rows;r2++)ks.push(r2+','+c);
      const all=ks.every(k=>sel.has(k));ks.forEach(k=>{if(all)sel.delete(k);else sel.add(k);});tblEdSyncSel();
    };
    el.oncontextmenu=e=>{e.preventDefault();tblStructMenu('col',+el.dataset.c,e.clientX,e.clientY);};
  });
  host.onmousedown=e=>{
    if(e.button!==0)return;
    if(e.target.closest('input,select,button'))return;    // 输入/按钮照常操作，不触发框选
    if(e.target.closest('.tbl-idx'))return;               // 序号走 click 整行整列
    e.preventDefault();
    const sx=e.clientX,sy=e.clientY,startTarget=e.target;
    let mq=null;
    const move=ev=>{
      const x1=Math.min(sx,ev.clientX),y1=Math.min(sy,ev.clientY),x2=Math.max(sx,ev.clientX),y2=Math.max(sy,ev.clientY);
      if(!mq&&(x2-x1>4||y2-y1>4)){mq=document.createElement('div');mq.id='tbl-marquee';document.body.appendChild(mq);}
      if(mq){mq.style.left=x1+'px';mq.style.top=y1+'px';mq.style.width=(x2-x1)+'px';mq.style.height=(y2-y1)+'px';}
    };
    const up=ev=>{
      document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);
      if(mq)mq.remove();
      const x1=Math.min(sx,ev.clientX),y1=Math.min(sy,ev.clientY),x2=Math.max(sx,ev.clientX),y2=Math.max(sy,ev.clientY);
      const drag=(x2-x1>4||y2-y1>4);
      if(!ev.ctrlKey&&!ev.metaKey)sel.clear();
      if(drag){
        host.querySelectorAll('.tblc[data-rc]').forEach(cel=>{
          const b=cel.getBoundingClientRect();
          if(b.right>=x1&&b.left<=x2&&b.bottom>=y1&&b.top<=y2)sel.add(cel.dataset.rc);
        });
      }else{
        const cel=startTarget.closest('.tblc[data-rc]');
        if(cel){const k=cel.dataset.rc;if((ev.ctrlKey||ev.metaKey)&&sel.has(k))sel.delete(k);else sel.add(k);}
      }
      tblEdSyncSel();
    };
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
  };
  tblEdSyncSel();
}
// which='dv'（绑定格默认值）| 'zh' | 'en'（静态格中/英文字）
function tblCellInput(r,c,which,v){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  const f=tableCellField(n,r,c);
  if(f&&bindHasSource(f.bind)){if(which==='dv')f.dv=v;return;}   // 绑定格：输入=静态默认值
  if(which==='dv')return;
  tblSetStaticText(n,r,c,which,v);
}
// 建绑定格字段（不存在则按 RxCy 自动键创建）：吸附既有静态格的合并 span 与格级样式到字段上——
// 否则「先合并/上样式、再绑定」会退回 1×1 无样式（渲染以字段属性为准）；解绑时 tblUnbindCell 迁回
function _tblEnsureField(n,r,c){
  let i=tblFieldIndex(n,r,c);
  if(i>=0)return i;
  n.data=n.data||[];
  const key=_tblAutoKey(r,c);
  const f={key,keyEn:key,dv:'',tr:r,tc:c};
  const cv=n.cells&&n.cells[r+','+c];
  if(cv&&typeof cv==='object'){
    if(cv.spanR>1){f.spanR=cv.spanR;delete cv.spanR;}
    if(cv.spanC>1){f.spanC=cv.spanC;delete cv.spanC;}
    if(cv.color){f.cellColor=cv.color;delete cv.color;}
    if(cv.bg){f.cellBg=cv.bg;delete cv.bg;}
    if(cv.bold){f.cellBold=true;delete cv.bold;}
    if(cv.align){f.cellAlign=cv.align;delete cv.align;}
    if(!cv.zh&&!cv.en)delete n.cells[r+','+c];
  }
  n.data.push(f);
  return n.data.length-1;
}
// 绑定单元格：没有格字段则先按 RxCx 自动建（信号键=表格id.RxCx，天然唯一），再复用标准绑定弹窗
function tblBindCell(r,c){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  openFieldBind(_tblEnsureField(n,r,c));
}
function tblDictCell(r,c){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  const i=tblFieldIndex(n,r,c);if(i>=0)openFieldDict(i);
}
// 单元格动态图标：展示方式（仅值/仅图标/图标+值）+ 默认图标 + 图标规则（复用节点图标规则编辑器与信号选择器）。
// 规则条件可引用任意信号——最常用是本格自己的信号（如 table_1.R2C7 绑定 PackCurrent 后按电流判充/放电）。
// 无数据绑定、只配图标规则的「纯图标格」也允许（规则引用其它信号即可）。
function tblCellIconRules(r,c){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  const i=_tblEnsureField(n,r,c);
  const f=n.data[i];
  const ds={def:f.icon||'', rules:(Array.isArray(f.iconRules)?f.iconRules:[]).map(x=>({when:condToEdit(x.when),icon:x.icon||''}))};
  let show=f.cellShow||(bindHasSource(f.bind)?'both':'icon');
  openRuleModal(TT('单元格图标规则','Cell icon rules'),
    {kind:TT('表格','Table'),main:(nodeLabel(n)||n.id)+' · R'+(r+1)+'C'+(c+1),sub:bindHasSource(f.bind)?(TT('信号：','Signal: ')+fieldSig(n,f)+' ← '+fieldBindSummary(n,f)):TT('未绑定数据（规则可引用其它信号）','No binding (rules may reference other signals)'),color:'var(--ui-accent)'},
    box=>{
      box.innerHTML='';box.className='rm-cond';
      const bar=document.createElement('div');bar.className='rm-dircard';bar.style.display='flex';bar.style.alignItems='center';bar.style.gap='8px';bar.style.flexWrap='wrap';
      bar.appendChild(document.createTextNode(TT('展示方式','Display')));
      const ss=document.createElement('select');
      [['value',TT('仅值（不显示图标）','Value only')],['icon',TT('仅图标','Icon only')],['both',TT('图标 + 值','Icon + value')]].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;ss.appendChild(o);});
      ss.value=show;ss.onchange=()=>{show=ss.value;};
      bar.appendChild(ss);
      bar.appendChild(document.createTextNode(TT('默认图标（规则都不命中时）','Default icon (when no rule matches)')));
      bar.appendChild(mkIconSelect(ds.def,v=>{ds.def=v;}));
      box.appendChild(bar);
      const inner=document.createElement('div');box.appendChild(inner);
      renderIconRules(inner,ds);
    },
    ()=>{snapshot();
      const rules=ds.rules.map(x=>({when:editToCond(x.when),icon:x.icon})).filter(x=>x.when!=null&&x.icon);
      if(rules.length)f.iconRules=rules;else delete f.iconRules;
      if(ds.def)f.icon=ds.def;else delete f.icon;
      if(show&&show!=='value')f.cellShow=show;else delete f.cellShow;
      snapshot();renderDFs(n);},
    ()=>{ds.rules=[];const inner=document.querySelector('#rm-body > div:last-child');if(inner)renderIconRules(inner,ds);});
}
// 行相关信号改写：把条件里引用「源行」单元格的信号（表格id.R{srcRow+1}Cx）改写为目标行（⇊ 整列填充用）
function _tblRewriteRowSigs(cond,nid,srcRow,dstRow){
  if(cond==null||typeof cond!=='object')return;
  if(Array.isArray(cond.all))cond.all.forEach(c=>_tblRewriteRowSigs(c,nid,srcRow,dstRow));
  else if(Array.isArray(cond.any))cond.any.forEach(c=>_tblRewriteRowSigs(c,nid,srcRow,dstRow));
  else if(cond.not!=null)_tblRewriteRowSigs(cond.not,nid,srcRow,dstRow);
  else{
    const re=new RegExp('^'+nid.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.R'+(srcRow+1)+'C(\\d+)$');
    ['var','ref'].forEach(k=>{
      if(typeof cond[k]==='string'){const m=cond[k].match(re);if(m)cond[k]=nid+'.R'+(dstRow+1)+'C'+m[1];}
    });
  }
}
function tblUnbindCell(r,c){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  const i=tblFieldIndex(n,r,c);if(i<0)return;
  snapshot();
  // 字段上的合并 span 与格级样式迁回静态格（解绑清的是绑定与图标配置，不应顺带取消合并/清样式）
  const f=n.data[i];
  if(f&&(f.spanR>1||f.spanC>1||f.cellColor||f.cellBg||f.cellBold||f.cellAlign)){
    n.cells=n.cells||{};
    let cv=n.cells[r+','+c];
    if(cv==null)cv={zh:'',en:''};
    else if(typeof cv!=='object')cv={zh:String(cv),en:''};
    if(f.spanR>1)cv.spanR=f.spanR;
    if(f.spanC>1)cv.spanC=f.spanC;
    if(f.cellColor)cv.color=f.cellColor;
    if(f.cellBg)cv.bg=f.cellBg;
    if(f.cellBold)cv.bold=true;
    if(f.cellAlign)cv.align=f.cellAlign;
    n.cells[r+','+c]=cv;
  }
  n.data.splice(i,1);snapshot();
  renderDFs(n);
}
// ═════ 表格结构操作 / 合并 / 复制粘贴 / 格样式（2.1）═════
let _tblClip=null;         // 单元格剪贴板：{w,h,items:[{dr,dc,f,cv,srcSig}]}（含绑定/图标/样式/合并，可跨表）
let _tblStyleSnapId=null;  // 样式面板「选中后首个改动前快照一次」的标记（粗粒度撤销，避免逐键快照刷史）
let _tblStyleSnapT=null;   // 样式面板定稿快照的防抖计时器
// 绑定格自动键（RxCy，1 起）；仅当 key/keyEn 仍是自动格式时才随位置改名——用户改过名则信号键保持稳定
function _tblAutoKey(r,c){return 'R'+(r+1)+'C'+(c+1);}
function _tblIsAutoKey(f){const re=/^R\d+C\d+$/;return re.test(String(f.keyEn||''))&&(!f.key||re.test(String(f.key)));}
// 全图改写信号引用（结构变更/粘贴导致 RxCy 键更名时）：节点显隐/图标规则、字段级单元格图标规则、
// 连线显隐/流向规则、注入的测试信号行。map={旧信号键:新信号键}
function tblRenameSigsEverywhere(map){
  if(!map||!Object.keys(map).length)return;
  nodes.forEach(m=>{
    if(m.visibleWhen!=null)migrateCondSignals(m.visibleWhen,map);
    if(Array.isArray(m.iconRules))m.iconRules.forEach(x=>x&&migrateCondSignals(x.when,map));
    (m.data||[]).forEach(f=>{if(Array.isArray(f.iconRules))f.iconRules.forEach(x=>x&&migrateCondSignals(x.when,map));});
  });
  edges.forEach(e=>{
    if(e.showWhen!=null)migrateCondSignals(e.showWhen,map);
    if(Array.isArray(e.dirRules))e.dirRules.forEach(x=>x&&migrateCondSignals(x.when,map));
  });
  let injChanged=false;
  (injRows||[]).forEach(row=>{
    const old=row.node+'.'+row.field, nw=map[old];
    if(nw){const d=nw.indexOf('.');row.node=nw.slice(0,d);row.field=nw.slice(d+1);injChanged=true;}
  });
  // 注入行的键变了要重建 signalValues（否则预览规则读不到样例值、导出 sampleSignals 滤掉旧键）
  if(injChanged&&typeof syncInjections==='function')syncInjections();
}
// 行/列结构变更核心：axis='r'|'c'，在 at 处 delta=+1 插入 / delta=-1 删除本行列。
// 统一处理：静态格键与合并 span、绑定字段 tr/tc 与 span、自动键(RxCy)改名 + 全图信号引用改写、
// 逐列宽/列对齐数组、行列数。返回 false=被挡下或用户取消
async function tblStructShift(n,axis,at,delta){
  const isR=axis==='r';
  const rows=Math.max(1,(n.rows|0)||1), cols=Math.max(1,(n.cols|0)||1);
  if(delta<0&&(isR?rows:cols)<=1){flashHint(TT('至少保留 1 行 / 1 列','Keep at least 1 row / column'));return false;}
  const spanOf=o=>({sR:(o&&typeof o==='object'&&o.spanR>1)?o.spanR:1,sC:(o&&typeof o==='object'&&o.spanC>1)?o.spanC:1});
  const cellsArr=Object.keys(n.cells||{}).map(k=>{const p=k.split(',');return {r:+p[0],c:+p[1],v:n.cells[k]};});
  if(delta<0){
    // 被删行/列上有合并锚点（区域将失去锚点）→ 先取消合并，避免隐式内容搬移
    const anchorHit=cellsArr.some(x=>{const s=spanOf(x.v);return (isR?x.r:x.c)===at&&(isR?s.sR:s.sC)>1;})
      ||(n.data||[]).some(f=>f.tr!=null&&(isR?f.tr:f.tc)===at&&(((isR?f.spanR:f.spanC)||1)>1));
    if(anchorHit){flashHint(TT('该行/列上有合并格锚点，请先取消合并','Merged-cell anchor on this line — unmerge first'));return false;}
    const hitF=(n.data||[]).filter(f=>f.tr!=null&&(isR?f.tr:f.tc)===at);
    if(hitF.length){
      const ok=await uiConfirm(TT('删除将移除 ','Deleting removes ')+hitF.length+TT(' 个绑定单元格，确定？',' bound cell(s). Continue?'),true);
      if(!ok)return false;
    }
  }
  snapshot();
  const mapPos=v=>delta>0?(v>=at?v+1:v):(v>at?v-1:v);
  const renames={};
  // 静态格：重键 + span 收放（插入点/删除点落在合并区内部 → 区域变长/变短）
  const newCells={};
  cellsArr.forEach(x=>{
    const o=(typeof x.v==='object')?{...x.v}:{zh:String(x.v==null?'':x.v),en:''};
    const s=spanOf(o);
    const pos=isR?x.r:x.c;
    let span=isR?s.sR:s.sC;
    if(delta<0&&pos===at)return;   // 被删行列上的静态格（锚点已在上面挡下）
    if(delta>0){if(pos<at&&at<pos+span)span++;}
    else if(pos<at&&at<pos+span)span--;
    if(isR){if(span>1)o.spanR=span;else delete o.spanR;}
    else {if(span>1)o.spanC=span;else delete o.spanC;}
    const nr=isR?mapPos(x.r):x.r, nc=isR?x.c:mapPos(x.c);
    newCells[nr+','+nc]=o;
  });
  n.cells=newCells;
  // 绑定字段：删行列上的字段移除，其余平移；span 收放；自动键改名并记录信号改写
  n.data=(n.data||[]).filter(f=>f.tr==null||!(delta<0&&(isR?f.tr:f.tc)===at));
  (n.data||[]).forEach(f=>{
    if(f.tr==null)return;
    const pos=isR?f.tr:f.tc;
    let span=(isR?f.spanR:f.spanC)||1;
    if(delta>0){if(pos<at&&at<pos+span)span++;}
    else if(pos<at&&at<pos+span)span--;
    const or=f.tr,oc=f.tc;
    if(isR){f.tr=mapPos(f.tr);if(span>1)f.spanR=span;else delete f.spanR;}
    else {f.tc=mapPos(f.tc);if(span>1)f.spanC=span;else delete f.spanC;}
    if((f.tr!==or||f.tc!==oc)&&_tblIsAutoKey(f)){
      const old=n.id+'.'+(f.keyEn||f.key);
      f.key=_tblAutoKey(f.tr,f.tc);f.keyEn=f.key;
      renames[old]=n.id+'.'+f.keyEn;
    }
  });
  if(isR)n.rows=rows+delta;else n.cols=cols+delta;
  if(!isR){   // 逐列宽 / 列对齐数组随列位增删
    ['colWs','colAlign'].forEach(k=>{
      if(!Array.isArray(n[k]))return;
      const a=n[k].slice();
      if(delta>0)a.splice(at,0,k==='colWs'?0:'center');else a.splice(at,1);
      n[k]=a;
    });
  }
  tblRenameSigsEverywhere(renames);
  snapshot();
  return true;
}
// 相邻行/列互换（上移/下移/左移/右移）。任一合并区涉及 a 或 b 行列 → 先取消合并（避免区域被隐式拆动）
async function tblStructSwap(n,axis,a,b){
  const isR=axis==='r';
  const hit=(pos,span)=>span>1&&((a>=pos&&a<pos+span)||(b>=pos&&b<pos+span));
  let blocked=false;
  Object.keys(n.cells||{}).forEach(k=>{const v=n.cells[k];
    if(v&&typeof v==='object'){const p=k.split(',');
      if(hit(isR?+p[0]:+p[1],(isR?v.spanR:v.spanC)||1))blocked=true;}});
  (n.data||[]).forEach(f=>{if(f.tr!=null&&hit(isR?f.tr:f.tc,(isR?f.spanR:f.spanC)||1))blocked=true;});
  if(blocked){flashHint(TT('移动涉及合并格，请先取消合并','Move touches merged cells — unmerge first'));return false;}
  snapshot();
  const renames={};
  const mapPos=v=>v===a?b:(v===b?a:v);
  const newCells={};
  Object.keys(n.cells||{}).forEach(k=>{const p=k.split(','),r=+p[0],c=+p[1];
    newCells[(isR?mapPos(r):r)+','+(isR?c:mapPos(c))]=n.cells[k];});
  n.cells=newCells;
  (n.data||[]).forEach(f=>{
    if(f.tr==null)return;
    const or=f.tr,oc=f.tc;
    if(isR)f.tr=mapPos(f.tr);else f.tc=mapPos(f.tc);
    if((f.tr!==or||f.tc!==oc)&&_tblIsAutoKey(f)){
      const old=n.id+'.'+(f.keyEn||f.key);
      f.key=_tblAutoKey(f.tr,f.tc);f.keyEn=f.key;
      renames[old]=n.id+'.'+f.keyEn;
    }
  });
  if(!isR){['colWs','colAlign'].forEach(k=>{if(Array.isArray(n[k])){const t=n[k][a];n[k][a]=n[k][b];n[k][b]=t;}});}
  tblRenameSigsEverywhere(renames);
  snapshot();
  return true;
}
// 行/列序号右键菜单：插入/删除/移动；列另有 对齐 与 逐列宽
function tblStructMenu(kind,idx,cx,cy){
  const ov=document.getElementById('tbl-ed-overlay');if(!ov)return;
  const n=nodes.find(x=>x.id===ov._nid);if(!n||n.type!=='table')return;
  const old=document.getElementById('tbl-struct-menu');if(old)old.remove();
  const isR=kind==='row';
  const rows=Math.max(1,(n.rows|0)||1), cols=Math.max(1,(n.cols|0)||1);
  const items=[];
  const act=(label,fn)=>items.push({label,fn});
  if(isR){
    act('⬆ '+TT('在上方插入行','Insert row above'),()=>tblStructShift(n,'r',idx,1));
    act('⬇ '+TT('在下方插入行','Insert row below'),()=>tblStructShift(n,'r',idx+1,1));
    act('🗑 '+TT('删除本行','Delete this row'),()=>tblStructShift(n,'r',idx,-1));
    if(idx>0)act('↑ '+TT('上移','Move up'),()=>tblStructSwap(n,'r',idx,idx-1));
    if(idx<rows-1)act('↓ '+TT('下移','Move down'),()=>tblStructSwap(n,'r',idx,idx+1));
  }else{
    act('⬅ '+TT('在左侧插入列','Insert column left'),()=>tblStructShift(n,'c',idx,1));
    act('➡ '+TT('在右侧插入列','Insert column right'),()=>tblStructShift(n,'c',idx+1,1));
    act('🗑 '+TT('删除本列','Delete this column'),()=>tblStructShift(n,'c',idx,-1));
    if(idx>0)act('← '+TT('左移','Move left'),()=>tblStructSwap(n,'c',idx,idx-1));
    if(idx<cols-1)act('→ '+TT('右移','Move right'),()=>tblStructSwap(n,'c',idx,idx+1));
  }
  const m=document.createElement('div');m.id='tbl-struct-menu';m.className='tsm';
  m.innerHTML='<div class="tsm-t">'+(isR?('R'+(idx+1)):('C'+(idx+1)))+'</div>'+
    items.map((it,i)=>'<button class="tsm-i" data-i="'+i+'">'+it.label+'</button>').join('')+
    (isR?'':(
      '<div class="tsm-sep"></div>'+
      '<div class="tsm-row"><span>'+TT('对齐','Align')+'</span><select id="tsm-align">'+
        [['center',TT('居中','center')],['left',TT('左','left')],['right',TT('右','right')]]
          .map(([v,t])=>'<option value="'+v+'"'+(((n.colAlign&&n.colAlign[idx])||'center')===v?' selected':'')+'>'+t+'</option>').join('')+'</select></div>'+
      '<div class="tsm-row"><span>'+TT('列宽','Width')+'</span><input id="tsm-colw" type="number" min="0" max="800" step="1" value="'+(Array.isArray(n.colWs)?(n.colWs[idx]||0):0)+'"><span class="punit">px</span></div>'+
      '<div class="phint" style="margin:2px 8px 6px">'+TT('列宽 0=自动/继承全表「固定列宽」','Width 0 = auto / inherit table default')+'</div>'));
  document.body.appendChild(m);
  m.style.left=Math.max(8,Math.min(cx,window.innerWidth-200))+'px';
  m.style.top=Math.max(8,Math.min(cy,window.innerHeight-m.offsetHeight-12))+'px';
  const done=()=>{renderTableCells(n);tblEdSyncSel();if(selNode===n.id){pairSet('p-tbl-rows',n.rows||1);pairSet('p-tbl-cols',n.cols||1);}};
  m.querySelectorAll('.tsm-i').forEach(btn=>btn.onclick=async()=>{
    const it=items[+btn.dataset.i];m.remove();
    const ok=await it.fn();
    if(ok!==false)done();
  });
  if(!isR){
    const al=m.querySelector('#tsm-align');
    al.onchange=()=>{
      snapshot();
      let a=Array.isArray(n.colAlign)?n.colAlign.slice():[];
      for(let i2=0;i2<cols;i2++)if(!a[i2])a[i2]='center';
      a[idx]=al.value;
      if(a.every(x=>x==='center'))delete n.colAlign;else n.colAlign=a;
      snapshot();
    };
    const cw=m.querySelector('#tsm-colw');
    cw.onchange=()=>{
      snapshot();
      const v=Math.max(0,Math.round(+cw.value||0));
      let a=Array.isArray(n.colWs)?n.colWs.slice():[];
      for(let i2=0;i2<cols;i2++)if(a[i2]==null)a[i2]=0;
      a[idx]=v;
      if(a.every(x=>!x))delete n.colWs;else n.colWs=a;
      snapshot();
    };
  }
  const close=ev=>{if(!m.contains(ev.target)){m.remove();document.removeEventListener('mousedown',close,true);}};
  setTimeout(()=>document.addEventListener('mousedown',close,true),0);
}
// 合并选中矩形为一格：左上角为锚点（内容保留），其余格内容/绑定清除
async function tblMergeSel(){
  const ov=document.getElementById('tbl-ed-overlay');if(!ov)return;
  const n=nodes.find(x=>x.id===ov._nid);if(!n||n.type!=='table')return;
  const rect=_tblSelRect(ov._selCells);
  if(!rect||!rect.isRect||ov._selCells.size<2)return;
  const {r0,c0,r1,c1}=rect;
  let lose=0;
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
    if(r===r0&&c===c0)continue;
    if(tblFieldIndex(n,r,c)>=0||((n.cells||{})[r+','+c]!=null))lose++;
  }
  if(lose){
    const ok=await uiConfirm(TT('合并将清除锚点（左上角）以外 ','Merging clears ')+lose+TT(' 个格的内容与绑定，确定？',' non-anchor cell(s). Continue?'),true);
    if(!ok)return;
  }
  snapshot();
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
    if(r===r0&&c===c0)continue;
    const i=tblFieldIndex(n,r,c);if(i>=0)n.data.splice(i,1);
    if(n.cells)delete n.cells[r+','+c];
  }
  const sR=r1-r0+1, sC=c1-c0+1;
  const f=tableCellField(n,r0,c0);
  if(f){
    if(sR>1)f.spanR=sR;else delete f.spanR;
    if(sC>1)f.spanC=sC;else delete f.spanC;
  }else{
    n.cells=n.cells||{};
    let cv=n.cells[r0+','+c0];
    if(cv==null)cv={zh:'',en:''};
    else if(typeof cv!=='object')cv={zh:String(cv),en:''};
    if(sR>1)cv.spanR=sR;else delete cv.spanR;
    if(sC>1)cv.spanC=sC;else delete cv.spanC;
    n.cells[r0+','+c0]=cv;
  }
  ov._selCells.clear();
  snapshot();renderDFs(n);tblEdSyncSel();
}
// 取消合并：选中格所属的全部合并区解除（锚点内容保留在原位）
function tblUnmergeSel(){
  const ov=document.getElementById('tbl-ed-overlay');if(!ov)return;
  const n=nodes.find(x=>x.id===ov._nid);if(!n||n.type!=='table')return;
  const sel=ov._selCells;if(!sel.size)return;
  const cover=tblCoverMap(n);
  const anchors=new Set();
  sel.forEach(k=>{const p=k.split(','),a=cover[+p[0]]&&cover[+p[0]][+p[1]];if(a)anchors.add(a.ar+','+a.ac);});
  if(!anchors.size)return;
  snapshot();
  anchors.forEach(k=>{
    const p=k.split(','),r=+p[0],c=+p[1];
    const f=tableCellField(n,r,c);
    if(f){delete f.spanR;delete f.spanC;}
    const cv=n.cells&&n.cells[k];
    if(cv&&typeof cv==='object'){
      delete cv.spanR;delete cv.spanC;
      if(!cv.zh&&!cv.en&&!cv.color&&!cv.bg&&!cv.bold&&!cv.align)delete n.cells[k];
    }
  });
  snapshot();renderDFs(n);tblEdSyncSel();
}
// 复制选中格（含绑定/图标规则/样式/合并 span；相对坐标存剪贴板，可跨表粘贴）
function tblCopySel(){
  const ov=document.getElementById('tbl-ed-overlay');if(!ov)return;
  const n=nodes.find(x=>x.id===ov._nid);if(!n||n.type!=='table')return;
  const sel=ov._selCells;if(!sel.size)return;
  const rect=_tblSelRect(sel);
  const items=[];
  sel.forEach(k=>{
    const p=k.split(','),r=+p[0],c=+p[1];
    const f=tableCellField(n,r,c);
    const cv=n.cells&&n.cells[k];
    if(!f&&cv==null)return;
    items.push({
      dr:r-rect.r0, dc:c-rect.c0,
      f:f?JSON.parse(JSON.stringify(f)):null,
      cv:cv!=null?JSON.parse(JSON.stringify(typeof cv==='object'?cv:{zh:String(cv),en:''})):null,
      srcSig:f?(n.id+'.'+(f.keyEn||f.key)):null
    });
  });
  if(!items.length){flashHint(TT('选中格没有内容可复制','Nothing to copy in selection'));return;}
  _tblClip={w:rect.c1-rect.c0+1, h:rect.r1-rect.r0+1, items};
  flashHint(TT('已复制 ','Copied ')+items.length+TT(' 个单元格（含绑定/图标/样式），选择目标格后点「粘贴」',' cell(s) — select target cell(s) and Paste'));
  tblEdSyncSel();
}
// 粘贴到选中区左上角：目标按「整个落点区域」（含粘贴合并格铺开的范围）清理覆盖；与既有合并区
// 交叠且该区伸出落点范围 → 拦下（先取消合并）。自动键(RxCy)随新位置改名；非自动键与表内既有
// 字段撞名时强制改为自动键（信号键在表内必须唯一，否则导出被重名校验挡下）。副本内自引用信号一并改写
async function tblPasteSel(){
  const ov=document.getElementById('tbl-ed-overlay');if(!ov||!_tblClip)return;
  const n=nodes.find(x=>x.id===ov._nid);if(!n||n.type!=='table')return;
  const rect=_tblSelRect(ov._selCells);if(!rect)return;
  const rows=Math.max(1,(n.rows|0)||1), cols=Math.max(1,(n.cols|0)||1);
  const r0=rect.r0, c0=rect.c0;
  if(r0+_tblClip.h>rows||c0+_tblClip.w>cols){
    flashHint(TT('粘贴区域（','Paste block (')+_tblClip.h+'×'+_tblClip.w+TT('）超出表格范围，请先扩大行列',') exceeds table bounds — enlarge first'));
    return;
  }
  // 落点区域 = 每个粘贴项的锚点 + 其合并 span 铺开范围（先按表界裁剪）
  const clipSpan=it=>({
    sR:Math.min(((it.f?it.f.spanR:it.cv&&it.cv.spanR)||1),rows-(r0+it.dr)),
    sC:Math.min(((it.f?it.f.spanC:it.cv&&it.cv.spanC)||1),cols-(c0+it.dc))
  });
  const destSet=new Set();
  _tblClip.items.forEach(it=>{
    const r=r0+it.dr, c=c0+it.dc, s=clipSpan(it);
    for(let rr=r;rr<r+Math.max(1,s.sR);rr++)for(let cc=c;cc<c+Math.max(1,s.sC);cc++)destSet.add(rr+','+cc);
  });
  // 与既有合并区交叠检查：区域完整落在落点范围内=将被整体覆盖（允许）；伸出范围=会被拆开（拦下）
  const cover0=tblCoverMap(n);
  let mergedClash=false;
  destSet.forEach(k=>{
    if(mergedClash)return;
    const p=k.split(','), a=cover0[+p[0]]&&cover0[+p[0]][+p[1]];
    if(!a)return;
    const af=tableCellField(n,a.ar,a.ac), av=(n.cells||{})[a.ar+','+a.ac];
    const sR=(af&&af.spanR>1?af.spanR:(av&&av.spanR)||1), sC=(af&&af.spanC>1?af.spanC:(av&&av.spanC)||1);
    for(let rr=a.ar;rr<a.ar+sR;rr++)for(let cc=a.ac;cc<a.ac+sC;cc++)
      if(!destSet.has(rr+','+cc))mergedClash=true;
  });
  if(mergedClash){
    flashHint(TT('粘贴区域与现有合并格交叠（且该合并区伸出落点范围），请先取消合并','Paste area overlaps a merged region extending outside it — unmerge first'));
    return;
  }
  let over=0;
  destSet.forEach(k=>{const p=k.split(',');
    if(tblFieldIndex(n,+p[0],+p[1])>=0||((n.cells||{})[k]!=null))over++;});
  if(over){
    const ok=await uiConfirm(TT('粘贴将覆盖 ','Paste overwrites ')+over+TT(' 个已有格，确定？',' existing cell(s). Continue?'),true);
    if(!ok)return;
  }
  snapshot();
  // 整个落点区域清场（含被粘贴合并格盖住的格），再写入粘贴项
  destSet.forEach(k=>{const p=k.split(',');
    const i=tblFieldIndex(n,+p[0],+p[1]);if(i>=0)n.data.splice(i,1);
    if(n.cells)delete n.cells[k];});
  const renMap={};
  const pasted=[];
  _tblClip.items.forEach(it=>{
    const r=r0+it.dr, c=c0+it.dc;
    if(it.f){
      const nf=JSON.parse(JSON.stringify(it.f));
      nf.tr=r;nf.tc=c;
      // 自动键随新位置改名；非自动键与表内既有字段撞名 → 也改为自动键（保持信号键唯一）
      const dup=()=> (n.data||[]).some(o=>o!==nf&&o.tr!=null&&((o.keyEn||o.key)===(nf.keyEn||nf.key)||o.key===nf.key));
      if(_tblIsAutoKey(nf)||dup()){nf.key=_tblAutoKey(r,c);nf.keyEn=nf.key;}
      if(it.srcSig&&it.srcSig!==n.id+'.'+(nf.keyEn||nf.key))renMap[it.srcSig]=n.id+'.'+(nf.keyEn||nf.key);
      if(nf.spanR>1&&r+nf.spanR>rows)nf.spanR=rows-r;
      if(nf.spanC>1&&c+nf.spanC>cols)nf.spanC=cols-c;
      if(!(nf.spanR>1))delete nf.spanR;
      if(!(nf.spanC>1))delete nf.spanC;
      n.data=n.data||[];n.data.push(nf);pasted.push(nf);
    }else if(it.cv){
      const cv=JSON.parse(JSON.stringify(it.cv));
      if(cv.spanR>1&&r+cv.spanR>rows)cv.spanR=rows-r;
      if(cv.spanC>1&&c+cv.spanC>cols)cv.spanC=cols-c;
      if(!(cv.spanR>1))delete cv.spanR;
      if(!(cv.spanC>1))delete cv.spanC;
      n.cells=n.cells||{};n.cells[r+','+c]=cv;
    }
  });
  // 只改写「粘贴副本」的图标规则自引用（源格与其它规则不动）
  pasted.forEach(f=>{if(Array.isArray(f.iconRules))f.iconRules.forEach(x=>x&&migrateCondSignals(x.when,renMap));});
  snapshot();renderDFs(n);tblEdSyncSel();
  flashHint(TT('已粘贴 ','Pasted ')+_tblClip.items.length+TT(' 个单元格',' cell(s)'));
}
// 🎨 格样式弹层：文字色/底色/加粗/对齐。点开的格若在选中集内 → 应用到全部选中格
function tblCellStylePopover(r,c,ev){
  if(ev){ev.stopPropagation();ev.preventDefault();}
  const ov=document.getElementById('tbl-ed-overlay');if(!ov)return;
  const n=nodes.find(x=>x.id===ov._nid);if(!n||n.type!=='table')return;
  const old=document.getElementById('tbl-style-pop');if(old)old.remove();
  const sel=ov._selCells;
  const targets=(sel&&sel.size&&sel.has(r+','+c))
    ?[...sel].map(k=>{const p=k.split(',');return {r:+p[0],c:+p[1]};})
    :[{r,c}];
  const f0=tableCellField(n,r,c), cv0=n.cells&&n.cells[r+','+c];
  const cur={
    color:(f0?f0.cellColor:(cv0&&typeof cv0==='object'?cv0.color:''))||'',
    bg:(f0?f0.cellBg:(cv0&&typeof cv0==='object'?cv0.bg:''))||'',
    bold:!!(f0?f0.cellBold:(cv0&&typeof cv0==='object'&&cv0.bold)),
    align:(f0?f0.cellAlign:(cv0&&typeof cv0==='object'?cv0.align:''))||''
  };
  const m=document.createElement('div');m.id='tbl-style-pop';m.className='tsm';
  m.innerHTML='<div class="tsm-t">🎨 '+TT('格样式','Cell style')+(targets.length>1?('（'+targets.length+TT(' 格',' cells')+'）'):(' · R'+(r+1)+'C'+(c+1)))+'</div>'+
    '<div class="tsm-row"><span>'+TT('文字色','Color')+'</span><input type="color" id="tsp-color" value="'+(cur.color||'#e8f4ff')+'"><label class="tsm-on"><input type="checkbox" id="tsp-color-on"'+(cur.color?' checked':'')+' style="width:auto">'+TT('启用','on')+'</label></div>'+
    '<div class="tsm-row"><span>'+TT('底色','Bg')+'</span><input type="color" id="tsp-bg" value="'+(cur.bg||'#143560')+'"><label class="tsm-on"><input type="checkbox" id="tsp-bg-on"'+(cur.bg?' checked':'')+' style="width:auto">'+TT('启用','on')+'</label></div>'+
    '<div class="tsm-row"><label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" id="tsp-bold"'+(cur.bold?' checked':'')+' style="width:auto"> '+TT('加粗','Bold')+'</label></div>'+
    '<div class="tsm-row"><span>'+TT('对齐','Align')+'</span><select id="tsp-align">'+
      [['',TT('继承列','column')],['left',TT('左','left')],['center',TT('居中','center')],['right',TT('右','right')]]
        .map(([v,t])=>'<option value="'+v+'"'+(cur.align===v?' selected':'')+'>'+t+'</option>').join('')+'</select></div>'+
    '<div style="display:flex;gap:6px;justify-content:flex-end;margin:6px 8px 8px">'+
    '<button class="tb" id="tsp-cancel">'+TT('取消','Cancel')+'</button>'+
    '<button class="tb grn" id="tsp-ok">✓ '+TT('应用','Apply')+'</button></div>';
  document.body.appendChild(m);
  const cx=ev?ev.clientX:window.innerWidth/2, cy=ev?ev.clientY:window.innerHeight/2;
  m.style.left=Math.max(8,Math.min(cx,window.innerWidth-230))+'px';
  m.style.top=Math.max(8,Math.min(cy,window.innerHeight-m.offsetHeight-12))+'px';
  m.querySelector('#tsp-cancel').onclick=()=>m.remove();
  m.querySelector('#tsp-ok').onclick=()=>{
    const color=m.querySelector('#tsp-color-on').checked?m.querySelector('#tsp-color').value:'';
    const bg=m.querySelector('#tsp-bg-on').checked?m.querySelector('#tsp-bg').value:'';
    const bold=m.querySelector('#tsp-bold').checked;
    const align=m.querySelector('#tsp-align').value;
    m.remove();
    snapshot();
    targets.forEach(t=>{
      const f=tableCellField(n,t.r,t.c);
      if(f){
        if(color)f.cellColor=color;else delete f.cellColor;
        if(bg)f.cellBg=bg;else delete f.cellBg;
        if(bold)f.cellBold=true;else delete f.cellBold;
        if(align)f.cellAlign=align;else delete f.cellAlign;
      }else{
        n.cells=n.cells||{};
        let cv=n.cells[t.r+','+t.c];
        if(cv==null)cv={zh:'',en:''};
        else if(typeof cv!=='object')cv={zh:String(cv),en:''};
        if(color)cv.color=color;else delete cv.color;
        if(bg)cv.bg=bg;else delete cv.bg;
        if(bold)cv.bold=true;else delete cv.bold;
        if(align)cv.align=align;else delete cv.align;
        if(!cv.zh&&!cv.en&&!cv.color&&!cv.bg&&!cv.bold&&!cv.align&&!(cv.spanR>1)&&!(cv.spanC>1))delete n.cells[t.r+','+t.c];
        else n.cells[t.r+','+t.c]=cv;
      }
    });
    snapshot();renderDFs(n);tblEdSyncSel();
  };
  const close=e2=>{if(!m.contains(e2.target)){m.remove();document.removeEventListener('mousedown',close,true);}};
  setTimeout(()=>document.addEventListener('mousedown',close,true),0);
}
// 某行的「所属设备」：取该行任一已绑定格的设备（单字段绑定的 deviceId，或计算绑定首个带设备的操作数）
function tblRowDevice(n,r){
  for(const f of (n.data||[])){
    if(f.tr!==r||!f.bind)continue;
    if(f.bind.deviceId)return {deviceId:f.bind.deviceId,deviceType:f.bind.deviceType||''};
    if(bindIsCalc(f.bind)){const o=(f.bind.calc.operands||[]).find(o=>o&&o.field&&o.deviceId);if(o)return {deviceId:o.deviceId,deviceType:o.deviceType||''};}
  }
  return null;
}
// 应用到整列：把 (sr,c) 格的绑定复制到本列所有数据行，设备替换为各行自己的设备。
// 单字段/计算绑定（逐操作数换设备，常量不动）/值字典设置 一并复制；某行识别不到设备（该行无任何已绑定格）则跳过并提示。
// 典型用法：功率=电流×电压÷1000、状态=电流+charge_state 字典 这类派生列，配好一行点 ⇊ 填满整列。
function tblFillColumn(sr,c){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  const src=tableCellField(n,sr,c);
  const hasBind=!!(src&&bindHasSource(src.bind));
  const hasIcon=!!(src&&(src.cellShow||src.icon||(Array.isArray(src.iconRules)&&src.iconRules.length)));
  if(!hasBind&&!hasIcon){flashHint(TT('请先给该格配置绑定或图标规则，再应用到整列','Configure a binding or icon rules on this cell first'));return;}
  const rows=Math.max(1,(n.rows|0)||1), start=n.headerRow?1:0;
  let filled=0;const noDev=[];
  snapshot();
  for(let r=start;r<rows;r++){
    if(r===sr)continue;
    const dev=hasBind?tblRowDevice(n,r):null;
    if(hasBind&&!dev){noDev.push(r+1);continue;}
    const f=n.data[_tblEnsureField(n,r,c)];
    if(hasBind){
      const nb=JSON.parse(JSON.stringify(src.bind));
      if(nb.field){nb.deviceId=dev.deviceId;if(dev.deviceType)nb.deviceType=dev.deviceType;else delete nb.deviceType;}
      else if(nb.calc)(nb.calc.operands||[]).forEach(o=>{if(o&&o.field){o.deviceId=dev.deviceId;if(dev.deviceType)o.deviceType=dev.deviceType;else delete o.deviceType;}});
      f.bind=nb;
      if(src.dict!==undefined&&src.dict!==null)f.dict=src.dict;else delete f.dict;
      if(src.decimals!=null)f.decimals=src.decimals;else delete f.decimals;   // 显示小数位一并复制
    }
    // 格样式一并复制（对齐/颜色/加粗；合并 span 不复制——逐行格没有跨行语义）
    ['cellColor','cellBg','cellBold','cellAlign'].forEach(k=>{
      if(src[k]!=null&&src[k]!=='')f[k]=src[k];else delete f[k];
    });
    // 图标配置复制：规则条件里引用源行单元格的信号（R{sr+1}Cx）改写为本行（R{r+1}Cx），跨行引用保持不变
    if(hasIcon){
      if(src.cellShow)f.cellShow=src.cellShow;else delete f.cellShow;
      if(src.icon)f.icon=src.icon;else delete f.icon;
      if(Array.isArray(src.iconRules)&&src.iconRules.length){
        f.iconRules=JSON.parse(JSON.stringify(src.iconRules));
        f.iconRules.forEach(rl=>_tblRewriteRowSigs(rl.when,n.id,sr,r));
      }else delete f.iconRules;
    }
    filled++;
  }
  snapshot();
  renderDFs(n);
  flashHint(TT('已应用到整列：','Filled column: ')+filled+TT(' 格',' cells')+(hasBind?TT('（绑定随各行设备）',' (device per row)'):'')+(hasIcon?TT('（含图标规则）',' (incl. icon rules)'):'')+
    (noDev.length?(TT('；第 ','; rows ')+noDev.join('、')+TT(' 行无已绑定格、识别不到设备，已跳过',' skipped — no device identified')):''));
}
// ── 从设备生成表格：设备类型 → 多选设备（行）→ 多选字段（列），一键建表并逐格绑定 ──
function openTableGen(){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  closeFieldBind();
  const ov=document.createElement('div');ov.id='fb-overlay';ov.onclick=e=>{if(e.target===ov)closeFieldBind();};
  const typeOpts=DEVICE_TYPES.map(t=>'<option value="'+tplEsc(t.value)+'">'+tplEsc(t.label)+'</option>').join('');
  ov.innerHTML='<div id="fb-box" class="fb-wide"><button class="dlg-close" onclick="closeFieldBind()" title="'+TT('关闭','Close')+'" aria-label="'+TT('关闭','Close')+'">✕</button>'+
    '<div id="fb-title">⚡ '+TT('从设备生成表格（行=设备，列=字段）','Generate table from devices (rows=devices, cols=fields)')+'</div>'+
    '<div style="display:flex;gap:8px"><div style="flex:1"><label class="fb-l">'+TT('设备类型','Device type')+'</label><select id="tg-type">'+typeOpts+'</select></div>'+
    '<div style="flex:1"><label class="fb-l">'+TT('项目筛选','Project filter')+'</label><select id="tg-proj"></select></div></div>'+
    '<label class="fb-l">'+TT('设备（多选，每台一行）','Devices (multi-select, one per row)')+'<button class="tb" id="tg-dev-all" style="float:right;padding:1px 7px;font-size:11px">'+TT('全选/清空','All / none')+'</button></label>'+
    '<div id="tg-devs" class="tg-list"></div>'+
    '<label class="fb-l">'+TT('字段（多选，每个一列；点分组名折叠/展开，勾分组=全选该组）','Fields (multi-select, one per column; click group to fold, tick group = select all)')+'</label>'+
    '<input id="tg-fld-q" class="tg-q" placeholder="'+TT('🔍 模糊搜索字段（搜索时不丢已勾选项）…','🔍 Search fields (selection kept)…')+'">'+
    '<div id="tg-flds" class="tg-list tg-tree"></div>'+
    '<label class="fb-l">'+TT('扩展列（计算 / 值字典转义 · 按各行设备实例化）','Derived columns (calc / dict, instantiated per row device)')+
      '<button class="tb" id="tg-ext-add" style="float:right;padding:1px 7px;font-size:11px">＋ '+TT('添加扩展列','Add')+'</button></label>'+
    '<div id="tg-ext" class="tg-list" style="max-height:220px"></div>'+
    '<div style="display:flex;gap:14px;margin-top:8px;font-size:12px;color:var(--ui-text);flex-wrap:wrap">'+
    '<label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" id="tg-hrow" checked style="width:auto"> '+TT('首行表头','Header row')+'</label>'+
    '<label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" id="tg-hcol" checked style="width:auto"> '+TT('首列名称','Name column')+'</label>'+
    '<label style="display:flex;align-items:center;gap:5px;cursor:pointer" title="'+TT('行=字段、列=设备（默认相反）','rows=fields, cols=devices')+'"><input type="checkbox" id="tg-transpose" style="width:auto"> '+TT('转置','Transpose')+'</label>'+
    '<label style="display:flex;align-items:center;gap:5px;cursor:pointer" title="'+TT('不清空现有内容，新设备行接在现有行之后（列结构须与现有表一致）','Keep existing content; new device rows appended below (column layout must match)')+'"><input type="checkbox" id="tg-append" style="width:auto"> '+TT('追加到现有表格','Append to table')+'</label></div>'+
    '<div id="fb-acts"><span class="phint" id="tg-sum" style="flex:1;margin:0"></span>'+
    '<button class="tb" onclick="closeFieldBind()">'+TT('取消','Cancel')+'</button><button class="tb grn" id="tg-ok">'+TT('生成','Generate')+'</button></div>'+
    '<div class="phint" id="tg-hint" style="margin-top:6px">'+TT('将替换本表格现有内容：生成 (设备数+表头)×(字段数+名称列) 的表格，逐格绑定所选设备的字段，值字典按后台绑定自动匹配。','Replaces current table contents; every cell bound to the selected device/field, value dicts auto-matched.')+'</div></div>';
  document.body.appendChild(ov);
  const tSel=document.getElementById('tg-type'),pSel=document.getElementById('tg-proj');
  if(n.deviceType&&DEVICE_TYPES.some(t=>t.value===n.deviceType))tSel.value=n.deviceType;
  const sum=()=>{const d=ov.querySelectorAll('#tg-devs input:checked').length,f=ov._tgFldChecked.size;
    const ext=(ov._tgExtCols||[]).filter(e=>e.zh||e.en).length,fc=f+ext;
    const hrow=document.getElementById('tg-hrow').checked, hcol=document.getElementById('tg-hcol').checked;
    const tp=document.getElementById('tg-transpose').checked, ap=!tp&&document.getElementById('tg-append').checked;
    let txt='';
    if(d&&fc){
      // 常规：行=设备；转置：行=字段；追加：新行接在现有行之后（不加表头行）
      const rowsN=tp?(fc+(hrow?1:0)):(ap?((n.rows|0)+d):(d+(hrow?1:0)));
      const colsN=tp?(d+(hcol?1:0)):(fc+(hcol?1:0));
      txt=TT('将生成 ','Result: ')+rowsN+' × '+colsN+TT('，','; ')+(d*fc)+TT(' 个绑定格',' bound cells')
        +(ext?TT('（含 '+ext+' 个扩展列）',' (incl. '+ext+' derived)'):'')
        +(ap?TT('（追加模式）',' (append)'):'')+(tp?TT('（转置）',' (transposed)'):'');
    }else txt=TT('请勾选设备与字段（或配置扩展列）','Select devices & fields (or add derived columns)');
    document.getElementById('tg-sum').textContent=txt;};
  const fillProj=()=>{const ps=projectsOfType(tSel.value);pSel.innerHTML='<option value="">全部项目</option>'+ps.map(p=>'<option value="'+tplEsc(p.id)+'">'+tplEsc(p.name)+'</option>').join('');};
  const fillDevs=()=>{
    const list=devicesOfType(tSel.value,pSel.value);
    document.getElementById('tg-devs').innerHTML=list.length?list.map(d=>'<label><input type="checkbox" value="'+tplEsc(d.deviceId)+'" style="width:auto"> '+tplEsc(d.deviceName+(d.projectName?(' · '+d.projectName):''))+'</label>').join('')
      :('<div class="phint">'+TT('该类型/项目下没有设备','No devices for this type/project')+'</div>');
    ov.querySelectorAll('#tg-devs input').forEach(x=>x.onchange=sum);
  };
  // 字段树：勾选集合挂在弹窗上（tblGenApply 按字典顺序取；搜索过滤/折叠重渲染不丢选）
  ov._tgFldChecked=new Set();
  let fldCollapsed=null;   // 折叠的 location 集合；null=未初始化（默认仅首组展开）
  const fillFlds=()=>{
    const dt=tSel.value,groups=DEVICE_DICTS[dt]||[];
    const host=document.getElementById('tg-flds');
    const q=(document.getElementById('tg-fld-q').value||'').trim().toLowerCase();
    const sel=ov._tgFldChecked;
    if(fldCollapsed===null)fldCollapsed=new Set(groups.slice(1).map(g=>g.location));
    if(!groups.length){host.innerHTML='<div class="phint">'+TT('该类型无字段字典（请确认 dic/ 已配置）','No field dictionary for this type (check dic/)')+'</div>';return;}
    const st=host.scrollTop;   // 重渲染保持滚动位置
    let html='';
    groups.forEach(g=>{
      const locHit=!q||g.location.toLowerCase().includes(q);
      const flds=(g.fields||[]).filter(fd=>locHit||fd.toLowerCase().includes(q));   // 分组名命中=整组展示
      if(q&&!flds.length)return;
      const total=(g.fields||[]).length, nSel=(g.fields||[]).filter(fd=>sel.has(g.location+'.'+fd)).length;
      const open=q?true:!fldCollapsed.has(g.location);   // 搜索时强制展开命中组（不改记忆的折叠状态）
      html+='<div class="tg-grp"><div class="tg-grp-hd" data-loc="'+tplEsc(g.location)+'" title="点击折叠/展开">'+
        '<span class="tg-chev">'+(open?'▼':'▶')+'</span>'+
        '<input type="checkbox" class="tg-grp-cb" data-loc="'+tplEsc(g.location)+'"'+(total>0&&nSel===total?' checked':'')+' title="全选/清空该分组">'+
        '<span class="tg-grp-name">'+tplEsc(g.location)+'</span><span class="tg-grp-n">'+nSel+'/'+total+'</span></div>'+
        (open?('<div class="tg-grp-body">'+flds.map(fd=>{const v=g.location+'.'+fd;
          return '<label><input type="checkbox" class="tg-fld-cb" value="'+tplEsc(v)+'"'+(sel.has(v)?' checked':'')+' style="width:auto"> '+tplEsc(fd)+'</label>';}).join('')+'</div>'):'')+
        '</div>';
    });
    host.innerHTML=html||('<div class="phint">'+TT('没有匹配「','No fields matching "')+tplEsc(q)+TT('」的字段','"')+'</div>');
    host.scrollTop=st;
    host.querySelectorAll('.tg-grp-cb').forEach(cb=>{
      const loc=cb.dataset.loc,g=groups.find(x=>x.location===loc);
      const total=(g.fields||[]).length,nSel=(g.fields||[]).filter(fd=>sel.has(loc+'.'+fd)).length;
      cb.indeterminate=nSel>0&&nSel<total;   // 三态：部分选中
      cb.onchange=()=>{const on=cb.checked;(g.fields||[]).forEach(fd=>{const v=loc+'.'+fd;if(on)sel.add(v);else sel.delete(v);});fillFlds();sum();};
    });
    host.querySelectorAll('.tg-grp-hd').forEach(hd=>{
      hd.onclick=e=>{if(e.target.classList.contains('tg-grp-cb'))return;   // 点复选框不触发折叠
        const loc=hd.dataset.loc;
        if(fldCollapsed.has(loc))fldCollapsed.delete(loc);else fldCollapsed.add(loc);fillFlds();};
    });
    host.querySelectorAll('.tg-fld-cb').forEach(x=>x.onchange=()=>{
      if(x.checked)sel.add(x.value);else sel.delete(x.value);fillFlds();sum();});
  };
  // ── 扩展列：计算公式（操作数=字段/常量，设备=本行设备）或 字段+值字典 转义列 ──
  const extCols=[];ov._tgExtCols=extCols;
  const fldOptions=cur=>{const gs=DEVICE_DICTS[tSel.value]||[];
    return '<option value="">'+TT('选择字段…','Choose field…')+'</option>'+gs.map(g=>'<optgroup label="'+tplEsc(g.location)+'">'+
      (g.fields||[]).map(fd=>{const v=g.location+'.'+fd;return '<option value="'+tplEsc(v)+'"'+(v===cur?' selected':'')+'>'+tplEsc(fd)+'</option>';}).join('')+'</optgroup>').join('');};
  const dictOptions=cur=>'<option value="@auto"'+(cur==='@auto'?' selected':'')+'>'+TT('值字典：自动匹配（默认）','Dict: auto match (default)')+'</option>'+
    '<option value="@none"'+(cur==='@none'?' selected':'')+'>'+TT('不转义（原样显示）','No translation')+'</option>'+
    effectiveValueDicts().map(d=>'<option value="'+tplEsc(d.type)+'"'+(cur===d.type?' selected':'')+'>'+TT('强制：','Force: ')+tplEsc((d.name||d.type)+' ('+d.type+')')+'</option>').join('');
  const renderExt=()=>{
    const host=document.getElementById('tg-ext');
    if(!extCols.length){host.innerHTML='<div class="phint" style="margin:2px">'+TT('派生列在此配置：如「功率 = 电流 × 电压 ÷ 1000」计算列、「状态 = 某字段 + 值字典」转义列；生成时逐行替换为该行设备。','Derived columns: e.g. calc "P = I × U ÷ 1000" or dict-translated field; instantiated per row device.')+'</div>';return;}
    host.innerHTML=extCols.map((e,i)=>{
      let body='';
      if(e.mode==='calc'){
        body='<div class="tg-ext-body">'+e.calc.operands.map((o,oi)=>{
          const opSel=oi>0?('<select class="tg-ext-op" data-i="'+i+'" data-oi="'+(oi-1)+'" style="flex:0 0 76px">'+
            CALC_OPS.map(x=>'<option value="'+x+'"'+(x===(e.calc.operators[oi-1]||'*')?' selected':'')+'>'+calcOpText(x)+'</option>').join('')+'</select>'):'<span style="flex:0 0 76px"></span>';
          const kind='<select class="tg-ext-kind" data-i="'+i+'" data-oi="'+oi+'" style="flex:0 0 62px"><option value="field"'+(o.kind!=='const'?' selected':'')+'>'+TT('字段','field')+'</option><option value="const"'+(o.kind==='const'?' selected':'')+'>'+TT('常量','const')+'</option></select>';
          const val=o.kind==='const'
            ?'<input class="tg-ext-const" data-i="'+i+'" data-oi="'+oi+'" placeholder="'+TT('常量值','constant')+'" value="'+tplEsc(o.v||'')+'" style="flex:1;min-width:0">'
            :'<select class="tg-ext-fld" data-i="'+i+'" data-oi="'+oi+'" style="flex:1;min-width:0">'+fldOptions(o.v)+'</select>';
          const del=e.calc.operands.length>2?'<button type="button" class="df-del tg-ext-odel" data-i="'+i+'" data-oi="'+oi+'" title="'+TT('移除操作数','Remove operand')+'">✕</button>':'';
          return '<div class="tg-ext-row">'+opSel+kind+val+del+'</div>';
        }).join('')+'<button type="button" class="tb tg-ext-oadd" data-i="'+i+'" style="font-size:11px;padding:2px 8px;margin-top:2px">＋ '+TT('操作数','operand')+'</button></div>';
      }else{
        body='<div class="tg-ext-body"><div class="tg-ext-row">'+
          '<select class="tg-ext-dfld" data-i="'+i+'" style="flex:1;min-width:0">'+fldOptions(e.dictField)+'</select>'+
          '<select class="tg-ext-dict" data-i="'+i+'" style="flex:1;min-width:0">'+dictOptions(e.dict)+'</select></div></div>';
      }
      return '<div class="tg-ext-card"><div class="tg-ext-row">'+
        '<input class="tg-ext-zh" data-i="'+i+'" placeholder="'+TT('表头中文名（如 功率(kW)）','Header zh (e.g. 功率(kW))')+'" value="'+tplEsc(e.zh)+'" style="flex:1;min-width:0">'+
        '<input class="tg-ext-en" data-i="'+i+'" placeholder="'+TT('English（如 P(kW)）','English (e.g. P(kW))')+'" value="'+tplEsc(e.en)+'" style="flex:1;min-width:0">'+
        '<select class="tg-ext-mode" data-i="'+i+'" style="flex:0 0 116px"><option value="calc"'+(e.mode==='calc'?' selected':'')+'>'+TT('计算/比较','Calc/compare')+'</option><option value="dict"'+(e.mode!=='calc'?' selected':'')+'>'+TT('字段+值字典','Field + dict')+'</option></select>'+
        '<button type="button" class="df-del tg-ext-del" data-i="'+i+'" title="'+TT('删除该扩展列','Remove derived column')+'">✕</button></div>'+body+'</div>';
    }).join('');
    const q=sel=>[...host.querySelectorAll(sel)];
    q('.tg-ext-zh').forEach(x=>x.oninput=()=>{extCols[+x.dataset.i].zh=x.value;sum();});
    q('.tg-ext-en').forEach(x=>x.oninput=()=>{extCols[+x.dataset.i].en=x.value;sum();});
    q('.tg-ext-mode').forEach(x=>x.onchange=()=>{extCols[+x.dataset.i].mode=x.value;renderExt();});
    q('.tg-ext-del').forEach(x=>x.onclick=()=>{extCols.splice(+x.dataset.i,1);renderExt();sum();});
    q('.tg-ext-kind').forEach(x=>x.onchange=()=>{const e=extCols[+x.dataset.i];e.calc.operands[+x.dataset.oi]=(x.value==='const')?{kind:'const',v:''}:{kind:'field',v:''};renderExt();});
    q('.tg-ext-fld').forEach(x=>x.onchange=()=>{extCols[+x.dataset.i].calc.operands[+x.dataset.oi].v=x.value;});
    q('.tg-ext-const').forEach(x=>x.oninput=()=>{extCols[+x.dataset.i].calc.operands[+x.dataset.oi].v=x.value;});
    q('.tg-ext-op').forEach(x=>x.onchange=()=>{extCols[+x.dataset.i].calc.operators[+x.dataset.oi]=x.value;});
    q('.tg-ext-odel').forEach(x=>x.onclick=()=>{const e=extCols[+x.dataset.i],oi=+x.dataset.oi;e.calc.operands.splice(oi,1);e.calc.operators.splice(oi>0?oi-1:0,1);renderExt();});
    q('.tg-ext-oadd').forEach(x=>x.onclick=()=>{const e=extCols[+x.dataset.i];e.calc.operands.push({kind:'field',v:''});e.calc.operators.push('*');renderExt();});
    q('.tg-ext-dfld').forEach(x=>x.onchange=()=>{extCols[+x.dataset.i].dictField=x.value;});
    q('.tg-ext-dict').forEach(x=>x.onchange=()=>{extCols[+x.dataset.i].dict=x.value;});
  };
  document.getElementById('tg-ext-add').onclick=()=>{
    extCols.push({zh:'',en:'',mode:'calc',calc:{operands:[{kind:'field',v:''},{kind:'field',v:''}],operators:['*']},dictField:'',dict:'@auto'});
    renderExt();sum();
  };
  renderExt();
  document.getElementById('tg-fld-q').oninput=()=>fillFlds();
  tSel.onchange=()=>{ov._tgFldChecked.clear();fldCollapsed=null;document.getElementById('tg-fld-q').value='';fillProj();fillDevs();fillFlds();renderExt();sum();};
  pSel.onchange=()=>{fillDevs();sum();};
  document.getElementById('tg-dev-all').onclick=()=>{const cbs=[...ov.querySelectorAll('#tg-devs input')];const all=cbs.length&&cbs.every(x=>x.checked);cbs.forEach(x=>x.checked=!all);sum();};
  document.getElementById('tg-hrow').onchange=sum;document.getElementById('tg-hcol').onchange=sum;
  // 转置与追加互斥（追加按行接续，转置下行=字段无法按设备追加）；追加模式不重建表头
  const tpCb=document.getElementById('tg-transpose'), apCb=document.getElementById('tg-append');
  const syncGenHint=()=>{
    apCb.disabled=tpCb.checked;if(tpCb.checked)apCb.checked=false;
    document.getElementById('tg-hrow').disabled=apCb.checked;
    document.getElementById('tg-hint').textContent=apCb.checked
      ?TT('追加模式：保留现有内容，新设备行接在最后一行之后；列结构沿用本次勾选（应与现有表一致），不重建表头。','Append mode: existing content kept, new device rows added below; column layout follows current selection (should match the table).')
      :(tpCb.checked
        ?TT('转置：行=字段、列=设备。将替换本表格现有内容。','Transposed: rows=fields, cols=devices. Replaces current contents.')
        :TT('将替换本表格现有内容：生成 (设备数+表头)×(字段数+名称列) 的表格，逐格绑定所选设备的字段，值字典按后台绑定自动匹配。','Replaces current table contents; every cell bound, value dicts auto-matched.'));
    sum();
  };
  tpCb.onchange=syncGenHint;apCb.onchange=syncGenHint;
  document.getElementById('tg-ok').onclick=()=>tblGenApply(n.id);
  fillProj();fillDevs();fillFlds();sum();
}
function tblGenApply(nodeId){
  const n=nodes.find(x=>x.id===nodeId);if(!n||n.type!=='table')return;
  const ov=document.getElementById('fb-overlay');if(!ov)return;
  const dt=document.getElementById('tg-type').value;
  const devIds=[...ov.querySelectorAll('#tg-devs input:checked')].map(x=>x.value);
  // 字段取自勾选集合（搜索过滤时 DOM 只有命中项，集合才是全量），按字典顺序排列成列
  const fset=(ov._tgFldChecked instanceof Set)?ov._tgFldChecked:new Set();
  const flds=[];
  (DEVICE_DICTS[dt]||[]).forEach(g=>(g.fields||[]).forEach(fd=>{const v=g.location+'.'+fd;if(fset.has(v))flds.push(v);}));
  // 扩展列（有表头名的才参与）：生成前校验配置完整
  const exts=(ov._tgExtCols||[]).filter(e=>e.zh||e.en);
  for(const e of exts){
    const nm=e.zh||e.en;
    if(e.mode==='calc'){
      if(!e.calc.operands.some(o=>o.kind!=='const'&&o.v)){flashHint(TT('扩展列「','Derived column "')+nm+TT('」：计算公式至少需要一个字段操作数','": formula needs at least one field operand'));return;}
      if(e.calc.operands.some(o=>o.kind==='const'?String(o.v).trim()==='':!o.v)){flashHint(TT('扩展列「','Derived column "')+nm+TT('」：请补全公式的所有操作数','": fill in all operands'));return;}
    }else if(!e.dictField){flashHint(TT('扩展列「','Derived column "')+nm+TT('」：请选择来源字段','": choose a source field'));return;}
  }
  if(!devIds.length||(!flds.length&&!exts.length)){flashHint(TT('请至少勾选一台设备和一个字段（或配置扩展列）','Select at least one device and one field (or a derived column)'));return;}
  const hrow0=document.getElementById('tg-hrow').checked, hcol=document.getElementById('tg-hcol').checked;
  const tp=document.getElementById('tg-transpose').checked;
  const ap=!tp&&document.getElementById('tg-append').checked;   // 追加：不清空、不建表头行、新行接在最后
  const hrow=ap?false:hrow0;
  const fc=flds.length+exts.length;
  snapshot();
  const rowOff=ap?Math.max(1,(n.rows|0)||1):0;
  if(!ap){
    n.cells={};
    n.data=(n.data||[]).filter(f=>f.tr==null);   // 清掉旧绑定格（整表重建）
    n.headerRow=hrow;n.headerCol=hcol;
  }else n.cells=n.cells||{};
  if(tp){ n.rows=fc+(hrow?1:0); n.cols=devIds.length+(hcol?1:0); }
  else { n.rows=rowOff+devIds.length+(hrow?1:0); n.cols=Math.max(ap?((n.cols|0)||1):0, fc+(hcol?1:0)); }
  // 单个字段/扩展列的显示名（表头用）
  const colName=xi=>xi<flds.length?flds[xi].split('.').pop():(exts[xi-flds.length].zh||exts[xi-flds.length].en);
  const colNameEn=xi=>xi<flds.length?flds[xi].split('.').pop():(exts[xi-flds.length].en||exts[xi-flds.length].zh);
  if(hrow){   // 首行表头：常规=字段名；转置=设备名
    if(hcol)n.cells['0,0']=tp?{zh:'字段',en:'Field'}:{zh:'设备',en:'Device'};
    if(tp)devIds.forEach((did,di)=>{const dev=DEVICE_LIST.find(d=>d.deviceId===did);const nm=(dev&&dev.deviceName)||did;n.cells['0,'+(di+(hcol?1:0))]={zh:nm,en:nm};});
    else for(let xi=0;xi<fc;xi++)n.cells['0,'+(xi+(hcol?1:0))]={zh:colName(xi),en:colNameEn(xi)};
  }
  if(hcol&&tp)for(let xi=0;xi<fc;xi++)n.cells[(xi+(hrow?1:0))+',0']={zh:colName(xi),en:colNameEn(xi)};   // 转置的首列=字段名
  devIds.forEach((did,di)=>{
    const dev=DEVICE_LIST.find(d=>d.deviceId===did);
    const devType=(dev&&dev.deviceType)||dt;
    if(hcol&&!tp){const r=rowOff+di+(hrow?1:0);const nm=(dev&&dev.deviceName)||did;n.cells[r+',0']={zh:nm,en:nm};}
    for(let xi=0;xi<fc;xi++){
      const r=tp?(xi+(hrow?1:0)):(rowOff+di+(hrow?1:0));
      const c=tp?(di+(hcol?1:0)):(xi+(hcol?1:0));
      const key='R'+(r+1)+'C'+(c+1);
      const fo={key,keyEn:key,dv:'',tr:r,tc:c};
      if(xi<flds.length){
        fo.bind={field:flds[xi], deviceType:devType, deviceId:did};
      }else{
        const e=exts[xi-flds.length];
        if(e.mode==='calc'){
          fo.bind={calc:{
            operands:e.calc.operands.map(o=>o.kind==='const'?{const:autoNum(String(o.v).trim())}:{field:o.v,deviceType:devType,deviceId:did}),
            operators:e.calc.operators.slice(0,e.calc.operands.length-1)
          }};
        }else{
          fo.bind={field:e.dictField, deviceType:devType, deviceId:did};
          if(e.dict==='@none')fo.dict='';else if(e.dict&&e.dict!=='@auto')fo.dict=e.dict;
        }
      }
      // 追加模式下目标格已有内容 → 覆盖（旧字段移除，静态文字清除）
      const old=tblFieldIndex(n,r,c);if(old>=0)n.data.splice(old,1);
      if(n.cells[r+','+c]&&!(hrow&&r===0)&&!(hcol&&c===0))delete n.cells[r+','+c];
      n.data.push(fo);
    }
  });
  snapshot();closeFieldBind();selectNode(n.id);
  if(document.getElementById('tbl-ed-overlay'))openTableCellEditor(true);   // 单元格弹框开着 → 重建并沿用最初快照（取消仍可回滚到打开前）
  flashHint(TT('已生成 ','Generated ')+n.rows+'×'+n.cols+TT(' 表格，',' table, ')+(devIds.length*fc)+TT(' 个单元格已绑定',' cells bound')
    +(exts.length?TT('（含 '+exts.length+' 个扩展列）',' (incl. '+exts.length+' derived)'):'')
    +(ap?TT('（追加）',' (appended)'):'')+(tp?TT('（转置）',' (transposed)'):''));
}
// 清空表格内容（保留行列数与样式）
async function tblClearAll(){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='table')return;
  const ok=await uiConfirm(TT('清空全部单元格内容与绑定？（行列数与样式保留）','Clear all cell contents & bindings? (size & style kept)'),true);
  if(!ok)return;
  snapshot();
  n.cells={};n.data=(n.data||[]).filter(f=>f.tr==null);
  snapshot();renderTableCells(n);
}
function renderNodeActionControls(n){
  const trigger=document.getElementById('p-action-trigger'),url=document.getElementById('p-action-url'),target=document.getElementById('p-action-target');
  if(!trigger||!url||!target)return;
  const a=n.action||{};
  trigger.value=a.url?(a.trigger||'click'):'none';
  url.value=a.url||'';
  target.value=a.target||'same';
}
function applyNodeAction(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const trigger=document.getElementById('p-action-trigger').value;
  const url=document.getElementById('p-action-url').value.trim();
  const target=document.getElementById('p-action-target').value;
  if(trigger==='none'||!url){delete n.action;return;}
  n.action={trigger,url,target:(target==='blank'?'blank':'same')};
}
// 占位点(anchor)外观：填充色 + 不透明度
function applyAnchorStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  // 以「正在编辑的控件」为准，避免 hex 旧值覆盖取色器新值（同 applyTextStyle）
  const act=document.activeElement?document.activeElement.id:'';
  const fillPick=document.getElementById('p-anchor-fill'),fillHex=document.getElementById('p-anchor-fill-hex');
  if(act==='p-anchor-fill'){ n.fill=fillPick.value; fillHex.value=fillPick.value; }
  else if(act==='p-anchor-fill-hex'){
    const v=fillHex.value.trim();
    if(v==='')n.fill='none';
    else if(/^#?[0-9a-fA-F]{6}$/.test(v)){ n.fill=(v[0]==='#'?v:'#'+v); fillPick.value=n.fill; }
  }
  n.opacity=parseInt(document.getElementById('p-anchor-op').value)/100;
  document.getElementById('p-anchor-op-v').textContent=Math.round(n.opacity*100);
}
function clearAnchorFill(){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.fill='none';document.getElementById('p-anchor-fill-hex').value='';}
// 内部走线值 → 属性面板可显示的选项；非弧线/手动的一律视为「智能（最短·避障·少交叉）」
function routeToOption(r){ return (r==='arc'||r==='manual'||r==='line') ? r : 'smart'; }
// 属性面板选项 → 内部走线值；「智能」用统一的内部值 'smart'
function optionToRoute(o){ return (o==='arc'||o==='manual'||o==='line') ? o : 'smart'; }
function selectEdge(e){
  ensurePropsOpen();
  selEdge=e;selNode=null;showPanel('edge');
  document.getElementById('ep-type').value=e.et||'ac_power';document.getElementById('ep-route').value=routeToOption(e.route);
  document.getElementById('ep-dir').value=e.dir||'forward';
  refreshEdgeLblUI(e);   // 填充属性面板「🏷 标签」分组（文字/样式/绑定级联/值字典/当前值溯源）
  document.getElementById('ep-w').value=e.w||1;document.getElementById('ep-w-v').textContent=(e.w||1).toFixed(1);
  const cfg=edgeCfg(e);
  document.getElementById('ep-color').value=cfg.color;
  document.getElementById('ep-color-hex').value=e.lineColor||'';
  document.getElementById('ep-style').value=e.lineStyle||'inherit';
  // 仅手动拐点连线显示正交开关
  const orow=document.getElementById('ep-ortho-row');
  orow.style.display=(e.route==='manual')?'block':'none';
  document.getElementById('ep-ortho').checked=(e.orthoSnap!==false);
  const base=ET[e.et]||ET.ac_power;document.getElementById('ep-desc').textContent=base.desc;document.getElementById('ep-desc').style.color=cfg.color;
  refreshEdgeRuleSummary(e);
  updateEpTypeSwatch();
}
function showPanel(m){document.getElementById('pnone').style.display=m==='none'?'block':'none';document.getElementById('pnode').style.display=m==='node'?'block':'none';document.getElementById('pedge').style.display=m==='edge'?'block':'none';}
function applyNP(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const idEl=document.getElementById('p-id');
  const nid=idEl.value.trim();
  // 节点 ID 必须唯一且非空：非法则标红提示、不应用该 ID（其余属性照常保存），改成合法后自动生效
  if(nid!==n.id){
    let err='';
    if(!nid)err='节点 ID 不能为空';
    else if(nodes.some(x=>x!==n&&x.id===nid))err='节点 ID 已存在，请使用唯一 ID';
    if(err){ idEl.style.borderColor='#ff6b6b';idEl.title=err; }
    else{
      idEl.style.borderColor='';idEl.title='';
      edges.forEach(e=>{if(e.from===n.id)e.from=nid;if(e.to===n.id)e.to=nid;});n.id=nid;selNode=nid;
    }
  }else{ idEl.style.borderColor='';idEl.title=''; }
  n.labelZh=document.getElementById('p-label-zh').value;
  n.labelEn=document.getElementById('p-label-en').value;
  n.label=n.labelZh; // 兼容旧字段
  n.type=document.getElementById('p-type').value;
  n.fontSize=Math.max(4,Math.min(300,Math.round(pairVal('p-fs',14))));
  n.scale=Math.max(5,Math.min(800,Math.round(pairVal('p-scale',100))))/100;
  n.rotation=((Math.round(pairVal('p-rot',0))%360)+360)%360;
  invalidateRouting();
  n.fontColor=document.getElementById('p-fc').value;document.getElementById('p-fc-hex').value=n.fontColor;
}
function syncColor(id,v){if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById(id).value=v;applyNP();}}
// 单个节点：控制画布上是否显示名称 / 数据字段（属性仍保留，仅控制显示）
function applyVis(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;snapshot();
  n.hideLabel=!document.getElementById('p-show-label').checked;
  if(!usesTextBox(n.type))n.hideFields=!document.getElementById('p-show-fields').checked;
  snapshot();
}
// 批量：对所有选中节点统一显示/隐藏 名称(label) 或 数据字段(fields)
function batchVis(which,show){
  const ns=selectedNodes();if(ns.length<1)return;snapshot();
  ns.forEach(n=>{ if(which==='label')n.hideLabel=!show; else if(!usesTextBox(n.type))n.hideFields=!show; });
  const cur=nodes.find(x=>x.id===selNode);
  if(cur){const a=document.getElementById('p-show-label'),b=document.getElementById('p-show-fields');if(a)a.checked=!cur.hideLabel;if(b)b.checked=!cur.hideFields;}
  snapshot();
}
function applyEP(){
  if(!selEdge)return;selEdge.et=document.getElementById('ep-type').value;selEdge.route=optionToRoute(document.getElementById('ep-route').value);
  selEdge.dir=document.getElementById('ep-dir').value;
  // 标签相关属性由「🏷 标签」分组的 applyELbl/elcApplyBind 等专职处理，applyEP 不再读写
  selEdge.w=parseFloat(document.getElementById('ep-w').value);document.getElementById('ep-w-v').textContent=selEdge.w.toFixed(1);
  // 以「正在编辑的控件」为准，避免 hex 旧值覆盖取色器新值（同 applyTextStyle）
  const epPick=document.getElementById('ep-color'),epHex=document.getElementById('ep-color-hex');
  if(document.activeElement&&document.activeElement.id==='ep-color'){selEdge.lineColor=epPick.value;epHex.value=epPick.value;}
  else{
    const hex=normHex(epHex.value);
    if(hex){selEdge.lineColor=hex;epPick.value=hex;}
    else if(!epHex.value.trim())delete selEdge.lineColor;
  }
  selEdge.lineStyle=document.getElementById('ep-style').value;
  if(selEdge.lineStyle==='inherit')delete selEdge.lineStyle;
  selEdge.orthoSnap=document.getElementById('ep-ortho').checked;
  document.getElementById('ep-ortho-row').style.display=(selEdge.route==='manual')?'block':'none';
  invalidateRouting();
  const base=ET[selEdge.et]||ET.ac_power,cfg=edgeCfg(selEdge);
  if(!selEdge.lineColor)document.getElementById('ep-color').value=base.color;
  document.getElementById('ep-desc').textContent=base.desc;document.getElementById('ep-desc').style.color=cfg.color;updateEpTypeSwatch();snapshot();
}
function clearEdgeColor(){if(!selEdge)return;delete selEdge.lineColor;document.getElementById('ep-color-hex').value='';document.getElementById('ep-color').value=(ET[selEdge.et]||ET.ac_power).color;applyEP();}
function renderDFs(n){const c=document.getElementById('dfields');c.className='dfgrid';
  // 列头 + 所有字段单元格放在「同一个 CSS grid」里，列宽由浏览器统一计算 → 列名与数据行精确对齐、绝不错位
  let html='<span class="dh dh-zh" data-i18n="中文名">中文名</span><span class="dh dh-en" data-i18n="英文名">英文名</span><span class="dh dh-val" data-i18n="默认值">默认值</span><span class="dh dh-act" data-i18n="绑定">绑定</span>';
  const _issues=fieldNameIssues(n);
  (n.data||[]).forEach((f,i)=>{
    const dvVal=(f.dv==null||f.dv==='')?'':String(f.dv);   // 原始值；下方统一用 tplEsc 转义
    const bound=bindHasSource(f.bind);   // 单字段绑定或计算绑定（bind.calc）均视为已绑定
    // 值字典状态：显式指定(强制/不转义)高亮；否则按 bind 自动匹配（title 提示当前生效字典）
    const hasDict=(f.dict!==undefined&&f.dict!==null);
    const effDict=resolveValueDict(f,nodeDeviceType(n));
    const dictTip=hasDict?(f.dict===''?'值字典：已设为「不转义」（原样显示），点击修改':('值字典：强制使用「'+vdDisplayName(f.dict)+'」，点击修改'))
      :(effDict?('值字典：自动命中「'+vdDisplayName(effDict.type)+'」（经后台绑定），点击可覆盖'):'值字典：code 码转义显示（默认自动匹配后台绑定），点击设置');
    const iss=_issues[i]||{};
    const zhBad=iss.emptyZh||iss.dupZh, enBad=iss.emptyEn||iss.dupEn;
    const zhTip=iss.dupZh?'中文名重复（同节点内需唯一）':'中文字段名（必填）';
    const enTip=iss.dupEn?'英文名重复（同节点内需唯一·作信号键会冲突）':'英文名（必填·作端到端信号键）';
    html+='<input class="df-zh-in'+(zhBad?' df-invalid':'')+'" value="'+tplEsc(f.key||'')+'" placeholder="中文字段名(必填)" title="'+zhTip+'" oninput="updDF('+i+',\'key\',this.value,this)">'+
      '<input class="df-en-in'+(enBad?' df-invalid':'')+'" value="'+tplEsc(f.keyEn||'')+'" placeholder="英文名(必填)" title="'+enTip+'" oninput="updDF('+i+',\'keyEn\',this.value,this)">'+
      '<input class="df-val-in" value="'+tplEsc(dvVal)+'" placeholder="--" title="默认值（可留空）" oninput="updDFVal('+i+',this.value)">'+
      '<span class="df-acts">'+
        '<button class="df-bind'+(bound?' bound':'')+'" onclick="openFieldBind('+i+')" title="'+(bound?'已绑定后台字段，点击修改':'绑定后台字段')+'">🔗</button>'+
        '<button class="df-bind df-dict'+(hasDict?' bound':'')+'" onclick="openFieldDict('+i+')" title="'+tplEsc(dictTip)+'">📖</button>'+
        '<button class="df-del" onclick="rmDF('+i+')" title="删除字段">✕</button>'+
      '</span>';
    // 显式指定了值字典 → 整行紧贴显示（同绑定摘要），✕ 恢复自动匹配
    if(hasDict){
      html+='<div class="df-bindline"><span class="df-bindsum" onclick="openFieldDict('+i+')" title="点击修改值字典">↳ '+
        tplEsc((f.key||('字段'+(i+1)))+'  ·  值字典：'+(f.dict===''?'不转义（原样显示）':('强制「'+vdDisplayName(f.dict)+'」')))+'</span>'+
        '<button class="df-bindclr" onclick="clearFieldDict('+i+')" title="恢复自动匹配（按后台绑定自动命中字典）">✕</button></div>';
    }
    // 已绑定 → 整行(跨全部列)紧贴显示来源（前缀字段名，杜绝歧义）+ ✕ 快速清除
    if(bound){
      const noInst=bindIsCalc(f.bind)
        ?calcFieldOperands(f.bind).some(x=>!(x.o.deviceId||n.deviceId))   // 计算绑定：任一字段操作数解析不到设备实例即告警
        :!(f.bind.deviceId||n.deviceId);
      html+='<div class="df-bindline'+(noInst?' warn':'')+'">'+
        '<span class="df-bindsum" onclick="openFieldBind('+i+')" title="点击编辑绑定">↳ '+tplEsc((f.key||('字段'+(i+1)))+'  ←  '+fieldBindSummary(n,f))+'</span>'+
        '<button class="df-bindclr" onclick="clearFieldBind('+i+')" title="清除此字段的绑定">✕</button></div>';
    }
  });
  c.innerHTML=html;
  refreshDeviceBindUI(n);
  // 表格：既无绑定也无图标配置的「格字段」无意义（静态文字走 cells）——清除绑定/取消后自动清理，避免导出黄色误报；
  // 同时刷新表格分组的单元格编辑器（绑定弹窗确定/清除都经由本函数回流）
  if(n.type==='table'){
    n.data=(n.data||[]).filter(f=>f.tr==null||bindHasSource(f.bind)||f.cellShow||f.icon||(Array.isArray(f.iconRules)&&f.iconRules.length));
    renderTableCells(n);
  }
  // 文本框 / 变量节点：画布上只显示「第一个字段」，因此绑定限制为单个字段，避免绑定多个却只显示一个造成误解
  const single=usesTextBox(n.type)&&n.type!=='table';
  const lbl=document.getElementById('prow-data-label'),btn=document.getElementById('btn-add-df'),hint=document.getElementById('prow-data-hint');
  if(lbl)lbl.textContent=single?(n.type==='variable'?'绑定数据（值，仅一个字段）':'绑定数据（仅一个字段）'):'数据字段';
  if(btn)btn.style.display=(single&&(n.data||[]).length>=1)?'none':'';
  if(hint){if(single){hint.style.display='';hint.textContent=(n.type==='variable'?'变量只显示一个值：此字段即「value」，可填默认值或由实时数据绑定覆盖。':'文本框只显示一个绑定值，故仅允许绑定一个数据字段。');}else hint.style.display='none';}
}
function addDF(){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.data=n.data||[];
  // 文本框 / 变量节点：只允许绑定一个字段（表格多字段，按单元格管理）
  if(usesTextBox(n.type)&&n.type!=='table'&&n.data.length>=1){flashHint(n.type==='variable'?'变量只能绑定一个值字段':'文本框只能绑定一个数据字段');return;}
  // 已有字段名不完整/重复时，先修正再加新字段（避免堆积非法字段）
  if(nodeHasFieldNameError(n)){flashHint(lang==='en'?'Fix existing field names (required & unique) before adding':'请先补全/修正现有字段的中英文名（必填且不可重复），再添加新字段');return;}
  // 新增一条「空」字段：中文名/英文名都留空由用户填写（必填校验会即时标红），不做默认填充
  n.data.push({key:'',keyEn:'',dv:''});renderDFs(n);
  const zhs=document.querySelectorAll('#dfields .df-zh-in');const last=zhs[zhs.length-1];if(last)last.focus();}

// ───── 后台数据绑定 UI ─────
// 设备绑定面板的「项目筛选」——仅 UI 态、不入库；随所选设备实例派生，用于「先选项目→再选项目下设备」的级联
let _devBindProj='';
// 节点级「设备类型 → 项目 → 设备实例」级联下拉（该节点字段的默认来源）
function refreshDeviceBindUI(n){
  const sec=document.getElementById('prow-devbind'),sep=document.getElementById('prow-devbind-sep');
  if(!sec)return;
  const show=n&&n.type!=='anchor';   // 占位点无数据，不显示绑定
  sec.style.display=show?'':'none'; if(sep)sep.style.display=show?'':'none';
  if(!show)return;
  const tSel=document.getElementById('p-dev-type'),pSel=document.getElementById('p-dev-project'),iSel=document.getElementById('p-dev-id');
  const dt=nodeDeviceType(n);
  // 设备类型
  tSel.innerHTML='<option value="">未指定</option>'+DEVICE_TYPES.map(t=>'<option value="'+tplEsc(t.value)+'"'+(t.value===dt?' selected':'')+'>'+tplEsc(t.label)+'</option>').join('');
  // 项目筛选：已选设备实例时以该设备所属项目为准；否则沿用暂存筛选
  const selDev=n.deviceId?DEVICE_LIST.find(d=>d.deviceId===n.deviceId):null;
  if(selDev)_devBindProj=selDev.projectId||'';
  const projs=projectsOfType(dt);
  if(_devBindProj&&!projs.some(p=>p.id===_devBindProj))_devBindProj='';   // 换类型后旧项目已不在列表→清空
  if(pSel)pSel.innerHTML='<option value="">全部项目</option>'+projs.map(p=>'<option value="'+tplEsc(p.id)+'"'+(p.id===_devBindProj?' selected':'')+'>'+tplEsc(p.name)+'</option>').join('');
  // 设备实例：按类型 + 项目过滤；已选项目时项目名不再重复追加
  const list=devicesOfType(dt,_devBindProj),showProj=!_devBindProj;
  iSel.innerHTML='<option value="">未指定实例</option>'+list.map(d=>'<option value="'+tplEsc(d.deviceId)+'"'+(d.deviceId===n.deviceId?' selected':'')+'>'+tplEsc(d.deviceName+(showProj&&d.projectName?(' · '+d.projectName):''))+'</option>').join('');
  const hint=document.getElementById('p-dev-hint');
  if(hint){
    if(!DEVICE_TYPES.length){hint.textContent='未加载到后台设备类型，请确认 device/ 与 dic/ 已就绪并重启服务后点 🔄 刷新。';hint.style.color='#e0a020';}
    else if(dt&&!n.deviceId){hint.textContent='⚠ 已选设备类型但未指定「设备实例」——可先选项目再选项目下的设备；未指定实例时跟随本节点的字段将无法关联到具体后台设备。';hint.style.color='#e0a020';}
    else {hint.textContent='该节点默认对应的后台设备；下方字段未单独指定来源时即取此设备。';hint.style.color='';}
  }
}
// what: 'type' 改设备类型 | 'project' 改项目筛选 | 'device' 选设备实例
function applyDeviceBind(what){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;snapshot();
  if(what==='type'){
    const dt=document.getElementById('p-dev-type').value;
    n.deviceType=dt||''; if(!n.deviceType)delete n.deviceType;
    delete n.deviceId; _devBindProj='';   // 改类型 → 项目/实例都需重选
  }else if(what==='project'){
    _devBindProj=document.getElementById('p-dev-project').value||'';
    delete n.deviceId;                     // 改项目 → 实例需重选
  }else{ // 'device'
    const did=document.getElementById('p-dev-id').value; n.deviceId=did||''; if(!n.deviceId)delete n.deviceId;
  }
  refreshDeviceBindUI(n); renderDFs(n); snapshot();
}
// 计算绑定的可读摘要：= 操作数1 op 操作数2 …（字段操作数带设备名，常量原样；n 为空时不做「跟随节点」兜底）
function calcBindSummary(calc,n){
  const parts=[];
  (calc.operands||[]).forEach((o,i)=>{
    if(i>0)parts.push(calcOpText((calc.operators||[])[i-1]||'+'));
    if(o&&o.const!==undefined){parts.push(String(o.const));return;}
    if(!o||!o.field){parts.push('?');return;}
    const dt=o.deviceType||(n?nodeDeviceType(n):'');
    const did=o.deviceId||(n?(n.deviceId||''):'');
    parts.push((dt?deviceTypeLabel(dt)+'·':'')+(did?deviceNameOf(did):'⚠未指定实例')+'/'+o.field);
  });
  return '= '+parts.join(' ');
}
// 某字段绑定的可读摘要：跨设备时加 ⮕ 标记；计算绑定显示整条公式
function fieldBindSummary(n,f){
  if(!f.bind)return '';
  if(bindIsCalc(f.bind))return calcBindSummary(f.bind.calc,n);
  if(!f.bind.field)return '';
  const dt=f.bind.deviceType||nodeDeviceType(n);
  const did=f.bind.deviceId||n.deviceId||'';
  const cross=(f.bind.deviceType&&f.bind.deviceType!==nodeDeviceType(n))||(f.bind.deviceId&&f.bind.deviceId!==(n.deviceId||''));
  if(!did)  // 没解析到设备实例 → 绑定不完整，明确提示
    return '⚠ 未指定设备实例 · '+(dt?deviceTypeLabel(dt)+'·':'')+f.bind.field;
  return (cross?'⮕ ':'')+(dt?deviceTypeLabel(dt)+'·':'')+deviceNameOf(did)+' / '+f.bind.field;
}
// ───── 计算绑定编辑器（绑定弹窗「计算/比较」模式，数据字段/全局信号共用）─────
// 工作副本 _fbCalc={operands:[{kind:'field',deviceId,deviceType,loc,fld}|{kind:'const',v}],operators:[op,...]}，
// 确定时经 _fbCalcCollect 校验并固化为 bind={calc:{operands,operators}}。求值单一实现在 TopoRules.calcValue。
const CALC_OPS=['+','-','*','/','%','>','>=','<','<=','==','!='];
const CALC_CMP_OPS=['>','>=','<','<=','==','!='];
const CALC_NUM_OPS=['+','-','*','/','%','>','>=','<','<='];   // 这些运算符两侧的常量必须是数字（==/!= 允许文本）
let _fbCalc=null,_fbCalcOpt=null;   // 工作副本 / 当前弹窗上下文（followLbl/defType/hasNodeDev）
function _fbCalcInit(b){
  const st={operands:[],operators:[],decimals:2};   // decimals=数值结果保留小数位（0~3，缺省 2）
  if(bindIsCalc(b)){
    b.calc.operands.forEach(o=>{
      if(o&&o.const!==undefined)st.operands.push({kind:'const',v:String(o.const)});
      else if(o&&o.field){const p=String(o.field).split('.');const fld=p.pop(),loc=p.join('.');
        st.operands.push({kind:'field',deviceId:o.deviceId||'',deviceType:o.deviceType||'',loc,fld});}
    });
    st.operators=(Array.isArray(b.calc.operators)?b.calc.operators:[]).slice();
    if(b.calc.decimals!=null)st.decimals=Math.max(0,Math.min(3,b.calc.decimals|0));
  }
  while(st.operands.length<2)st.operands.push({kind:'field',deviceId:'',deviceType:'',loc:'',fld:''});
  st.operators.length=st.operands.length-1;
  for(let i=0;i<st.operators.length;i++)if(!CALC_OPS.includes(st.operators[i]))st.operators[i]='+';
  return st;
}
// 计算模式区块（两个绑定弹窗共用）：操作数行 + 底部「添加操作数 / 结果小数位」+ 公式摘要
function _fbCalcBlockHTML(){
  return '<div id="fb-calc" style="display:none"><div id="fb-calc-rows"></div>'+
    '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">'+
    '<button class="tb" type="button" id="fb-calc-add">＋ 添加操作数</button><span style="flex:1"></span>'+
    '<label class="fb-l" style="margin:0;flex:0 0 auto" title="数值结果四舍五入保留的小数位（比较结果 1/0 不受影响）">结果小数位</label>'+
    '<select id="fb-calc-dp" style="width:88px;flex:0 0 auto">'+
    [0,1,2,3].map(d=>'<option value="'+d+'"'+(d===2?' selected':'')+'>'+d+(d===2?'（默认）':'')+'</option>').join('')+'</select></div>'+
    '<div class="phint" id="fb-calc-sum" style="margin-top:6px"></div></div>';
}
// 行内「来源设备」选项：followLbl 非 null 时提供「跟随本节点」空值项（数据字段）；全局信号必须显式选设备
function _fbCalcDevHTML(o,followLbl){
  const opts=[followLbl!=null?('<option value="">跟随本节点：'+tplEsc(followLbl)+'</option>'):'<option value="">请选择设备实例</option>'];
  DEVICE_LIST.forEach(d=>{opts.push('<option value="'+tplEsc(d.deviceId)+'" data-dt="'+tplEsc(d.deviceType)+'"'+(o.deviceId===d.deviceId?' selected':'')+'>'+tplEsc(deviceTypeLabel(d.deviceType)+' · '+d.deviceName+(d.projectName?(' · '+d.projectName):''))+'</option>');});
  return opts.join('');
}
// opt={followLbl:string|null, defType:string（跟随节点时的兜底设备类型）, hasNodeDev:bool（「跟随本节点」能否解析到实例）}
function _fbCalcRender(opt){
  _fbCalcOpt=opt;
  const host=document.getElementById('fb-calc-rows');if(!host)return;
  const st=_fbCalc;host.innerHTML='';
  st.operands.forEach((o,i)=>{
    if(i>0){
      const orow=document.createElement('div');orow.className='fb-calc-oprow';
      const osel=document.createElement('select');
      CALC_OPS.forEach(v=>{const x=document.createElement('option');x.value=v;x.textContent=calcOpText(v)+(CALC_CMP_OPS.includes(v)?'（比较→1/0）':'');osel.appendChild(x);});
      osel.value=st.operators[i-1]||'+';
      osel.onchange=e=>{st.operators[i-1]=e.target.value;_fbCalcSum();};
      orow.appendChild(osel);host.appendChild(orow);
    }
    const row=document.createElement('div');row.className='fb-calc-row';
    const kind=document.createElement('select');kind.className='fb-calc-kind';
    [['field','后台字段'],['const','常量']].forEach(([v,t])=>{const x=document.createElement('option');x.value=v;x.textContent=t;kind.appendChild(x);});
    kind.value=o.kind;
    kind.onchange=e=>{st.operands[i]=(e.target.value==='const')?{kind:'const',v:''}:{kind:'field',deviceId:'',deviceType:'',loc:'',fld:''};_fbCalcRender(opt);};
    row.appendChild(kind);
    if(o.kind==='const'){
      const inp=document.createElement('input');inp.className='fb-calc-const';inp.placeholder='常量值（数字或文本）';inp.value=(o.v!=null?o.v:'');
      inp.oninput=e=>{o.v=e.target.value;_fbCalcSum();};
      row.appendChild(inp);
    }else{
      const dev=document.createElement('select');dev.className='fb-calc-dev';dev.innerHTML=_fbCalcDevHTML(o,opt.followLbl);
      const loc=document.createElement('select');loc.className='fb-calc-loc';
      const fld=document.createElement('select');fld.className='fb-calc-fld';
      const effType=()=>{const x=dev.selectedOptions[0];return (x&&x.getAttribute('data-dt'))||opt.defType||'';};
      const fillFld=cur=>{const fs=dictFields(effType(),loc.value);fld.innerHTML=fs.length?fs.map(x=>'<option'+(x===cur?' selected':'')+'>'+tplEsc(x)+'</option>').join(''):'<option value="">无字段</option>';};
      const fillLoc=(cl,cf)=>{const ls=dictLocations(effType());loc.innerHTML=ls.length?ls.map(l=>'<option'+(l===cl?' selected':'')+'>'+tplEsc(l)+'</option>').join(''):'<option value="">该类型无字典</option>';fillFld(cf);};
      const save=()=>{const x=dev.selectedOptions[0];o.deviceId=dev.value;o.deviceType=dev.value?((x&&x.getAttribute('data-dt'))||''):'';o.loc=loc.value;o.fld=fld.value;_fbCalcSum();};
      dev.onchange=()=>{fillLoc('','');save();};
      loc.onchange=()=>{fillFld('');save();};
      fld.onchange=save;
      fillLoc(o.loc,o.fld);save();
      row.appendChild(dev);row.appendChild(loc);row.appendChild(fld);
    }
    if(st.operands.length>2){
      const del=document.createElement('button');del.type='button';del.className='df-del';del.textContent='✕';del.title='移除该操作数';
      del.onclick=()=>{st.operands.splice(i,1);st.operators.splice(i>0?i-1:0,1);_fbCalcRender(opt);};   // 删操作数=连带删它前面的运算符，长度不变量自持
      row.appendChild(del);
    }
    host.appendChild(row);
  });
  const add=document.getElementById('fb-calc-add');
  if(add)add.onclick=()=>{st.operands.push({kind:'field',deviceId:'',deviceType:'',loc:'',fld:''});st.operators.push('+');_fbCalcRender(opt);};
  const dp=document.getElementById('fb-calc-dp');
  if(dp){dp.value=String(st.decimals!=null?st.decimals:2);dp.onchange=e=>{st.decimals=Math.max(0,Math.min(3,(+e.target.value)|0));_fbCalcSum();};}
  _fbCalcSum();
}
// 逐操作数校验：字段操作数必须能解析到设备实例（显式选择，或「跟随本节点」且节点已设实例）且分类/字段已选；
// 常量必填，参与算术/大小比较的常量必须是数字，除法/取模的除数常量不能为 0；至少一个字段操作数。
// 返回 {rows:[{dev?,fld?,const?}], err:首个错误文案|null}
function _fbCalcIssues(){
  const st=_fbCalc,opt=_fbCalcOpt||{};
  const rows=[];let firstErr=null,hasField=false;
  if(!st)return {rows,err:null};
  st.operands.forEach((o,i)=>{
    const r={};
    if(o.kind==='const'){
      const s=String(o.v||'').trim();
      const adj=[i>0?st.operators[i-1]:null, i<st.operands.length-1?st.operators[i]:null].filter(Boolean);
      if(!s)r.const='常量值必填';
      else if(adj.some(op=>CALC_NUM_OPS.includes(op))&&!/^-?\d+(\.\d+)?$/.test(s))r.const='参与算术/大小比较的常量必须是数字（仅 = ≠ 允许文本）';
      else if(i>0&&(st.operators[i-1]==='/'||st.operators[i-1]==='%')&&parseFloat(s)===0)r.const='除法/取模的除数不能为 0';
    }else{
      hasField=true;
      if(!o.deviceId&&!opt.hasNodeDev)r.dev='必须确定设备实例——选具体来源设备，或先为本节点指定「设备实例」';
      if(!o.loc||!o.fld)r.fld='请选择分类与字段';
    }
    const msg=r.dev||r.fld||r.const;
    if(msg&&!firstErr)firstErr='第'+(i+1)+'个操作数：'+msg;
    rows.push(r);
  });
  if(!firstErr&&!hasField)firstErr='至少需要一个「后台字段」操作数（全常量无需绑定后台）';
  return {rows,err:firstErr};
}
// 公式摘要 + 实时校验：非法输入红框、fb-hint 显示首个错误、「确定」按钮门禁（合法才可点）
function _fbCalcSum(){
  const el=document.getElementById('fb-calc-sum');if(!el||!_fbCalc)return;
  const parts=[];
  _fbCalc.operands.forEach((o,i)=>{
    if(i>0)parts.push(calcOpText(_fbCalc.operators[i-1]||'+'));
    if(o.kind==='const')parts.push(String(o.v||'').trim()===''?'?':String(o.v).trim());
    else parts.push(o.fld?((o.deviceId?deviceNameOf(o.deviceId)+'/':'')+o.fld):'?');
  });
  el.textContent='公式：'+parts.join(' ')+'　（按顺序从左到右依次结合，无括号/优先级；比较结果为 1/0；数值结果保留 '+(_fbCalc.decimals!=null?_fbCalc.decimals:2)+' 位小数）';
  // 实时校验标红 + 门禁
  const {rows,err}=_fbCalcIssues();
  const host=document.getElementById('fb-calc-rows');
  if(host)host.querySelectorAll('.fb-calc-row').forEach((rowEl,i)=>{
    const r=rows[i]||{};
    const mark=(sel,bad)=>{const x=rowEl.querySelector(sel);if(x)x.classList.toggle('df-invalid',!!bad);};
    mark('.fb-calc-const',r.const);
    mark('.fb-calc-dev',r.dev);
    mark('.fb-calc-loc',r.fld);mark('.fb-calc-fld',r.fld);
  });
  if(_fbMode()==='calc'){
    const cb=document.getElementById('fb-confirm');
    if(cb){cb.disabled=!!err;cb.style.opacity=err?'.45':'';cb.style.cursor=err?'not-allowed':'';}
    const h=document.getElementById('fb-hint');
    if(h){
      if(err){h.textContent='⚠ '+err;h.style.color='#e0a020';}
      else{h.textContent='操作数按从上到下依次结合（无括号/优先级）；比较运算结果为 1/0，可再配值字典转成文案。后台只推各操作数原始值，计算在画布/前端完成。';h.style.color='';}
    }
  }
}
// 校验并固化（确定时的最终关卡，与实时校验同一套 _fbCalcIssues）。返回 {calc} 或 {err}
function _fbCalcCollect(){
  const chk=_fbCalcIssues();
  if(chk.err)return {err:chk.err};
  const st=_fbCalc,operands=[];
  st.operands.forEach(o=>{
    if(o.kind==='const'){operands.push({const:autoNum(String(o.v).trim())});return;}
    const op={field:o.loc+'.'+o.fld};
    if(o.deviceId){op.deviceId=o.deviceId;if(o.deviceType)op.deviceType=o.deviceType;}
    operands.push(op);
  });
  const calc={operands,operators:st.operators.slice(0,operands.length-1)};
  if(st.decimals!=null&&st.decimals!==2)calc.decimals=st.decimals;   // 缺省 2 不落字段，JSON 保持精简
  return {calc};
}
// 字段来源选择弹窗：设备(默认本节点/可跨设备) + 分类(location) + 字段(field)
function openFieldBind(i){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const f=(n.data||[])[i];if(!f)return;
  // 字段中英文名必填且同节点内唯一：不合法则不允许绑定到节点（英文名是端到端信号键，缺失/重复将无法生成或冲突）
  const _iss=fieldNameIssues(n)[i]||{};
  if(_iss.emptyZh||_iss.emptyEn){flashHint(lang==='en'?'Fill both Chinese & English field names before binding':'请先填写该字段的中文名和英文名，方可绑定');return;}
  if(_iss.dupZh||_iss.dupEn){flashHint(lang==='en'?'Field name duplicated in this node — make it unique before binding':'该字段名在本节点内重复（中/英文名需唯一），请先修正再绑定');return;}
  closeFieldBind();
  const b=f.bind||{};
  const isCalc0=bindIsCalc(b);
  const ov=document.createElement('div');ov.id='fb-overlay';ov.onclick=e=>{if(e.target===ov)closeFieldBind();};
  // 设备选项：空=跟随本节点；否则具体设备(携带其 deviceType)
  const followLbl=n.deviceId?deviceNameOf(n.deviceId):(nodeDeviceType(n)?('⚠ 未指定实例·'+deviceTypeLabel(nodeDeviceType(n))):'⚠ 未指定设备');
  const devOpts=['<option value="">跟随本节点：'+tplEsc(followLbl)+'</option>']
    .concat(DEVICE_LIST.map(d=>{const sel=(!isCalc0&&b.deviceId===d.deviceId)?' selected':'';return '<option value="'+tplEsc(d.deviceId)+'" data-dt="'+tplEsc(d.deviceType)+'"'+sel+'>'+tplEsc(deviceTypeLabel(d.deviceType)+' · '+d.deviceName+(d.projectName?(' · '+d.projectName):''))+'</option>';}));
  ov.innerHTML='<div id="fb-box"'+(isCalc0?' class="fb-wide"':'')+'><button class="dlg-close" onclick="closeFieldBind()" title="关闭" aria-label="关闭">✕</button><div id="fb-title">绑定后台字段：'+tplEsc(f.key||('字段'+(i+1)))+'</div>'+
    '<div class="fb-mode"><label><input type="radio" name="fb-mode" value="simple"'+(isCalc0?'':' checked')+'> 单字段</label>'+
    '<label><input type="radio" name="fb-mode" value="calc"'+(isCalc0?' checked':'')+'> 计算/比较（多字段与常量）</label></div>'+
    '<div id="fb-simple">'+
    '<label class="fb-l">来源设备</label><select id="fb-dev">'+devOpts.join('')+'</select>'+
    '<label class="fb-l">分类(location)</label><select id="fb-loc"></select>'+
    '<label class="fb-l">字段(field)</label><select id="fb-field"></select>'+
    '<label class="fb-l" title="'+TT('数值显示保留的小数位（仅数值生效；值字典命中转义时不适用）','Displayed decimal places for numeric values (dict labels unaffected)')+'">'+TT('显示小数位','Decimals')+'</label>'+
    '<select id="fb-dp">'+[['',TT('原样（默认）','as-is (default)')],['0','0'],['1','1'],['2','2'],['3','3']]
      .map(([v,t])=>'<option value="'+v+'"'+(String(f.decimals??'')===v?' selected':'')+'>'+t+'</option>').join('')+'</select>'+
    '</div>'+
    _fbCalcBlockHTML()+
    '<div id="fb-acts"><button class="tb" onclick="clearFieldBind('+i+')">清除绑定</button><span style="flex:1"></span>'+
    '<button class="tb" onclick="closeFieldBind()">取消</button><button class="tb grn" id="fb-confirm" onclick="confirmFieldBind('+i+')">确定</button></div>'+
    '<div class="phint" id="fb-hint" style="margin-top:6px"></div></div>';
  document.body.appendChild(ov);
  const effType=()=>{const o=document.getElementById('fb-dev').selectedOptions[0];const dt=o&&o.getAttribute('data-dt');return dt||nodeDeviceType(n);};
  // 是否已能确定来源设备实例：选了具体设备，或「跟随本节点」且本节点已设实例
  const resolvable=()=>!!(document.getElementById('fb-dev').value||n.deviceId);
  const fillField=(curField)=>{
    const dt=effType();const loc=document.getElementById('fb-loc').value;const fields=dictFields(dt,loc);
    document.getElementById('fb-field').innerHTML=fields.length?fields.map(x=>'<option'+(x===curField?' selected':'')+'>'+tplEsc(x)+'</option>').join(''):'<option value="">无字段</option>';
  };
  const fillLoc=(curLoc,curField)=>{
    const dt=effType();const locs=dictLocations(dt);
    const loc=document.getElementById('fb-loc');
    loc.innerHTML=locs.length?locs.map(l=>'<option'+(l===curLoc?' selected':'')+'>'+tplEsc(l)+'</option>').join(''):'<option value="">该类型无字典</option>';
    fillField(curField);
    updateGate();
  };
  // 无法解析设备实例 → 禁用分类/字段/确定，避免存下无法关联后台的"残缺绑定"（仅单字段模式；计算模式确定时逐操作数校验）
  const updateGate=()=>{
    if(_fbMode()==='calc')return;
    const ok=resolvable();
    ['fb-loc','fb-field'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!ok;});
    const cb=document.getElementById('fb-confirm');if(cb){cb.disabled=!ok;cb.style.opacity=ok?'':'.45';cb.style.cursor=ok?'':'not-allowed';}
    const h=document.getElementById('fb-hint');
    if(!ok){h.textContent='⚠ 未确定设备实例：请在上方为本节点选「设备实例」，或在此「来源设备」直接选择具体设备，否则无法绑定。';h.style.color='#e0a020';}
    else{const dt=effType();h.textContent='字典：'+(dt?deviceTypeLabel(dt):'—')+'（'+dictLocations(dt).length+' 个分类）';h.style.color='';}
  };
  // 模式切换：单字段 ⇄ 计算/比较（计算模式的校验/门禁由 _fbCalcSum 实时维护）
  const calcOpt={followLbl, defType:nodeDeviceType(n), hasNodeDev:!!n.deviceId};
  const setMode=m=>{
    document.getElementById('fb-simple').style.display=(m==='calc')?'none':'';
    document.getElementById('fb-calc').style.display=(m==='calc')?'':'none';
    document.getElementById('fb-box').classList.toggle('fb-wide',m==='calc');
    if(m==='calc'){
      if(!_fbCalc)_fbCalc=_fbCalcInit(f.bind);
      _fbCalcRender(calcOpt);
    }else updateGate();
  };
  document.querySelectorAll('input[name="fb-mode"]').forEach(r=>{r.onchange=e=>setMode(e.target.value);});
  // 解析当前 bind 的初值
  let curLoc='',curField='';
  if(!isCalc0&&b.field){const p=String(b.field).split('.');curField=p.pop();curLoc=p.join('.');}
  document.getElementById('fb-dev').onchange=()=>fillLoc('','');
  document.getElementById('fb-loc').onchange=()=>{fillField('');};
  fillLoc(curLoc,curField);
  if(isCalc0)setMode('calc');
}
function _fbMode(){const r=document.querySelector('input[name="fb-mode"]:checked');return r?r.value:'simple';}
function closeFieldBind(){const ov=document.getElementById('fb-overlay');if(ov)ov.remove();_fbCalc=null;_fbCalcOpt=null;}
function clearFieldBind(i){const n=nodes.find(x=>x.id===selNode);if(!n)return;const f=(n.data||[])[i];if(f){snapshot();delete f.bind;delete f.decimals;snapshot();}closeFieldBind();renderDFs(n);}
function confirmFieldBind(i){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;const f=(n.data||[])[i];if(!f)return;
  if(_fbMode()==='calc'){   // 计算/比较模式：校验操作数并固化 bind={calc:{operands,operators}}
    const r=_fbCalcCollect();
    if(r.err){flashHint(r.err);_fbCalcSum();return;}
    const hasCmp=(r.calc.operators||[]).some(op=>CALC_CMP_OPS.includes(op));
    snapshot();f.bind={calc:r.calc};delete f.decimals;snapshot();   // 计算绑定的小数位在 calc.decimals，字段级的清掉
    closeFieldBind();renderDFs(n);
    flashHint('已保存计算绑定：后台推送各操作数原始值，画布/前端按公式实时计算'+(hasCmp?'（比较结果为 1/0，可在 📖 里配值字典转文案）':''));
    return;
  }
  const devSel=document.getElementById('fb-dev'),loc=document.getElementById('fb-loc').value,field=document.getElementById('fb-field').value;
  if(!devSel.value&&!n.deviceId){flashHint('请先确定设备实例：为本节点选「设备实例」或在弹窗里选具体来源设备');return;}  // 无实例不允许保存
  if(!loc||!field){flashHint('请选择分类与字段');return;}
  snapshot();
  const o=devSel.selectedOptions[0],did=devSel.value,dt=o&&o.getAttribute('data-dt');
  const bind={field:loc+'.'+field};
  if(did){ bind.deviceId=did; if(dt)bind.deviceType=dt; }   // 指定了具体设备 → 跨设备/显式来源
  f.bind=bind;
  const dpSel=document.getElementById('fb-dp');
  if(dpSel&&dpSel.value!=='')f.decimals=Math.max(0,Math.min(3,(+dpSel.value)|0));else delete f.decimals;   // 显示小数位（原样=不落字段）
  if(!f.key){ f.key=field; f.keyEn=f.keyEn||field; }        // 字段名未填则用后台字段名兜底
  snapshot();closeFieldBind();renderDFs(n);
}
// ───── 全局信号后台绑定弹窗：全局信号无所属节点，必须选具体设备实例 → 分类(location) → 字段(field) ─────
function openGlobalBind(idx){
  const s=(customSignals||[])[idx];if(!s)return;
  const gi=globalSigIssues()[idx]||{};
  if(gi.emptyZh||gi.emptyEn){flashHint(lang==='en'?'Fill both Chinese & English names before binding':'请先填写该信号的中文名和英文名，方可绑定');return;}
  if(gi.dupZh||gi.dupEn){flashHint(lang==='en'?'Signal name duplicated — make it unique before binding':'该信号名重复（中/英文名需全局唯一），请先修正再绑定');return;}
  closeFieldBind();
  const b=s.bind||{};
  const isCalc0=bindIsCalc(b);
  const ov=document.createElement('div');ov.id='fb-overlay';ov.onclick=e=>{if(e.target===ov)closeFieldBind();};
  const devOpts=['<option value="">请选择设备实例</option>']
    .concat(DEVICE_LIST.map(d=>{const sel=(!isCalc0&&b.deviceId===d.deviceId)?' selected':'';return '<option value="'+tplEsc(d.deviceId)+'" data-dt="'+tplEsc(d.deviceType)+'"'+sel+'>'+tplEsc(deviceTypeLabel(d.deviceType)+' · '+d.deviceName+(d.projectName?(' · '+d.projectName):''))+'</option>';}));
  ov.innerHTML='<div id="fb-box"'+(isCalc0?' class="fb-wide"':'')+'><button class="dlg-close" onclick="closeFieldBind()" title="关闭" aria-label="关闭">✕</button><div id="fb-title">绑定后台字段（全局信号）：'+tplEsc(sigDisplayName(s)||('信号'+(idx+1)))+'</div>'+
    '<div class="fb-mode"><label><input type="radio" name="fb-mode" value="simple"'+(isCalc0?'':' checked')+'> 单字段</label>'+
    '<label><input type="radio" name="fb-mode" value="calc"'+(isCalc0?' checked':'')+'> 计算/比较（多字段与常量）</label></div>'+
    '<div id="fb-simple">'+
    '<label class="fb-l">来源设备</label><select id="fb-dev">'+devOpts.join('')+'</select>'+
    '<label class="fb-l">分类(location)</label><select id="fb-loc"></select>'+
    '<label class="fb-l">字段(field)</label><select id="fb-field"></select>'+
    '</div>'+
    _fbCalcBlockHTML()+
    '<div id="fb-acts"><button class="tb" onclick="clearGlobalBind('+idx+')">清除绑定</button><span style="flex:1"></span>'+
    '<button class="tb" onclick="closeFieldBind()">取消</button><button class="tb grn" id="fb-confirm" onclick="confirmGlobalBind('+idx+')">确定</button></div>'+
    '<div class="phint" id="fb-hint" style="margin-top:6px"></div></div>';
  document.body.appendChild(ov);
  const effType=()=>{const o=document.getElementById('fb-dev').selectedOptions[0];return (o&&o.getAttribute('data-dt'))||'';};
  const resolvable=()=>!!document.getElementById('fb-dev').value;
  const fillField=(curField)=>{const dt=effType();const loc=document.getElementById('fb-loc').value;const fields=dictFields(dt,loc);
    document.getElementById('fb-field').innerHTML=fields.length?fields.map(x=>'<option'+(x===curField?' selected':'')+'>'+tplEsc(x)+'</option>').join(''):'<option value="">无字段</option>';};
  const updateGate=()=>{if(_fbMode()==='calc')return;
    const ok=resolvable();['fb-loc','fb-field'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!ok;});
    const cb=document.getElementById('fb-confirm');if(cb){cb.disabled=!ok;cb.style.opacity=ok?'':'.45';cb.style.cursor=ok?'':'not-allowed';}
    const h=document.getElementById('fb-hint');if(!ok){h.textContent='⚠ 请选择具体设备实例（全局信号无所属节点，必须指定来源设备）。';h.style.color='#e0a020';}
    else{const dt=effType();h.textContent='字典：'+(dt?deviceTypeLabel(dt):'—')+'（'+dictLocations(dt).length+' 个分类）';h.style.color='';}};
  const fillLoc=(curLoc,curField)=>{const dt=effType();const locs=dictLocations(dt);const loc=document.getElementById('fb-loc');
    loc.innerHTML=locs.length?locs.map(l=>'<option'+(l===curLoc?' selected':'')+'>'+tplEsc(l)+'</option>').join(''):'<option value="">该类型无字典</option>';
    fillField(curField);updateGate();};
  // 模式切换：全局信号无所属节点 → 操作数必须显式选设备（followLbl=null、hasNodeDev=false）
  const calcOpt={followLbl:null, defType:'', hasNodeDev:false};
  const setMode=m=>{
    document.getElementById('fb-simple').style.display=(m==='calc')?'none':'';
    document.getElementById('fb-calc').style.display=(m==='calc')?'':'none';
    document.getElementById('fb-box').classList.toggle('fb-wide',m==='calc');
    if(m==='calc'){
      if(!_fbCalc)_fbCalc=_fbCalcInit(s.bind);
      _fbCalcRender(calcOpt);
    }else updateGate();
  };
  document.querySelectorAll('input[name="fb-mode"]').forEach(r=>{r.onchange=e=>setMode(e.target.value);});
  let curLoc='',curField='';if(!isCalc0&&b.field){const p=String(b.field).split('.');curField=p.pop();curLoc=p.join('.');}
  document.getElementById('fb-dev').onchange=()=>fillLoc('','');
  document.getElementById('fb-loc').onchange=()=>fillField('');
  fillLoc(curLoc,curField);
  if(isCalc0)setMode('calc');
}
function clearGlobalBind(idx){const s=(customSignals||[])[idx];if(s)delete s.bind;closeFieldBind();renderCustomSignals();invalidateRouting();}
function confirmGlobalBind(idx){
  const s=(customSignals||[])[idx];if(!s)return;
  if(_fbMode()==='calc'){   // 计算/比较模式（全局信号：操作数必须显式指定设备）
    const r=_fbCalcCollect();
    if(r.err){flashHint(r.err);_fbCalcSum();return;}
    const hasCmp=(r.calc.operators||[]).some(op=>CALC_CMP_OPS.includes(op));
    s.bind={calc:r.calc};
    closeFieldBind();renderCustomSignals();invalidateRouting();
    flashHint('已保存计算绑定：后台推送各操作数原始值，画布/前端按公式实时计算'+(hasCmp?'（比较结果为 1/0，可在 📖 里配值字典转文案）':''));
    return;
  }
  const devSel=document.getElementById('fb-dev'),loc=document.getElementById('fb-loc').value,field=document.getElementById('fb-field').value;
  if(!devSel.value){flashHint('请选择具体设备实例（全局信号必须指定来源设备）');return;}
  if(!loc||!field){flashHint('请选择分类与字段');return;}
  const o=devSel.selectedOptions[0],did=devSel.value,dt=o&&o.getAttribute('data-dt');
  s.bind={field:loc+'.'+field, deviceId:did, deviceType:dt||''};
  closeFieldBind();renderCustomSignals();invalidateRouting();
}
// ───── 值字典选择（数据字段 / 全局信号共用）：自动匹配(默认) / 不转义 / 强制指定某字典 ─────
// 存储语义：f.dict 不存在=自动（bind 命中 applyTo 即转义）；''=强制不转义；'xxx'=强制用该字典。
function vdDisplayName(type){
  const d=findValueDict(type);
  if(!d)return type+'（未找到，按不转义处理）';
  return (lang==='en'?(d.nameEn||d.name):(d.name||d.nameEn))||d.type;
}
// 通用选择弹窗：f=字段/信号对象；deviceType=自动匹配兜底类型；title 弹窗标题；onDone 应用后回调
function openValueDictPicker(f,deviceType,title,onDone){
  closeFieldBind();
  const dicts=effectiveValueDicts();
  const cur=(f.dict!==undefined&&f.dict!==null)?(f.dict===''?'@none':f.dict):'@auto';
  const auto=resolveValueDict({bind:f.bind},deviceType);   // 忽略显式指定，看自动匹配会命中谁
  const autoLbl='自动匹配（默认）'+(auto?('：当前命中「'+vdDisplayName(auto.type)+'」')
    :(bindIsCalc(f.bind)?'：计算绑定无单一认领字段，不参与自动匹配——需转义请在下方强制指定字典'
      :'：当前未命中（未绑定后台字段或无字典认领）'));
  const opts=['<option value="@auto"'+(cur==='@auto'?' selected':'')+'>'+tplEsc(autoLbl)+'</option>',
    '<option value="@none"'+(cur==='@none'?' selected':'')+'>不转义（原样显示 code）</option>']
    .concat(dicts.map(d=>'<option value="'+tplEsc(d.type)+'"'+(cur===d.type?' selected':'')+'>强制：'+
      tplEsc((d.name||d.type)+(d.nameEn?(' / '+d.nameEn):'')+' ('+d.type+')')+'</option>'));
  const ov=document.createElement('div');ov.id='fb-overlay';ov.onclick=e=>{if(e.target===ov)closeFieldBind();};
  ov.innerHTML='<div id="fb-box"><button class="dlg-close" onclick="closeFieldBind()" title="关闭" aria-label="关闭">✕</button>'+
    '<div id="fb-title">'+tplEsc(title)+'</div>'+
    '<label class="fb-l">值字典（code 码 → 中/英显示文案）</label><select id="vd-pick">'+opts.join('')+'</select>'+
    '<div id="fb-acts" style="margin-top:12px"><span style="flex:1"></span>'+
    '<button class="tb" onclick="closeFieldBind()">取消</button><button class="tb grn" id="vd-pick-ok">确定</button></div>'+
    '<div class="phint" style="margin-top:6px">显示语言随编辑器中英文切换自动变化；查不到的 code 回退显示原始值。字典本身在菜单栏「📖 值字典」中维护。</div></div>';
  document.body.appendChild(ov);
  document.getElementById('vd-pick-ok').onclick=()=>{
    const v=document.getElementById('vd-pick').value;
    snapshot();
    if(v==='@auto')delete f.dict; else if(v==='@none')f.dict=''; else f.dict=v;
    snapshot();closeFieldBind();
    if(onDone)onDone();
  };
}
function openFieldDict(i){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const f=(n.data||[])[i];if(!f)return;
  openValueDictPicker(f,nodeDeviceType(n),'值字典：'+(f.key||('字段'+(i+1))),()=>renderDFs(n));
}
function clearFieldDict(i){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;const f=(n.data||[])[i];
  if(f&&f.dict!==undefined){snapshot();delete f.dict;snapshot();}
  renderDFs(n);
}
function openGlobalDict(idx){
  const s=(customSignals||[])[idx];if(!s)return;
  openValueDictPicker(s,'','值字典（全局信号）：'+(sigDisplayName(s)||('信号'+(idx+1))),()=>renderCustomSignals());
}
// ───── 标签设置（属性面板「🏷 标签」分组，非弹框）：文字/样式 + 绑定后台字段 + 值字典 + 当前值溯源 ─────
// · 绑定：设备类型必选（驱动分类/字段级联），设备实例可选——未指定实例仍可绑定
//   （导出校验仅黄色提醒，与数据字段「未指定实例」同级），由后台按类型自行对应设备。
// · 标签值 = 绑定字段的实时值；命中值字典（applyTo 自动匹配）则转义显示——非强制，查不到回退原始值。
//   「当前值」溯源行（elcValTrace）实时展示：原始值 → 转义结果 · 来源 · 经过哪个字典，杜绝"不知道显示的值哪来的"。
// · 绑定成立自动生成连线 id（信号键=连线id.标签英文名，进 dataBindings 供后台推送）。
function refreshEdgeLblUI(e){
  const $=id=>document.getElementById(id);
  if(!$('elc-zh'))return;
  $('elc-zh').value=e.lbl||'';$('elc-en').value=e.lblEn||'';
  $('elc-show').value=e.lblShow||'value';$('elc-dir').value=e.lblDir||'auto';
  pairSet('ep-lbl-rot',e.lblRot||0);pairSet('ep-lbl-scale',Math.round((e.lblScale||1)*100));
  $('elc-visible').checked=!e.hideLabel;
  const b=e.lblBind||{};
  let curLoc='',curFld='';if(b.field){const p=String(b.field).split('.');curFld=p.pop();curLoc=p.join('.');}
  $('elc-dt').innerHTML='<option value="">未指定</option>'+DEVICE_TYPES.map(t=>'<option value="'+tplEsc(t.value)+'"'+(t.value===(b.deviceType||'')?' selected':'')+'>'+tplEsc(t.label)+'</option>').join('');
  elcFillDev(b.deviceType||'',b.deviceId||'');
  elcFillLoc(b.deviceType||'',curLoc,curFld);
  const ev=document.getElementById('elc-val');if(ev)ev.value=(e.lblVal==null?'':String(e.lblVal));
  elcBHint();elcDictFill();elcValTrace();
}
function elcFillDev(dt,cur){
  const el=document.getElementById('elc-dev');if(!el)return;
  el.innerHTML='<option value="">不指定实例（后台按类型对应）</option>'+devicesOfType(dt,'').map(d=>'<option value="'+tplEsc(d.deviceId)+'"'+(d.deviceId===cur?' selected':'')+'>'+tplEsc(d.deviceName+(d.projectName?(' · '+d.projectName):''))+'</option>').join('');
}
function elcFillFld(dt,loc,cur){
  const el=document.getElementById('elc-fld');if(!el)return;
  const fs=dictFields(dt,loc);
  el.innerHTML=fs.length?fs.map(x=>'<option'+(x===cur?' selected':'')+'>'+tplEsc(x)+'</option>').join(''):'<option value="">无字段</option>';
}
function elcFillLoc(dt,cl,cf){
  const el=document.getElementById('elc-loc');if(!el)return;
  const ls=dictLocations(dt);
  el.innerHTML=ls.length?ls.map(l=>'<option'+(l===cl?' selected':'')+'>'+tplEsc(l)+'</option>').join(''):'<option value="">该类型无字典</option>';
  elcFillFld(dt,el.value,cf);
  const off=!dt;['elc-dev','elc-loc','elc-fld'].forEach(id=>{const x=document.getElementById(id);if(x)x.disabled=off;});
}
function elcDtChanged(){const dt=document.getElementById('elc-dt').value;elcFillDev(dt,'');elcFillLoc(dt,'','');}
function elcLocChanged(){elcFillFld(document.getElementById('elc-dt').value,document.getElementById('elc-loc').value,'');}
// 文字/样式类属性（中文文字/展示内容/走向/旋转/缩放/显示开关）——照 applyEP 模式，每次变更即应用+入历史
function applyELbl(){
  const e=selEdge;if(!e)return;
  const $=id=>document.getElementById(id);
  e.lbl=$('elc-zh').value;
  const sh=$('elc-show').value;if(sh==='value')delete e.lblShow;else e.lblShow=sh;
  const dr=$('elc-dir').value;if(dr==='auto')delete e.lblDir;else e.lblDir=dr;
  const rot=((Math.round(pairVal('ep-lbl-rot',0))%360)+360)%360;if(rot)e.lblRot=rot;else delete e.lblRot;
  const sc=Math.max(5,Math.min(800,Math.round(pairVal('ep-lbl-scale',100))))/100;if(sc!==1)e.lblScale=sc;else delete e.lblScale;
  e.hideLabel=!$('elc-visible').checked;
  snapshot();
}
// 静态默认值（labelValue）：无实时数据时标签显示它；直接填 code 即可模拟后台值看展示效果（注入/实时信号会覆盖）
function applyELblVal(inp){
  const e=selEdge;if(!e)return;
  const v=inp.value;
  if(v==='')delete e.lblVal;else e.lblVal=v;
  elcValTrace();snapshot();
}
// 标签英文名（信号键段）变更 → 同步迁移注入行到新键，避免旧键的注入值残留导致标签取不到值
function elcMigrateInj(e,oldKey,newKey){
  if(!e||!e.id||!oldKey||oldKey===newKey)return;
  if(newKey)injRows.forEach(r=>{if(r.node===e.id&&r.field===oldKey)r.field=newKey;});
  else injRows=injRows.filter(r=>!(r.node===e.id&&r.field===oldKey));
  syncInjections();renderInjRows();
}
// 英文名单独处理：已绑定时不可清空（作信号键）；变更后信号键随之变化，注入行一并迁移
function applyELblEn(inp){
  const e=selEdge;if(!e)return;
  const v=inp.value.trim();
  if(e.lblBind&&e.lblBind.field&&!v){flashHint('已绑定后台字段，English 不能为空（作信号键）');inp.value=e.lblEn||'';return;}
  const oldKey=edgeLabelSigKey(e);
  if(v)e.lblEn=v;else delete e.lblEn;
  elcMigrateInj(e,oldKey,v);
  elcBHint();elcValTrace();snapshot();
}
function elcApplyBind(){
  const e=selEdge;if(!e)return;
  const $=id=>document.getElementById(id);
  const dt=$('elc-dt').value,loc=$('elc-loc').value,fld=$('elc-fld').value,did=$('elc-dev').value;
  if(!dt){flashHint('请选择设备类型（决定可选的分类/字段）');return;}
  if(!loc||!fld){flashHint('请选择分类与字段');return;}
  const en=$('elc-en').value.trim();
  if(!en){flashHint('请先填写标签「English」（作端到端信号键，如 Power / ChargeState）');$('elc-en').focus();return;}
  const _oldKey=edgeLabelSigKey(e);
  e.lblEn=en;
  if(!e.id)e.id=genId('edge');                     // 绑定成立 → 需要稳定信号键前缀
  elcMigrateInj(e,_oldKey,en);
  e.lblBind={field:loc+'.'+fld, deviceType:dt, ...(did?{deviceId:did}:{})};
  elcBHint();elcDictFill();elcValTrace();snapshot();
  flashHint('已绑定：标签值将随实时数据更新'+(resolveValueDict({bind:e.lblBind},'')?'（命中值字典，自动转义显示）':''));
}
function elcClearBind(){
  const e=selEdge;if(!e)return;
  if(e.lblBind){delete e.lblBind;delete e.lblVal;snapshot();}
  elcBHint();elcDictFill();elcValTrace();
}
// 当前绑定摘要 + 信号键
function elcBHint(){
  const e=selEdge,h=document.getElementById('elc-bhint');if(!e||!h)return;
  if(e.lblBind&&e.lblBind.field){
    const dt=e.lblBind.deviceType||'',did=e.lblBind.deviceId||'';
    h.textContent='↳ 已绑定：'+(dt?deviceTypeLabel(dt)+'·':'')+(did?deviceNameOf(did):'（未指定实例）')+' / '+e.lblBind.field
      +(e.id&&e.lblEn?('　信号键：'+e.id+'.'+e.lblEn):'');
    h.style.color='#2ecc71';
  }else{h.textContent='未绑定：标签仅显示静态文字。';h.style.color='';}
}
// 值字典下拉（自动匹配为默认；可强制指定/强制不转义）
function elcDictFill(){
  const e=selEdge,el=document.getElementById('elc-dict');if(!e||!el)return;
  const dicts=effectiveValueDicts();
  const cur=(e.lblDict!==undefined&&e.lblDict!==null)?(e.lblDict===''?'@none':e.lblDict):'@auto';
  const auto=resolveValueDict({bind:e.lblBind},'');
  const autoLbl='自动匹配（默认）'+(auto?('：当前命中「'+vdDisplayName(auto.type)+'」'):'：当前未命中（未绑定或无字典认领该字段）');
  el.innerHTML='<option value="@auto"'+(cur==='@auto'?' selected':'')+'>'+tplEsc(autoLbl)+'</option>'+
    '<option value="@none"'+(cur==='@none'?' selected':'')+'>不转义（原样显示 code）</option>'+
    dicts.map(d=>'<option value="'+tplEsc(d.type)+'"'+(cur===d.type?' selected':'')+'>强制：'+tplEsc((d.name||d.type)+' ('+d.type+')')+'</option>').join('');
}
function elcDictChanged(){
  const e=selEdge;if(!e)return;
  const v=document.getElementById('elc-dict').value;
  if(v==='@auto')delete e.lblDict;else if(v==='@none')e.lblDict='';else e.lblDict=v;
  elcValTrace();snapshot();
}
// ★ 当前值溯源：画布上显示的值从哪来、有没有被字典转义——「原始值 → 转义结果 · 来源 · 字典」
function elcValTrace(){
  const e=selEdge,el=document.getElementById('elc-valtrace');if(!e||!el)return;
  if(!(e.lblBind&&e.lblBind.field)){el.textContent='';return;}
  const sig=edgeLabelSig(e);
  let v=e.lblVal,src='静态默认值（上方输入框，导入/历史测试留存）';
  if(sig&&Object.prototype.hasOwnProperty.call(signalValues,sig)&&signalValues[sig]!==''&&signalValues[sig]!=null){v=signalValues[sig];src='实时/注入信号 '+sig;}
  if(v==null||v===''){el.textContent='当前值：（空）— 等待后台推送'+(sig?('信号 '+sig):'（需先填 English 生成信号键）');el.style.color='';return;}
  const f={bind:e.lblBind,...(e.lblDict!==undefined&&e.lblDict!==null?{dict:e.lblDict}:{})};
  const d=resolveValueDict(f,'');
  const tv=translateFieldValue(f,v,'');
  if(d&&String(tv)!==String(v))el.textContent='当前值：'+v+' →「'+tv+'」　来源：'+src+'　· 经值字典「'+vdDisplayName(d.type)+'」转义';
  else if(d)el.textContent='当前值：「'+v+'」　来源：'+src+'　· 命中字典「'+vdDisplayName(d.type)+'」但未收录此 code，原样显示';
  else el.textContent='当前值：「'+v+'」　来源：'+src+'　· 未命中值字典，原样显示';
  el.style.color='#4dd0ff';
}
function resetRotation(){const n=nodes.find(x=>x.id===selNode);if(!n)return;snapshot();n.rotation=0;pairSet('p-rot',0);snapshot();}
function resetFieldPos(){const n=nodes.find(x=>x.id===selNode);if(!n||!n.data)return;snapshot();n.data.forEach(f=>{f.ox=0;f.oy=0;});snapshot();}
// 智能环绕布局：把字段卡片分配到设备四周空闲方向，避开连线占用的边
function connDirsOf(n){
  // 返回该节点各连线离开的方向角度集合
  const dirs=[];
  edges.forEach(e=>{
    let other=null;
    if(e.from===n.id)other=nodes.find(x=>x.id===e.to);
    else if(e.to===n.id)other=nodes.find(x=>x.id===e.from);
    if(other){const a=Math.atan2(other.y-n.y,other.x-n.x);dirs.push(a);}
  });
  return dirs;
}
function smartLayoutFields(n){
  if(!n.data||n.data.length===0)return;
  const s=nsz(n);
  const cfs=chipBaseFS(n)*0.92/zoom;
  const connDirs=connDirsOf(n);
  const step=(chipBaseFS(n)+18)/zoom; const chipW=130/zoom, chipH=step; // 估算卡片尺寸（屏幕固定）
  // 8 个候选方向（右、右下、下、左下、左、左上、上、右上）
  const slots=[0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, -3*Math.PI/4, -Math.PI/2, -Math.PI/4];
  const radius=s*0.55+cfs*1.6;
  // 收集障碍：其它节点盒 + 其它节点已放置的字段卡片
  const obstacles=[];
  nodes.forEach(o=>{ if(o.id===n.id)return; const b=nodeBox(o); obstacles.push({l:b.left-10,r:b.right+10,t:b.top-10,b:b.bottom+10});
    if(o.data) o.data.forEach((f,i)=>{ const os=nsz(o); const bx=o.x+os*0.5+12/zoom+(f.ox||0)/zoom, by=o.y-os*0.40+i*((chipBaseFS(o)+18)/zoom)+(f.oy||0)/zoom; obstacles.push({l:bx-6,r:bx+chipW+6,t:by-6,b:by+chipH+6}); });
  });
  // 画布中心，用于"朝向开阔区"的偏好
  const cw=canvas.width/zoom, ch=canvas.height/zoom;
  const rectHit=(x,y,w,h)=>{ for(const o of obstacles){ if(x< o.r&&x+w>o.l&&y<o.b&&y+h>o.t)return true; } return false; };
  // 给每个方向打分
  const scored=slots.map(ang=>{
    // 该方向放第一张卡片的左上角
    const cx=n.x+Math.cos(ang)*radius, cy=(n.y-s*0.22)+Math.sin(ang)*radius;
    const leftSide=Math.cos(ang)<-0.3;
    const x=cx-(leftSide?chipW:0), y=cy-chipH/2;
    // 1) 离连线越远越好
    let minDiff=Math.PI; connDirs.forEach(cd=>{let d=Math.abs(ang-cd);if(d>Math.PI)d=2*Math.PI-d;minDiff=Math.min(minDiff,d);});
    // 2) 不与障碍碰撞
    const collide=rectHit(x,y,chipW,chipH)?-3:0;
    // 3) 偏好水平方向（卡片横向）
    const horizBonus=(Math.abs(Math.cos(ang))>0.7)?0.3:0;
    // 4) 偏好画布内、远离边缘
    let edgePenalty=0;
    if(x<10||x+chipW>cw-10) edgePenalty-=0.6;
    if(y<10||y+chipH>ch-10) edgePenalty-=0.6;
    // 5) 偏好朝向画布开阔的一侧（远离最近的节点群——用朝画布中心反方向的弱偏好）
    return {ang, leftSide, score:minDiff+horizBonus+collide+edgePenalty};
  }).sort((a,b)=>b.score-a.score);
  // 依次摆放：同一方向多条字段沿垂直堆叠，超过容量换下一个方向
  const perSlot=Math.ceil(n.data.length/Math.min(2,n.data.length));
  let slotIdx=0,inSlot=0;
  n.data.forEach((f,i)=>{
    if(inSlot>=perSlot && slotIdx<scored.length-1){slotIdx++;inSlot=0;}
    const sl=scored[Math.min(slotIdx,scored.length-1)];
    const ang=sl.ang;
    const cx=n.x+Math.cos(ang)*radius;
    const cy=(n.y-s*0.22)+Math.sin(ang)*radius + inSlot*step;
    const baseX=n.x+s*0.5+14/zoom, baseY=n.y-s*0.40+i*step;
    f.ox=((cx - (sl.leftSide?chipW:0)) - baseX)*zoom;   // 存屏幕像素
    f.oy=(cy - baseY)*zoom;
    inSlot++;
  });
}
function smartLayoutSelected(){const n=nodes.find(x=>x.id===selNode);if(!n)return;snapshot();smartLayoutFields(n);snapshot();}
function smartLayoutAll(){snapshot();nodes.forEach(smartLayoutFields);snapshot();}
// ───── 多选对齐 ─────
function updateAlignBar(){
  const bar=document.getElementById('alignbar');
  const nc=selSet.size, cc=selChips.size;
  if(nc>=2){bar.classList.add('show');document.getElementById('align-count').textContent=lang==='en'?('Align '+nc+' nodes'+(cc>0?' (+'+cc+' fields, nodes first)':'')):('对齐 '+nc+' 个元素'+(cc>0?'（含'+cc+'字段，以元素为准）':''));}
  else if(cc>=2){bar.classList.add('show');document.getElementById('align-count').textContent=lang==='en'?('Align '+cc+' fields'):('对齐 '+cc+' 个字段');}
  else bar.classList.remove('show');
  updGfdSelBtn();   // 外观面板④「仅选中节点」按钮计数随选择变化实时刷新
}
function clearMultiSel(){selSet.clear();selChips.clear();updateAlignBar();}
function selectedNodes(){return [...selSet].map(id=>nodes.find(n=>n.id===id)).filter(Boolean);}
// 取选中 chip 的绝对位置列表（含其所属字段引用）
function selectedChipRefs(){
  return [...selChips].map(k=>{const a=k.split('#');const n=nodes.find(z=>z.id===a[0]);if(!n||!n.data[a[1]])return null;
    const pos=fieldChipPos(n,parseInt(a[1]));const b=n.data[a[1]]._chipBox;
    // x/y 取 chip 盒左上角(与 w/h 同口径)：优先用已绘制的 _chipBox，未绘制时用 fieldChipPos 兜底
    // 兜底 y 用「盒顶」= 基线(pos.y) - cfs，与 _chipBox.y(=pos.y-cfs) 同口径，避免竖向对齐偏移
    return {n,f:n.data[a[1]],fi:parseInt(a[1]),x:(b?b.x:pos.x),y:(b?b.y:(pos.y-(pos.cfs||0))),w:b?b.w:60,h:b?b.h:16};
  }).filter(Boolean);
}
function alignChips(mode){
  const cs=selectedChipRefs();if(cs.length<2)return;
  snapshot();
  // c.x/c.y = chip 左/上边缘(世界坐标)，c.w/c.h = chip 宽高 → 按「边缘」对齐(与元素对齐口径一致)，宽度不同也能真正左/右/居中对齐
  const minL=Math.min(...cs.map(c=>c.x)), maxR=Math.max(...cs.map(c=>c.x+c.w));
  const minT=Math.min(...cs.map(c=>c.y)), maxB=Math.max(...cs.map(c=>c.y+c.h));
  const cX=(minL+maxR)/2, cY=(minT+maxB)/2;
  // ox/oy 以「屏幕像素」存储（fieldChipPos 用 ox/zoom 换算到世界坐标）；这里的 nx/c.x 是世界坐标，
  // 故位移增量需 *zoom 转成屏幕像素，否则非 100% 缩放下对齐会错位（与拖拽存储口径一致）。
  const setX=(c,nx)=>{c.f.ox=(c.f.ox||0)+(nx-c.x)*zoom;};
  const setY=(c,ny)=>{c.f.oy=(c.f.oy||0)+(ny-c.y)*zoom;};
  if(mode==='left')cs.forEach(c=>setX(c,minL));            // 左边缘对齐
  else if(mode==='right')cs.forEach(c=>setX(c,maxR-c.w));   // 右边缘对齐
  else if(mode==='hcenter')cs.forEach(c=>setX(c,cX-c.w/2)); // 水平居中
  else if(mode==='top')cs.forEach(c=>setY(c,minT));         // 顶边缘对齐
  else if(mode==='bottom')cs.forEach(c=>setY(c,maxB-c.h));  // 底边缘对齐
  else if(mode==='vcenter')cs.forEach(c=>setY(c,cY-c.h/2)); // 垂直居中
  else if(mode==='hdist'){const s=[...cs].sort((a,b)=>a.x-b.x);const a0=s[0].x,a1=s[s.length-1].x;const span=(a1-a0)>1?(a1-a0):(s.length-1)*(parseInt(document.getElementById('align-gap').value)||80);const step=span/(s.length-1);s.forEach((c,i)=>setX(c,a0+step*i));}
  else if(mode==='vdist'){const s=[...cs].sort((a,b)=>a.y-b.y);const a0=s[0].y,a1=s[s.length-1].y;const span=(a1-a0)>1?(a1-a0):(s.length-1)*(parseInt(document.getElementById('align-gap').value)||30);const step=span/(s.length-1);s.forEach((c,i)=>setY(c,a0+step*i));}
  else if(mode==='hgap'){const gap=parseInt(document.getElementById('align-gap').value)||80;const s=[...cs].sort((a,b)=>a.x-b.x);let cur=s[0].x;s.forEach(c=>{setX(c,cur);cur+=c.w+gap;});}   // 边到边固定间距(累积宽度)
  else if(mode==='vgap'){const gap=parseInt(document.getElementById('align-gap').value)||30;const s=[...cs].sort((a,b)=>a.y-b.y);let cur=s[0].y;s.forEach(c=>{setY(c,cur);cur+=c.h+gap;});}   // 边到边固定间距(累积高度)
  snapshot();
}
function alignSel(mode){
  // 谁多对齐谁：默认优先对齐设备（框选设备是常见意图）。
  // 仅当几乎没框到设备（设备<2）而字段≥2 时，才对齐数据字段。
  const nodeCount=selSet.size, chipCount=selChips.size;
  if(nodeCount<2 && chipCount>=2){ alignChips(mode); return; }
  const ns=selectedNodes();if(ns.length<2)return;
  snapshot();
  // 元素半宽/半高（考虑实际尺寸），对齐按边缘计算
  const hw=n=>(usesTextBox(n.type)&&n._textBox)?n._textBox.w/2:nsz(n)*0.40;
  const hh=n=>(usesTextBox(n.type)&&n._textBox)?n._textBox.h/2:nsz(n)*0.40;
  const left=n=>n.x-hw(n), right=n=>n.x+hw(n), top=n=>n.y-hh(n), bot=n=>n.y+hh(n);
  const xs=ns.map(n=>n.x), ys=ns.map(n=>n.y);
  const minL=Math.min(...ns.map(left)), maxR=Math.max(...ns.map(right));
  const minT=Math.min(...ns.map(top)), maxB=Math.max(...ns.map(bot));
  const cX=(Math.min(...xs)+Math.max(...xs))/2, cY=(Math.min(...ys)+Math.max(...ys))/2;
  if(mode==='left')ns.forEach(n=>n.x=minL+hw(n));        // 左边缘对齐
  else if(mode==='right')ns.forEach(n=>n.x=maxR-hw(n));   // 右边缘对齐
  else if(mode==='hcenter')ns.forEach(n=>n.x=cX);
  else if(mode==='top')ns.forEach(n=>n.y=minT+hh(n));     // 顶边缘对齐
  else if(mode==='bottom')ns.forEach(n=>n.y=maxB-hh(n));  // 底边缘对齐
  else if(mode==='vcenter')ns.forEach(n=>n.y=cY);
  else if(mode==='hdist'){
    const minX=Math.min(...xs),maxX=Math.max(...xs);
    const sorted=[...ns].sort((a,b)=>a.x-b.x);
    const span=maxX-minX>1?(maxX-minX):(sorted.length-1)*(parseInt(document.getElementById('align-gap').value)||120);
    const step=span/(sorted.length-1);sorted.forEach((n,i)=>n.x=minX+step*i);
  }
  else if(mode==='vdist'){
    const minY=Math.min(...ys),maxY=Math.max(...ys);
    const sorted=[...ns].sort((a,b)=>a.y-b.y);
    const span=maxY-minY>1?(maxY-minY):(sorted.length-1)*(parseInt(document.getElementById('align-gap').value)||120);
    const step=span/(sorted.length-1);sorted.forEach((n,i)=>n.y=minY+step*i);
  }
  else if(mode==='hgap'){
    // 边到边间距：gap 为相邻元素之间的空白
    const gap=parseInt(document.getElementById('align-gap').value)||120;
    const sorted=[...ns].sort((a,b)=>a.x-b.x);
    const halfW=n=>(usesTextBox(n.type)&&n._textBox)?n._textBox.w/2:nsz(n)*0.40;
    let cursor=sorted[0].x;
    sorted.forEach((n,i)=>{if(i===0){cursor=n.x;return;}cursor=cursor+halfW(sorted[i-1])+gap+halfW(n);n.x=cursor;});
  }
  else if(mode==='vgap'){
    const gap=parseInt(document.getElementById('align-gap').value)||120;
    const sorted=[...ns].sort((a,b)=>a.y-b.y);
    const halfH=n=>(usesTextBox(n.type)&&n._textBox)?n._textBox.h/2:nsz(n)*0.40;
    let cursor=sorted[0].y;
    sorted.forEach((n,i)=>{if(i===0){cursor=n.y;return;}cursor=cursor+halfH(sorted[i-1])+gap+halfH(n);n.y=cursor;});
  }
  else if(mode==='hdistedge'){
    // 水平均匀分布：保持首尾不动，中间元素按边缘间距相等排列
    const sorted=[...ns].sort((a,b)=>a.x-b.x);
    if(sorted.length>=2){
      const totalW=sorted.reduce((s,n)=>s+hw(n)*2,0);
      const span=(sorted[sorted.length-1].x+hw(sorted[sorted.length-1])) - (sorted[0].x-hw(sorted[0]));
      const gap=(span-totalW)/(sorted.length-1);
      let cursor=sorted[0].x-hw(sorted[0]);
      sorted.forEach(n=>{n.x=cursor+hw(n);cursor=cursor+hw(n)*2+gap;});
    }
  }
  else if(mode==='vdistedge'){
    const sorted=[...ns].sort((a,b)=>a.y-b.y);
    if(sorted.length>=2){
      const totalH=sorted.reduce((s,n)=>s+hh(n)*2,0);
      const span=(sorted[sorted.length-1].y+hh(sorted[sorted.length-1])) - (sorted[0].y-hh(sorted[0]));
      const gap=(span-totalH)/(sorted.length-1);
      let cursor=sorted[0].y-hh(sorted[0]);
      sorted.forEach(n=>{n.y=cursor+hh(n);cursor=cursor+hh(n)*2+gap;});
    }
  }
  else if(mode==='row'){
    // 排成一行：垂直居中对齐 + 按边缘间距水平排列
    const gap=parseInt(document.getElementById('align-gap').value)||80;
    const sorted=[...ns].sort((a,b)=>a.x-b.x);
    let cursor=Math.min(...sorted.map(left));
    sorted.forEach(n=>{n.x=cursor+hw(n);n.y=cY;cursor=cursor+hw(n)*2+gap;});
  }
  else if(mode==='col'){
    // 排成一列：水平居中对齐 + 按边缘间距垂直排列
    const gap=parseInt(document.getElementById('align-gap').value)||60;
    const sorted=[...ns].sort((a,b)=>a.y-b.y);
    let cursor=Math.min(...sorted.map(top));
    sorted.forEach(n=>{n.y=cursor+hh(n);n.x=cX;cursor=cursor+hh(n)*2+gap;});
  }
  else if(mode==='matrix'){
    // 矩阵排列：按数量自动定列数，网格状排布
    const gap=parseInt(document.getElementById('align-gap').value)||120;
    const cols=Math.ceil(Math.sqrt(ns.length));
    const startX=Math.min(...ns.map(n=>n.x)), startY=Math.min(...ns.map(n=>n.y));
    const sorted=[...ns];
    sorted.forEach((n,i)=>{
      const r=Math.floor(i/cols), c=i%cols;
      n.x=startX+c*gap; n.y=startY+r*gap;
    });
  }
  else if(mode==='canvasH'){
    // 水平居中于画布：整组中心移到画布水平中心
    const wcx=(-panX+canvas.width/2)/zoom;
    const gcx=(Math.min(...ns.map(left))+Math.max(...ns.map(right)))/2;
    const d=wcx-gcx; ns.forEach(n=>n.x+=d);
  }
  else if(mode==='canvasV'){
    const wcy=(-panY+canvas.height/2)/zoom;
    const gcy=(Math.min(...ns.map(top))+Math.max(...ns.map(bot)))/2;
    const d=wcy-gcy; ns.forEach(n=>n.y+=d);
  }
  invalidateRouting();snapshot();
}
function rmDF(i){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.data.splice(i,1);renderDFs(n);}
function updDF(i,prop,v,el){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.data[i][prop]=v;
  // 中英文名必填且同节点内唯一：即时标红（改一个名字可能影响其它行的重复状态，故整节点重算；仅 toggle class 不重建 DOM，避免丢焦点）
  if(prop==='key'||prop==='keyEn')refreshFieldNameValidity(n);
}
// 按 fieldNameIssues 重刷所有字段行的红框（DOM 顺序与 n.data 一一对应）
function refreshFieldNameValidity(n){
  const iss=fieldNameIssues(n);
  const zhs=document.querySelectorAll('#dfields .df-zh-in'), ens=document.querySelectorAll('#dfields .df-en-in');
  iss.forEach((s,i)=>{
    if(zhs[i])zhs[i].classList.toggle('df-invalid',s.emptyZh||s.dupZh);
    if(ens[i])ens[i].classList.toggle('df-invalid',s.emptyEn||s.dupEn);
  });
}
function updDFVal(i,v){const n=nodes.find(x=>x.id===selNode);if(!n||!n.data[i])return;n.data[i].dv=v.trim();invalidateRouting();}

function toggleEdgeMode(){
  edgeMode=!edgeMode;edgeFrom=null;edgeFromPort=null;
  // 与框选模式互斥
  if(edgeMode&&selectMode){selectMode=false;document.getElementById('btn-select').classList.remove('active');}
  document.getElementById('btn-edge').classList.toggle('active',edgeMode);
  document.getElementById('ehint').style.display=edgeMode?'block':'none';document.getElementById('ebar').classList.toggle('show',edgeMode);canvas.style.cursor=edgeMode?'crosshair':'default';if(edgeMode)document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：点击起始节点…';
}
function toggleMenu(id){const m=document.getElementById(id);const wasOpen=m.classList.contains('open');closeMenus();if(!wasOpen)m.classList.add('open');}
function closeMenus(){document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open'));}
document.addEventListener('click',e=>{if(!e.target.closest('.menu'))closeMenus();});
function toggleSelectMode(){
  selectMode=!selectMode;
  // 与连线模式互斥
  if(selectMode&&edgeMode){edgeMode=false;edgeFrom=null;edgeFromPort=null;document.getElementById('btn-edge').classList.remove('active');document.getElementById('ehint').style.display='none';document.getElementById('ebar').classList.remove('show');}
  document.getElementById('btn-select').classList.toggle('active',selectMode);canvas.style.cursor=selectMode?'crosshair':'default';
}
// 删除当前选择（Del 键 / 多选工具条「删除所选」）：框选多选集合 → 单选节点 → 单选连线 → 框选的字段卡片
function deleteSelected(){
  if(selSet.size>0){
    snapshot();
    const ids=new Set(selSet);
    nodes=nodes.filter(n=>!ids.has(n.id));
    edges=edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));   // 两端任一被删的连线一并删除
    if(selNode&&ids.has(selNode))selNode=null;
    selSet.clear();selChips.clear();
    updateAlignBar();invalidateRouting();snapshot();showPanel('none');
    flashHint('已删除 '+ids.size+' 个元素');
    return;
  }
  if(selNode){snapshot();nodes=nodes.filter(n=>n.id!==selNode);edges=edges.filter(e=>e.from!==selNode&&e.to!==selNode);selNode=null;invalidateRouting();snapshot();showPanel('none');return;}
  if(selEdge){snapshot();edges=edges.filter(e=>e!==selEdge);selEdge=null;invalidateRouting();snapshot();showPanel('none');return;}
  if(selChips.size>0){
    // 框选的是字段卡片：删除这些数据字段（按节点分组、索引倒序 splice 避免错位）
    snapshot();
    const byNode={};
    selChips.forEach(k=>{const a=k.split('#');(byNode[a[0]]=byNode[a[0]]||[]).push(parseInt(a[1]));});
    let cnt=0;
    Object.entries(byNode).forEach(([nid,idxs])=>{
      const n=nodes.find(x=>x.id===nid);if(!n||!n.data)return;
      idxs.sort((a,b)=>b-a).forEach(i=>{if(n.data[i]){n.data.splice(i,1);cnt++;}});
    });
    selChips.clear();updateAlignBar();snapshot();
    const cur=nodes.find(x=>x.id===selNode);if(cur)selectNode(cur.id);   // 面板字段列表同步
    flashHint('已删除 '+cnt+' 个数据字段');
    return;
  }
  showPanel('none');
}
// ───── 复制 / 粘贴（含数据字段整体复制）─────
let clipboard=null;
function cleanNodeForCopy(n){
  // 深拷贝节点，剔除运行时缓存字段（_textBox/_chipBox/_resizeHandle 等）
  const c=JSON.parse(JSON.stringify(n));
  delete c._textBox;delete c._chipBox;delete c._resizeHandle;delete c._rotHandle;delete c._resizeHandles;delete c._tblGeom;delete c._varGap;
  if(c.data)c.data.forEach(f=>{delete f._chipBox;});
  return c;
}
function copySelection(){
  let ids2=[];
  if(selSet.size>0) ids2=[...selSet];
  else if(selNode) ids2=[selNode];
  if(ids2.length===0)return;
  const ns=ids2.map(id=>nodes.find(n=>n.id===id)).filter(Boolean).map(cleanNodeForCopy);
  // 同时复制两端都在选中集合内的连线
  const idset=new Set(ids2);
  const es=edges.filter(e=>idset.has(e.from)&&idset.has(e.to)).map(e=>JSON.parse(JSON.stringify(e)));
  clipboard={nodes:ns,edges:es};
  // 轻提示
  flashHint('已复制 '+ns.length+' 个元素'+(es.length?('（含 '+es.length+' 条连线）'):''));
}
function pasteClipboard(){
  if(!clipboard||!clipboard.nodes.length)return;
  snapshot();
  const OFF=40; // 粘贴偏移
  const idMap={};
  const newIds=[];
  clipboard.nodes.forEach(orig=>{
    const c=JSON.parse(JSON.stringify(orig));
    const nid=genId(c.type);
    idMap[c.id]=nid;c.id=nid;
    c.x+=OFF;c.y+=OFF;
    // data 字段（含 ox/oy 偏移）已随深拷贝带上
    nodes.push(c);newIds.push(nid);
  });
  // 复制选中范围内的连线，重新指向新节点
  clipboard.edges.forEach(oe=>{
    const f=idMap[oe.from],t=idMap[oe.to];if(!f||!t)return;
    const ne=JSON.parse(JSON.stringify(oe));ne.from=f;ne.to=t;
    if(ne.waypoints)ne.waypoints=ne.waypoints.map(p=>[p[0]+OFF,p[1]+OFF]);
    edges.push(ne);
  });
  // 选中新粘贴的元素
  selSet=new Set(newIds);selChips.clear();
  if(newIds.length===1){selectNode(newIds[0]);}else{selNode=selEdge=null;showPanel('none');}
  updateAlignBar();invalidateRouting();snapshot();
  flashHint('已粘贴 '+newIds.length+' 个元素');
}
let _hintTimer=null;
function flashHint(msg){
  let el=document.getElementById('flash-hint');
  if(!el){el=document.createElement('div');el.id='flash-hint';el.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(20,30,48,0.95);color:#9fe8ff;border:1px solid var(--ui-accent);padding:8px 16px;border-radius:20px;font-size:13px;z-index:300;pointer-events:none;transition:opacity .3s';document.body.appendChild(el);}
  el.textContent=msg;el.style.opacity='1';
  clearTimeout(_hintTimer);_hintTimer=setTimeout(()=>{el.style.opacity='0';},1500);
}
function delEdge(){if(selEdge){snapshot();edges=edges.filter(e=>e!==selEdge);selEdge=null;snapshot();showPanel('none');}}
// 自定义美化确认弹框（替代原生 confirm）
function uiConfirm(msg, danger){
  return new Promise(resolve=>{
    const ov=document.getElementById('confirm-overlay');
    document.getElementById('confirm-msg').textContent=msg;
    document.getElementById('confirm-icon').textContent=danger?'🗑️':'❓';
    const okBtn=document.getElementById('confirm-ok'), caBtn=document.getElementById('confirm-cancel');
    okBtn.textContent=lang==='en'?'Confirm':'确定';
    caBtn.textContent=lang==='en'?'Cancel':'取消';
    okBtn.className='tb '+(danger?'red':'grn');
    ov.classList.add('show');
    const done=(v)=>{ov.classList.remove('show');okBtn.onclick=null;caBtn.onclick=null;resolve(v);};
    okBtn.onclick=()=>done(true);
    caBtn.onclick=()=>done(false);
  });
}
// 轻量文本输入对话框（替代原生 prompt，支持多字段）；返回 {key:value} 或 null（取消）
function uiPrompt(titleText,fields){
  return new Promise(resolve=>{
    let ov=document.getElementById('uiprompt-overlay');
    if(!ov){
      ov=document.createElement('div');ov.id='uiprompt-overlay';
      ov.innerHTML='<div id="uiprompt-box"><div id="uiprompt-title"></div><div id="uiprompt-fields"></div>'
        +'<div id="uiprompt-acts"><button class="tb" data-a="cancel"></button><button class="tb grn" data-a="ok"></button></div></div>';
      document.body.appendChild(ov);
    }
    ov.querySelector('#uiprompt-title').textContent=titleText;
    const fc=ov.querySelector('#uiprompt-fields');fc.innerHTML='';
    const inputs={};
    fields.forEach(f=>{
      const l=document.createElement('label');l.className='uiprompt-l';l.textContent=f.label;
      const i=document.createElement('input');i.value=f.value||'';if(f.placeholder)i.placeholder=f.placeholder;
      inputs[f.key]=i;fc.appendChild(l);fc.appendChild(i);
    });
    const ok=ov.querySelector('[data-a=ok]'),ca=ov.querySelector('[data-a=cancel]');
    ok.textContent=lang==='en'?'OK':'确定';ca.textContent=lang==='en'?'Cancel':'取消';
    ov.classList.add('show');
    const first=fields[0]&&inputs[fields[0].key];if(first)setTimeout(()=>first.focus(),30);
    const done=v=>{ov.classList.remove('show');ok.onclick=null;ca.onclick=null;resolve(v);};
    ok.onclick=()=>{const out={};Object.keys(inputs).forEach(k=>out[k]=inputs[k].value.trim());done(out);};
    ca.onclick=()=>done(null);
  });
}
async function clearAll(){
  const ok=await uiConfirm(lang==='en'?'Clear the entire canvas?':'确定清空整个画布？',true);
  if(!ok)return;
  snapshot();nodes=[];edges=[];selNode=selEdge=null;ids={};snapshot();showPanel('none');
}

// ══════════════════════════════════════════════
// 一键自动布局（分层 + 同层均布 + 重心排序，减少交叉）
// ══════════════════════════════════════════════
// 一键整理连线：智能选择走线（无障碍走直线，否则正交），并触发汇流合并，减少画面线条
// 线段相交判定 segsCross/pathsCross 已抽到 packages/topology-runtime（经 04 接线层落回全局）
function countCrossings(){
  let n=0;
  const paths=edges.map(e=>edgePath(e)).filter(Boolean);
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){
    if(pathsCross(paths[i],paths[j]))n++;
  }
  return n;
}
function tidyEdges(){
  if(!edges.length)return;
  snapshot();
  busMerge=true;
  busAggregation=false;
  applyTidyRouting();
  invalidateRouting();snapshot();
  flashHint('已整理连线：自动吸附端口 · 最短避障路径（剩余交叉 '+_countCrossRaw()+'）');
}
// 一键直线走线：直线优先，遇障碍/交叉自动转最优 L 型正交路线（不改线型/颜色）
function straightenAllEdges(){
  if(!edges.length)return;
  snapshot();
  busAggregation=false;
  applyTidyRouting();
  invalidateRouting();snapshot();
  flashHint('已直线走线 · 遇障/交叉转最优L型 · 剩余交叉 '+_countCrossRaw());
}
// 在给定节点子集内做分层布局（列=层级、重心排序、中位对齐、叶子对齐），就地设置 x,y（局部坐标）
function _layoutComponent(cNodes, cEdges, minGap, colGap){
  const SEMANTIC_TIER={grid:0,solar:0,generator:0,meter2:1,meter:1,busbar:2,transformer:2,switch:2,highvolt:2,pcs:3,ems:3,bms:4,cabinet:4,load:2,charger:2,aircon:3,fire:3,sensor:3};
  const find=id=>cNodes.find(n=>n.id===id);
  const tier={};
  cNodes.forEach(n=>{ tier[n.id]= SEMANTIC_TIER[n.type]!==undefined?SEMANTIC_TIER[n.type]:2; });
  for(let it=0;it<3;it++) cEdges.forEach(e=>{ if(tier[e.to]<=tier[e.from] && SEMANTIC_TIER[find(e.to)?.type]===undefined) tier[e.to]=tier[e.from]+1; });
  const layers={}; cNodes.forEach(n=>{ const t=tier[n.id]; (layers[t]=layers[t]||[]).push(n); });
  const tierKeys=Object.keys(layers).map(Number).sort((a,b)=>a-b);
  const order={}; tierKeys.forEach(t=>layers[t].forEach((n,i)=>order[n.id]=i));
  for(let pass=0;pass<4;pass++) tierKeys.forEach(t=>{
    layers[t].forEach(n=>{ const nb=[]; cEdges.forEach(e=>{ if(e.from===n.id&&order[e.to]!=null)nb.push(order[e.to]); if(e.to===n.id&&order[e.from]!=null)nb.push(order[e.from]); }); n._bary=nb.length?nb.reduce((a,b)=>a+b,0)/nb.length:order[n.id]; });
    layers[t].sort((a,b)=>a._bary-b._bary); layers[t].forEach((n,i)=>order[n.id]=i);
  });
  tierKeys.forEach((t,ti)=>layers[t].forEach((n,i)=>{ n.x=colGap*(ti+1); n.y=(i+1)*minGap; delete n._bary; }));
  const med=a=>{ if(!a.length)return null; const s=[...a].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
  for(let pass=0;pass<10;pass++){ const seq=pass%2?[...tierKeys].reverse():tierKeys;
    seq.forEach(t=>{ const arr=layers[t]; if(!arr.length)return;
      arr.forEach(n=>{ const ys=[]; cEdges.forEach(e=>{ if(e.from===n.id){const m=find(e.to);if(m)ys.push(m.y);} if(e.to===n.id){const m=find(e.from);if(m)ys.push(m.y);} }); n._dy=ys.length?med(ys):n.y; });
      arr.forEach((n,i)=>{ n.y=(i===0)?n._dy:Math.max(n._dy,arr[i-1].y+minGap); });
      for(let i=arr.length-2;i>=0;i--) if(arr[i].y>arr[i+1].y-minGap) arr[i].y=arr[i+1].y-minGap;
      const mD=arr.reduce((s,n)=>s+n._dy,0)/arr.length, mY=arr.reduce((s,n)=>s+n.y,0)/arr.length, off=mD-mY; arr.forEach(n=>n.y+=off);
    });
  }
  cNodes.forEach(n=>delete n._dy);
  const deg={}; cNodes.forEach(n=>deg[n.id]=0); cEdges.forEach(e=>{ if(deg[e.from]!=null)deg[e.from]++; if(deg[e.to]!=null)deg[e.to]++; });
  for(let rep=0;rep<3;rep++) tierKeys.forEach(t=>{ const arr=layers[t];
    arr.forEach((n,i)=>{ if(deg[n.id]!==1)return; let nb=null; for(const e of cEdges){ if(e.from===n.id){nb=e.to;break;} if(e.to===n.id){nb=e.from;break;} } const m=find(nb); if(!m)return;
      const target=m.y, up=i>0?arr[i-1].y:-Infinity, dn=i<arr.length-1?arr[i+1].y:Infinity; if(target>up+minGap-1&&target<dn-minGap+1) n.y=target; });
  });
}
// 收紧空白：沿某一轴向，把「整条投影都没有任何节点」的空白带压缩到 targetGap，
// 保持节点先后次序与连接关系不变（只挪动落在空带之后的节点）。
// 用于消除语义分层导致的大片无效留白（如子树被推到很远、中间整段空白）。
function _compactAxis(cNodes, axis, targetGap){
  if(cNodes.length<2)return;
  const lohi=n=>{ const s=nsz(n);
    const f=(!n.hideFields&&n.data)?n.data.filter(x=>!x.hidden).length:0;
    const step=(chipBaseFS(n)+18);
    if(axis==='x'){ const rc=f?185:0; return [n.x-s*0.7, n.x+s*0.7+rc]; }   // 右侧含字段延展
    return [n.y-s*0.9, n.y+Math.max(s*1.2, s*0.4+f*step)];                  // 下方含标签与下垂字段
  };
  const arr=cNodes.map(n=>{const[lo,hi]=lohi(n);return{n,lo,hi};}).sort((a,b)=>a.lo-b.lo);
  let shift=0, cover=-Infinity;
  for(const it of arr){
    let lo=it.lo-shift; const len=it.hi-it.lo;
    if(cover!==-Infinity && lo-cover>targetGap){ const e=(lo-cover)-targetGap; shift+=e; lo-=e; }
    it.n[axis]-=shift; cover=Math.max(cover, lo+len);
  }
}
function autoLayout(silent){
  if(nodes.length===0)return;
  if(!silent)snapshot();
  // 自适应间距：纵向随字段数增减（避免太空或字段重叠）；横向容纳右侧字段
  // 间距与「节点实际视觉尺寸」成比例：nsz 随 zoom 反比变化，若用固定像素间距，
  // 低缩放布局时节点很大→间距相对过小→元素重叠折叠；高缩放时又留白过多。比例化后任何缩放都一致。
  let maxF=0, sRef=0;
  nodes.forEach(n=>{ if(!n.hideFields&&n.data) maxF=Math.max(maxF, n.data.filter(f=>!f.hidden).length); sRef=Math.max(sRef, nsz(n)); });
  if(sRef<=0) sRef=nsz('pcs');
  // 紧凑但不重叠：节点视觉高约 1.3×尺寸(图标+标签)，纵向取略大于此值；横向留出右侧字段+一条走线通道即可。
  const minGap=Math.round(sRef*(1.4+0.06*Math.min(maxF,6)));   // 纵向：刚好不折叠重叠，随字段条数轻微增高
  const colGap=Math.round(maxF>0 ? sRef*2.5 : sRef*1.35);      // 横向：图标 + 右侧字段预留 + 走线通道（连线不穿字段，又不浪费空间）
  // 拆分连通分量，分别布局后紧凑打包 —— 互不相连的系统不再被拉远、不留大片空白
  const idIndex={}; nodes.forEach((n,i)=>idIndex[n.id]=i);
  const parent=nodes.map((_,i)=>i);
  const findp=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
  edges.forEach(e=>{ const a=idIndex[e.from],b=idIndex[e.to]; if(a!=null&&b!=null) parent[findp(a)]=findp(b); });
  const comps={}; nodes.forEach((n,i)=>{ const r=findp(i); (comps[r]=comps[r]||[]).push(n); });
  const compList=Object.values(comps);
  compList.forEach(cNodes=>{
    const cset=new Set(cNodes.map(n=>n.id));
    _layoutComponent(cNodes, edges.filter(e=>cset.has(e.from)&&cset.has(e.to)), minGap, colGap);
    // 压缩纵向/横向空白带，去掉分层产生的大片无效留白（填充列不受影响；阈值随节点尺寸成比例）
    _compactAxis(cNodes,'y',minGap*0.5);
    _compactAxis(cNodes,'x',colGap*0.45);
  });
  // 打包：各分量按行排布，超出目标宽度换行，避免空白
  const gapX=200, gapY=150, maxRowW=2400;
  let curX=0, curY=0, rowH=0;
  compList.forEach(cNodes=>{
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    cNodes.forEach(n=>{ const s=nsz(n); const f=(!n.hideFields&&n.data)?n.data.filter(x=>!x.hidden).length:0; const rc=f?185:0;
      minX=Math.min(minX,n.x-s*0.6); minY=Math.min(minY,n.y-s*0.85); maxX=Math.max(maxX,n.x+s*0.6+rc); maxY=Math.max(maxY,n.y+s*0.95); });
    const w=maxX-minX, h=maxY-minY;
    if(curX>0 && curX+w>maxRowW){ curX=0; curY+=rowH+gapY; rowH=0; }
    const dx=curX-minX, dy=curY-minY; cNodes.forEach(n=>{ n.x+=dx; n.y+=dy; });
    curX += w+gapX; rowH=Math.max(rowH,h);
  });
  // 走线：自动布局优先连接最近语义端口，再由智能路由选择最短避障路径
  busAggregation=false;
  applyTidyRouting();
  nodes.forEach(n=>{ if(n.data) n.data.forEach(f=>{ f.ox=0; f.oy=0; }); });
  if(!silent)snapshot();
  fitView(1);   // 居中展示全部，最多 100%（内容多则自动缩小以全展示）
}

function fitView(capZoom){
  if(nodes.length===0)return;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  nodes.forEach(n=>{const s=nsz(n);
    const f=(!n.hideFields&&n.data)?n.data.filter(x=>!x.hidden).length:0;
    const rc=f?185:0;                       // 右侧字段延展
    minX=Math.min(minX,n.x-s);minY=Math.min(minY,n.y-s);
    maxX=Math.max(maxX,n.x+s+rc);maxY=Math.max(maxY,n.y+s*1.5);});
  const w=maxX-minX, h=maxY-minY, pad=60;
  const zx=(canvas.width-pad*2)/w, zy=(canvas.height-pad*2)/h;
  zoom=Math.max(0.2,Math.min(capZoom||2,Math.min(zx,zy)));
  panX=pad-minX*zoom+(canvas.width-pad*2-w*zoom)/2;
  panY=pad-minY*zoom+(canvas.height-pad*2-h*zoom)/2;
  document.getElementById('zoom-info').textContent=Math.round(zoom*100)+'%';
}

function ctxEdit(){document.getElementById('ctxmenu').style.display='none';if(ctxKind==='node')selectNode(ctxTgt.id);else selectEdge(ctxTgt);}
function ctxConn(){if(!edgeMode){toggleEdgeMode();}edgeFrom=ctxTgt.id;edgeFromPort=null;document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：已选"'+ctxTgt.label+'"，点目标';document.getElementById('ctxmenu').style.display='none';}
function ctxDelEdge(){snapshot();edges=edges.filter(e=>e!==ctxTgt);selEdge=null;snapshot();showPanel('none');document.getElementById('ctxmenu').style.display='none';}
function ctxDel(){if(ctxKind==='node'){selNode=ctxTgt.id;deleteSelected();}else{selEdge=ctxTgt;delEdge();}document.getElementById('ctxmenu').style.display='none';}
function ctxCopy(){document.getElementById('ctxmenu').style.display='none';if(ctxKind==='node'){selSet.clear();selChips.clear();selectNode(ctxTgt.id);copySelection();pasteClipboard();}}
function ctxStraight(){document.getElementById('ctxmenu').style.display='none';if(ctxKind==='edge'){snapshot();ctxTgt.route='smart';delete ctxTgt.waypoints;invalidateRouting();snapshot();selectEdge(ctxTgt);flashHint('该连线已重置为智能走线（最短·自动避障）');}}
function ctxLine(){document.getElementById('ctxmenu').style.display='none';if(ctxKind==='edge'){snapshot();ctxTgt.route='line';delete ctxTgt.waypoints;delete ctxTgt.orthoDir;invalidateRouting();snapshot();selectEdge(ctxTgt);flashHint('该连线已设为直线（起止直连）');}}
// 右键连线「从此处引出连线」：在点击处插入占位点（原边分接为两段），并立即进入连线模式从该汇合点起线
function ctxTapEdge(){
  document.getElementById('ctxmenu').style.display='none';
  if(ctxKind!=='edge'||!ctxTgt)return;
  const hit=edgeHitInfo(ctxWX,ctxWY,14/zoom,oe=>oe!==ctxTgt);   // 只在右键命中的这条线上找分接点
  if(!hit){flashHint('未在连线上找到分接点');return;}
  snapshot();
  const id=genId('anchor');
  const dev=DEVICE_GROUPS.flatMap(g=>g.devices).find(d=>d.type==='anchor');
  const n={id,type:'anchor',labelZh:(dev&&dev.label)||'占位点',labelEn:(dev&&dev.label_en)||'Anchor',
    x:hit.point[0],y:hit.point[1],fontSize:14,fontColor:'#e8f4ff',scale:0.5,
    hideLabel:true,hideFields:true,fill:'#4dd0ff',opacity:1,data:[]};
  nodes.push(n);
  n.y=hit.point[1]+nsz(n)*0.22;   // 视觉中心对齐分接点（attach 内亦会校正，此处兜底 attach 失败的情况）
  attachAnchorToEdge(n,hit);
  normalizeAnchorJunctions();
  snapshot();
  if(!edgeMode)toggleEdgeMode();
  edgeFrom=id;edgeFromPort=null;edgeWaypoints=[];
  document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：已从汇合点出发，点空白处加拐点，点目标节点完成';
}

// 外观面板：非模态（无遮罩、不点外即关），画布保持可交互，便于「选节点→批量应用」的往返操作
function closeBgPanel(){const p=document.getElementById('bgpanel');if(p)p.classList.remove('show');}
function toggleBgPanel(){
  const p=document.getElementById('bgpanel');const show=!p.classList.contains('show');
  if(show)setSigPanel(false);
  p.classList.toggle('show',show);
}
function setBg(c){bgColor=c;document.documentElement.style.setProperty('--bg',c);const h=document.getElementById('bg-hex');if(h)h.value=c;const p=document.getElementById('bg-pick');if(p&&/^#[0-9a-fA-F]{6}$/.test(c))p.value=c;document.querySelectorAll('.cp').forEach(el=>el.classList.toggle('active',el.dataset.color===c));}
function applyBgHex(){let v=document.getElementById('bg-hex').value.trim();if(v&&v[0]!=='#')v='#'+v;if(/^#[0-9a-fA-F]{3,6}$/.test(v))setBg(v);else alert('请输入有效色值，如 #0a1f40');}
// 键入完整 6 位色值即生效（与色板/取色器「即选即生效」语义一致；Enter 仍走 applyBgHex 支持 3 位缩写）
function applyBgHexLive(v){v=(v||'').trim();if(v&&v[0]!=='#')v='#'+v;if(/^#[0-9a-fA-F]{6}$/.test(v))setBg(v);}
// 全局字体：按勾选把「大小/颜色」分别应用到所有节点的「名称/数据字段」，四项自由组合、互不绑定
document.getElementById('gf-color').addEventListener('input',e=>{document.getElementById('gf-color-hex').value=e.target.value;});
// 外观面板的 取色器↔hex 双向联动（无选中节点语义，纯控件同步）
function wireColorPair(pickId,hexId){
  const p=document.getElementById(pickId),h=document.getElementById(hexId);
  if(!p||!h)return;
  p.addEventListener('input',()=>{h.value=p.value;});
  h.addEventListener('input',()=>{const v=h.value.trim();if(/^#[0-9a-fA-F]{6}$/.test(v))p.value=v;});
}
wireColorPair('gfd-bg','gfd-bg-hex');
wireColorPair('gfd-bc','gfd-bc-hex');
// 数据字段卡片统一设置（外观面板④）：scope 'all'=全部设备节点 / 'sel'=仅当前选中（支持多选）
// 当前选中的批量目标，两种粒度：
//   节点级 nodeTargets = 多选集合/单选的设备节点 → 改该节点全部字段卡片（写 n.field*）
//   字段级 fieldTargets = 框选/点选的字段卡片（其节点不在节点级目标中）→ 只改这几张卡片（写 f.chip*，渲染时覆盖节点级）
function gfdSelTargets(){
  // 有字段卡片被选中的节点 → 按字段级处理（只改选中卡片），不再整体计为节点目标。
  // 注意：单击卡片也会把 selNode 设为该节点（供属性面板显示），故 selNode 只有在「没有选中它的卡片」时才算节点级选中。
  const chipNodeIds=new Set([...selChips].map(k=>k.split('#')[0]));
  const selOn=n=>selSet.has(n.id)||(n.id===selNode&&!chipNodeIds.has(n.id));
  const nodeTargets=nodes.filter(n=>!usesTextBox(n.type)&&n.type!=='anchor'&&selOn(n));
  const nodeIds=new Set(nodeTargets.map(n=>n.id));
  const fieldTargets=[...selChips].map(k=>{
    const a=k.split('#');const n=nodes.find(z=>z.id===a[0]);const f=n&&n.data&&n.data[a[1]];
    return (f&&!nodeIds.has(n.id))?{n,f}:null;
  }).filter(Boolean);
  // 文本框/变量：受「同步应用为盒子样式」开关控制，把同一套设置落为盒子样式；占位点始终跳过
  const boxTargets=nodes.filter(n=>usesTextBox(n.type)&&selOn(n));
  const skippedAnchors=nodes.filter(n=>n.type==='anchor'&&selOn(n)).length;
  return {nodeTargets, fieldTargets, boxTargets, skippedAnchors};
}
// 「仅选中」按钮：标签固定简洁，不做计数（目标类型可能增减，避免频繁改统计）
function updGfdSelBtn(){
  const b=document.getElementById('gfd-apply-sel');if(!b)return;
  b.textContent=(lang==='en'?'Selected only':'仅选中');
}
function applyGlobalFieldStyle(scope){
  const useBg=document.getElementById('gfd-use-bg').checked;
  const useBorder=document.getElementById('gfd-use-border').checked;
  const useRadius=document.getElementById('gfd-use-radius').checked;
  if(!useBg&&!useBorder&&!useRadius){flashHint(lang==='en'?'Check at least one style to apply':'请先勾选要设置的样式（背景/边框/圆角）');return;}
  const incBox=!!(document.getElementById('gfd-inc-box')&&document.getElementById('gfd-inc-box').checked);
  let nodeTargets=[],fieldTargets=[],boxTargets=[],skipped=0;
  if(scope==='sel'){
    const r=gfdSelTargets();
    nodeTargets=r.nodeTargets;fieldTargets=r.fieldTargets;
    boxTargets=incBox?r.boxTargets:[];
    skipped=r.skippedAnchors+(incBox?0:r.boxTargets.length);
  }else{
    nodeTargets=nodes.filter(n=>!usesTextBox(n.type)&&n.type!=='anchor');
    boxTargets=incBox?nodes.filter(n=>usesTextBox(n.type)):[];
  }
  if(!nodeTargets.length&&!fieldTargets.length&&!boxTargets.length){
    flashHint(scope==='sel'
      ?(skipped?(lang==='en'?'Selected elements are not applicable (enable the box-style option for text/variable)':'当前选中的 '+skipped+' 个元素不可应用（文本框/变量可勾选上方「同步应用为盒子样式」；占位点不参与）')
               :(lang==='en'?'Select nodes or field chips on canvas first':'请先在画布上选中节点或字段卡片（可框选）'))
      :(lang==='en'?'No nodes on canvas':'画布暂无节点'));
    return;
  }
  const bg=document.getElementById('gfd-bg').value;
  const bs=document.getElementById('gfd-border').value;
  const bc=document.getElementById('gfd-bc').value;
  const bw=Math.max(0.5,Math.min(20,pairVal('gfd-bw',1.2)));
  const rad=readRadiusControls('gfd-radius','gfd-radius-unit');
  snapshot();
  nodeTargets.forEach(n=>{
    if(useBg)n.fieldBg=bg;
    if(useBorder){n.fieldBorder=bs;if(bs!=='none'){n.fieldBorderColor=bc;n.fieldBorderWidth=bw;}else{delete n.fieldBorderColor;delete n.fieldBorderWidth;}}
    if(useRadius)n.fieldRadius=rad;
    // 节点级应用时清掉该节点各字段的字段级覆盖，避免旧的单卡片样式残留挡住本次设置
    if(n.data)n.data.forEach(f=>{
      if(useBg)delete f.chipBg;
      if(useBorder){delete f.chipBorder;delete f.chipBorderColor;delete f.chipBorderWidth;}
      if(useRadius)delete f.chipRadius;
    });
  });
  fieldTargets.forEach(({f})=>{
    if(useBg)f.chipBg=bg;
    if(useBorder){f.chipBorder=bs;if(bs!=='none'){f.chipBorderColor=bc;f.chipBorderWidth=bw;}else{delete f.chipBorderColor;delete f.chipBorderWidth;}}
    if(useRadius)f.chipRadius=rad;
  });
  // 文本框/变量：同一套设置落为盒子样式（bg/border/radius 与属性面板「盒子样式」同一组属性，圆角同样支持百分比）
  boxTargets.forEach(n=>{
    if(useBg)n.bg=bg;
    if(useBorder){n.border=bs;if(bs!=='none'){n.borderColor=bc;n.borderWidth=bw;}}   // 盒子 'none' 时保留 borderColor/Width 无碍：盒子渲染以 n.border 为准，不读残留
    if(useRadius)n.radius=rad;
  });
  snapshot();
  if(selNode)selectNode(selNode);
  const parts=[];
  if(nodeTargets.length)parts.push(lang==='en'?(nodeTargets.length+' node(s)'):(nodeTargets.length+' 个节点'));
  if(fieldTargets.length)parts.push(lang==='en'?(fieldTargets.length+' field chip(s)'):(fieldTargets.length+' 个字段卡片'));
  if(boxTargets.length)parts.push(lang==='en'?(boxTargets.length+' text/variable box(es)'):(boxTargets.length+' 个文本/变量盒子'));
  flashHint((lang==='en'?'Style applied to ':'样式已应用到 ')+parts.join(' + ')
    +(skipped?((lang==='en'?', skipped ':'；已跳过 ')+skipped+(lang==='en'?' element(s)':' 个元素（未勾选盒子同步的文本/变量或占位点）')):''));
}
function applyGlobalFont(){
  if(nodes.length===0){alert(lang==='en'?'No nodes on canvas':'画布暂无节点');return;}
  const useSize=document.getElementById('gf-use-size').checked;
  const useColor=document.getElementById('gf-use-color').checked;
  const toLabel=document.getElementById('gf-tgt-label').checked;
  const toFields=document.getElementById('gf-tgt-fields').checked;
  if(!useSize&&!useColor){flashHint(lang==='en'?'Check at least one style: size or color':'请先勾选要设置的样式：文字大小 或 文字颜色');return;}
  if(!toLabel&&!toFields){flashHint(lang==='en'?'Check at least one target: node label or data fields':'请先勾选应用范围：节点名称 或 数据字段');return;}
  let fs=Math.round(pairVal('gf-size',14));
  fs=Math.max(6,Math.min(200,fs));
  pairSet('gf-size',fs);
  const fc=document.getElementById('gf-color').value;
  snapshot();
  nodes.forEach(n=>{
    if(toLabel){ if(useSize)n.fontSize=fs; if(useColor)n.fontColor=fc; }
    if(toFields){ if(useSize)n.fieldFontSize=fs; if(useColor)n.fieldFontColor=fc; }
  });
  snapshot();
  // 若当前选中节点，刷新属性面板
  if(selNode)selectNode(selNode);
  flashHint(lang==='en'?'Text style applied':'文字样式已应用');
}
document.getElementById('bg-hex').addEventListener('keydown',e=>{if(e.key==='Enter')applyBgHex();});

const dz=document.getElementById('dz');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');if(e.dataTransfer.files[0])readFile(e.dataTransfer.files[0]);});
// ── 图标图片格式校验：仅支持 PNG / JPG(JPEG) / SVG / GIF / WEBP，与服务端 icon-store 一致 ──
const ICON_ALLOWED_MIME=['image/png','image/jpeg','image/jpg','image/svg+xml','image/gif','image/webp'];
const ICON_ALLOWED_EXT=['png','jpg','jpeg','svg','gif','webp'];
const ICON_ALLOWED_HINT='PNG / JPG / SVG / GIF / WEBP';
// 校验所选文件是否为受支持的图片：有 MIME 用 MIME 精确判定；个别 svg 无 MIME 时用扩展名兜底。
// 通过返回 true；否则可视化提示（toast）并返回 false。
function checkIconFile(file){
  if(!file)return false;
  const mime=(file.type||'').toLowerCase();
  const ext=((file.name||'').split('.').pop()||'').toLowerCase();
  const ok = mime ? ICON_ALLOWED_MIME.includes(mime) : ICON_ALLOWED_EXT.includes(ext);
  if(!ok){
    flashHint(lang==='en'?('Unsupported file format. Allowed images: '+ICON_ALLOWED_HINT):('不支持的文件格式，仅支持图片：'+ICON_ALLOWED_HINT));
    return false;
  }
  return true;
}
function onFile(e){if(e.target.files[0]&&!checkIconFile(e.target.files[0])){e.target.value='';return;}if(e.target.files[0])readFile(e.target.files[0]);}
function readFile(file){if(!checkIconFile(file))return;const r=new FileReader();r.onload=ev=>{pendingDataURL=ev.target.result;const p=document.getElementById('upv');p.src=pendingDataURL;p.style.display='block';if(!document.getElementById('un').value)document.getElementById('un').value=file.name.replace(/\.[^.]+$/,'');};r.readAsDataURL(file);}
async function confirmUp(){
  if(!pendingDataURL){alert(lang==='en'?'Please select a file':'请先选择文件');return;}
  const zhEl=document.getElementById('un'),enEl=document.getElementById('un-en');
  const zh=zhEl.value.trim(), en=enEl.value.trim();
  zhEl.classList.toggle('invalid',!zh); enEl.classList.toggle('invalid',!en);
  if(!zh||!en){alert(lang==='en'?'Please fill both Chinese and English names':'请同时填写中文和英文名称');return;}
  // 中/英文名各自全库唯一：重复则不提交（服务端也会 409 兜底）
  const dup=iconNameConflict(zh,en,null);
  if(dup){alert(dup);return;}
  const safe=en.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
  const tk='custom_'+(safe||('icon'+Date.now()));
  const group=(document.getElementById('un-group')||{}).value||'';
  // ★ 持久化：图片落盘到服务器 icons/ 目录 + 登记 index.json，刷新页面不丢失；成功后重扫图标库动态生效
  const dataURL=pendingDataURL;
  try{
    const r=await fetch(ICON_API,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:tk,labelZh:zh,labelEn:en,dataURL,group})});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.ok){
      closeUp();
      await reloadIconLibrary();
      if(document.getElementById('iconmgr-overlay').classList.contains('show'))renderIconManager();
      flashHint(lang==='en'?'Icon saved to library':'图标已保存到图标库');
      return;
    }
    console.warn('icon upload api failed',j);
  }catch(err){ console.warn('icon upload api unreachable',err); }
  // 兜底：无写接口（纯静态托管）时退回「仅本次会话」内存图标
  const img=new Image();img.src=dataURL;
  img.onload=()=>{
    CUSTOM_ICONS[tk]=img;IMGS[tk]=img;NODE_DEFAULTS[tk]={data:[]};
    CUSTOM_LABELS[tk]={zh,en};
    addCustomToSidebar(tk,zh,en,dataURL);
    const sel=document.getElementById('p-type');const o=document.createElement('option');o.value=tk;o.textContent=zh+' / '+en;sel.appendChild(o);
    closeUp();
    flashHint(lang==='en'?'No icon API — icon kept for this session only':'未连接图标服务，图标仅本次会话可用');
  };
}
function closeUp(){document.getElementById('uo').classList.remove('show');document.getElementById('upv').style.display='none';document.getElementById('upv').src='';document.getElementById('un').value='';document.getElementById('un-en').value='';document.getElementById('un').classList.remove('invalid');document.getElementById('un-en').classList.remove('invalid');document.getElementById('fi').value='';pendingDataURL=null;}

// ══════════════════════════════════════════════
// 图标库管理（菜单栏「🗂 图标库管理」）：管理全部图标 + 分组。增 / 删 / 改（重命名、替换图片、
// 移动分组）图标，以及分组的增 / 删 / 改 → 服务端落盘 icons/ + index.json；每次操作后
// reloadIconLibrary() 重扫，左栏 / 属性面板下拉 / 画布即时生效，无需刷新页面。
// ══════════════════════════════════════════════
let _mgrReplaceType=null;   // 「替换图片」时暂存目标图标 type，等待文件选择回调
async function iconApiCall(method,type,body){
  const u=type?(ICON_API+'/'+encodeURIComponent(type)):ICON_API;
  const r=await fetch(u,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
  return j;
}
async function iconGroupApiCall(method,title,body){
  const u='api/icon-groups'+(title?('/'+encodeURIComponent(title)):'');
  const r=await fetch(u,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
  return j;
}
// 中/英文名各自全库唯一校验（排除自身 type）；命中返回本地化错误消息，否则 null
function iconNameConflict(zh,en,selfType){
  for(const g of DEVICE_GROUPS)for(const d of (g.devices||[])){
    if(d.type===selfType)continue;
    if(zh&&(d.label||'')===zh)return (lang==='en'?'Duplicate Chinese name: ':'中文名称重复：')+zh;
    if(en&&(d.label_en||'')===en)return (lang==='en'?'Duplicate English name: ':'英文名称重复：')+en;
  }
  return null;
}
// 分组下拉：列出图标库现有分组 + 「未分组」兜底；selected 预选中
function populateGroupSelect(el,selected){
  if(!el)return;el.innerHTML='';
  const seen=[];
  DEVICE_GROUPS.forEach(g=>{if(!seen.some(x=>x.t===g.title))seen.push({t:g.title,en:g.title_en||g.title});});
  if(!seen.some(x=>x.t==='未分组'))seen.push({t:'未分组',en:'Ungrouped'});
  seen.forEach(x=>{const o=document.createElement('option');o.value=x.t;o.textContent=(lang==='en'?x.en:x.t);if(x.t===selected)o.selected=true;el.appendChild(o);});
}
// 打开上传对话框（新增图标）：先填充分组下拉（默认「未分组」）
function openUploadDialog(){populateGroupSelect(document.getElementById('un-group'),'未分组');document.getElementById('uo').classList.add('show');}
// ── 可视化校验（替代原生 alert）：不合法字段红框高亮 + 该字段所在行内的红字提示（就近显示，语义明确） ──
function _imRowOf(el){return el&&el.closest('.im-addrow,.im-row,.im-grow');}
// 清除某字段所在行的校验态（红框 + 行内错误文字）
function _imClear(){[].forEach.call(arguments,i=>{if(!i)return;i.classList.remove('im-invalid');const row=_imRowOf(i);const e=row&&row.querySelector('.im-err');if(e)e.remove();});}
// 在字段所在行显示错误：字段红框 + 行内红字（行 flex-wrap，错误另起一行紧贴字段）
function _imInvalid(inputs,msg){
  const input=inputs[0];if(!input)return;
  input.classList.add('im-invalid');
  const row=_imRowOf(input);
  if(row){let e=row.querySelector('.im-err');if(!e){e=document.createElement('div');e.className='im-err';row.appendChild(e);}e.textContent=msg;}
  else flashHint(msg);
  try{input.focus();}catch(_){}
}
// 行级错误（无特定字段，如「未选择图片」）：在该行末尾显示红字
function _imRowErr(row,msg){if(!row)return flashHint(msg);const o=row.querySelector('.im-err');if(o)o.remove();const e=document.createElement('div');e.className='im-err';e.textContent=msg;row.appendChild(e);}
// 图标中/英文名校验：各自必填 + 全库唯一（排除自身 type）。通过返回 {zh,en}，否则就近提示并返回 null
function validateIconNames(zhI,enI,selfType){
  _imClear(zhI,enI);
  const zh=zhI.value.trim(),en=enI.value.trim();
  if(!zh)return _imInvalid([zhI],lang==='en'?'Chinese name is required':'请填写中文名称'),null;
  if(!en)return _imInvalid([enI],lang==='en'?'English name is required':'请填写英文名称'),null;
  for(const g of DEVICE_GROUPS)for(const d of (g.devices||[])){
    if(d.type===selfType)continue;
    if((d.label||'')===zh)return _imInvalid([zhI],(lang==='en'?('Chinese name "'+zh+'" already exists'):('中文名称「'+zh+'」已被占用，请换一个'))),null;
    if((d.label_en||'')===en)return _imInvalid([enI],(lang==='en'?('English name "'+en+'" already exists'):('英文名称「'+en+'」已被占用，请换一个'))),null;
  }
  return {zh,en};
}
// 分组中/英文名校验：各自必填 + 全库唯一（排除自身分组）。通过返回 {zh,en}，否则就近提示并返回 null
function validateGroupNames(zhI,enI,selfTitle){
  _imClear(zhI,enI);
  const zh=zhI.value.trim(),en=enI.value.trim();
  if(!zh)return _imInvalid([zhI],lang==='en'?'Group name is required':'请填写分组中文名称'),null;
  if(!en)return _imInvalid([enI],lang==='en'?'Group English name is required':'请填写分组英文名称'),null;
  for(const g of DEVICE_GROUPS){
    if(g.title===selfTitle)continue;
    if(g.title===zh)return _imInvalid([zhI],(lang==='en'?('Group name "'+zh+'" already exists'):('分组中文名「'+zh+'」已存在，请换一个'))),null;
    if((g.title_en||'')===en)return _imInvalid([enI],(lang==='en'?('Group English name "'+en+'" already exists'):('分组英文名「'+en+'」已存在，请换一个'))),null;
  }
  return {zh,en};
}
let _iconMgrTab='icons';    // 当前子tab：'icons' 图标管理 / 'groups' 分组管理
let _iconMgrAdding=false;    // 是否在当前tab顶部展开「新增」行
let _iconMgrFlash=null;      // 刚新增的项 {type} 或 {title}：渲染后滚动到并高亮
let _iconMgrFlashEl=null;    // 本次渲染命中的高亮行元素（渲染末尾滚动）
// 图标库管理面板的分组顺序（不用左栏的 ICON_GROUP_ORDER 排序，改用清单原始顺序 _ord，
// 使「新增分组」(服务端 unshift 到最前)显示在最上面）。ungroupedFirst=true 时「未分组」再置顶。
function iconMgrGroups(ungroupedFirst){
  const gs=DEVICE_GROUPS.slice().sort((a,b)=>(a._ord||0)-(b._ord||0));
  if(ungroupedFirst){const i=gs.findIndex(g=>g.title==='未分组');if(i>0)gs.unshift(gs.splice(i,1)[0]);}
  return gs;
}
function openIconManager(){
  document.getElementById('iconmgr-overlay').classList.add('show');
  document.getElementById('iconmgr-title').textContent=lang==='en'?'🗂 Icon Library Manager':'🗂 图标库管理';
  _iconMgrAdding=false;_addIconDataURL=null;
  renderIconManager();
}
function closeIconManager(){document.getElementById('iconmgr-overlay').classList.remove('show');}
function setIconMgrTab(t){_iconMgrTab=t;_iconMgrAdding=false;_addIconDataURL=null;renderIconManager();}
// 「新增分组」内联行（分组管理tab顶部；无冗余标签文字）
function buildAddGroupRow(en){
  const row=document.createElement('div');row.className='im-addrow';
  const zh=_imInput(en?'Group name (Chinese)':'分组名称（中文）');
  const eni=_imInput(en?'English name':'分组名称（English）');
  row.append(zh,eni,
    _imBtn('tb grn',en?'✓ Save':'✓ 保存',()=>submitAddGroup(zh,eni)),
    _imBtn('tb',en?'Cancel':'取消',()=>{_iconMgrAdding=false;renderIconManager();}));
  setTimeout(()=>zh.focus(),30);
  return row;
}
// 「新增图标」内联行（图标管理tab顶部；无冗余标签文字）
function buildAddIconRow(en){
  const row=document.createElement('div');row.className='im-addrow';
  const prev=document.createElement('img');prev.id='im-add-prev';prev.className='im-icon';
  if(_addIconDataURL){prev.src=_addIconDataURL;}else{prev.style.visibility='hidden';}
  const zh=_imInput(en?'Chinese name':'中文名称');
  const eni=_imInput(en?'English name':'英文名称');
  const gsel=document.createElement('select');gsel.className='im-gsel';populateGroupSelect(gsel,'未分组');
  row.append(
    _imBtn('tb',en?'🖼 Choose':'🖼 选择图片',()=>document.getElementById('im-add-fi').click()),
    prev,zh,eni,gsel,
    _imBtn('tb grn',en?'✓ Save':'✓ 保存',()=>submitAddIcon(zh,eni,gsel.value)),
    _imBtn('tb',en?'Cancel':'取消',()=>{_iconMgrAdding=false;_addIconDataURL=null;renderIconManager();}));
  setTimeout(()=>zh.focus(),30);
  return row;
}
// 「新增」按钮（tab 行右侧）：展开/收起当前 tab 的顶部内联新增行
function iconMgrToggleAdd(){_iconMgrAdding=!_iconMgrAdding;_addIconDataURL=null;renderIconManager();}
function renderIconManager(){
  const en=lang==='en';
  // tab 即区标题（标题栏只保留弹框名），右侧为「导出全部」+ 当前 tab 的「新增」按钮
  const ti=document.getElementById('im-tab-icons'),tg=document.getElementById('im-tab-groups'),tt=document.getElementById('im-tab-trash');
  ti.textContent=en?'Icons':'图标管理';tg.textContent=en?'Groups':'分组管理';tt.textContent=en?'Trash':'回收站';
  ti.classList.toggle('active',_iconMgrTab==='icons');tg.classList.toggle('active',_iconMgrTab==='groups');tt.classList.toggle('active',_iconMgrTab==='trash');
  const addBtn=document.getElementById('iconmgr-addbtn');
  addBtn.style.display=(_iconMgrTab==='trash')?'none':'';   // 回收站无「新增」，改显示批量按钮
  addBtn.textContent=_iconMgrTab==='groups'?(en?'＋ Add Group':'＋ 新增分组'):(en?'＋ Add Icon':'＋ 新增图标');
  const exp=document.getElementById('iconmgr-export');
  exp.textContent=en?'⬇ Export Library':'⬇ 导出图标库';   // 语义明确：导出图标库（不含回收站）
  const rall=document.getElementById('iconmgr-restoreall'),pall=document.getElementById('iconmgr-purgeall');
  rall.style.display=pall.style.display=(_iconMgrTab==='trash')?'':'none';
  rall.textContent=en?'↺ Restore All':'↺ 全部还原';
  pall.textContent=en?'🗑 Purge All':'🗑 全部删除';
  const list=document.getElementById('iconmgr-list');list.innerHTML='';
  const bust=_iconBust?('?v='+_iconBust):'';
  _iconMgrFlashEl=null;
  // 顶部内联新增行
  if(_iconMgrAdding&&_iconMgrTab!=='trash')list.appendChild(_iconMgrTab==='groups'?buildAddGroupRow(en):buildAddIconRow(en));
  // 主体
  if(_iconMgrTab==='groups')renderGroupRows(list,en);
  else if(_iconMgrTab==='trash')renderTrashRows(list,en);
  else renderIconRows(list,en,bust);
  // 新增项：滚动到并短暂高亮，便于立即查看验证（即便所属分组不在最上面）
  if(_iconMgrFlashEl){const el=_iconMgrFlashEl;requestAnimationFrame(()=>{try{el.scrollIntoView({block:'center'});}catch(_){}el.classList.add('im-flash');});}
  _iconMgrFlash=null;
}
// 分组行：改名(中/英) / 删除（组内图标移到「未分组」）。按清单顺序（新增分组在最上面）
function renderGroupRows(list,en){
  iconMgrGroups(false).forEach(g=>{
    const sys=(g.title==='未分组');   // 系统保留分组：常驻、不可改名/删除
    const row=document.createElement('div');row.className='im-grow'+(sys?' im-grow-sys':'');
    if(_iconMgrFlash&&_iconMgrFlash.title===g.title)_iconMgrFlashEl=row;
    const dot=document.createElement('span');dot.className='im-dot';dot.style.background=g.color||'#8aa8c4';
    const zhI=document.createElement('input');zhI.value=g.title||'';zhI.placeholder=en?'Group name':'分组名称';
    const enI=document.createElement('input');enI.value=g.title_en||'';enI.placeholder=en?'English name':'英文名称';
    const cnt=document.createElement('span');cnt.className='im-gcount';cnt.textContent='×'+((g.devices||[]).length);
    const save=document.createElement('button');save.className='im-btn';save.textContent=en?'💾 Save':'💾 保存';
    const del=document.createElement('button');del.className='im-btn im-del';del.textContent=en?'🗑 Delete':'🗑 删除';
    del.title=en?'Delete group (icons move to Ungrouped)':'删除分组（组内图标移到未分组）';
    if(sys){
      // 「未分组」为系统保留分组：禁止改名/删除
      zhI.disabled=enI.disabled=save.disabled=del.disabled=true;
      zhI.title=enI.title=save.title=del.title=en?'Reserved system group (cannot be renamed or deleted)':'系统保留分组，不可改名/删除';
    }else{
      zhI.addEventListener('input',()=>_imClear(zhI));
      enI.addEventListener('input',()=>_imClear(enI));
      save.onclick=()=>iconMgrRenameGroup(g.title,zhI,enI);
      del.onclick=()=>iconMgrDeleteGroup(g.title);
    }
    row.append(dot,zhI,enI,cnt,save,del);
    list.appendChild(row);
  });
}
// 图标行：按分组列出「有图片」的图标（纯绘制元素文本框/变量/占位点无图片，不在此管理）
function renderIconRows(list,en,bust){
  let total=0;
  iconMgrGroups(true).forEach(g=>{
    const devs=(g.devices||[]).filter(d=>d.file);
    if(!devs.length)return;
    total+=devs.length;
    const h=document.createElement('div');h.className='im-group';
    h.textContent=(en?(g.title_en||g.title):g.title)+'（'+devs.length+'）';
    list.appendChild(h);
    devs.forEach(d=>{
      const row=document.createElement('div');row.className='im-row';
      if(_iconMgrFlash&&_iconMgrFlash.type===d.type)_iconMgrFlashEl=row;
      const img=document.createElement('img');img.className='im-icon';img.src=ICON_BASE+d.file+bust;img.alt=d.type;
      const tp=document.createElement('div');tp.className='im-type';tp.textContent=d.type;tp.title=(en?'File: ':'文件：')+d.file;
      const zhI=document.createElement('input');zhI.value=d.label||'';zhI.placeholder=en?'Chinese name':'中文名称';zhI.addEventListener('input',()=>_imClear(zhI));
      const enI=document.createElement('input');enI.value=d.label_en||'';enI.placeholder=en?'English name':'英文名称';enI.addEventListener('input',()=>_imClear(enI));
      const gsel=document.createElement('select');gsel.className='im-gsel';populateGroupSelect(gsel,g.title);
      gsel.title=en?'Move to group':'移动到分组';
      gsel.onchange=()=>iconMgrMove(d.type,gsel.value);
      const save=document.createElement('button');save.className='im-btn';save.textContent=en?'💾 Save':'💾 保存';
      save.title=en?'Save Chinese/English labels':'保存中/英文名称';
      save.onclick=()=>iconMgrRename(d.type,zhI,enI);
      const rep=document.createElement('button');rep.className='im-btn';rep.textContent=en?'🔄 Replace':'🔄 替换';
      rep.title=en?'Replace the image file':'替换图标图片';
      rep.onclick=()=>{_mgrReplaceType=d.type;document.getElementById('im-fi').click();};
      const del=document.createElement('button');del.className='im-btn im-del';del.textContent=en?'🗑 Delete':'🗑 删除';
      del.title=en?'Delete this icon from the library':'从图标库删除该图标';
      del.onclick=()=>iconMgrDelete(d.type,en?(d.label_en||d.label):(d.label||d.label_en));
      row.append(img,tp,zhI,enI,gsel,save,rep,del);
      list.appendChild(row);
    });
  });
  if(!total){
    const empty=document.createElement('div');empty.className='im-empty';
    empty.textContent=en?'No image icons yet. Click "Add Icon".':'图标库暂无图片图标，点击「新增图标」。';
    list.appendChild(empty);
  }
}
async function iconMgrRename(type,zhI,enI){
  const v=validateIconNames(zhI,enI,type);
  if(!v)return;
  try{
    await iconApiCall('PUT',type,{labelZh:v.zh,labelEn:v.en});
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Icon renamed':'图标名称已保存');
  }catch(err){flashHint((lang==='en'?'Save failed: ':'保存失败：')+err.message);}
}
async function iconMgrMove(type,group){
  try{
    await iconApiCall('PUT',type,{group});
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Moved to '+group:'已移动到「'+group+'」');
  }catch(err){flashHint((lang==='en'?'Move failed: ':'移动失败：')+err.message);}
}
async function iconMgrDelete(type,label){
  // 拦截：该图标被当前画布元素使用时，删除会让这些元素失去图标（变占位孤儿）。禁止删除，引导改用「替换」。
  const used=(nodes||[]).filter(n=>n.type===type||(Array.isArray(n.iconRules)&&n.iconRules.some(r=>r&&r.icon===type)));
  if(used.length){
    flashHint(lang==='en'
      ?('Cannot delete: used by '+used.length+' canvas element(s). Use "Replace" to change its image.')
      :('无法删除：该图标正被画布中 '+used.length+' 个元素使用。如需更换图案请点「替换」。'));
    return;
  }
  const ok=await uiConfirm(lang==='en'
    ?('Delete icon "'+(label||type)+'"? It will be moved to Trash and can be restored there.')
    :('确定删除「'+(label||type)+'」？将移入回收站，可在「回收站」页签中还原。'),true);
  if(!ok)return;
  try{
    await iconApiCall('DELETE',type);
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Moved to Trash (restorable)':'已移入回收站，可在「回收站」还原');
  }catch(err){flashHint((lang==='en'?'Delete failed: ':'删除失败：')+err.message);}
}
// ── 回收站：列表 / 还原 / 彻底删除 ──
function renderTrashRows(list,en){
  const tip=document.createElement('div');tip.className='im-empty';tip.textContent=en?'Loading…':'加载中…';
  list.appendChild(tip);
  fetch('api/icon-trash',{cache:'no-store'}).then(r=>r.json()).then(j=>{
    if(_iconMgrTab!=='trash')return;   // 用户已切走，放弃渲染
    list.innerHTML='';
    const items=(j&&j.items)||[];
    if(!items.length){
      const d=document.createElement('div');d.className='im-empty';
      d.textContent=en?'Trash is empty. Deleted icons land here and can be restored.':'回收站为空。删除的图标会进入这里，可随时还原。';
      list.appendChild(d);return;
    }
    items.forEach(it=>{
      const row=document.createElement('div');row.className='im-row';
      const img=document.createElement('img');img.className='im-icon';img.src=ICON_BASE+'.trash/'+it.trashFile;img.alt=it.type;
      const tp=document.createElement('div');tp.className='im-type';tp.textContent=it.type;tp.title=(en?'File: ':'文件：')+it.file;
      const name=document.createElement('div');name.className='im-tname';name.textContent=(it.label||'')+' / '+(it.label_en||'');
      const meta=document.createElement('div');meta.className='im-tmeta';
      meta.textContent=(en?'from ':'原分组：')+(it.group||'-')+(it.deletedAt?('　'+(en?'deleted ':'删除于 ')+String(it.deletedAt).replace('T',' ').slice(0,19)):'');
      const rst=document.createElement('button');rst.className='im-btn';rst.textContent=en?'↺ Restore':'↺ 还原';
      rst.title=en?'Restore to its original group (Ungrouped if the group is gone)':'还原到原分组（原分组已删则回到未分组）';
      rst.onclick=()=>iconMgrRestore(it.type,it.label||it.type);
      const purge=document.createElement('button');purge.className='im-btn im-del';purge.textContent=en?'✕ Purge':'✕ 彻底删除';
      purge.title=en?'Permanently delete (cannot be undone)':'彻底删除，不可恢复';
      purge.onclick=()=>iconMgrPurge(it.type,it.label||it.type);
      row.append(img,tp,name,meta,rst,purge);
      list.appendChild(row);
    });
  }).catch(err=>{
    list.innerHTML='';
    const d=document.createElement('div');d.className='im-empty';
    d.textContent=(en?'Failed to load trash: ':'回收站加载失败：')+err.message;
    list.appendChild(d);
  });
}
async function iconMgrRestore(type,label){
  try{
    const r=await fetch('api/icon-trash/'+encodeURIComponent(type)+'/restore',{method:'POST'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
    await reloadIconLibrary();renderIconManager();
    flashHint((lang==='en'?'Restored: ':'已还原：')+(label||type));
  }catch(err){flashHint((lang==='en'?'Restore failed: ':'还原失败：')+err.message);}
}
async function iconMgrPurge(type,label){
  const ok=await uiConfirm(lang==='en'
    ?('Permanently delete "'+(label||type)+'"? This cannot be undone.')
    :('确定彻底删除「'+(label||type)+'」？该操作不可恢复。'),true);
  if(!ok)return;
  try{
    const r=await fetch('api/icon-trash/'+encodeURIComponent(type),{method:'DELETE'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
    renderIconManager();
    flashHint(lang==='en'?'Purged':'已彻底删除');
  }catch(err){flashHint((lang==='en'?'Purge failed: ':'彻底删除失败：')+err.message);}
}
// 读取回收站列表（批量操作共用）
async function _iconTrashItems(){
  const r=await fetch('api/icon-trash',{cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
  return j.items||[];
}
// 全部还原：逐个调还原接口（还原含 type/名称冲突自动改名逻辑，复用单个接口最稳）
async function iconMgrRestoreAll(){
  try{
    const items=await _iconTrashItems();
    if(!items.length){flashHint(lang==='en'?'Trash is empty':'回收站为空');return;}
    const ok=await uiConfirm(lang==='en'
      ?('Restore all '+items.length+' icon(s) from Trash?')
      :('确定还原回收站中的全部 '+items.length+' 个图标？'),false);
    if(!ok)return;
    let done=0,fail=0;
    for(const it of items){
      try{
        const r=await fetch('api/icon-trash/'+encodeURIComponent(it.type)+'/restore',{method:'POST'});
        const j=await r.json().catch(()=>({}));
        if(r.ok&&j.ok)done++;else fail++;
      }catch(_){fail++;}
    }
    await reloadIconLibrary();renderIconManager();
    flashHint((lang==='en'?('Restored '+done+' icon(s)'):('已还原 '+done+' 个图标'))
      +(fail?(lang==='en'?(', '+fail+' failed'):('，'+fail+' 个失败')):''));
  }catch(err){flashHint((lang==='en'?'Restore all failed: ':'全部还原失败：')+err.message);}
}
// 全部删除（清空回收站）：不可恢复，二次确认
async function iconMgrPurgeAll(){
  try{
    const items=await _iconTrashItems();
    if(!items.length){flashHint(lang==='en'?'Trash is empty':'回收站为空');return;}
    const ok=await uiConfirm(lang==='en'
      ?('Permanently delete all '+items.length+' icon(s) in Trash? This cannot be undone.')
      :('确定彻底删除回收站中的全部 '+items.length+' 个图标？该操作不可恢复。'),true);
    if(!ok)return;
    let done=0,fail=0;
    for(const it of items){
      try{
        const r=await fetch('api/icon-trash/'+encodeURIComponent(it.type),{method:'DELETE'});
        const j=await r.json().catch(()=>({}));
        if(r.ok&&j.ok)done++;else fail++;
      }catch(_){fail++;}
    }
    renderIconManager();
    flashHint((lang==='en'?('Purged '+done+' icon(s)'):('已彻底删除 '+done+' 个图标'))
      +(fail?(lang==='en'?(', '+fail+' failed'):('，'+fail+' 个失败')):''));
  }catch(err){flashHint((lang==='en'?'Purge all failed: ':'全部删除失败：')+err.message);}
}
// ── 导出全部图标：全部图片 + index.json 打包 ZIP（备份/迁移；解压回 icons/ 目录即还原）──
async function iconMgrExportAll(){
  try{
    const r=await fetch(ICON_BASE+'index.json',{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const manifest=await r.json();
    const files=[{name:'index.json',data:strToBytes(JSON.stringify(manifest,null,2))}];
    const seen=new Set();let n=0;
    for(const g of (manifest.groups||[]))for(const d of (g.devices||[])){
      if(!d.file||seen.has(d.file))continue;seen.add(d.file);
      try{
        const ir=await fetch(ICON_BASE+d.file,{cache:'no-store'});
        if(!ir.ok)continue;
        files.push({name:d.file,data:new Uint8Array(await ir.arrayBuffer())});n++;
      }catch(_){/* 单个图片拉取失败跳过，不中断整体导出 */}
    }
    if(!n)throw new Error(lang==='en'?'no icons to export':'没有可导出的图标');
    const zip=makeZip(files);
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([zip],{type:'application/zip'}));
    const dt=new Date(),p=x=>String(x).padStart(2,'0');
    a.download='topo-icons-backup-'+dt.getFullYear()+p(dt.getMonth()+1)+p(dt.getDate())+'.zip';
    a.click();
    flashHint((lang==='en'?'Exported ':'已导出 ')+n+(lang==='en'?' icons + index.json':' 个图标 + index.json'));
  }catch(err){flashHint((lang==='en'?'Export failed: ':'导出失败：')+err.message);}
}
function onIconMgrFile(e){
  const f=e.target.files[0];e.target.value='';
  if(!f||!_mgrReplaceType)return;
  if(!checkIconFile(f)){_mgrReplaceType=null;return;}
  const type=_mgrReplaceType;_mgrReplaceType=null;
  const r=new FileReader();
  r.onload=async ev=>{
    try{
      await iconApiCall('PUT',type,{dataURL:ev.target.result});
      await reloadIconLibrary();renderIconManager();
      flashHint(lang==='en'?'Icon image replaced':'图标图片已替换');
    }catch(err){flashHint((lang==='en'?'Replace failed: ':'替换失败：')+err.message);}
  };
  r.readAsDataURL(f);
}
// ── 新增图标 / 新增分组：内联表单（在管理面板内，不弹独立遮罩对话框，管理面板全程不关闭/不被盖住） ──
let _addIconDataURL=null;
// 注意：函数名带 im 前缀，避免与 09-rules.js 的 _mkBtn(签名不同)在共享全局作用域下冲突
// 输入即清除该字段的校验态（红框 + 行内红字）——「必填/为空」提示实时消失，不必等到再次保存
function _imInput(ph){const i=document.createElement('input');i.placeholder=ph||'';i.addEventListener('input',()=>_imClear(i));return i;}
function _imBtn(cls,txt,fn){const b=document.createElement('button');b.className=cls;b.textContent=txt;b.onclick=fn;return b;}
function onIconAddFile(e){
  const f=e.target.files[0];e.target.value='';if(!f)return;
  if(!checkIconFile(f))return;
  const r=new FileReader();
  r.onload=ev=>{
    _addIconDataURL=ev.target.result;
    const prev=document.getElementById('im-add-prev');if(prev){prev.src=_addIconDataURL;prev.style.visibility='visible';}
    // 选好图片后，实时清除「请先选择图标图片」的行内提示
    const row=prev&&prev.closest('.im-addrow');const e2=row&&row.querySelector('.im-err');if(e2)e2.remove();
  };
  r.readAsDataURL(f);
}
async function submitAddIcon(zhI,enI,group){
  if(!_addIconDataURL){_imRowErr(_imRowOf(zhI),lang==='en'?'Please choose an image first':'请先选择图标图片');return;}
  const v=validateIconNames(zhI,enI,null);
  if(!v)return;
  const safe=v.en.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
  const tk='custom_'+(safe||('icon'+Date.now()));
  try{
    const res=await iconApiCall('POST',null,{type:tk,labelZh:v.zh,labelEn:v.en,dataURL:_addIconDataURL,group});
    // 用服务端返回的真实 type 高亮（type 冲突时服务端会改名，避免高亮失配）
    _iconMgrAdding=false;_addIconDataURL=null;_iconMgrFlash={type:(res&&res.type)||tk};
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Icon added':'图标已新增');
  }catch(err){flashHint((lang==='en'?'Add failed: ':'新增失败：')+err.message);}
}
async function submitAddGroup(zhI,enI){
  const v=validateGroupNames(zhI,enI,null);
  if(!v)return;
  try{
    await iconGroupApiCall('POST',null,{title:v.zh,title_en:v.en});
    _iconMgrAdding=false;_iconMgrFlash={title:v.zh};   // 新增后滚动到并高亮该分组
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Group added':'分组已新增');
  }catch(err){flashHint((lang==='en'?'Add group failed: ':'新增分组失败：')+err.message);}
}
// ── 分组：重命名 / 删除 ──
async function iconMgrRenameGroup(oldTitle,zhI,enI){
  const v=validateGroupNames(zhI,enI,oldTitle);
  if(!v)return;
  try{
    await iconGroupApiCall('PUT',oldTitle,{title:v.zh,title_en:v.en});
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Group saved':'分组已保存');
  }catch(err){flashHint((lang==='en'?'Save group failed: ':'保存分组失败：')+err.message);}
}
async function iconMgrDeleteGroup(title){
  const ok=await uiConfirm(lang==='en'
    ?('Delete group "'+title+'"? Its icons move to "Ungrouped".')
    :('确定删除分组「'+title+'」？组内图标会移动到「未分组」，不会丢失。'),true);
  if(!ok)return;
  try{
    await iconGroupApiCall('DELETE',title);
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Group deleted':'分组已删除');
  }catch(err){flashHint((lang==='en'?'Delete group failed: ':'删除分组失败：')+err.message);}
}

// 取某类型的图标 dataURL
function iconSrcOf(t){
  if(CUSTOM_ICONS[t]&&CUSTOM_ICONS[t].src) return CUSTOM_ICONS[t].src;
  if(IMG_DATA[t]) return IMG_DATA[t];
  if(IMGS[t]&&IMGS[t].src) return IMGS[t].src;
  return null;
}
// 根据 dataURL 或文件 URL 判断扩展名
function iconExt(src){
  if(!src) return 'png';
  if(src.indexOf('data:')===0){
    if(src.indexOf('image/svg')>=0) return 'svg';
    if(src.indexOf('image/jpeg')>=0||src.indexOf('image/jpg')>=0) return 'jpg';
    return 'png';
  }
  const m=src.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
  return m?m[1].toLowerCase():'png';
}
function iconFileName(t){
  if(ICON_FILE[t]) return ICON_FILE[t];                 // 图标库内置图标：用清单登记的真实文件名
  const src=iconSrcOf(t);return src?(t+'.'+iconExt(src)):null;
}
function usedTypeList(){return [...new Set(nodes.map(n=>n.type))];}

// 元素库版本号（后台维护，前后端共享同一套库时用它对齐）
const LIBRARY_VERSION='2.0.0';
const LIBRARY_NAME='energy-topology';


// ───── 值字典管理（菜单栏「📖 值字典」）：管理共享字典库，增删改落盘 value-dicts/*.json ─────
// 字典 = {type, name, nameEn, applyTo:[{deviceType, field:'location.field'}], items:[{code, zh, en}]}
//  · applyTo：字典「认领」的后台字段——画布字段/全局信号绑定了这些后台字段即自动转义（零配置）；
//  · items：code 码 → 中/英文案；显示语言随编辑器语言切换，en 缺失回退 zh，查不到回退原始值。
// 转义逻辑在 packages/topology-runtime（fieldDisplayValue），此处只管字典数据的增删改。
let _vdList=null,_vdEdit=null,_vdAdding=false;   // 服务端清单 / 展开编辑中的工作副本 / 新建表单是否展开
// 条件条目（when）可用比较算子（求值复用 TopoRules.cmpOp，与规则引擎同一实现）。
// 「其他(兜底)」是独立的条目类型（存储为 when:{op:'else'}）：任何未被之前条目命中的值都归入，无比较值，建议放最后
const VD_WHEN_OPS=[['>','>'],['>=','≥'],['<','<'],['<=','≤'],['==','='],['!=','≠'],['in','∈ 列表'],['between','∈ 区间']];
// 区间端点选项：含两端存纯 "a,b"（兼容旧数据），其余按括号写法存（"[a,b)"/"(a,b]"/"(a,b)"，cmpOp 按括号求值）
const VD_BETWEEN_BRS=[['[]','[a,b] 含两端'],['[)','[a,b) 含左'],['(]','(a,b] 含右'],['()','(a,b) 不含两端']];
function _vdParseBetween(val){
  const s=String(val==null?'':val).trim();
  if(s.length>1){
    const c0=s.charAt(0),c1=s.charAt(s.length-1);
    if((c0==='['||c0==='(')&&(c1===']'||c1===')'))return {br:c0+c1,body:s.slice(1,-1)};
  }
  return {br:'[]',body:s};
}
function _vdComposeBetween(br,body){
  const b=String(body||'').trim();
  if(!b)return '';                                  // 比较值未填 → 存空（校验会拦）
  return br==='[]'?b:(br.charAt(0)+b+br.charAt(1)); // 含两端存纯 a,b，其余带括号
}
// 条件条目「比较值」格式校验（与服务端 dict-store 一致）：> ≥ < ≤ 需数字；区间需两个数字；列表至少一个值；= ≠ 允许任意文本。
// 命中返回错误文案，合法返回 null。
function _vdWhenValError(op,val){
  if(op==='else')return null;   // 兜底条目无比较值
  if(!VD_WHEN_OPS.some(x=>x[0]===op))return '不支持的运算符「'+op+'」';   // 手改文件/导入的未知 op：与服务端白名单一致，拦下而非静默放行
  const s=String(val==null?'':val).trim();
  if(!s)return '比较值必填';
  const num=v=>/^-?\d+(\.\d+)?$/.test(String(v).trim());
  if(op==='>'||op==='>='||op==='<'||op==='<=')return num(s)?null:'阈值必须是数字';
  if(op==='between'){
    const body=_vdParseBetween(s).body;
    const parts=body.split(',').map(x=>x.trim()).filter(x=>x!=='');
    return (parts.length===2&&parts.every(num))?null:'区间需为两个数字（a,b）';
  }
  if(op==='in'){
    const parts=s.split(',').map(x=>x.trim()).filter(x=>x!=='');
    return parts.length?null:'列表至少填一个值（逗号分隔）';
  }
  return null;   // == / != 允许任意文本
}
function _vdOverlayEnsure(){
  if(document.getElementById('vdmgr-overlay'))return;
  const ov=document.createElement('div');ov.id='vdmgr-overlay';
  ov.innerHTML='<div id="vdmgr-box">'+
    '<div id="vdmgr-head"><h4 id="vdmgr-title">📖 值字典管理</h4>'+
    '<button class="tb" onclick="_vdRescan()" title="重新扫描 value-dicts/ 目录：手动增删改 JSON 文件后点此即时生效（画布同步刷新）">🔄 重新扫描</button>'+
    '<button class="tb" onclick="_vdImportClick()" title="导入字典 JSON（支持多选；单个字典对象 / 数组 / {dicts:[…]} 清单均可；同名 type 询问后覆盖）">📥 导入</button>'+
    '<button class="tb" onclick="_vdExportAll()" title="导出全部字典为一个 JSON（{dicts:[…]} 清单格式，可直接导入或拆放到 value-dicts/ 目录）">⬇ 导出全部</button>'+
    '<button class="tb grn" id="vdmgr-addbtn" onclick="_vdToggleAdd()">＋ 新建字典</button>'+
    '<button id="vdmgr-close" onclick="closeDictManager()" aria-label="关闭" title="关闭">✕</button></div>'+
    '<div class="phint" id="vdmgr-hint" style="margin:0 0 8px">字典把字段/信号的 code 码值转义成中英文案显示在画布上。在「适用后台字段」里认领后台字段后，绑定了该字段的画布元素自动生效；无后台绑定的字段可在字段行的 📖 按钮里手动指定。清单由服务端实时扫描 value-dicts/ 目录生成——手动增删改 JSON 文件后点「🔄 重新扫描」即生效。</div>'+
    '<div id="vdmgr-list"></div>'+
    '<input type="file" id="vd-import-fi" accept="application/json,.json" multiple style="display:none" onchange="_vdImportFiles(event)"></div>';
  ov.addEventListener('click',e=>{if(e.target===ov)closeDictManager();});
  document.body.appendChild(ov);
}
async function openDictManager(){
  _vdOverlayEnsure();
  document.getElementById('vdmgr-overlay').classList.add('show');
  document.getElementById('vdmgr-title').textContent=lang==='en'?'📖 Value Dictionaries':'📖 值字典管理';
  document.getElementById('vdmgr-list').innerHTML='<div class="tpl-empty">'+(lang==='en'?'Loading…':'加载中…')+'</div>';
  _vdEdit=null;_vdAdding=false;
  try{ await _vdFetch(); _vdRender(); }
  catch(err){
    console.warn('load value dicts failed',err);
    document.getElementById('vdmgr-list').innerHTML='<div class="tpl-empty" style="color:#ff7a6a">'+
      (lang==='en'?'Value dict API unavailable (needs dev/production server)':'值字典接口不可用（需 dev-server / 生产 server 提供 /api/value-dicts）')+'</div>';
  }
}
function closeDictManager(){const ov=document.getElementById('vdmgr-overlay');if(ov)ov.classList.remove('show');}
async function _vdFetch(){
  const r=await fetch(VD_API,{cache:'no-store'});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const m=await r.json();
  _vdList=(m&&Array.isArray(m.dicts))?m.dicts:[];
}
// 写操作后统一收尾：重拉清单 + 刷新画布用的共享库 + 重渲染
async function _vdAfterWrite(){ await _vdFetch(); await reloadValueDicts(); _vdRender(); }
function _vdApplySummary(d){
  const n=(d.applyTo||[]).length,m=(d.items||[]).length;
  return (n?('认领 '+n+' 个后台字段'):'未认领后台字段（仅可手动指定）')+' · '+m+' 个条目';
}
function _vdRender(){
  const list=document.getElementById('vdmgr-list');if(!list)return;
  let html='';
  // 新建表单
  if(_vdAdding){
    html+='<div class="vd-card vd-addcard"><div class="vd-row">'+
      '<input id="vd-new-type" placeholder="标识 type（英文/数字/_/-，唯一）" title="字典唯一标识，字段引用它；建议如 bms_status">'+
      '<input id="vd-new-name" placeholder="字典名（中文，必填）">'+
      '<input id="vd-new-nameen" placeholder="字典名（English，必填）">'+
      '<button class="tb grn" onclick="_vdCreate()">✓ 创建</button>'+
      '<button class="tb" onclick="_vdToggleAdd()">取消</button></div></div>';
  }
  if(!_vdList||!_vdList.length){
    html+='<div class="tpl-empty">'+(lang==='en'?'No value dicts yet — click ＋ to create one.':'暂无值字典。点右上「＋ 新建字典」创建；也可直接把字典 JSON 放入 value-dicts/ 目录。')+'</div>';
    list.innerHTML=html;return;
  }
  _vdList.forEach(d=>{
    const editing=_vdEdit&&_vdEdit.type===d.type;
    html+='<div class="vd-card'+(editing?' editing':'')+'">';
    html+='<div class="vd-row vd-head-row"><span class="vd-name">📖 '+tplEsc((d.name||d.type)+(d.nameEn?(' / '+d.nameEn):''))+
      ' <span class="vd-type">('+tplEsc(d.type)+')</span></span>'+
      '<span class="vd-sum">'+tplEsc(_vdApplySummary(d))+'</span>'+
      (editing?'':('<button class="tb" data-vdedit="'+tplEsc(d.type)+'">✎ 编辑</button>'))+
      '<button class="tb" data-vdexp="'+tplEsc(d.type)+'" title="导出该字典为 <type>.json（与 value-dicts/ 落盘文件同构，可直接放入目录或导入）">⬇</button>'+
      '<button class="tb red" data-vddel="'+tplEsc(d.type)+'">🗑 删除</button></div>';
    if(editing)html+=_vdEditorHTML();
    html+='</div>';
  });
  list.innerHTML=html;
  list.querySelectorAll('[data-vdedit]').forEach(b=>{b.onclick=()=>_vdExpand(b.getAttribute('data-vdedit'));});
  list.querySelectorAll('[data-vdexp]').forEach(b=>{b.onclick=()=>_vdExportOne(b.getAttribute('data-vdexp'));});
  list.querySelectorAll('[data-vddel]').forEach(b=>{b.onclick=()=>_vdDelete(b.getAttribute('data-vddel'));});
  if(_vdEdit)_vdBindEditor();
}
function _vdToggleAdd(){_vdAdding=!_vdAdding;_vdRender();if(_vdAdding){const t=document.getElementById('vd-new-type');if(t)t.focus();}}
async function _vdCreate(){
  const t=(document.getElementById('vd-new-type').value||'').trim();
  const zh=(document.getElementById('vd-new-name').value||'').trim();
  const en=(document.getElementById('vd-new-nameen').value||'').trim();
  if(!/^[a-zA-Z0-9_-]+$/.test(t)){flashHint('标识 type 必填，只能用 字母/数字/_/-');return;}
  if(!zh){flashHint('字典名（中文）必填');return;}
  if(!en){flashHint('字典名（English）必填');return;}
  try{
    const r=await fetch(VD_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:t,name:zh,nameEn:en,applyTo:[],items:[]})});
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||('HTTP '+r.status));}
    _vdAdding=false;
    await _vdAfterWrite();
    _vdExpand(t);                       // 建完直接展开编辑，接着配 applyTo / items
    flashHint('字典已创建：'+zh);
  }catch(err){console.warn(err);flashHint('创建失败：'+(err.message||err));}
}
function _vdExpand(type){
  const d=(_vdList||[]).find(x=>x.type===type);if(!d)return;
  _vdEdit=JSON.parse(JSON.stringify(d));   // 工作副本：保存(PUT)才生效，取消/切换即丢弃
  _vdEdit.applyTo=_vdEdit.applyTo||[];_vdEdit.items=_vdEdit.items||[];
  _vdRender();
}
async function _vdDelete(type){
  const d=(_vdList||[]).find(x=>x.type===type);if(!d)return;
  const ok=await uiConfirm('确定删除值字典「'+(d.name||d.type)+'」？引用它的字段将不再转义（回退显示原始 code）。',true);
  if(!ok)return;
  try{
    const r=await fetch(VD_API+'/'+encodeURIComponent(type),{method:'DELETE'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    if(_vdEdit&&_vdEdit.type===type)_vdEdit=null;
    await _vdAfterWrite();flashHint('已删除');
  }catch(err){console.warn(err);flashHint('删除失败：'+(err.message||err));}
}
// 展开的编辑器（工作副本 _vdEdit）：名称 + 适用后台字段(applyTo 级联) + code 条目表
function _vdEditorHTML(){
  const d=_vdEdit;
  let h='<div class="vd-editor">';
  h+='<div class="vd-row"><label class="vd-l">字典名</label><input id="vd-e-name" value="'+tplEsc(d.name||'')+'" placeholder="中文名（必填）">'+
     '<input id="vd-e-nameen" value="'+tplEsc(d.nameEn||'')+'" placeholder="English（必填）"></div>';
  // 适用后台字段（applyTo）：设备类型 → 分类 → 字段 级联；绑定了这些后台字段的画布字段/信号自动用本字典
  h+='<div class="vd-sec">适用后台字段（自动匹配）<span class="vd-secnote">绑定了这些后台字段的画布字段/全局信号将自动转义——多个字段是「码表相同、共用本表」，各自独立求值，不会相互比较；码表不同的字段请各建一张字典</span></div>';
  (d.applyTo||[]).forEach((a,i)=>{
    const p=String(a.field||'').split('.'),fld=p.pop()||'',loc=p.join('.');
    const dts=DEVICE_TYPES.map(t=>t.value);if(a.deviceType&&!dts.includes(a.deviceType))dts.push(a.deviceType);
    const locs=dictLocations(a.deviceType||'').slice();if(loc&&!locs.includes(loc))locs.push(loc);
    const flds=dictFields(a.deviceType||'',loc).slice();if(fld&&!flds.includes(fld))flds.push(fld);
    h+='<div class="vd-row vd-apply-row">'+
      '<select data-ap="'+i+'" data-k="deviceType">'+dts.map(v=>'<option value="'+tplEsc(v)+'"'+(v===(a.deviceType||'')?' selected':'')+'>'+tplEsc(deviceTypeLabel(v)||v)+'</option>').join('')+'</select>'+
      '<select data-ap="'+i+'" data-k="loc">'+(locs.length?locs.map(l=>'<option'+(l===loc?' selected':'')+'>'+tplEsc(l)+'</option>').join(''):'<option value="">该类型无字典</option>')+'</select>'+
      '<select data-ap="'+i+'" data-k="fld">'+(flds.length?flds.map(x=>'<option'+(x===fld?' selected':'')+'>'+tplEsc(x)+'</option>').join(''):'<option value="">无字段</option>')+'</select>'+
      '<button class="df-del" data-apdel="'+i+'" title="移除">✕</button></div>';
  });
  h+='<button class="tb" id="vd-e-addap">＋ 添加适用字段</button>';
  // 转义条目表：「code 等值」与「条件」（与常量比较/区间）两种条目可并存
  h+='<div class="vd-sec">转义条目<span class="vd-secnote">每个绑定字段拿「自己的当前值」独立查本表：code 按字符串精确匹配；条件=该值与常量比较/区间（in/between 逗号分隔）。求值顺序：code 精确匹配优先 → 条件按顺序首中即用 → 都不中原样显示。多个后台字段之间的计算/比较请在字段的 🔗 绑定里用「计算/比较」模式</span></div>';
  h+='<div class="vd-items-head"><span style="flex:0 0 74px">类型</span><span>code / 条件</span><span>中文文案</span><span>English</span><span></span></div>';
  (d.items||[]).forEach((it,i)=>{
    const isElse=!!(it.when&&it.when.op==='else');
    const isW=!!it.when&&!isElse;
    h+='<div class="vd-row vd-item-row">'+
      '<select data-it="'+i+'" data-k="_kind" style="flex:0 0 96px" title="code=等值精确匹配；条件=与常量比较/区间；其他=兜底，任何未命中的值归入">'+
        '<option value="code"'+((isW||isElse)?'':' selected')+'>code</option>'+
        '<option value="when"'+(isW?' selected':'')+'>条件</option>'+
        '<option value="else"'+(isElse?' selected':'')+'>其他(兜底)</option></select>';
    if(isElse){   // 兜底：无比较值——任何未被之前条目命中的值都显示本条文案
      h+='<input disabled value="" placeholder="任何未命中的值都归入本条（建议放最后）" style="opacity:.6;cursor:not-allowed">';
    }else if(isW){
      const op=(it.when&&it.when.op)||'>';
      h+='<select data-it="'+i+'" data-k="wop" style="flex:0 0 80px">'+
        VD_WHEN_OPS.map(([v,t])=>'<option value="'+v+'"'+(v===op?' selected':'')+'>'+t+'</option>').join('')+'</select>';
      if(op==='between'){   // 区间：端点是否包含（含两端/含左/含右/不含两端），输入框只填 a,b
        const pb=_vdParseBetween(it.when&&it.when.val);
        h+='<select data-it="'+i+'" data-k="wbr" style="flex:0 0 118px" title="区间端点是否包含（[ ]=含、( )=不含）">'+
          VD_BETWEEN_BRS.map(([v,t])=>'<option value="'+v+'"'+(v===pb.br?' selected':'')+'>'+t+'</option>').join('')+'</select>'+
          '<input data-it="'+i+'" data-k="wval" value="'+tplEsc(pb.body)+'" placeholder="a,b（必填）">';
      }else{
        h+='<input data-it="'+i+'" data-k="wval" value="'+tplEsc(it.when&&it.when.val!=null?String(it.when.val):'')+'" placeholder="'+(op==='in'?'值1,值2,…':'阈值（必填）')+'">';
      }
    }else{
      h+='<input data-it="'+i+'" data-k="code" value="'+tplEsc(it.code==null?'':String(it.code))+'" placeholder="如 0 / 1 / FAULT（必填）">';
    }
    h+='<input data-it="'+i+'" data-k="zh" value="'+tplEsc(it.zh||'')+'" placeholder="如 待机（必填）">'+
      '<input data-it="'+i+'" data-k="en" value="'+tplEsc(it.en||'')+'" placeholder="如 Standby（必填）">'+
      '<button class="df-del" data-itdel="'+i+'" title="删除条目">✕</button></div>';
  });
  h+='<button class="tb" id="vd-e-additem">＋ 添加条目</button>';
  h+='<div class="vd-row vd-save-row"><span style="flex:1"></span>'+
     '<button class="tb" id="vd-e-cancel">取消</button><button class="tb grn" id="vd-e-save">💾 保存字典</button></div>';
  return h+'</div>';
}
function _vdBindEditor(){
  const d=_vdEdit,box=document.querySelector('.vd-card.editing');if(!d||!box)return;
  box.querySelector('#vd-e-name').oninput=e=>{d.name=e.target.value;e.target.classList.remove('df-invalid');};
  box.querySelector('#vd-e-nameen').oninput=e=>{d.nameEn=e.target.value;e.target.classList.remove('df-invalid');};
  box.querySelectorAll('[data-ap]').forEach(sel=>{
    sel.onchange=()=>{
      const i=+sel.getAttribute('data-ap'),k=sel.getAttribute('data-k'),a=d.applyTo[i];if(!a)return;
      const p=String(a.field||'').split('.'),fld=p.pop()||'',loc=p.join('.');
      if(k==='deviceType'){a.deviceType=sel.value;const ls=dictLocations(a.deviceType);const nl=ls[0]||'';a.field=nl?(nl+'.'+(dictFields(a.deviceType,nl)[0]||'')):'';}
      else if(k==='loc'){const nl=sel.value;a.field=nl?(nl+'.'+(dictFields(a.deviceType,nl)[0]||'')):'';}
      else{a.field=(loc?loc+'.':'')+sel.value;}
      _vdRender();
    };
  });
  box.querySelectorAll('[data-apdel]').forEach(b=>{b.onclick=()=>{d.applyTo.splice(+b.getAttribute('data-apdel'),1);_vdRender();};});
  box.querySelector('#vd-e-addap').onclick=()=>{
    const dt=(DEVICE_TYPES[0]&&DEVICE_TYPES[0].value)||'';
    const loc=dictLocations(dt)[0]||'';
    d.applyTo.push({deviceType:dt,field:loc?(loc+'.'+(dictFields(dt,loc)[0]||'')):''});
    _vdRender();
  };
  box.querySelectorAll('[data-it]').forEach(inp=>{
    const k=inp.getAttribute('data-k');
    if(k==='_kind'){   // 条目类型切换：code 等值 / 条件 / 其他(兜底)（转换时清空另一形态的字段）
      inp.onchange=()=>{const i=+inp.getAttribute('data-it'),it=d.items[i];if(!it)return;
        if(inp.value==='when'){delete it.code;it.when={op:'>',val:''};}
        else if(inp.value==='else'){delete it.code;it.when={op:'else',val:''};}
        else{delete it.when;it.code='';}
        _vdRender();};
      return;
    }
    if(k==='wop'){
      inp.onchange=()=>{const i=+inp.getAttribute('data-it'),it=d.items[i];if(it&&it.when){
        // 切换运算符时把旧值归一成裸值（区间→其它运算符去掉括号），避免括号残留
        if(it.when.op==='between'&&inp.value!=='between')it.when.val=_vdParseBetween(it.when.val).body;
        it.when.op=inp.value;_vdRender();}};
      return;
    }
    if(k==='wbr'){   // 区间端点切换：按当前 a,b 重新拼写法（含两端存纯 a,b，其余带括号）
      inp.onchange=()=>{const i=+inp.getAttribute('data-it'),it=d.items[i];if(it&&it.when)it.when.val=_vdComposeBetween(inp.value,_vdParseBetween(it.when.val).body);};
      return;
    }
    inp.oninput=()=>{const i=+inp.getAttribute('data-it'),it=d.items[i];if(!it)return;
      if(k==='wval'){
        if(it.when){
          if(it.when.op==='between'){   // 区间：输入框只填 a,b，端点写法由同行 wbr 下拉拼出
            const br=document.querySelector('.vd-card.editing [data-it="'+i+'"][data-k="wbr"]');
            it.when.val=_vdComposeBetween(br?br.value:'[]',inp.value);
          }else it.when.val=inp.value;
        }
      }
      else it[k]=inp.value;
      inp.classList.remove('df-invalid');};
  });
  box.querySelectorAll('[data-itdel]').forEach(b=>{b.onclick=()=>{d.items.splice(+b.getAttribute('data-itdel'),1);_vdRender();};});
  box.querySelector('#vd-e-additem').onclick=()=>{d.items.push({code:'',zh:'',en:''});_vdRender();
    const rows=document.querySelectorAll('.vd-item-row');const last=rows[rows.length-1];if(last)last.querySelector('input').focus();};
  box.querySelector('#vd-e-cancel').onclick=()=>{_vdEdit=null;_vdRender();};
  box.querySelector('#vd-e-save').onclick=_vdSave;
}
// 保存前校验（与服务端校验一致）：字典名中/英文必填；
// code 条目：code/中文/英文均必填、code 在同字典 code 条目内唯一；条件条目：比较值/中文/英文均必填。
// 全空行（各内容项均空）视为「没填完的空白行」自动剔除，不算错误；有任一项内容的行必须补全。
function _vdItemBlank(it){
  const key=it.when?String(it.when.val==null?'':it.when.val):String(it.code==null?'':it.code);
  return key.trim()===''&&!String(it.zh||'').trim()&&!String(it.en||'').trim();
}
function _vdValidate(d){
  if(!String(d.name||'').trim())return '字典名（中文）必填';
  if(!String(d.nameEn||'').trim())return '字典名（English）必填';
  const rows=(d.items||[]).filter(it=>it&&!_vdItemBlank(it));
  const bad=[];
  rows.forEach((it,i)=>{
    const miss=[];
    if(it.when){ const e=_vdWhenValError(it.when.op||'>',it.when.val); if(e)miss.push(e); }
    else if(!String(it.code==null?'':it.code).trim())miss.push('缺 code');
    if(!String(it.zh||'').trim())miss.push('缺中文文案');
    if(!String(it.en||'').trim())miss.push('缺英文文案');
    if(miss.length)bad.push('第'+(i+1)+'条：'+miss.join('、'));
  });
  if(bad.length)return '转义条目不合法：'+bad.join('；');
  const codes=rows.filter(it=>!it.when).map(it=>String(it.code).trim());
  const dup=[...new Set(codes.filter((c,i)=>codes.indexOf(c)!==i))];
  if(dup.length)return 'code 重复：'+dup.join('、')+'（同一字典内 code 需唯一）';
  return null;
}
// 校验未过时给弹框里对应输入框标红（复用 .df-invalid 样式），便于定位
function _vdMarkInvalid(d){
  const box=document.querySelector('.vd-card.editing');if(!box)return;
  const mark=(el,bad)=>{if(el)el.classList.toggle('df-invalid',!!bad);};
  mark(box.querySelector('#vd-e-name'),!String(d.name||'').trim());
  mark(box.querySelector('#vd-e-nameen'),!String(d.nameEn||'').trim());
  const codeSeen={};
  (d.items||[]).forEach((it,i)=>{
    const zh=String(it.zh||'').trim(),en=String(it.en||'').trim();
    const blank=_vdItemBlank(it);   // 全空行不标红（保存时自动剔除）
    if(it.when){
      mark(box.querySelector('[data-it="'+i+'"][data-k="wval"]'),!blank&&!!_vdWhenValError(it.when.op||'>',it.when.val));
    }else{
      const code=String(it.code==null?'':it.code).trim();
      const dupC=code&&codeSeen[code];if(code)codeSeen[code]=1;
      mark(box.querySelector('[data-it="'+i+'"][data-k="code"]'),!blank&&(!code||dupC));
    }
    mark(box.querySelector('[data-it="'+i+'"][data-k="zh"]'),!blank&&!zh);
    mark(box.querySelector('[data-it="'+i+'"][data-k="en"]'),!blank&&!en);
  });
}
async function _vdSave(){
  const d=_vdEdit;if(!d)return;
  const err=_vdValidate(d);
  if(err){_vdMarkInvalid(d);flashHint(err);return;}
  _vdMarkInvalid(d);   // 清除历史标红
  const items=(d.items||[]).filter(it=>it&&!_vdItemBlank(it)).map(it=>it.when
    ?({when:{op:it.when.op||'>',val:String(it.when.val==null?'':it.when.val).trim()},zh:String(it.zh||'').trim(),en:String(it.en||'').trim()})
    :({code:String(it.code).trim(),zh:String(it.zh||'').trim(),en:String(it.en||'').trim()}));
  const applyTo=(d.applyTo||[]).filter(a=>a&&a.field&&a.field.indexOf('.')>0);
  try{
    const r=await fetch(VD_API+'/'+encodeURIComponent(d.type),{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:d.name.trim(),nameEn:d.nameEn.trim(),applyTo,items})});
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||('HTTP '+r.status));}
    _vdEdit=null;
    await _vdAfterWrite();
    flashHint('字典已保存（画布即时生效）');
  }catch(err){console.warn(err);flashHint('保存失败：'+(err.message||err));}
}

// ───── 值字典：导入 / 导出 / 目录重扫 ─────
// 导出格式与落盘/清单同构：单个={schemaVersion:'vd-1',type,...}；全部={schemaVersion:'vd-index-1',dicts:[...]}。
// 导入兼容三种形态（单个对象 / 数组 / {dicts:[…]} 清单），宽松归一化（nameEn←name、item.en←zh 兜底），
// 同名 type 统一询问一次后覆盖(PUT)，其余新建(POST)。清单由服务端实时扫描目录——手动改文件后「重新扫描」即生效。
function _vdDownload(name,obj){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));
  a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function _vdExportAll(){
  const dicts=(_vdList&&_vdList.length)?_vdList:effectiveValueDicts();
  if(!dicts.length){flashHint('暂无字典可导出');return;}
  _vdDownload('value-dicts.json',{schemaVersion:'vd-index-1',dicts});
  flashHint('已导出 '+dicts.length+' 个字典（value-dicts.json）');
}
function _vdExportOne(type){
  const d=((_vdList||[]).find(x=>x.type===type))||findValueDict(type);
  if(!d){flashHint('字典不存在：'+type);return;}
  _vdDownload(type+'.json',{schemaVersion:'vd-1',type:d.type,name:d.name||d.type,nameEn:d.nameEn||d.name||d.type,
    applyTo:d.applyTo||[],items:d.items||[]});
  flashHint('已导出：'+(d.name||type));
}
async function _vdRescan(){
  try{ await _vdFetch(); await reloadValueDicts(); _vdEdit=null; _vdRender();
    flashHint('值字典已重新扫描（'+(_vdList?_vdList.length:0)+' 个）——目录里手动增删改的 JSON 已生效'); }
  catch(err){ console.warn(err); flashHint('重新扫描失败：'+(err.message||err)); }
}
function _vdImportClick(){ const fi=document.getElementById('vd-import-fi'); if(fi){fi.value='';fi.click();} }
// 归一化一份待导入字典：type 合法化、名称/文案兜底（en←zh）、剔除无 code/条件残缺条目、同字典内 code 去重（保留先出现者）
function _vdNormalizeImport(o){
  if(!o||typeof o!=='object')return null;
  const type=String(o.type||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64);
  if(!type)return null;
  const name=String(o.name||type).trim()||type;
  const nameEn=String(o.nameEn||name).trim()||name;
  const seen=new Set(),items=[];
  const wopSet=new Set(VD_WHEN_OPS.map(x=>x[0]).concat(['else']));   // 'else'=兜底条目（UI 里是独立条目类型）
  (Array.isArray(o.items)?o.items:[]).forEach(it=>{
    if(!it)return;
    const zh=String(it.zh||it.en||'').trim(),en=String(it.en||it.zh||'').trim();
    if(!zh&&!en)return;
    if(it.when&&it.when.op){   // 条件条目：op 需在白名单内、比较值需通过格式校验（数字阈值/两数区间/非空列表）
      const op=String(it.when.op);
      const val=String(it.when.val==null?'':it.when.val).trim();
      if(!wopSet.has(op)||_vdWhenValError(op,val))return;
      items.push({when:{op,val},zh:zh||en,en:en||zh});
      return;
    }
    if(it.code===undefined||it.code===null||String(it.code).trim()==='')return;
    const code=String(it.code).trim();
    if(seen.has(code))return;
    seen.add(code);
    items.push({code,zh:zh||en,en:en||zh});
  });
  const applyTo=(Array.isArray(o.applyTo)?o.applyTo:[]).filter(a=>a&&a.field&&String(a.field).indexOf('.')>0)
    .map(a=>({deviceType:String(a.deviceType||''),field:String(a.field)}));
  return {type,name,nameEn,applyTo,items};
}
async function _vdImportFiles(ev){
  const files=[...(ev.target.files||[])];
  if(!files.length)return;
  // 1) 解析全部文件 → 摊平成字典数组（兼容 单对象/数组/{dicts:[…]}）
  const incoming=[],bad=[];
  for(const f of files){
    let obj;
    try{ obj=JSON.parse(await f.text()); }
    catch(err){ bad.push(f.name+'（JSON 解析失败）'); continue; }
    const arr=Array.isArray(obj)?obj:(obj&&Array.isArray(obj.dicts))?obj.dicts:[obj];
    let ok=0;
    arr.forEach(o=>{const d=_vdNormalizeImport(o);if(d){incoming.push(d);ok++;}});
    if(!ok)bad.push(f.name+'（未识别出有效字典：需含 type 字段）');
  }
  if(!incoming.length){flashHint('导入失败：'+(bad.join('；')||'文件里没有有效字典'));return;}
  // 同批内同 type 去重（后出现覆盖先出现，便于「清单+单文件」混选时以单文件为准）
  const byType=new Map();incoming.forEach(d=>byType.set(d.type,d));
  const list=[...byType.values()];
  // 2) 与现有库比对：同名 type 统一询问一次是否覆盖
  try{ await _vdFetch(); }catch(err){ flashHint('值字典接口不可用，无法导入（需 dev/生产 server）'); return; }
  const existing=new Set((_vdList||[]).map(d=>d.type));
  const dup=list.filter(d=>existing.has(d.type));
  let overwrite=false;
  if(dup.length){
    overwrite=await uiConfirm('导入的 '+dup.length+' 个字典与现有同名（'+dup.map(d=>d.type).join('、')+'）。覆盖现有字典？（取消则跳过同名项，只导入新增）',false);
  }
  // 3) 逐个写入：同名→PUT 覆盖（或跳过），新增→POST
  let created=0,updated=0,skipped=0;const fails=[];
  for(const d of list){
    const isDup=existing.has(d.type);
    if(isDup&&!overwrite){skipped++;continue;}
    try{
      const r=isDup
        ?await fetch(VD_API+'/'+encodeURIComponent(d.type),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:d.name,nameEn:d.nameEn,applyTo:d.applyTo,items:d.items})})
        :await fetch(VD_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||('HTTP '+r.status));}
      isDup?updated++:created++;
    }catch(err){fails.push(d.type+'：'+(err.message||err));}
  }
  await _vdAfterWrite();
  let msg='导入完成：新增 '+created+'、覆盖 '+updated+(skipped?('、跳过同名 '+skipped):'');
  if(bad.length)msg+='；文件问题：'+bad.join('；');
  if(fails.length)msg+='；失败：'+fails.join('；');
  flashHint(msg);
}
