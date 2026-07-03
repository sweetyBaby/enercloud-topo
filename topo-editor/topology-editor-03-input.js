const canvas=document.getElementById('c'),ctx=canvas.getContext('2d'),cwrap=document.getElementById('cwrap');
function resizeCanvas(){canvas.width=cwrap.clientWidth;canvas.height=cwrap.clientHeight;}
// 折叠/展开左右侧面板，给画布更多空间；过渡期间持续重算画布尺寸
function togglePanel(side){
  const el=document.getElementById(side==='left'?'sidebar-wrap':'props');
  const btn=document.getElementById(side==='left'?'left-toggle':'right-toggle');
  const collapsed=el.classList.toggle('collapsed');
  if(side==='left') btn.textContent = collapsed?'▶':'◀';
  else              btn.textContent = collapsed?'◀':'▶';
  const t0=performance.now();
  (function tick(){ resizeCanvas(); if(performance.now()-t0<280) requestAnimationFrame(tick); })();
}
function ensurePropsOpen(){
  const el=document.getElementById('props'),btn=document.getElementById('right-toggle');
  if(!el||!el.classList.contains('collapsed'))return;
  el.classList.remove('collapsed');
  if(btn)btn.textContent='▶';
  const t0=performance.now();
  (function tick(){ resizeCanvas(); if(performance.now()-t0<280) requestAnimationFrame(tick); })();
}
window.addEventListener('resize',()=>resizeCanvas());
function toWorld(sx,sy){return [(sx-panX)/zoom,(sy-panY)/zoom];}

// 外观面板(#bgpanel)及其遮罩挂在 cwrap 内：滚轮落在弹层上时应滚动弹层内容，放行默认行为，不缩放画布
cwrap.addEventListener('wheel',e=>{if(e.target!==canvas&&e.target.closest&&e.target.closest('#bgpanel,#bgpanel-overlay'))return;e.preventDefault();const r=canvas.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;const[wx,wy]=toWorld(mx,my);const f=e.deltaY<0?1.12:1/1.12;zoom=Math.max(.1,Math.min(5,zoom*f));panX=mx-wx*zoom;panY=my-wy*zoom;document.getElementById('zoom-info').textContent=Math.round(zoom*100)+'%';},{passive:false});
function resetZoom(){zoom=1;panX=0;panY=0;document.getElementById('zoom-info').textContent='100%';}
function zoomStep(factor){
  const mx=canvas.width/2,my=canvas.height/2;
  const wx=(mx-panX)/zoom,wy=(my-panY)/zoom;
  zoom=Math.max(.1,Math.min(5,zoom*factor));
  panX=mx-wx*zoom;panY=my-wy*zoom;
  document.getElementById('zoom-info').textContent=Math.round(zoom*100)+'%';
}
function toggleGrid(){showGrid=!showGrid;}
function toggleEdgeLabels(){showEdgeLabels=!showEdgeLabels;}
function toggleFieldChips(){showFieldChips=!showFieldChips;}
function toggleAnchors(){showAnchors=!showAnchors;}
function toggleBusMerge(){busMerge=!busMerge;invalidateRouting();}
// 完整中英文对照表（界面静态文案）
const I18N={
  '⚙ 规则与信号':'⚙ Rules & Signals',
  '▶ 预览效果':'▶ Preview','■ 退出预览':'■ Exit Preview',
  '运行视图（彻底隐藏被规则隐藏者）':'Run view (fully hide rule-hidden items)',
  '规则随信号实时生效：编辑态被隐藏的元素/连线会「虚化」显示，仍可点选并编辑；勾选「运行视图」可预览真实显隐效果。':'Rules apply live as signals change: in edit mode, hidden elements/edges are dimmed but still selectable & editable; tick "Run view" to preview the real show/hide result.',
  '全局信号':'Global Signals',
  '（添加后画布上所有元素/连线的规则均可引用，随图导出）':'(once added, any element/edge rule can reference it; exported with the diagram)',
  '数值':'Number','布尔':'Boolean','枚举':'Enum','文本':'Text',
  '（仅查看；新增/修改请选中元素或连线，在右侧属性面板里设置）':'(view only; to add/edit, select an element or edge and set it in the property panel)',
  '注入信号（测试）':'Inject Signals (test)',
  '（临时覆盖某信号的值，验证规则；不填用当前值）':'(temporarily override a signal value to verify rules; blank = current value)',
  '⚡ 储能拓扑编辑器':'⚡ Energy Storage Topology Editor','储能拓扑编辑器':'Energy Storage Topology Editor',
  '历史':'History','↩ 撤销':'↩ Undo','↪ 重做':'↪ Redo',
  '模式':'Mode','⬚ 选择模式':'⬚ Select','🔗 连线模式':'🔗 Connect',
  '布局与连线':'Layout & Wiring','✨ 自动布局':'✨ Auto Layout','🚌 母线汇流':'🚌 Bus Merge','连线风格':'Wire Style',
  '🤖 智能':'🤖 Smart','➖ 直连':'➖ Direct','⊞ 正交':'⊞ Ortho','⊘ 清空':'⊘ Clear',
  '视图与文件':'View & File','👁 视图 ▾':'👁 View ▾','⊙ 缩放复位 100%':'⊙ Reset Zoom 100%',
  '🎨 外观与主题':'🎨 Appearance & Theme','▦ 网格':'▦ Grid','🏷 全部线标签':'🏷 All Line Labels','📊 数据字段':'📊 Data Fields',
  '📍 占位点标记':'📍 Anchor Markers','占位点填充色':'Anchor Fill','透明':'Clear',
  '📁 文件 ▾':'📁 File ▾','📂 打开示例模板':'📂 Open Templates','📂 模板库':'📂 Templates','💾 保存为模板':'💾 Save as Template','📥 导入画布 JSON':'📥 Import Canvas JSON','⎙ 导出画布 JSON':'⎙ Export Canvas JSON',
  '💾 保存草稿':'💾 Save Draft','↺ 恢复草稿':'↺ Restore Draft','🧹 清除草稿':'🧹 Clear Draft',
  '▶ 数据预览':'▶ Data Preview','▶ 数据预览（注入信号）':'▶ Data Preview (inject signals)',
  '显示条件（数据驱动）':'Show condition (data-driven)','流向规则（数据驱动）':'Direction rules (data-driven)','编辑':'Edit',
  '流向（按规则确定）':'Flow (set by rules)','固定流向（兜底）':'Fixed direction (fallback)',
  '按信号实时匹配规则确定流向；规则都不命中时用下面的固定流向':'Direction is matched live from signal rules; falls back to the fixed direction below when no rule matches',
  '条件不满足→不画此连线（适合"动态建立的连线"）':'If condition fails → edge is not drawn (use for "dynamically created links")',
  '清空条件':'Clear','取消':'Cancel','保存':'Save','+ 信号':'+ Signal','应用JSON':'Apply JSON','清空注入':'Reset',
  '分组':'Groups','全部展开':'Expand all','全部折叠':'Collapse all','＋ 全部展开':'+ Expand all','－ 全部折叠':'- Collapse all','▼ 全部展开':'▼ Expand all','▶ 全部折叠':'▶ Collapse all','▾ 全部展开':'▾ Expand all','▸ 全部折叠':'▸ Collapse all',
  '注入信号':'Inject Signals','（覆盖预览数据；不填用静态值）':'(override preview values; blank = static)','自定义全局信号':'Custom Global Signals',
  '（规则可引用，随图导出）':'(usable in rules, exported with the diagram)','批量样例 JSON':'Bulk Sample JSON','+ 添加注入':'+ Add Injection',
  '规则总览':'Rules Overview','（元素/连线的显隐与流向规则，与属性面板同步）':'(show/direction rules for nodes & edges, synced with the property panel)',
  '+ 规则':'+ Rule','（一次性设置多个信号的值）':'(set many signal values at once)','填入当前':'Fill Current',
  '粘贴 {信号名:值} 批量覆盖注入；点「填入当前」生成模板再改。':'Paste {signal:value} to bulk-override injections; click "Fill Current" to generate a template, then edit.',
  '🗂 导出元素库包 (ZIP)':'🗂 Export Element Library Pack (ZIP)','🗂 元素库包(ZIP)':'🗂 Library Pack (ZIP)','⬇ 下载画布JSON':'⬇ Download Canvas JSON','📋 画布 JSON':'📋 Canvas JSON',
  '画布显示':'Canvas Display','显示名称':'Show Name','显示文本':'Show Text','显示数据字段':'Show Data Fields',
  '批量(所选元素)':'Batch (selected)','隐藏名称':'Hide Name','显示字段':'Show Fields','隐藏字段':'Hide Fields','⊘ 取消选择':'⊘ Deselect',
  '语言':'Language',
  '线型：':'Line:','走线：':'Route:','直线':'Straight','L型折线':'L-Bend','弧线':'Arc','粗细：':'Width:',
  '⫷ 左':'⫷ Left','⊟ 水平居中':'⊟ H-Center','右 ⫸':'Right ⫸','⊤ 顶':'⊤ Top','⊞ 垂直居中':'⊞ V-Center','底 ⊥':'Bottom ⊥',
  '↔ 水平分布':'↔ H-Distribute','↕ 垂直分布':'↕ V-Distribute','↔ 边缘分布':'↔ H-Edge Dist','↕ 边缘分布':'↕ V-Edge Dist',
  '间距':'Gap','↔ 水平间距':'↔ H-Spacing','↕ 垂直间距':'↕ V-Spacing','⚍ 排成一行':'⚍ Into Row','⚌ 排成一列':'⚌ Into Column',
  '⊞ 矩阵':'⊞ Matrix','⊡ 画布水平居中':'⊡ Canvas H-Center','⊡ 画布垂直居中':'⊡ Canvas V-Center','✕ 取消':'✕ Cancel',
  '属性面板':'Properties','未选中':'Nothing selected','点击节点或连线编辑':'Click a node or edge to edit',
  '💡 快捷键':'💡 Shortcuts','Del删除 · Ctrl+Z撤销':'Del · Ctrl+Z Undo','Ctrl+Y重做 · 滚轮缩放':'Ctrl+Y Redo · Scroll Zoom','中键/空格拖拽平移':'Middle/Space Drag Pan',
  '节点 ID':'Node ID','中文标签':'Chinese Label','English Label':'English Label','类型':'Type',
  '事件绑定':'Action Binding','不绑定':'None','左键点击':'Left Click','右键点击':'Right Click','双击':'Double Click','当前页':'Same Page','新窗口':'New Window',
  '预览/运行态触发；URL 可填写前端路由路径，如 /station/detail?id=1。':'Triggers in preview/runtime mode; URL can be a frontend route, e.g. /station/detail?id=1.',
  '图标大小':'Icon Size','旋转':'Rotation','归零':'Reset','标签字号':'Label Font Size','标签颜色':'Label Color',
  '背景填充':'Background','无':'None','边框样式':'Border Style','无边框':'No Border','实线':'Solid','虚线':'Dashed','边框颜色':'Border Color','圆角':'Radius',
  '数据字段':'Data Fields','中文字段名':'Chinese Name','英文字段名':'English Name','数值':'Value','+ 添加字段':'+ Add Field',
  '🔗 连线属性':'🔗 Edge Properties','连线类型':'Edge Type','走线方式':'Routing','智能（最短·自动避障）':'Smart (shortest, auto-avoid)','直线':'Straight','直线走线':'Straight Line','L型折线（推荐·自动避障）':'L-Bend (recommended)',
  '手动拐点':'Manual','拐点强制横平竖直（正交）':'Force orthogonal waypoints','流向':'Flow',
  '正向 →':'Forward →','反向 ←':'Reverse ←','双向 ↔':'Both ↔','无流向':'None',
  '标签（可选）':'Label (optional)','单独显示本条连线标签':'Show this edge label',
  '线条粗细':'Line Width','✕ 删除此连线':'✕ Delete Edge',
  '📋 拓扑 JSON':'📋 Topology JSON','📋 复制JSON':'📋 Copy JSON','⬇ 下载JSON':'⬇ Download JSON','🖼 下载图标包(ZIP)':'🖼 Download Icons (ZIP)','✕ 关闭':'✕ Close',
  '母线汇流排（带端帽）':'Busbar (with caps)',
  '加粗实线':'Bold Solid',
  '双线母线':'Double Line',
  '发光母线':'Glow Busbar',
  '无边框':'No Border',
  '实线':'Solid',
  '虚线':'Dashed',
  '弧线':'Arc',
  '手动拐点':'Manual',
  'L型折线（推荐·自动避障）':'L-Bend (auto-avoid)',
  '正向 →':'Forward →',
  '反向 ←':'Reverse ←',
  '双向 ↔':'Both ↔',
  '无流向':'No Flow',
  '普通模式':'Normal'
};
function tr(zh){ return lang==='en' ? (I18N[zh]||zh) : zh; }
function applyLang(){
  const en=lang==='en';
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const zh=el.getAttribute('data-i18n');
    el.textContent = en ? (I18N[zh]||zh) : zh;
  });
  // 分组标题、按钮等用 data-i18n 已覆盖；下面处理 select 选项与占位
  document.documentElement.lang = en?'en':'zh';
}
function toggleLang(){
  lang=lang==='zh'?'en':'zh';
  document.getElementById('btn-lang').textContent=lang==='zh'?'🌐 中/EN':'🌐 EN/中';
  document.getElementById('btn-lang').classList.toggle('act',lang==='en');
  applyLang();
  buildSidebar();
  buildEdgeBar();
  buildSelects();
  applyUploadLang();
  updateAlignBar();
  toggleRunView(previewMode);   // 重设「预览效果」按钮文案（applyLang 会按 data-i18n 复位，需按当前状态再同步）
  if(selNode)selectNode(selNode); else if(selEdge)selectEdge(selEdge); else showPanel('none');
}
// 上传弹框文案随语言切换
function applyUploadLang(){
  const en=lang==='en';
  const set=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t;};
  set('ub-title', en?'📁 Upload Custom Icon':'📁 上传自定义图标');
  set('dz-p1', en?'Click to select PNG / SVG file':'点击选择 PNG / SVG 文件');
  set('dz-p2', en?'Recommended 100×100, transparent bg':'建议 100×100 透明背景');
  set('uf-zh-label', en?'Chinese Name':'中文名称'); set('uf-en-label', en?'English Name':'英文名称');
  set('uf-zh-req', en?'*Required':'*必填');
  set('uf-en-req', en?'*Required':'*必填');
  set('ub-ok', en?'✓ Add':'✓ 添加');
  set('ub-cancel', en?'✕ Cancel':'✕ 取消');
  const un=document.getElementById('un'),une=document.getElementById('un-en');
  if(un)un.placeholder=en?'e.g. Custom Device':'如：自定义设备';
  if(une)une.placeholder=en?'e.g. Custom Device':'如：Custom Device';
}
function gridColor(){
  const c=bgColor.replace('#','');const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
  const lum=(r*0.299+g*0.587+b*0.114);
  return lum>128?'rgba(0,40,90,0.13)':'rgba(120,170,220,0.28)';
}

let spaceDown=false;
canvas.addEventListener('mousedown',e=>{
  if(e.button===1||(e.button===0&&spaceDown)){e.preventDefault();isPanning=true;panSX=e.clientX-panX;panSY=e.clientY-panY;canvas.style.cursor='grabbing';return;}
  if(e.button===2)return;
  const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);
  // 多选整体缩放手柄
  if(_groupBox&&_groupBox.handle&&Math.hypot(wx-_groupBox.handle[0],wy-_groupBox.handle[1])<9/zoom){
    const cx=(_groupBox.x0+_groupBox.x1)/2, cy=(_groupBox.y0+_groupBox.y1)/2;
    const d0=Math.hypot(_groupBox.handle[0]-cx,_groupBox.handle[1]-cy);
    const snap={};selSet.forEach(id=>{const nn=nodes.find(z=>z.id===id);if(nn)snap[id]={x:nn.x,y:nn.y,scale:nn.scale||1,fontSize:nn.fontSize,valFontSize:nn.valFontSize};});
    dragGroupScale={cx,cy,d0,snap};canvas.style.cursor='nwse-resize';return;
  }
  // 单节点缩放手柄
  if(selNode&&selSet.size<=1){
    const sn=nodes.find(z=>z.id===selNode);
    if(sn&&sn._rotHandle&&Math.hypot(wx-sn._rotHandle[0],wy-sn._rotHandle[1])<9/zoom){
      const cx=sn.x, cy=(usesTextBox(sn.type))?sn.y:(sn.y-nsz(sn)*0.22);
      dragRotate={n:sn,cx,cy,start:sn.rotation||0,startAng:Math.atan2(wy-cy,wx-cx)};canvas.style.cursor='grabbing';return;
    }
    if(sn&&sn._resizeHandles){
      for(const h of sn._resizeHandles){
        if(Math.hypot(wx-h[0],wy-h[1])<9/zoom){
          const isText=usesTextBox(sn.type);
          const cx=usesTextBox(sn.type)?sn.y:(sn.y-nsz(sn)*0.22);
          const baseDist=Math.hypot(h[0]-sn.x, h[1]-sn.y)||1;
          dragResize={n:sn,baseDist,startScale:sn.scale||1,startFont:sn.fontSize,startValFont:sn.valFontSize,isText};canvas.style.cursor='nwse-resize';return;
        }
      }
    }
  }
  // 汇流主干拖动手柄优先检测
  if(busMerge&&busShowHandles&&TR.busTrunks().length){
    for(const t of TR.busTrunks()){
      if(t._handle&&Math.hypot(wx-t._handle[0],wy-t._handle[1])<8/zoom){
        dragBus={t, startOff:busOffsets[t.bkey]||0, sx:wx, sy:wy};
        canvas.style.cursor='grabbing';return;
      }
    }
  }
  const n=nodeAt(wx,wy);
  if(edgeMode){
    const snapHit=edgeSnapAt(wx,wy,edgeFrom);
    if(snapHit){
      const n=snapHit.node, hitPort=snapHit.port;
      const lockedPort=(hitPort&&hitPort.dist<=Math.max(18/zoom,nsz(n)*0.22))?hitPort.name:null;
      if(!edgeFrom){edgeFrom=n.id;edgeFromPort=lockedPort;edgeWaypoints=[];document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：点空白处加拐点，点目标节点完成';}
      else if(edgeFrom!==n.id){
        if(!edges.find(e=>e.from===edgeFrom&&e.to===n.id||e.from===n.id&&e.to===edgeFrom)){
          snapshot();
          const newEdge={from:edgeFrom,to:n.id,fromPort:edgeFromPort,toPort:lockedPort,et:pendingET,dir:'forward',route:pendingRoute,lbl:''};
          const cleanedWaypoints=trimWaypointsNearPort(edgeWaypoints,hitPort&&hitPort.point);
          if(cleanedWaypoints.length>0){
            newEdge.waypoints=cleanedWaypoints;
            newEdge.route='manual';
            simplifyWaypoints(newEdge);
            dropOverroutedManualWaypoints(newEdge);
          }
          edges.push(newEdge);snapshot();
        }
        edgeFrom=null;edgeFromPort=null;edgeWaypoints=[];document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：点击起始节点…';
        // 连完一条线后自动回到普通模式（除非勾选了「连续连线」）
        const cont=document.getElementById('edge-continuous');
        if(!cont||!cont.checked){ toggleEdgeMode(); }
      }
    } else if(edgeFrom){
      // 点击空白处：添加一个拐点（自动对齐为水平/垂直 + 吸附网格/节点）
      let px=wx,py=wy;
      const snap=10/zoom;
      nodes.forEach(o=>{if(Math.abs(o.x-px)<snap)px=o.x;const oy=usesTextBox(o.type)?o.y:(o.y-nsz(o)*0.22);if(Math.abs(oy-py)<snap)py=oy;});
      const GS=25;{const gx=Math.round(px/GS)*GS;if(Math.abs(gx-px)<snap)px=gx;const gy=Math.round(py/GS)*GS;if(Math.abs(gy-py)<snap)py=gy;}
      const last=edgeWaypoints.length>0?edgeWaypoints[edgeWaypoints.length-1]:(()=>{const f=nodes.find(z=>z.id===edgeFrom);return f?(nodePortPoint(f,edgeFromPort)||[f.x,f.y-nsz(f)*0.22]):[wx,wy];})();
      // L型：与上一点对齐，取偏移大的方向
      if(Math.abs(px-last[0])>Math.abs(py-last[1])) py=last[1]; else px=last[0];
      edgeWaypoints.push([px,py]);
      document.getElementById('ehint').textContent='已加 '+edgeWaypoints.length+' 个拐点，继续点空白加拐点或点目标完成';
    }
    return;
  }
  // 数据字段 chip 优先于节点检测（即使 chip 落在节点图标上也能拖动）
  const chipHit=fieldChipAt(wx,wy);
  if(chipHit && !edgeMode){
    if(selChips.has(chipHit.node.id+'#'+chipHit.fi)&&selChips.size>1){
      dragChipGroup={sx:wx,sy:wy,snap:{}};
      selChips.forEach(k=>{const a=k.split('#');const nn=nodes.find(z=>z.id===a[0]);if(nn&&nn.data[a[1]])dragChipGroup.snap[k]={ox:nn.data[a[1]].ox||0,oy:nn.data[a[1]].oy||0};});
      canvas.style.cursor='grabbing';return;
    }
    dragChip=chipHit;selectNode(chipHit.node.id);const f=chipHit.node.data[chipHit.fi];const pos=fieldChipPos(chipHit.node,chipHit.fi);dchox=wx-pos.x;dchoy=wy-pos.y;canvas.style.cursor='grabbing';return;
  }
  // 选中连线的手柄优先于节点检测（手柄即使落在节点附近也能抓取）：拐点(方块) + 起止端(方块)
  if(selEdge && !edgeMode){
    const wi=waypointAt(selEdge,wx,wy);
    if(wi>=0){dragWaypoint={e:selEdge,i:wi};canvas.style.cursor='grabbing';return;}
    const cn=cornerAt(selEdge,wx,wy);
    if(cn){
      const _savedRoute=selEdge.route, _savedWP=selEdge.waypoints?selEdge.waypoints.map(p=>p.slice()):undefined;
      ensureManual(selEdge);
      let idx=-1,bd=Infinity;
      selEdge.waypoints.forEach((p,k)=>{const d=Math.hypot(p[0]-cn.x,p[1]-cn.y);if(d<bd){bd=d;idx=k;}});
      if(idx<0||bd>7/zoom){const ins=waypointInsertIndex(selEdge,cn.x,cn.y);selEdge.waypoints.splice(ins,0,[cn.x,cn.y]);idx=ins;}
      dragWaypoint={e:selEdge,i:idx,fromCorner:true,sx:wx,sy:wy,savedRoute:_savedRoute,savedWP:_savedWP};canvas.style.cursor='grabbing';return;
    }
    // 起止端节点：拖动以「重连/移动这一端」，不插入拐点、不新增线段
    if(selEdge._endHandles){ for(let hi=0;hi<selEdge._endHandles.length;hi++){ const h=selEdge._endHandles[hi];
      if(h&&Math.abs(wx-h[0])<8/zoom&&Math.abs(wy-h[1])<8/zoom){
        const which=hi===0?'from':'to';
        dragEndpoint={e:selEdge,which,orig:selEdge[which],origPort:selEdge[which+'Port']};canvas.style.cursor='grabbing';return;
      } } }
  }
  if(n){
    // 若节点已在多选集合中，拖动整组；否则单选
    if(selSet.has(n.id)&&selSet.size>1){dragNode=n;dox=wx-n.x;doy=wy-n.y;_groupDrag=true;_groupStart={};selSet.forEach(id=>{const nn=nodes.find(z=>z.id===id);if(nn)_groupStart[id]=[nn.x,nn.y];});canvas.style.cursor='grabbing';return;}
    selSet.clear();selChips.clear();updateAlignBar();selectNode(n.id);dragNode=n;dox=wx-n.x;doy=wy-n.y;canvas.style.cursor='grabbing';}
  else{
    const hit=fieldChipAt(wx,wy);
    if(hit){
      // 若点中的 chip 在多选集合中，整组拖动所有选中 chip
      if(selChips.has(hit.node.id+'#'+hit.fi)&&selChips.size>1){
        dragChipGroup={sx:wx,sy:wy,snap:{}};
        selChips.forEach(k=>{const [id,j]=k.split('#');const nn=nodes.find(z=>z.id===id);if(nn&&nn.data[j])dragChipGroup.snap[k]={ox:nn.data[j].ox||0,oy:nn.data[j].oy||0};});
        canvas.style.cursor='grabbing';return;
      }
      dragChip=hit;selectNode(hit.node.id);const f=hit.node.data[hit.fi];const pos=fieldChipPos(hit.node,hit.fi);dchox=wx-pos.x;dchoy=wy-pos.y;canvas.style.cursor='grabbing';return;
    }
    const ed=edgeAt(wx,wy);if(ed){selSet.clear();selChips.clear();updateAlignBar();selectEdge(ed);}
    else if(e.shiftKey||selectMode){
      // 选择模式或 Shift+拖动空白 → 框选
      rubber={x0:wx,y0:wy,x1:wx,y1:wy};selSet.clear();selChips.clear();updateAlignBar();selNode=selEdge=null;showPanel('none');
    }else{
      selSet.clear();selChips.clear();updateAlignBar();selNode=selEdge=null;showPanel('none');
      isPanning=true;panSX=e.clientX-panX;panSY=e.clientY-panY;canvas.style.cursor='grabbing';
    }
  }
});
canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect();
  const wpt=toWorld(e.clientX-r.left,e.clientY-r.top);mouseWX=wpt[0];mouseWY=wpt[1];
  if(isPanning){panX=e.clientX-panSX;panY=e.clientY-panSY;return;}
  if(dragRotate){
    const ang=Math.atan2(mouseWY-dragRotate.cy, mouseWX-dragRotate.cx);
    let deg=dragRotate.start + (ang-dragRotate.startAng)*180/Math.PI;
    if(e.shiftKey) deg=Math.round(deg/15)*15; // Shift 吸附 15°
    deg=((deg%360)+360)%360;
    dragRotate.n.rotation=Math.round(deg);
    invalidateRouting();
    const el=document.getElementById('p-rot');if(el){el.value=dragRotate.n.rotation;const v=document.getElementById('p-rot-v');if(v)v.textContent=dragRotate.n.rotation;}
    _hud={x:dragRotate.cx,y:dragRotate.cy,text:'∠ '+dragRotate.n.rotation+'°'};
    return;
  }
  if(dragResize){
    const d=Math.hypot(mouseWX-dragResize.n.x, mouseWY-dragResize.n.y);
    const ratio=Math.max(0.05,Math.min(4, d/dragResize.baseDist));
    if(dragResize.isText){dragResize.n.fontSize=Math.max(8,Math.round(dragResize.startFont*ratio));
      if(dragResize.n.type==='variable'&&dragResize.startValFont!=null)dragResize.n.valFontSize=Math.max(8,Math.round(dragResize.startValFont*ratio));}
    else{dragResize.n.scale=Math.max(0.05,Math.min(8, dragResize.startScale*ratio));}
    invalidateRouting();
    if(selNode===dragResize.n.id){
      if(dragResize.isText){const el=document.getElementById('p-fs');if(el){el.value=dragResize.n.fontSize;const v=document.getElementById('p-fs-v');if(v)v.textContent=dragResize.n.fontSize;}}
      else{const el=document.getElementById('p-scale');if(el){el.value=Math.round(dragResize.n.scale*100);const v=document.getElementById('p-scale-v');if(v)v.textContent=Math.round(dragResize.n.scale*100);}}
    }
    _hud={x:dragResize.n.x,y:dragResize.n.y,text:dragResize.isText?(dragResize.n.fontSize+'px'):(Math.round(dragResize.n.scale*100)+'%')};
    return;
  }
  if(dragGroupScale){
    const d=Math.hypot(mouseWX-dragGroupScale.cx, mouseWY-dragGroupScale.cy);
    const ratio=Math.max(0.15,Math.min(8, d/dragGroupScale.d0));
    const {cx,cy,snap}=dragGroupScale;
    selSet.forEach(id=>{const n=nodes.find(z=>z.id===id);if(!n||!snap[id])return;
      n.x=cx+(snap[id].x-cx)*ratio; n.y=cy+(snap[id].y-cy)*ratio;
      if(usesTextBox(n.type)){
        n.fontSize=Math.max(8,Math.round((snap[id].fontSize||14)*ratio));
        if(n.type==='variable'&&snap[id].valFontSize!=null)n.valFontSize=Math.max(8,Math.round(snap[id].valFontSize*ratio));
      }
      else n.scale=Math.max(0.05,Math.min(8, snap[id].scale*ratio));
    });
    invalidateRouting();
    _hud={x:cx,y:cy,text:Math.round(ratio*100)+'%'};
    return;
  }
  if(dragBus){
    const t=dragBus.t;
    // 主干垂直方向的位移转为偏移量；远离节点为正
    let delta;
    if(t.horiz){delta=(t.side==='T')?(dragBus.sy-mouseWY):(mouseWY-dragBus.sy);}
    else{delta=(t.side==='L')?(dragBus.sx-mouseWX):(mouseWX-dragBus.sx);}
    let off=dragBus.startOff+delta;
    if(off<-(Math.max(0,busMergeGap-8)))off=-(Math.max(0,busMergeGap-8)); // 不要穿进节点
    busOffsets[t.bkey]=off;
    invalidateRouting();
    return;
  }
  if(rubber){rubber.x1=mouseWX;rubber.y1=mouseWY;return;}
  if(dragEndpoint){
    // 重连/移动连线这一端：实时吸附到光标下的设备(非另一端)，移开则回到原设备
    const otherId=dragEndpoint.e[dragEndpoint.which==='from'?'to':'from'];
    const hit=edgeSnapAt(mouseWX,mouseWY,otherId);
    const hv=hit&&hit.node;
    const portKey=dragEndpoint.which+'Port';
    const tgt=(hv&&hv.id!==otherId)?hv.id:dragEndpoint.orig;
    const hp=(hv&&hv.id!==otherId)?hit.port:null;
    const nextPort=(hp&&hp.dist<=Math.max(18/zoom,nsz(hv)*0.22))?hp.name:dragEndpoint.origPort;
    if(dragEndpoint.e[dragEndpoint.which]!==tgt || dragEndpoint.e[portKey]!==nextPort){
      dragEndpoint.e[dragEndpoint.which]=tgt;
      if(nextPort)dragEndpoint.e[portKey]=nextPort;else delete dragEndpoint.e[portKey];
      invalidateRouting();
    }
    canvas.style.cursor=(hv&&hv.id!==otherId)?'grabbing':'no-drop';
    return;
  }
  if(dragWaypoint){
    alignGuides=[];
    const snap=9/zoom;
    // 始终以「原始鼠标位置」为基准挑最近的吸附目标，避免逐个比较时被前一次吸附带偏
    let px=mouseWX, py=mouseWY, bestXd=snap, bestYd=snap, gx=null, gy=null;
    const tryX=v=>{const d=Math.abs(v-mouseWX);if(d<bestXd){bestXd=d;px=v;gx=v;}};
    const tryY=v=>{const d=Math.abs(v-mouseWY);if(d<bestYd){bestYd=d;py=v;gy=v;}};
    // 1) 对齐其他节点中心线（横/竖）
    nodes.forEach(o=>{ tryX(o.x); tryY(usesTextBox(o.type)?o.y:(o.y-nsz(o)*0.22)); });
    // 2) 对齐/汇合其他连线：其拐点(同时命中X与Y即汇合为同一点) + 横平竖直段(对齐到同一通道)
    edges.forEach(oe=>{ if(oe===dragWaypoint.e)return; const pp=TR.cachedPath(oe)||oe._drawPts; if(!pp||pp.length<2)return;
      pp.forEach(pt=>{ tryX(pt[0]); tryY(pt[1]); });
      for(let i=0;i<pp.length-1;i++){ const a=pp[i],b=pp[i+1];
        if(Math.abs(a[0]-b[0])<1) tryX(a[0]);   // 竖直段 → 对齐 X
        if(Math.abs(a[1]-b[1])<1) tryY(a[1]);   // 水平段 → 对齐 Y
      }
    });
    // 3) 仍未吸附到任何参考 → 吸附网格(25px)
    const GS=25;
    if(gx==null){const g=Math.round(mouseWX/GS)*GS;if(Math.abs(g-mouseWX)<snap){px=g;gx=g;}}
    if(gy==null){const g=Math.round(mouseWY/GS)*GS;if(Math.abs(g-mouseWY)<snap){py=g;gy=g;}}
    if(gx!=null)alignGuides.push({type:'v',x:gx});
    if(gy!=null)alignGuides.push({type:'h',y:gy});
    dragWaypoint.e.waypoints[dragWaypoint.i]=[px,py];
    invalidateRouting();
    return;
  }
  if(dragChipGroup){
    const ddx=mouseWX-dragChipGroup.sx, ddy=mouseWY-dragChipGroup.sy;
    Object.entries(dragChipGroup.snap).forEach(([k,s])=>{const a=k.split('#');const nn=nodes.find(z=>z.id===a[0]);if(nn&&nn.data[a[1]]){nn.data[a[1]].ox=s.ox+ddx*zoom;nn.data[a[1]].oy=s.oy+ddy*zoom;}});
    return;
  }
  if(dragChip){
    const f=dragChip.node.data[dragChip.fi];
    const s=nsz(dragChip.node);
    const step=((dragChip.node.fontSize||14)+18)/zoom;
    const baseX=dragChip.node.x+s*0.5+14/zoom, baseY=dragChip.node.y-s*0.40+dragChip.fi*step;
    f.ox=((mouseWX-dchox)-baseX)*zoom; f.oy=((mouseWY-dchoy)-baseY)*zoom;   // 存屏幕像素
    return;
  }
  if(dragNode&&_groupDrag){
    const ddx=(mouseWX-dox)-_groupStart[dragNode.id][0], ddy=(mouseWY-doy)-_groupStart[dragNode.id][1];
    selSet.forEach(id=>{const nn=nodes.find(z=>z.id===id);if(nn&&_groupStart[id]){nn.x=_groupStart[id][0]+ddx;nn.y=_groupStart[id][1]+ddy;}});
    _dragging=true;_dragIds=new Set(selSet);return;
  }
  if(!dragNode)return;const[wx,wy]=[wpt[0],wpt[1]];
  let nx=wx-dox, ny=wy-doy;
  alignGuides=[];
  const snap=8/zoom;
  // 取一个节点的对齐参考线：x方向[左,中,右]，y方向[上,中,下]
  function xRefs(o,cx){const s=nsz(o);const hw=(usesTextBox(o.type)&&o._textBox)?o._textBox.w/2:s*0.40;return [cx-hw,cx,cx+hw];}
  function yRefs(o,cy){const s=nsz(o);if(usesTextBox(o.type)&&o._textBox){const hh=o._textBox.h/2;return [cy-hh,cy,cy+hh];}const vc=cy-s*0.22,hh=s*0.40;return [vc-hh,vc,vc+hh];}
  const dxr=xRefs(dragNode,nx), dyr=yRefs(dragNode,ny);
  let bestX=null,bestY=null,bestXd=snap,bestYd=snap,guideX=null,guideY=null;
  nodes.forEach(o=>{if(o.id===dragNode.id)return;
    const oxr=xRefs(o,o.x), oyr=yRefs(o,o.y);
    // x 方向：拖动节点的 3 条参考线 vs 目标 3 条参考线
    dxr.forEach((dv,di)=>oxr.forEach(ov=>{const d=Math.abs(dv-ov);if(d<bestXd){bestXd=d;bestX=nx+(ov-dv);guideX=ov;}}));
    dyr.forEach((dv,di)=>oyr.forEach(ov=>{const d=Math.abs(dv-ov);if(d<bestYd){bestYd=d;bestY=ny+(ov-dv);guideY=ov;}}));
  });
  if(bestX!=null){nx=bestX;alignGuides.push({type:'v',x:guideX});}
  if(bestY!=null){ny=bestY;alignGuides.push({type:'h',y:guideY});}
  dragNode.x=nx;dragNode.y=ny;_dragging=true;_dragIds=new Set([dragNode.id]);
  if(selNode===dragNode.id){document.getElementById('p-x').textContent=dragNode.x.toFixed(0);document.getElementById('p-y').textContent=dragNode.y.toFixed(0);}
});
canvas.addEventListener('mouseup',()=>{
  if(rubber){
    const x0=Math.min(rubber.x0,rubber.x1),x1=Math.max(rubber.x0,rubber.x1),y0=Math.min(rubber.y0,rubber.y1),y1=Math.max(rubber.y0,rubber.y1);
    selSet.clear();selChips.clear();
    nodes.forEach(n=>{if(n.x>=x0&&n.x<=x1&&n.y>=y0&&n.y<=y1)selSet.add(n.id);});
    // 框选数据字段 chip（chip 盒与框相交即选中）
    if(showFieldChips){
      nodes.forEach(n=>{if(!n.data)return;n.data.forEach((f,j)=>{const b=f._chipBox;if(!b||f.hidden)return;
        if(b.x<x1&&b.x+b.w>x0&&b.y<y1&&b.y+b.h>y0)selChips.add(n.id+'#'+j);
      });});
    }
    rubber=null;
    updateAlignBar();
    // 框选结束后自动回到普通模式，无需手动取消选择模式
    if(selectMode){ selectMode=false; document.getElementById('btn-select').classList.remove('active'); }
    canvas.style.cursor='default';return;
  }
  if(isPanning){isPanning=false;canvas.style.cursor=edgeMode?'crosshair':'default';return;}
  if(dragRotate){dragRotate=null;_hud=null;invalidateRouting();snapshot();canvas.style.cursor='default';return;}
  if(dragResize){dragResize=null;_hud=null;invalidateRouting();snapshot();canvas.style.cursor='default';return;}
  if(dragGroupScale){dragGroupScale=null;_hud=null;invalidateRouting();snapshot();canvas.style.cursor='default';return;}
  if(dragBus){dragBus=null;invalidateRouting();canvas.style.cursor='default';return;}
  if(dragEndpoint){
    const _e=dragEndpoint.e, portKey=dragEndpoint.which+'Port';
    const changed=_e[dragEndpoint.which]!==dragEndpoint.orig || _e[portKey]!==dragEndpoint.origPort;
    if(changed){ delete _e.waypoints; if(_e.route==='manual')_e.route='smart'; }   // 端点变了→旧拐点作废，重新走线
    dragEndpoint=null;invalidateRouting();canvas.style.cursor='default';
    if(changed){snapshot();flashHint('已重连该端');}
    return;
  }
  if(dragWaypoint){const _dw=dragWaypoint,_e=_dw.e;dragWaypoint=null;alignGuides=[];
    // 若是通过点击自动路由拐角触发的（fromCorner），且几乎没有移动，则视为点击而非拖动——
    // 恢复原始路由，不把直线变成折线
    if(_dw.fromCorner && Math.hypot(mouseWX-_dw.sx, mouseWY-_dw.sy)<8/zoom){
      _e.route=_dw.savedRoute; if(_dw.savedWP){_e.waypoints=_dw.savedWP;}else{delete _e.waypoints;}
      invalidateRouting();canvas.style.cursor='default';return;
    }
    simplifyWaypoints(_e);
    // 把存储拐点同步为「实际渲染后的正交拐点」：强制正交会让线在直角处转弯而非原始点，
    // 不同步就会残留偏离线条的孤立手柄、并越拖越多。同步后手柄恒在线上、抓取即命中。
    invalidateRouting(); const rp=edgePath(_e); if(rp&&rp.length>2){ _e.waypoints=rp.slice(1,-1).map(p=>p.slice()); simplifyWaypoints(_e); autoAttachLooseEdgeEnds(_e); dropOverroutedManualWaypoints(_e); }
    invalidateRouting();snapshot();canvas.style.cursor='default';return;}
  if(dragChipGroup){dragChipGroup=null;snapshot();canvas.style.cursor='default';return;}
  if(dragChip){dragChip=null;snapshot();canvas.style.cursor='default';return;}
  if(dragNode){suppressNodeActionClick=true;setTimeout(()=>{suppressNodeActionClick=false;},0);_dragging=false;_groupDrag=false;_dragIds=new Set();invalidateRouting();alignGuides=[];snapshot();}
  dragNode=null;canvas.style.cursor=edgeMode?'crosshair':'default';
});
canvas.addEventListener('mouseleave',()=>{dragNode=null;isPanning=false;});
function isNodeActionRuntime(){return previewMode||document.body.classList.contains('rt');}
function openNodeAction(action){
  if(!action||!action.url)return false;
  const url=String(action.url).trim();
  if(!url)return false;
  if(action.target==='blank')window.open(url,'_blank','noopener');
  else window.location.href=url;
  return true;
}
function triggerNodeAction(n,trigger){
  if(!isNodeActionRuntime()||!n||!n.action)return false;
  const a=n.action;
  if((a.trigger||'click')!==trigger)return false;
  return openNodeAction(a);
}
canvas.addEventListener('click',e=>{
  if(suppressNodeActionClick||edgeMode)return;
  const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);
  const n=nodeAt(wx,wy);
  if(n)triggerNodeAction(n,'click');
});
canvas.addEventListener('dblclick',e=>{
  const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);
  // 双击选中连线的拐点 → 删除该拐点
  if(selEdge){
    const wi=waypointAt(selEdge,wx,wy);
    if(wi>=0){
      snapshot();
      selEdge.waypoints.splice(wi,1);
      if(selEdge.waypoints.length===0){selEdge.route='straight';delete selEdge.waypoints;}
      invalidateRouting();snapshot();
      return;
    }
  }
  // 双击数据字段 chip → 内联编辑数值（自定义弹层，替代原生 prompt）
  const hit=fieldChipAt(wx,wy);
  if(hit){
    openChipValueEditor(hit.node, hit.fi, e.clientX, e.clientY);
    return;
  }
  // 双击节点 → 编辑标签（当前语言）
  const n=nodeAt(wx,wy);
  if(n){
    if(triggerNodeAction(n,'dblclick'))return;
    if(usesTextBox(n.type)){ openTextEditor(n, e.clientX, e.clientY); return; }
    const isEn=lang==='en';
    const cur=isEn?(n.labelEn||''):(n.labelZh||n.label||'');
    openInlineInput(e.clientX,e.clientY,(isEn?'编辑英文标签':'编辑中文标签'),cur,(v)=>{
      snapshot();if(isEn)n.labelEn=v;else{n.labelZh=v;n.label=v;}snapshot();selectNode(n.id);
    });
  }
});
// 通用内联输入弹层（替代原生 prompt）
function openInlineInput(clientX,clientY,title,value,onOk){
  const old=document.getElementById('inline-input');if(old)old.remove();
  const box=document.createElement('div');box.id='inline-input';
  box.style.cssText='position:fixed;z-index:200;background:var(--ui-bg);border:1px solid var(--ui-accent);border-radius:8px;padding:10px;box-shadow:0 8px 28px rgba(0,0,0,.5);min-width:200px';
  const lbl=document.createElement('div');lbl.textContent=title;lbl.style.cssText='font-size:12px;color:var(--ui-text2);margin-bottom:6px';
  const inp=document.createElement('input');inp.type='text';inp.value=value;
  inp.style.cssText='width:100%;background:var(--ui-input-bg,#060e1a);border:1.5px solid var(--ui-border);color:var(--ui-text);font-family:inherit;font-size:14px;padding:7px 9px;border-radius:5px;outline:none;box-sizing:border-box';
  const row=document.createElement('div');row.style.cssText='display:flex;gap:6px;justify-content:flex-end;margin-top:8px';
  const ok=document.createElement('button');ok.className='tb grn';ok.textContent='✓ 确定';ok.style.fontSize='12px';
  const cancel=document.createElement('button');cancel.className='tb';cancel.textContent='取消';cancel.style.fontSize='12px';
  row.appendChild(cancel);row.appendChild(ok);
  box.appendChild(lbl);box.appendChild(inp);box.appendChild(row);
  document.body.appendChild(box);
  // 定位（避免超出视口）
  const bw=box.offsetWidth,bh=box.offsetHeight;
  let x=Math.min(clientX,window.innerWidth-bw-12), y=Math.min(clientY,window.innerHeight-bh-12);
  box.style.left=Math.max(8,x)+'px';box.style.top=Math.max(8,y)+'px';
  inp.focus();inp.select();
  const close=()=>{box.remove();document.removeEventListener('mousedown',outside,true);};
  const submit=()=>{const v=inp.value.trim();close();onOk(v);};
  ok.onclick=submit;cancel.onclick=close;
  inp.addEventListener('keydown',ev=>{if(ev.key==='Enter')submit();else if(ev.key==='Escape')close();});
  const outside=(ev)=>{if(!box.contains(ev.target))close();};
  setTimeout(()=>document.addEventListener('mousedown',outside,true),0);
}
// 编辑某字段数值
function openChipValueEditor(node,fi,clientX,clientY){
  const f=node.data[fi];
  const cur=(f.dv!=null&&f.dv!==''&&f.dv!==0)?f.dv:'';
  openInlineInput(clientX,clientY,'设置数值 · '+dataKey(f),cur,(v)=>{
    snapshot();f.dv=v;snapshot();selectNode(node.id);
  });
}
// 文本框多行内联编辑器
function openTextEditor(n, clientX, clientY){
  const old=document.getElementById('text-editor');if(old)old.remove();
  const isEn=lang==='en';
  const ta=document.createElement('textarea');
  ta.id='text-editor';
  ta.value=isEn?(n.labelEn||''):(n.labelZh||n.label||'');
  ta.placeholder=isEn?'Enter text (Enter for newline, Esc to cancel)':'输入文字（回车换行，Esc 取消，点外部保存）';
  const r=canvas.getBoundingClientRect();
  ta.style.cssText='position:fixed;left:'+Math.min(clientX,window.innerWidth-280)+'px;top:'+Math.min(clientY,window.innerHeight-140)+'px;'+
    'width:260px;height:90px;z-index:200;background:var(--ui-bg);color:var(--ui-text);'+
    'border:2px solid var(--ui-accent);border-radius:8px;padding:9px;font-size:14px;'+
    'font-family:inherit;resize:both;outline:none;box-shadow:0 8px 30px rgba(0,0,0,.5)';
  document.body.appendChild(ta);ta.focus();ta.select();
  const save=()=>{
    if(!document.body.contains(ta))return;
    snapshot();
    if(isEn)n.labelEn=ta.value; else {n.labelZh=ta.value;n.label=ta.value;}
    snapshot();selectNode(n.id);
    ta.remove();
  };
  ta.addEventListener('blur',save);
  ta.addEventListener('keydown',ev=>{
    ev.stopPropagation();
    if(ev.key==='Escape'){ta.remove();}
    // Ctrl+Enter 也保存
    if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){save();}
  });
}
window.addEventListener('keydown',e=>{
  if(e.code==='Space'&&!e.target.matches('input,select,textarea')){e.preventDefault();spaceDown=true;canvas.style.cursor='grab';}
  if(e.key==='Escape'){if(edgeFrom){edgeFrom=null;edgeFromPort=null;edgeWaypoints=[];document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：点击起始节点…';}}
  if((e.key==='Delete'||e.key==='Backspace')&&!e.target.matches('input,select,textarea')){e.preventDefault();deleteSelected();}
  if(e.ctrlKey&&e.key==='z'){e.preventDefault();undo();}
  if(e.ctrlKey&&(e.key==='y'||e.key==='Y')){e.preventDefault();redo();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='c'||e.key==='C')&&!e.target.matches('input,select,textarea')){e.preventDefault();copySelection();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='v'||e.key==='V')&&!e.target.matches('input,select,textarea')){e.preventDefault();pasteClipboard();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='d'||e.key==='D')&&!e.target.matches('input,select,textarea')){e.preventDefault();copySelection();pasteClipboard();}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;canvas.style.cursor=edgeMode?'crosshair':'default';}});
canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);
  const n=nodeAt(wx,wy),ed=edgeAt(wx,wy),m=document.getElementById('ctxmenu');
  if(n&&triggerNodeAction(n,'contextmenu'))return;
  if(n||ed){ctxTgt=n||ed;ctxKind=n?'node':'edge';
    document.getElementById('ctx-conn').style.display=n?'flex':'none';
    document.getElementById('ctx-copy').style.display=n?'flex':'none';
    document.getElementById('ctx-straight').style.display=ed?'flex':'none';
    document.getElementById('ctx-line').style.display=ed?'flex':'none';
    document.getElementById('ctx-del-edge').style.display=ed?'flex':'none';
    document.getElementById('ctx-del').style.display=n?'flex':'none';
    m.style.display='block';m.style.left=e.clientX+'px';m.style.top=e.clientY+'px';}
});
document.addEventListener('click',e=>{
  if(!e.target.closest('#ctxmenu'))document.getElementById('ctxmenu').style.display='none';
  if(!e.target.closest('#ep-type-dd'))closeEpTypeDD();
  if(!e.target.closest('#bgpanel')&&!e.target.closest('#topbar'))closeBgPanel();
  if(e.target.id==='tpl-overlay')closeTemplates();
});
