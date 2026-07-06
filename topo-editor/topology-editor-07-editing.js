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
  document.getElementById('p-fs-label').textContent=fsLabelTxt;
  pairSet('p-fs',n.fontSize||(isText?18:14));
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
    pairSet('p-bw',n.borderWidth!=null?n.borderWidth:1.5);
    // 边框细项（颜色/线宽）仅在选了边框样式时展示
    document.getElementById('border-detail').style.display=(n.border&&n.border!=='none')?'':'none';
    // 圆角：内部存 数字=px / 'NN%'=百分比（按盒子高度），回填到 数值+单位 两个控件
    fillRadiusControls('p-radius','p-radius-unit',n.radius!=null?n.radius:6);
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
    const bound=!!(f.bind&&f.bind.field);
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
  const autoLbl='自动匹配（默认）'+(auto?('：当前命中「'+vdDisplayName(auto.type)+'」'):'：当前未命中（未绑定后台字段或无字典认领）');
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
  return (n?('认领 '+n+' 个后台字段'):'未认领后台字段（仅可手动指定）')+' · '+m+' 个 code';
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
  h+='<div class="vd-sec">适用后台字段（自动匹配）<span class="vd-secnote">绑定了这些后台字段的画布字段/全局信号将自动转义</span></div>';
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
  // code 条目表
  h+='<div class="vd-sec">code 转义条目<span class="vd-secnote">code/中文/英文均必填；code 按字符串匹配（数字/字符串均可）、同字典内唯一</span></div>';
  h+='<div class="vd-items-head"><span>code</span><span>中文文案</span><span>English</span><span></span></div>';
  (d.items||[]).forEach((it,i)=>{
    h+='<div class="vd-row vd-item-row">'+
      '<input data-it="'+i+'" data-k="code" value="'+tplEsc(it.code==null?'':String(it.code))+'" placeholder="如 0 / 1 / FAULT（必填）">'+
      '<input data-it="'+i+'" data-k="zh" value="'+tplEsc(it.zh||'')+'" placeholder="如 待机（必填）">'+
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
    inp.oninput=()=>{const i=+inp.getAttribute('data-it'),k=inp.getAttribute('data-k'),it=d.items[i];if(it)it[k]=inp.value;inp.classList.remove('df-invalid');};
  });
  box.querySelectorAll('[data-itdel]').forEach(b=>{b.onclick=()=>{d.items.splice(+b.getAttribute('data-itdel'),1);_vdRender();};});
  box.querySelector('#vd-e-additem').onclick=()=>{d.items.push({code:'',zh:'',en:''});_vdRender();
    const rows=document.querySelectorAll('.vd-item-row');const last=rows[rows.length-1];if(last)last.querySelector('input').focus();};
  box.querySelector('#vd-e-cancel').onclick=()=>{_vdEdit=null;_vdRender();};
  box.querySelector('#vd-e-save').onclick=_vdSave;
}
// 保存前校验（与服务端校验一致）：字典名中/英文必填；条目 code/中文/英文三项必填、code 唯一。
// 全空行（三项均空）视为「没填完的空白行」自动剔除，不算错误；有任一项内容的行必须补全。
function _vdValidate(d){
  if(!String(d.name||'').trim())return '字典名（中文）必填';
  if(!String(d.nameEn||'').trim())return '字典名（English）必填';
  const rows=(d.items||[]).filter(it=>it&&(String(it.code==null?'':it.code).trim()!==''||String(it.zh||'').trim()!==''||String(it.en||'').trim()!==''));
  const bad=[];
  rows.forEach((it,i)=>{
    const miss=[];
    if(!String(it.code==null?'':it.code).trim())miss.push('code');
    if(!String(it.zh||'').trim())miss.push('中文文案');
    if(!String(it.en||'').trim())miss.push('英文文案');
    if(miss.length)bad.push('第'+(i+1)+'条缺 '+miss.join('、'));
  });
  if(bad.length)return '转义条目不完整（code/中文/英文均必填）：'+bad.join('；');
  const codes=rows.map(it=>String(it.code).trim());
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
    const code=String(it.code==null?'':it.code).trim(),zh=String(it.zh||'').trim(),en=String(it.en||'').trim();
    const blank=!code&&!zh&&!en;   // 全空行不标红（保存时自动剔除）
    const dupC=code&&codeSeen[code];if(code)codeSeen[code]=1;
    mark(box.querySelector('[data-it="'+i+'"][data-k="code"]'),!blank&&(!code||dupC));
    mark(box.querySelector('[data-it="'+i+'"][data-k="zh"]'),!blank&&!zh);
    mark(box.querySelector('[data-it="'+i+'"][data-k="en"]'),!blank&&!en);
  });
}
async function _vdSave(){
  const d=_vdEdit;if(!d)return;
  const err=_vdValidate(d);
  if(err){_vdMarkInvalid(d);flashHint(err);return;}
  _vdMarkInvalid(d);   // 清除历史标红
  const items=(d.items||[]).filter(it=>it&&String(it.code==null?'':it.code).trim()!=='')
    .map(it=>({code:String(it.code).trim(),zh:String(it.zh||'').trim(),en:String(it.en||'').trim()}));
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
// 归一化一份待导入字典：type 合法化、名称/文案兜底（en←zh）、剔除无 code 条目、同字典内 code 去重（保留先出现者）
function _vdNormalizeImport(o){
  if(!o||typeof o!=='object')return null;
  const type=String(o.type||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64);
  if(!type)return null;
  const name=String(o.name||type).trim()||type;
  const nameEn=String(o.nameEn||name).trim()||name;
  const seen=new Set(),items=[];
  (Array.isArray(o.items)?o.items:[]).forEach(it=>{
    if(!it||it.code===undefined||it.code===null||String(it.code).trim()==='')return;
    const code=String(it.code).trim();
    if(seen.has(code))return;
    seen.add(code);
    const zh=String(it.zh||it.en||'').trim(),en=String(it.en||it.zh||'').trim();
    if(!zh&&!en)return;
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
