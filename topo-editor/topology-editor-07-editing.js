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
// 标签背景板颜色（用纯背景色不透明，彻底遮住下方连线，避免文字与线叠加）
function bgPlate(){
  return bgColor;
}

function selectNode(id){
  ensurePropsOpen();
  selNode=id;selEdge=null;const n=nodes.find(x=>x.id===id);if(!n){showPanel('none');return;}
  showPanel('node');
  document.getElementById('p-id').value=n.id;
  document.getElementById('p-label-zh').value=n.labelZh||n.label||'';
  document.getElementById('p-label-en').value=n.labelEn||'';
  document.getElementById('p-type').value=n.type;
  document.getElementById('p-fs').value=n.fontSize||14;document.getElementById('p-fs-v').textContent=n.fontSize||14;
  const sc=Math.round((n.scale||1)*100);document.getElementById('p-scale').value=sc;document.getElementById('p-scale-v').textContent=sc;
  document.getElementById('p-rot').value=n.rotation||0;document.getElementById('p-rot-v').textContent=n.rotation||0;
  document.getElementById('p-fc').value=n.fontColor||'#e8f4ff';document.getElementById('p-fc-hex').value=n.fontColor||'#e8f4ff';
  document.getElementById('p-x').textContent=n.x.toFixed(0);document.getElementById('p-y').textContent=n.y.toFixed(0);
  // 文本框 / 变量节点：隐藏类型/图标大小，数据字段走标准配置
  const isText=n.type==='text';
  const isVariable=n.type==='variable';
  const isTextBox=isText||isVariable;
  ['prow-type','prow-scale'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=isTextBox?'none':'';});
  // 图标规则：仅对「有图标」的设备节点开放（文本/变量无图标、占位点走独立绘制，均隐藏此入口）
  {const el=document.getElementById('prow-iconrule');if(el)el.style.display=(isTextBox||n.type==='anchor')?'none':'';}
  ['prow-data','prow-datasep'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='';});
  // 画布显示开关：反映当前节点的 hideLabel / hideFields
  const slEl=document.getElementById('p-show-label'),sfEl=document.getElementById('p-show-fields');
  if(slEl)slEl.checked=!n.hideLabel; if(sfEl)sfEl.checked=!n.hideFields;
  const slTxt=document.getElementById('p-show-label-text'),sfWrap=document.getElementById('p-show-fields-wrap');
  if(slTxt){slTxt.textContent=isTextBox?(lang==='en'?'Show Text':'显示文本'):(lang==='en'?'Show Name':'显示名称');slTxt.setAttribute('data-i18n',isTextBox?'显示文本':'显示名称');}
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
  const fsLabelTxt=isText?'文字字号':(isVariable?'标签(label)字号':'标签字号');
  document.getElementById('p-fs-label').innerHTML=fsLabelTxt+' <span id="p-fs-v">'+(n.fontSize||(isText?18:14))+'</span>px';
  document.getElementById('p-fc-label').textContent=isText?'文字颜色':(isVariable?'标签(label)颜色':'标签颜色');
  document.querySelector('#pnode .pr label').textContent=isText?'文本框 ID':(isVariable?'变量 ID':'节点 ID');
  // 盒子样式（背景/边框/圆角）：文本框 + 变量节点共用
  document.getElementById('text-style').style.display=isTextBox?'block':'none';
  if(isTextBox){
    document.getElementById('p-bg').value=(n.bg&&n.bg!=='none')?n.bg:'#102a52';
    document.getElementById('p-bg-hex').value=(n.bg&&n.bg!=='none')?n.bg:'';
    document.getElementById('p-border').value=n.border||'none';
    document.getElementById('p-border-color').value=n.borderColor||'#4dd0ff';
    document.getElementById('p-border-color-hex').value=n.borderColor||'#4dd0ff';
    document.getElementById('p-radius').value=n.radius!=null?n.radius:6;
    document.getElementById('p-radius-v').textContent=n.radius!=null?n.radius:6;
  }
  // 变量节点专属：排列方式 + label/value 字体属性
  document.getElementById('variable-style').style.display=isVariable?'block':'none';
  if(isVariable){
    document.getElementById('p-var-layout').value=(n.varLayout==='v'?'v':'h');
    document.getElementById('p-label-bold').checked=(n.labelBold!==false);
    const vfs=(n.valFontSize!=null?n.valFontSize:(n.fontSize||16));
    document.getElementById('p-val-fs').value=vfs;document.getElementById('p-val-fs-v').textContent=vfs;
    document.getElementById('p-val-color').value=n.valColor||'#4dd0ff';
    document.getElementById('p-val-color-hex').value=n.valColor||'#4dd0ff';
    document.getElementById('p-val-bold').checked=!!n.valBold;
  }
  renderNodeActionControls(n);
  renderDFs(n);
  refreshNodeRuleSummary(n);
  refreshNodeIconRuleSummary(n);
}
function applyTextStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const bgHex=document.getElementById('p-bg-hex').value.trim();
  const pick=document.getElementById('p-bg').value;
  if(bgHex){ n.bg=(/^#?[0-9a-fA-F]{6}$/.test(bgHex))?(bgHex[0]==='#'?bgHex:'#'+bgHex):pick; }
  else if(document.activeElement&&document.activeElement.id==='p-bg'){ n.bg=pick; document.getElementById('p-bg-hex').value=pick; }
  n.border=document.getElementById('p-border').value;
  n.borderColor=document.getElementById('p-border-color').value;
  const bch=document.getElementById('p-border-color-hex').value.trim();
  if(/^#?[0-9a-fA-F]{6}$/.test(bch)){n.borderColor=(bch[0]==='#'?bch:'#'+bch);document.getElementById('p-border-color').value=n.borderColor;}
  n.radius=parseInt(document.getElementById('p-radius').value);
  document.getElementById('p-radius-v').textContent=n.radius;
}
function clearTextBg(){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.bg='none';document.getElementById('p-bg-hex').value='';}
// 变量节点：排列方式 + label/value 字体属性（label 复用 p-fs/p-fc/p-label-bold，value 用 p-val-*）
function applyVarStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n||n.type!=='variable')return;
  n.varLayout=document.getElementById('p-var-layout').value==='v'?'v':'h';
  n.labelBold=document.getElementById('p-label-bold').checked;
  n.valFontSize=parseInt(document.getElementById('p-val-fs').value);
  document.getElementById('p-val-fs-v').textContent=n.valFontSize;
  n.valBold=document.getElementById('p-val-bold').checked;
  const pick=document.getElementById('p-val-color').value;
  const hex=document.getElementById('p-val-color-hex').value.trim();
  if(/^#?[0-9a-fA-F]{6}$/.test(hex)){n.valColor=(hex[0]==='#'?hex:'#'+hex);document.getElementById('p-val-color').value=n.valColor;}
  else if(document.activeElement&&document.activeElement.id==='p-val-color'){n.valColor=pick;document.getElementById('p-val-color-hex').value=pick;}
}
function syncVarColor(v){if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById('p-val-color').value=v;applyVarStyle();}}
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
  const hex=document.getElementById('p-anchor-fill-hex').value.trim();
  const pick=document.getElementById('p-anchor-fill').value;
  if(/^#?[0-9a-fA-F]{6}$/.test(hex)){ n.fill=(hex[0]==='#'?hex:'#'+hex); document.getElementById('p-anchor-fill').value=n.fill; }
  else if(document.activeElement&&document.activeElement.id==='p-anchor-fill'){ n.fill=pick; document.getElementById('p-anchor-fill-hex').value=pick; }
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
  document.getElementById('ep-dir').value=e.dir||'forward';document.getElementById('ep-lbl').value=e.lbl||'';
  document.getElementById('ep-w').value=e.w||1;document.getElementById('ep-w-v').textContent=(e.w||1).toFixed(1);
  const cfg=edgeCfg(e);
  document.getElementById('ep-color').value=cfg.color;
  document.getElementById('ep-color-hex').value=e.lineColor||'';
  document.getElementById('ep-style').value=e.lineStyle||'inherit';
  document.getElementById('ep-showlbl').checked=!e.hideLabel;
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
  n.fontSize=parseInt(document.getElementById('p-fs').value);document.getElementById('p-fs-v').textContent=n.fontSize;
  n.scale=parseInt(document.getElementById('p-scale').value)/100;document.getElementById('p-scale-v').textContent=Math.round(n.scale*100);
  n.rotation=parseInt(document.getElementById('p-rot').value);document.getElementById('p-rot-v').textContent=n.rotation;
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
  selEdge.dir=document.getElementById('ep-dir').value;selEdge.lbl=document.getElementById('ep-lbl').value;
  selEdge.w=parseFloat(document.getElementById('ep-w').value);document.getElementById('ep-w-v').textContent=selEdge.w.toFixed(1);
  const pick=document.getElementById('ep-color').value;
  const hex=normHex(document.getElementById('ep-color-hex').value);
  if(hex){selEdge.lineColor=hex;document.getElementById('ep-color').value=hex;}
  else if(document.activeElement&&document.activeElement.id==='ep-color'){selEdge.lineColor=pick;document.getElementById('ep-color-hex').value=pick;}
  else if(!document.getElementById('ep-color-hex').value.trim())delete selEdge.lineColor;
  selEdge.lineStyle=document.getElementById('ep-style').value;
  if(selEdge.lineStyle==='inherit')delete selEdge.lineStyle;
  selEdge.hideLabel=!document.getElementById('ep-showlbl').checked;
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
    const bound=!!(f.bind&&f.bind.field);
    const iss=_issues[i]||{};
    const zhBad=iss.emptyZh||iss.dupZh, enBad=iss.emptyEn||iss.dupEn;
    const zhTip=iss.dupZh?'中文名重复（同节点内需唯一）':'中文字段名（必填）';
    const enTip=iss.dupEn?'英文名重复（同节点内需唯一·作信号键会冲突）':'英文名（必填·作端到端信号键）';
    html+='<input class="df-zh-in'+(zhBad?' df-invalid':'')+'" value="'+tplEsc(f.key||'')+'" placeholder="中文字段名(必填)" title="'+zhTip+'" oninput="updDF('+i+',\'key\',this.value,this)">'+
      '<input class="df-en-in'+(enBad?' df-invalid':'')+'" value="'+tplEsc(f.keyEn||'')+'" placeholder="英文名(必填)" title="'+enTip+'" oninput="updDF('+i+',\'keyEn\',this.value,this)">'+
      '<input class="df-val-in" value="'+tplEsc(dvVal)+'" placeholder="--" title="默认值（可留空）" oninput="updDFVal('+i+',this.value)">'+
      '<span class="df-acts">'+
        '<button class="df-bind'+(bound?' bound':'')+'" onclick="openFieldBind('+i+')" title="'+(bound?'已绑定后台字段，点击修改':'绑定后台字段')+'">🔗</button>'+
        '<button class="df-del" onclick="rmDF('+i+')" title="删除字段">✕</button>'+
      '</span>';
    // 已绑定 → 整行(跨全部列)紧贴显示来源（前缀字段名，杜绝歧义）+ ✕ 快速清除
    if(bound){
      const noInst=!(f.bind.deviceId||n.deviceId);
      html+='<div class="df-bindline'+(noInst?' warn':'')+'">'+
        '<span class="df-bindsum" onclick="openFieldBind('+i+')" title="点击编辑绑定">↳ '+tplEsc((f.key||('字段'+(i+1)))+'  ←  '+fieldBindSummary(n,f))+'</span>'+
        '<button class="df-bindclr" onclick="clearFieldBind('+i+')" title="清除此字段的绑定">✕</button></div>';
    }
  });
  c.innerHTML=html;
  refreshDeviceBindUI(n);
  // 文本框 / 变量节点：画布上只显示「第一个字段」，因此绑定限制为单个字段，避免绑定多个却只显示一个造成误解
  const single=usesTextBox(n.type);
  const lbl=document.getElementById('prow-data-label'),btn=document.getElementById('btn-add-df'),hint=document.getElementById('prow-data-hint');
  if(lbl)lbl.textContent=single?(n.type==='variable'?'绑定数据（值，仅一个字段）':'绑定数据（仅一个字段）'):'数据字段';
  if(btn)btn.style.display=(single&&(n.data||[]).length>=1)?'none':'';
  if(hint){if(single){hint.style.display='';hint.textContent=(n.type==='variable'?'变量只显示一个值：此字段即「value」，可填默认值或由实时数据绑定覆盖。':'文本框只显示一个绑定值，故仅允许绑定一个数据字段。');}else hint.style.display='none';}
}
function addDF(){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.data=n.data||[];
  // 文本框 / 变量节点：只允许绑定一个字段
  if(usesTextBox(n.type)&&n.data.length>=1){flashHint(n.type==='variable'?'变量只能绑定一个值字段':'文本框只能绑定一个数据字段');return;}
  // 已有字段名不完整/重复时，先修正再加新字段（避免堆积非法字段）
  if(nodeHasFieldNameError(n)){flashHint(lang==='en'?'Fix existing field names (required & unique) before adding':'请先补全/修正现有字段的中英文名（必填且不可重复），再添加新字段');return;}
  // 新增一条「空」字段：中文名/英文名都留空由用户填写（必填校验会即时标红），不做默认填充
  n.data.push({key:'',keyEn:'',dv:''});renderDFs(n);
  const zhs=document.querySelectorAll('#dfields .df-zh-in');const last=zhs[zhs.length-1];if(last)last.focus();}

// ───── 后台数据绑定 UI ─────
// 节点级「设备类型 + 设备实例」下拉（该节点字段的默认来源）
function refreshDeviceBindUI(n){
  const sec=document.getElementById('prow-devbind'),sep=document.getElementById('prow-devbind-sep');
  if(!sec)return;
  const show=n&&n.type!=='anchor';   // 占位点无数据，不显示绑定
  sec.style.display=show?'':'none'; if(sep)sep.style.display=show?'':'none';
  if(!show)return;
  const tSel=document.getElementById('p-dev-type'),iSel=document.getElementById('p-dev-id');
  const dt=nodeDeviceType(n);
  tSel.innerHTML='<option value="">（未指定）</option>'+DEVICE_TYPES.map(t=>'<option value="'+tplEsc(t.value)+'"'+(t.value===dt?' selected':'')+'>'+tplEsc(t.label)+'</option>').join('');
  const list=devicesOfType(dt);
  iSel.innerHTML='<option value="">（未指定实例）</option>'+list.map(d=>'<option value="'+tplEsc(d.deviceId)+'"'+(d.deviceId===n.deviceId?' selected':'')+'>'+tplEsc(d.deviceName+(d.projectName?(' · '+d.projectName):''))+'</option>').join('');
  const hint=document.getElementById('p-dev-hint');
  if(hint){
    if(!DEVICE_TYPES.length){hint.textContent='未加载到后台设备类型，请确认 device/ 与 dic/ 已就绪并重启服务后点 🔄 刷新。';hint.style.color='#e0a020';}
    else if(dt&&!n.deviceId){hint.textContent='⚠ 已选设备类型但未指定「设备实例」——跟随本节点的字段将无法关联到具体后台设备，请选择实例。';hint.style.color='#e0a020';}
    else {hint.textContent='该节点默认对应的后台设备；下方字段未单独指定来源时即取此设备。';hint.style.color='';}
  }
}
function applyDeviceBind(typeChanged){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;snapshot();
  const dt=document.getElementById('p-dev-type').value;
  n.deviceType=dt||''; if(!n.deviceType)delete n.deviceType;
  if(typeChanged){ delete n.deviceId; }   // 改类型 → 实例需重选
  else { const did=document.getElementById('p-dev-id').value; n.deviceId=did||''; if(!n.deviceId)delete n.deviceId; }
  refreshDeviceBindUI(n); renderDFs(n); snapshot();
}
// 某字段绑定的可读摘要：跨设备时加 ⮕ 标记
function fieldBindSummary(n,f){
  if(!f.bind||!f.bind.field)return '';
  const dt=f.bind.deviceType||nodeDeviceType(n);
  const did=f.bind.deviceId||n.deviceId||'';
  const cross=(f.bind.deviceType&&f.bind.deviceType!==nodeDeviceType(n))||(f.bind.deviceId&&f.bind.deviceId!==(n.deviceId||''));
  if(!did)  // 没解析到设备实例 → 绑定不完整，明确提示
    return '⚠ 未指定设备实例 · '+(dt?deviceTypeLabel(dt)+'·':'')+f.bind.field;
  return (cross?'⮕ ':'')+(dt?deviceTypeLabel(dt)+'·':'')+deviceNameOf(did)+' / '+f.bind.field;
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
  const ov=document.createElement('div');ov.id='fb-overlay';ov.onclick=e=>{if(e.target===ov)closeFieldBind();};
  // 设备选项：空=跟随本节点；否则具体设备(携带其 deviceType)
  const followLbl=n.deviceId?deviceNameOf(n.deviceId):(nodeDeviceType(n)?('⚠ 未指定实例·'+deviceTypeLabel(nodeDeviceType(n))):'⚠ 未指定设备');
  const devOpts=['<option value="">跟随本节点：'+tplEsc(followLbl)+'</option>']
    .concat(DEVICE_LIST.map(d=>{const sel=(b.deviceId===d.deviceId)?' selected':'';return '<option value="'+tplEsc(d.deviceId)+'" data-dt="'+tplEsc(d.deviceType)+'"'+sel+'>'+tplEsc(deviceTypeLabel(d.deviceType)+' · '+d.deviceName+(d.projectName?(' · '+d.projectName):''))+'</option>';}));
  ov.innerHTML='<div id="fb-box"><button class="dlg-close" onclick="closeFieldBind()" title="关闭" aria-label="关闭">✕</button><div id="fb-title">绑定后台字段：'+tplEsc(f.key||('字段'+(i+1)))+'</div>'+
    '<label class="fb-l">来源设备</label><select id="fb-dev">'+devOpts.join('')+'</select>'+
    '<label class="fb-l">分类(location)</label><select id="fb-loc"></select>'+
    '<label class="fb-l">字段(field)</label><select id="fb-field"></select>'+
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
  // 无法解析设备实例 → 禁用分类/字段/确定，避免存下无法关联后台的"残缺绑定"
  const updateGate=()=>{
    const ok=resolvable();
    ['fb-loc','fb-field'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!ok;});
    const cb=document.getElementById('fb-confirm');if(cb){cb.disabled=!ok;cb.style.opacity=ok?'':'.45';cb.style.cursor=ok?'':'not-allowed';}
    const h=document.getElementById('fb-hint');
    if(!ok){h.textContent='⚠ 未确定设备实例：请在上方为本节点选「设备实例」，或在此「来源设备」直接选择具体设备，否则无法绑定。';h.style.color='#e0a020';}
    else{const dt=effType();h.textContent='字典：'+(dt?deviceTypeLabel(dt):'—')+'（'+dictLocations(dt).length+' 个分类）';h.style.color='';}
  };
  // 解析当前 bind 的初值
  let curLoc='',curField='';
  if(b.field){const p=String(b.field).split('.');curField=p.pop();curLoc=p.join('.');}
  document.getElementById('fb-dev').onchange=()=>fillLoc('','');
  document.getElementById('fb-loc').onchange=()=>{fillField('');};
  fillLoc(curLoc,curField);
}
function closeFieldBind(){const ov=document.getElementById('fb-overlay');if(ov)ov.remove();}
function clearFieldBind(i){const n=nodes.find(x=>x.id===selNode);if(!n)return;const f=(n.data||[])[i];if(f){snapshot();delete f.bind;snapshot();}closeFieldBind();renderDFs(n);}
function confirmFieldBind(i){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;const f=(n.data||[])[i];if(!f)return;
  const devSel=document.getElementById('fb-dev'),loc=document.getElementById('fb-loc').value,field=document.getElementById('fb-field').value;
  if(!devSel.value&&!n.deviceId){flashHint('请先确定设备实例：为本节点选「设备实例」或在弹窗里选具体来源设备');return;}  // 无实例不允许保存
  if(!loc||!field){flashHint('请选择分类与字段');return;}
  snapshot();
  const o=devSel.selectedOptions[0],did=devSel.value,dt=o&&o.getAttribute('data-dt');
  const bind={field:loc+'.'+field};
  if(did){ bind.deviceId=did; if(dt)bind.deviceType=dt; }   // 指定了具体设备 → 跨设备/显式来源
  f.bind=bind;
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
  const ov=document.createElement('div');ov.id='fb-overlay';ov.onclick=e=>{if(e.target===ov)closeFieldBind();};
  const devOpts=['<option value="">请选择设备实例</option>']
    .concat(DEVICE_LIST.map(d=>{const sel=(b.deviceId===d.deviceId)?' selected':'';return '<option value="'+tplEsc(d.deviceId)+'" data-dt="'+tplEsc(d.deviceType)+'"'+sel+'>'+tplEsc(deviceTypeLabel(d.deviceType)+' · '+d.deviceName+(d.projectName?(' · '+d.projectName):''))+'</option>';}));
  ov.innerHTML='<div id="fb-box"><button class="dlg-close" onclick="closeFieldBind()" title="关闭" aria-label="关闭">✕</button><div id="fb-title">绑定后台字段（全局信号）：'+tplEsc(sigDisplayName(s)||('信号'+(idx+1)))+'</div>'+
    '<label class="fb-l">来源设备</label><select id="fb-dev">'+devOpts.join('')+'</select>'+
    '<label class="fb-l">分类(location)</label><select id="fb-loc"></select>'+
    '<label class="fb-l">字段(field)</label><select id="fb-field"></select>'+
    '<div id="fb-acts"><button class="tb" onclick="clearGlobalBind('+idx+')">清除绑定</button><span style="flex:1"></span>'+
    '<button class="tb" onclick="closeFieldBind()">取消</button><button class="tb grn" id="fb-confirm" onclick="confirmGlobalBind('+idx+')">确定</button></div>'+
    '<div class="phint" id="fb-hint" style="margin-top:6px"></div></div>';
  document.body.appendChild(ov);
  const effType=()=>{const o=document.getElementById('fb-dev').selectedOptions[0];return (o&&o.getAttribute('data-dt'))||'';};
  const resolvable=()=>!!document.getElementById('fb-dev').value;
  const fillField=(curField)=>{const dt=effType();const loc=document.getElementById('fb-loc').value;const fields=dictFields(dt,loc);
    document.getElementById('fb-field').innerHTML=fields.length?fields.map(x=>'<option'+(x===curField?' selected':'')+'>'+tplEsc(x)+'</option>').join(''):'<option value="">无字段</option>';};
  const updateGate=()=>{const ok=resolvable();['fb-loc','fb-field'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!ok;});
    const cb=document.getElementById('fb-confirm');if(cb){cb.disabled=!ok;cb.style.opacity=ok?'':'.45';cb.style.cursor=ok?'':'not-allowed';}
    const h=document.getElementById('fb-hint');if(!ok){h.textContent='⚠ 请选择具体设备实例（全局信号无所属节点，必须指定来源设备）。';h.style.color='#e0a020';}
    else{const dt=effType();h.textContent='字典：'+(dt?deviceTypeLabel(dt):'—')+'（'+dictLocations(dt).length+' 个分类）';h.style.color='';}};
  const fillLoc=(curLoc,curField)=>{const dt=effType();const locs=dictLocations(dt);const loc=document.getElementById('fb-loc');
    loc.innerHTML=locs.length?locs.map(l=>'<option'+(l===curLoc?' selected':'')+'>'+tplEsc(l)+'</option>').join(''):'<option value="">该类型无字典</option>';
    fillField(curField);updateGate();};
  let curLoc='',curField='';if(b.field){const p=String(b.field).split('.');curField=p.pop();curLoc=p.join('.');}
  document.getElementById('fb-dev').onchange=()=>fillLoc('','');
  document.getElementById('fb-loc').onchange=()=>fillField('');
  fillLoc(curLoc,curField);
}
function clearGlobalBind(idx){const s=(customSignals||[])[idx];if(s)delete s.bind;closeFieldBind();renderCustomSignals();invalidateRouting();}
function confirmGlobalBind(idx){
  const s=(customSignals||[])[idx];if(!s)return;
  const devSel=document.getElementById('fb-dev'),loc=document.getElementById('fb-loc').value,field=document.getElementById('fb-field').value;
  if(!devSel.value){flashHint('请选择具体设备实例（全局信号必须指定来源设备）');return;}
  if(!loc||!field){flashHint('请选择分类与字段');return;}
  const o=devSel.selectedOptions[0],did=devSel.value,dt=o&&o.getAttribute('data-dt');
  s.bind={field:loc+'.'+field, deviceId:did, deviceType:dt||''};
  closeFieldBind();renderCustomSignals();invalidateRouting();
}
function resetRotation(){const n=nodes.find(x=>x.id===selNode);if(!n)return;snapshot();n.rotation=0;document.getElementById('p-rot').value=0;document.getElementById('p-rot-v').textContent=0;snapshot();}
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
  const cfs=(n.fontSize||14)*0.92/zoom;
  const connDirs=connDirsOf(n);
  const step=((n.fontSize||14)+18)/zoom; const chipW=130/zoom, chipH=step; // 估算卡片尺寸（屏幕固定）
  // 8 个候选方向（右、右下、下、左下、左、左上、上、右上）
  const slots=[0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, -3*Math.PI/4, -Math.PI/2, -Math.PI/4];
  const radius=s*0.55+cfs*1.6;
  // 收集障碍：其它节点盒 + 其它节点已放置的字段卡片
  const obstacles=[];
  nodes.forEach(o=>{ if(o.id===n.id)return; const b=nodeBox(o); obstacles.push({l:b.left-10,r:b.right+10,t:b.top-10,b:b.bottom+10});
    if(o.data) o.data.forEach((f,i)=>{ const os=nsz(o); const bx=o.x+os*0.5+12/zoom+(f.ox||0)/zoom, by=o.y-os*0.40+i*(((o.fontSize||14)+18)/zoom)+(f.oy||0)/zoom; obstacles.push({l:bx-6,r:bx+chipW+6,t:by-6,b:by+chipH+6}); });
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
function deleteSelected(){if(selNode){snapshot();nodes=nodes.filter(n=>n.id!==selNode);edges=edges.filter(e=>e.from!==selNode&&e.to!==selNode);selNode=null;snapshot();}else if(selEdge){snapshot();edges=edges.filter(e=>e!==selEdge);selEdge=null;snapshot();}showPanel('none');}
// ───── 复制 / 粘贴（含数据字段整体复制）─────
let clipboard=null;
function cleanNodeForCopy(n){
  // 深拷贝节点，剔除运行时缓存字段（_textBox/_chipBox/_resizeHandle 等）
  const c=JSON.parse(JSON.stringify(n));
  delete c._textBox;delete c._chipBox;delete c._resizeHandle;delete c._rotHandle;
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
    const step=((n.fontSize||14)+18);
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

function closeBgPanel(){const p=document.getElementById('bgpanel'),ov=document.getElementById('bgpanel-overlay');if(p)p.classList.remove('show');if(ov)ov.classList.remove('show');}
function toggleBgPanel(){
  const p=document.getElementById('bgpanel');const ov=document.getElementById('bgpanel-overlay');const show=!p.classList.contains('show');
  if(show)setSigPanel(false);
  p.classList.toggle('show',show);ov.classList.toggle('show',show);
}
function setBg(c){bgColor=c;document.documentElement.style.setProperty('--bg',c);const h=document.getElementById('bg-hex');if(h)h.value=c;const p=document.getElementById('bg-pick');if(p&&/^#[0-9a-fA-F]{6}$/.test(c))p.value=c;document.querySelectorAll('.cp').forEach(el=>el.classList.toggle('active',el.dataset.color===c));}
function applyBgHex(){let v=document.getElementById('bg-hex').value.trim();if(v&&v[0]!=='#')v='#'+v;if(/^#[0-9a-fA-F]{3,6}$/.test(v))setBg(v);else alert('请输入有效色值，如 #0a1f40');}
// 全局字体：一键应用到所有节点
document.getElementById('gf-color').addEventListener('input',e=>{document.getElementById('gf-color-hex').value=e.target.value;});
function applyGlobalFont(){
  if(nodes.length===0){alert('画布暂无节点');return;}
  const fs=parseInt(document.getElementById('gf-size').value);
  const fc=document.getElementById('gf-color').value;
  snapshot();
  nodes.forEach(n=>{n.fontSize=fs;n.fontColor=fc;});
  snapshot();
  // 若当前选中节点，刷新属性面板
  if(selNode)selectNode(selNode);
}
document.getElementById('bg-hex').addEventListener('keydown',e=>{if(e.key==='Enter')applyBgHex();});

const dz=document.getElementById('dz');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');if(e.dataTransfer.files[0])readFile(e.dataTransfer.files[0]);});
function onFile(e){if(e.target.files[0])readFile(e.target.files[0]);}
function readFile(file){const r=new FileReader();r.onload=ev=>{pendingDataURL=ev.target.result;const p=document.getElementById('upv');p.src=pendingDataURL;p.style.display='block';if(!document.getElementById('un').value)document.getElementById('un').value=file.name.replace(/\.[^.]+$/,'');};r.readAsDataURL(file);}
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
function openIconManager(){
  document.getElementById('iconmgr-overlay').classList.add('show');
  const en=lang==='en';
  document.getElementById('iconmgr-title').textContent=en?'🗂 Icon Library Manager':'🗂 图标库管理';
  document.getElementById('iconmgr-add').textContent=en?'＋ Add Icon':'＋ 新增图标';
  document.getElementById('iconmgr-addgroup').textContent=en?'＋ Add Group':'＋ 新增分组';
  document.getElementById('iconmgr-hint').textContent=en
    ?'Changes are saved to the server icons/ folder and manifest, then rescanned live — no page refresh. Images dropped into icons/ manually appear under "Ungrouped".'
    :'增删改会保存到服务器 icons/ 目录并同步清单，操作后自动重扫图标库，左栏与画布即时生效，刷新页面不丢失。手动放入 icons/ 的图片自动进入「未分组」。';
  renderIconManager();
}
function closeIconManager(){document.getElementById('iconmgr-overlay').classList.remove('show');}
function renderIconManager(){
  const list=document.getElementById('iconmgr-list');list.innerHTML='';
  const en=lang==='en';
  const bust=_iconBust?('?v='+_iconBust):'';
  // ── 分组管理区：每个分组可改名(中/英)、删除（组内图标移到「未分组」） ──
  const gsec=document.createElement('div');gsec.className='im-groupmgr';
  const gh=document.createElement('div');gh.className='im-group';gh.textContent=en?'Groups':'分组管理';gsec.appendChild(gh);
  DEVICE_GROUPS.forEach(g=>{
    const row=document.createElement('div');row.className='im-grow';
    const dot=document.createElement('span');dot.className='im-dot';dot.style.background=g.color||'#8aa8c4';
    const zhI=document.createElement('input');zhI.value=g.title||'';zhI.placeholder=en?'Group name':'分组名称';
    const enI=document.createElement('input');enI.value=g.title_en||'';enI.placeholder=en?'English name':'英文名称';
    const cnt=document.createElement('span');cnt.className='im-gcount';cnt.textContent='×'+((g.devices||[]).length);
    const save=document.createElement('button');save.className='im-btn';save.textContent=en?'💾 Save':'💾 保存';
    save.onclick=()=>iconMgrRenameGroup(g.title,zhI.value.trim(),enI.value.trim());
    const del=document.createElement('button');del.className='im-btn im-del';del.textContent=en?'🗑 Delete':'🗑 删除';
    del.disabled=(g.title==='未分组');
    del.title=en?'Delete group (icons move to Ungrouped)':'删除分组（组内图标移到未分组）';
    del.onclick=()=>iconMgrDeleteGroup(g.title);
    row.appendChild(dot);row.appendChild(zhI);row.appendChild(enI);row.appendChild(cnt);row.appendChild(save);row.appendChild(del);
    gsec.appendChild(row);
  });
  list.appendChild(gsec);
  // ── 图标区：按分组列出「有图片」的图标（纯绘制元素文本框/变量/占位点无图片，不在此管理） ──
  let total=0;
  DEVICE_GROUPS.forEach(g=>{
    const devs=(g.devices||[]).filter(d=>d.file);
    if(!devs.length)return;
    total+=devs.length;
    const h=document.createElement('div');h.className='im-group';
    h.textContent=(en?(g.title_en||g.title):g.title)+'（'+devs.length+'）';
    list.appendChild(h);
    devs.forEach(d=>{
      const row=document.createElement('div');row.className='im-row';
      const img=document.createElement('img');img.className='im-icon';img.src=ICON_BASE+d.file+bust;img.alt=d.type;
      const tp=document.createElement('div');tp.className='im-type';tp.textContent=d.type;tp.title=(en?'File: ':'文件：')+d.file;
      const zhI=document.createElement('input');zhI.value=d.label||'';zhI.placeholder=en?'Chinese name':'中文名称';
      const enI=document.createElement('input');enI.value=d.label_en||'';enI.placeholder=en?'English name':'英文名称';
      const gsel=document.createElement('select');gsel.className='im-gsel';populateGroupSelect(gsel,g.title);
      gsel.title=en?'Move to group':'移动到分组';
      gsel.onchange=()=>iconMgrMove(d.type,gsel.value);
      const save=document.createElement('button');save.className='im-btn';save.textContent=en?'💾 Save':'💾 保存';
      save.title=en?'Save Chinese/English labels':'保存中/英文名称';
      save.onclick=()=>iconMgrRename(d.type,zhI.value.trim(),enI.value.trim());
      const rep=document.createElement('button');rep.className='im-btn';rep.textContent=en?'🔄 Replace':'🔄 替换';
      rep.title=en?'Replace the image file':'替换图标图片';
      rep.onclick=()=>{_mgrReplaceType=d.type;document.getElementById('im-fi').click();};
      const del=document.createElement('button');del.className='im-btn im-del';del.textContent=en?'🗑 Delete':'🗑 删除';
      del.title=en?'Delete this icon from the library':'从图标库删除该图标';
      del.onclick=()=>iconMgrDelete(d.type,en?(d.label_en||d.label):(d.label||d.label_en));
      row.appendChild(img);row.appendChild(tp);row.appendChild(zhI);row.appendChild(enI);
      row.appendChild(gsel);row.appendChild(save);row.appendChild(rep);row.appendChild(del);
      list.appendChild(row);
    });
  });
  if(!total){
    const empty=document.createElement('div');empty.className='im-empty';
    empty.textContent=en?'No image icons yet. Click "Add Icon" to upload.':'图标库暂无图片图标，点击「新增图标」上传。';
    list.appendChild(empty);
  }
}
async function iconMgrRename(type,zh,enName){
  if(!zh||!enName){alert(lang==='en'?'Please fill both Chinese and English names':'请同时填写中文和英文名称');return;}
  const dup=iconNameConflict(zh,enName,type);
  if(dup){alert(dup);return;}
  try{
    await iconApiCall('PUT',type,{labelZh:zh,labelEn:enName});
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Icon renamed':'图标名称已保存');
  }catch(err){alert((lang==='en'?'Save failed: ':'保存失败：')+err.message);}
}
async function iconMgrMove(type,group){
  try{
    await iconApiCall('PUT',type,{group});
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Moved to '+group:'已移动到「'+group+'」');
  }catch(err){alert((lang==='en'?'Move failed: ':'移动失败：')+err.message);}
}
async function iconMgrDelete(type,label){
  const ok=await uiConfirm(lang==='en'
    ?('Delete icon "'+(label||type)+'" from the library? Elements using it will show a placeholder.')
    :('确定从图标库删除「'+(label||type)+'」？画布中正在使用该图标的元素将显示占位框。'),true);
  if(!ok)return;
  try{
    await iconApiCall('DELETE',type);
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Icon deleted':'图标已删除');
  }catch(err){alert((lang==='en'?'Delete failed: ':'删除失败：')+err.message);}
}
function onIconMgrFile(e){
  const f=e.target.files[0];e.target.value='';
  if(!f||!_mgrReplaceType)return;
  const type=_mgrReplaceType;_mgrReplaceType=null;
  const r=new FileReader();
  r.onload=async ev=>{
    try{
      await iconApiCall('PUT',type,{dataURL:ev.target.result});
      await reloadIconLibrary();renderIconManager();
      flashHint(lang==='en'?'Icon image replaced':'图标图片已替换');
    }catch(err){alert((lang==='en'?'Replace failed: ':'替换失败：')+err.message);}
  };
  r.readAsDataURL(f);
}
// ── 分组：新增 / 重命名 / 删除 ──
async function iconMgrAddGroup(){
  const v=await uiPrompt(lang==='en'?'New icon group':'新增图标分组',[
    {key:'zh',label:lang==='en'?'Group name':'分组名称（中文）',placeholder:lang==='en'?'e.g. Renewables':'如：新能源'},
    {key:'en',label:lang==='en'?'English name':'分组名称（English）',placeholder:'e.g. Renewables'},
  ]);
  if(!v)return;
  if(!v.zh){alert(lang==='en'?'Group name required':'请填写分组名称');return;}
  if(DEVICE_GROUPS.some(g=>g.title===v.zh)){alert((lang==='en'?'Duplicate group name: ':'分组名称重复：')+v.zh);return;}
  try{
    await iconGroupApiCall('POST',null,{title:v.zh,title_en:v.en||v.zh});
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Group added':'分组已新增');
  }catch(err){alert((lang==='en'?'Add group failed: ':'新增分组失败：')+err.message);}
}
async function iconMgrRenameGroup(oldTitle,zh,en){
  if(!zh){alert(lang==='en'?'Group name required':'请填写分组名称');return;}
  if(zh!==oldTitle&&DEVICE_GROUPS.some(g=>g.title===zh)){alert((lang==='en'?'Duplicate group name: ':'分组名称重复：')+zh);return;}
  try{
    await iconGroupApiCall('PUT',oldTitle,{title:zh,title_en:en||zh});
    await reloadIconLibrary();renderIconManager();
    flashHint(lang==='en'?'Group saved':'分组已保存');
  }catch(err){alert((lang==='en'?'Save group failed: ':'保存分组失败：')+err.message);}
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
  }catch(err){alert((lang==='en'?'Delete group failed: ':'删除分组失败：')+err.message);}
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

