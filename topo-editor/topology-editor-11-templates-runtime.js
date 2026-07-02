// ══════════════════════════════════════════════
// 模板系统：每个模板是 templates/ 目录下的单独 JSON 文件，按需加载（不一次性载入全部）。
//   清单(index.json)由服务端「扫描 templates/ 目录」动态生成——增删改模板 .json 文件即自动反映，无需维护 index.json。
//   读列表(GET templates/index.json，已被 dev/生产 server 拦截为扫描结果) / 读模板 = fetch；保存/编辑/重命名/删除 = 调 /api/templates 落盘对应 .json。
//   模板文件两种形态：内置 seed（节点/连线种子，加载时自动布局）；用户保存 canvas（完整画布 JSON，保留原布局）。
//   每个模板文件自带元数据 doc.template{id,name,nameEn,desc,builtin[,default]}；默认模板=某文件 default:true，否则排序首个。
// ══════════════════════════════════════════════
// 读列表/读模板的静态目录；写操作(保存/编辑/重命名/删除)的接口。
// 默认同源相对路径（dev-server / 生产 server 均提供）；如需对接父平台后端，
// 可在加载本脚本前设置 window.TOPO_TPL_BASE / window.TOPO_TPL_API 覆盖（支持绝对 URL）。
const TPL_BASE=(typeof window!=='undefined'&&window.TOPO_TPL_BASE)||'templates/';
const TPL_API=(typeof window!=='undefined'&&window.TOPO_TPL_API)||'api/templates';
let _tplManifest=null;           // 缓存的清单(index.json)，写操作后置空重新拉取
let currentTemplateId=null;      // 最近加载的模板（保存时可作为「覆盖」目标）
let _tplEditMode=false;          // true=经「编辑」进入，保存时默认勾选覆盖；普通「使用」则默认另存为新
function tplEsc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

async function loadTplManifest(force){
  if(_tplManifest&&!force)return _tplManifest;
  const r=await fetch(TPL_BASE+'index.json',{cache:'no-store'});
  if(!r.ok)throw new Error('manifest '+r.status);
  _tplManifest=await r.json();
  return _tplManifest;
}
async function fetchTplDoc(entry){
  const file=entry.file||(entry.id+'.json');
  const r=await fetch(TPL_BASE+file,{cache:'no-store'});
  if(!r.ok)throw new Error('template '+r.status);
  return r.json();
}
// 缩略图：用 index.json 里的轻量 preview（节点坐标+连线）渲染 SVG，无需加载整份模板文件
function tplThumbFromPreview(pv){
  if(!pv||!Array.isArray(pv.pts)||!pv.pts.length)return '<svg viewBox="0 0 300 130" xmlns="http://www.w3.org/2000/svg"></svg>';
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  pv.pts.forEach(p=>{minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);});
  const w=maxX-minX||1,h=maxY-minY||1,pad=40;
  const sc=Math.min((300-pad)/w,(130-pad)/h);
  const ox=(300-w*sc)/2-minX*sc, oy=(130-h*sc)/2-minY*sc;
  const px=p=>[p[0]*sc+ox,p[1]*sc+oy];
  let svg='<svg viewBox="0 0 300 130" xmlns="http://www.w3.org/2000/svg">';
  (pv.edges||[]).forEach(e=>{const a=pv.pts[e[0]],b=pv.pts[e[1]];if(!a||!b)return;const A=px(a),B=px(b);svg+='<path d="M'+A[0]+' '+A[1]+' L'+B[0]+' '+A[1]+' L'+B[0]+' '+B[1]+'" fill="none" stroke="'+(e[2]||'#4dd0ff')+'" stroke-width="1.5" opacity="0.8"/>';});
  pv.pts.forEach(p=>{const P=px(p);svg+='<circle cx="'+P[0]+'" cy="'+P[1]+'" r="4" fill="#4dd0ff"/>';});
  return svg+'</svg>';
}
// 把模板文档应用到画布：seed→自动布局；canvas→按原样还原(importCanvasJSON)
async function loadTemplateData(doc){
  if(!doc)return;
  if(doc.seed&&Array.isArray(doc.seed.nodes)){
    const tn=doc.seed.nodes, te=Array.isArray(doc.seed.edges)?doc.seed.edges:[];
    nodes=tn;edges=te;
    selNode=selEdge=null;showPanel('none');
    ids={};nodes.forEach(n=>{const m=String(n.id).match(/^(.+?)_?(\d+)$/);if(m){ids[m[1]]=Math.max(ids[m[1]]||0,parseInt(m[2]));}});
    busMerge=true;
    edges.forEach(e=>{ delete e.waypoints; });
    autoLayout(true);          // 布局 + 整理走线（静默，不单独入历史）
    history=[];histIdx=-1;snapshot();
  }else{
    const canvas=doc.canvas||doc;
    nodes=[];edges=[];          // 已在调用处确认替换，清空以跳过 importCanvasJSON 内的二次确认
    await importCanvasJSON(canvas);
  }
}
async function loadTemplateById(id){
  const mf=await loadTplManifest();
  const entry=(mf.templates||[]).find(t=>t.id===id);
  if(!entry){flashHint(lang==='en'?'Template not found':'模板不存在');return;}
  const doc=await fetchTplDoc(entry);
  await loadTemplateData(doc);
  currentTemplateId=id;
}
async function loadDefaultTemplate(){
  try{
    const mf=await loadTplManifest(true);
    const id=mf.default||((mf.templates||[])[0]&&mf.templates[0].id);
    if(id)await loadTemplateById(id);
  }catch(err){console.warn('load default template failed',err);flashHint(lang==='en'?'Failed to load templates':'加载模板失败');}
}
// 兼容旧调用
async function loadDemo(){ openTemplates(); }

// ───── 模板选择器 ─────
async function openTemplates(){
  const ov=document.getElementById('tpl-overlay');
  const grid=document.getElementById('tpl-grid');
  document.getElementById('tpl-title').textContent=lang==='en'?'📂 Templates':'📂 模板库';
  ov.classList.add('show');
  grid.innerHTML='<div class="tpl-empty">'+(lang==='en'?'Loading…':'加载中…')+'</div>';
  let mf;
  try{ mf=await loadTplManifest(true); }
  catch(err){ grid.innerHTML='<div class="tpl-empty" style="color:#ff7a6a">'+(lang==='en'?'Failed to load templates/index.json':'加载 templates/index.json 失败')+'</div>'; return; }
  renderTemplateCards(mf);
}
function renderTemplateCards(mf){
  const grid=document.getElementById('tpl-grid');grid.innerHTML='';
  const list=(mf&&mf.templates)||[];
  if(!list.length){grid.innerHTML='<div class="tpl-empty">'+(lang==='en'?'No templates yet.':'暂无模板。')+'</div>';return;}
  list.forEach(entry=>{
    const isDef=entry.id===mf.default;
    const card=document.createElement('div');card.className='tpl-card'+(isDef?' default':'');
    const nm=(lang==='en'?(entry.nameEn||entry.name):entry.name)||entry.id;
    const desc=entry.desc||'';
    let badges=isDef?'<span class="tpl-badge">'+(lang==='en'?'Default':'默认')+'</span>':'';
    if(!entry.builtin)badges+='<span class="tpl-badge tpl-badge-user">'+(lang==='en'?'Custom':'自定义')+'</span>';
    card.innerHTML='<div class="tpl-thumb">'+tplThumbFromPreview(entry.preview)+'</div>'+
      '<div class="tpl-name">'+tplEsc(nm)+badges+'</div>'+
      '<div class="tpl-desc">'+tplEsc(desc)+'</div>'+
      '<div class="tpl-card-acts">'+
        '<button class="tpl-act" data-act="load">'+(lang==='en'?'Use':'使用')+'</button>'+
        '<button class="tpl-act" data-act="edit">'+(lang==='en'?'Edit':'编辑')+'</button>'+
        '<button class="tpl-act" data-act="rename">'+(lang==='en'?'Rename':'重命名')+'</button>'+
        '<button class="tpl-act tpl-act-del" data-act="del">'+(lang==='en'?'Delete':'删除')+'</button>'+
      '</div>';
    card.querySelector('.tpl-thumb').onclick=()=>chooseTemplate(entry.id);
    card.querySelectorAll('.tpl-act').forEach(b=>{
      b.onclick=(ev)=>{ev.stopPropagation();const a=b.dataset.act;
        if(a==='load')chooseTemplate(entry.id);
        else if(a==='edit')editTemplate(entry.id);
        else if(a==='rename')renameTemplate(entry.id);
        else if(a==='del')deleteTemplateById(entry.id);};
    });
    grid.appendChild(card);
  });
}
function closeTemplates(){document.getElementById('tpl-overlay').classList.remove('show');}
async function chooseTemplate(id){
  if(nodes.length>0){const ok=await uiConfirm(lang==='en'?'Load template and replace current content?':'加载模板将替换当前内容，确定？',false);if(!ok)return;}
  try{ await loadTemplateById(id); _tplEditMode=false; closeTemplates(); }
  catch(err){ console.warn(err); flashHint(lang==='en'?'Failed to load template':'加载模板失败'); }
}
async function editTemplate(id){
  if(nodes.length>0){const ok=await uiConfirm(lang==='en'?'Load this template for editing? Current canvas will be replaced.':'载入该模板进行编辑？当前画布将被替换。',false);if(!ok)return;}
  try{
    await loadTemplateById(id);    // 内部已设置 currentTemplateId=id
    _tplEditMode=true;             // 标记为编辑：保存对话框默认勾选「覆盖此模板」
    closeTemplates();
    const mf=await loadTplManifest();const e=(mf.templates||[]).find(t=>t.id===id);
    const nm=e?((lang==='en'?(e.nameEn||e.name):e.name)||id):id;
    flashHint(lang==='en'?('Editing “'+nm+'” — change it, then File ▾ → Save as template → overwrite'):('正在编辑「'+nm+'」，改完点 文件▾ → 保存为模板 →（勾选覆盖此模板）'));
  }catch(err){ console.warn(err); flashHint(lang==='en'?'Failed to load template':'加载模板失败'); }
}

// ───── 保存 / 重命名 对话框（promise 形式） ─────
function tplDialog(opts){
  return new Promise(resolve=>{
    const ov=document.getElementById('tplsave-overlay');
    document.getElementById('tplsave-title').textContent=opts.title;
    const inName=document.getElementById('tplsave-name'),inEn=document.getElementById('tplsave-name-en'),inDesc=document.getElementById('tplsave-desc');
    document.getElementById('tplsave-name-label').textContent=lang==='en'?'Name (Chinese)':'模板名称（中文）';
    document.getElementById('tplsave-name-en-label').textContent=lang==='en'?'Name (English)':'模板名称（English）';
    document.getElementById('tplsave-desc-label').textContent=lang==='en'?'Description':'描述';
    inName.value=opts.name||'';inEn.value=opts.nameEn||'';inDesc.value=opts.desc||'';
    const owRow=document.getElementById('tplsave-overwrite-row'),owCb=document.getElementById('tplsave-overwrite');
    if(opts.showOverwrite){owRow.style.display='';owCb.checked=!!opts.overwriteDefault;
      document.getElementById('tplsave-overwrite-text').textContent=(lang==='en'?'Overwrite current template ':'覆盖当前模板「')+(opts.curName||'')+(lang==='en'?'':'」');}
    else{owRow.style.display='none';owCb.checked=false;}
    const ok=document.getElementById('tplsave-ok'),ca=document.getElementById('tplsave-cancel');
    ok.textContent=opts.okText||(lang==='en'?'Save':'保存');
    ca.textContent=lang==='en'?'Cancel':'取消';
    ov.classList.add('show');setTimeout(()=>inName.focus(),30);
    const done=v=>{ov.classList.remove('show');ok.onclick=null;ca.onclick=null;resolve(v);};
    ok.onclick=()=>{const name=inName.value.trim();if(!name){inName.focus();return;}
      const result={name,nameEn:inEn.value.trim()||name,desc:inDesc.value.trim(),overwrite:opts.showOverwrite&&owCb.checked};
      // opts.validate 返回非空错误串 → 提示并保持对话框打开（如重名），不关闭、不 resolve，让用户就地改名。
      if(opts.validate){const err=opts.validate(result);if(err){flashHint(err);inName.focus();if(inName.select)inName.select();return;}}
      done(result);};
    ca.onclick=()=>done(null);
  });
}
function tplPreviewOfCanvas(){
  const idx={};nodes.forEach((n,i)=>idx[n.id]=i);
  const pts=nodes.map(n=>[Math.round(n.x),Math.round(n.y)]);
  const eg=edges.map(e=>{const a=idx[e.from],b=idx[e.to];if(a==null||b==null)return null;return [a,b,(ET[e.et]||ET.ac_power).color];}).filter(Boolean);
  return {pts,edges:eg};
}
// 模板重名校验：中/英名忽略大小写与首尾空格；exceptId=允许与之同名的模板（即当前覆盖目标）。
function tplNameClash(templates,name,nameEn,exceptId){
  const norm=s=>String(s==null?'':s).trim().toLowerCase();
  const nm=norm(name),nmEn=norm(nameEn);
  return (templates||[]).find(t=>t.id!==exceptId&&(norm(t.name)===nm||(nmEn&&norm(t.nameEn)===nmEn)))||null;
}
async function saveCanvasAsTemplate(){
  if(!nodes.length){flashHint(lang==='en'?'Canvas is empty':'画布为空，无法保存');return;}
  // 重名校验依赖完整清单：拉取失败(服务不可用)时 fail-closed，不在状态未知时保存，以免产生重复模板。
  //  生产静态部署下清单是静态 index.json，正常可读；此处仅在清单真正不可达时阻断。
  let templates;
  try{const mf=await loadTplManifest();templates=(mf&&Array.isArray(mf.templates))?mf.templates:null;}catch(err){templates=null;}
  if(!templates){flashHint(lang==='en'?'Template service unavailable — cannot save now':'模板服务不可用，暂时无法保存（无法校验重名）');return;}
  const curTemplateId=currentTemplateId;   // 快照：对话框为异步等待，其间 currentTemplateId 可能被改动，覆盖目标与查名一律用此快照
  const curEntry=curTemplateId?templates.find(t=>t.id===curTemplateId):null;
  // 当前模板名（语言相关、去首尾空格、无 id 兜底）：真正有名称才允许「覆盖」。
  const curName=((curEntry?(lang==='en'?(curEntry.nameEn||curEntry.name):(curEntry.name||curEntry.nameEn)):'')||'').trim();
  // 只要「已加载模板且能在清单中找到」就展示「覆盖」选项（保证一致性：使用任意模板后都在）。
  const canOverwrite=!!(curEntry&&curName);
  // 覆盖默认不勾：默认「另存为新」，要更新原模板需手动勾选。重名会被 validate 拦截并提示勾选覆盖，故默认不勾也不会误建重复。
  const overwriteDefault=false;
  // 重名校验放在对话框「保存」点击处：中/英名与其它模板（非当前覆盖目标）重复则阻止保存并保持对话框打开。
  //  overwriteId 依赖复选框实时状态，故在 validate 内按 r.overwrite 重算。
  const res=await tplDialog({title:lang==='en'?'💾 Save as template':'💾 保存为模板',
    name:(canOverwrite?curName:''),showOverwrite:canOverwrite,overwriteDefault,curName,
    validate:(r)=>{
      const oid=(r.overwrite&&canOverwrite)?curTemplateId:null;
      const clash=tplNameClash(templates,r.name,r.nameEn,oid);
      if(!clash)return null;
      const cn=(lang==='en'?(clash.nameEn||clash.name):clash.name)||clash.id;
      // 仅当「未勾覆盖 且 撞的正是当前模板」时，勾选覆盖能解决 → 才提示勾选覆盖；
      //  其余情形（已勾覆盖、或撞的是另一个模板）勾覆盖无用，只能改名。
      const fixableByOverwrite=canOverwrite&&!r.overwrite&&clash.id===curTemplateId;
      if(lang==='en'){
        return fixableByOverwrite
          ? ('A template named “'+cn+'” already exists — use another name, or tick “overwrite current template”')
          : ('The name “'+cn+'” is already used by another template (name / English name must be unique) — use another name');
      }
      return fixableByOverwrite
        ? ('已存在同名模板「'+cn+'」，请改用其它名称，或勾选「覆盖当前模板」')
        : ('名称「'+cn+'」已被另一个模板使用（中/英文名均不可重复），请改用其它名称');
    }});
  if(!res)return;
  const overwriteId=(res.overwrite&&canOverwrite)?curTemplateId:null;
  const canvas=JSON.parse(buildJSON());
  const preview=tplPreviewOfCanvas();
  const meta={name:res.name,nameEn:res.nameEn,desc:res.desc};
  try{
    if(overwriteId){
      const r=await fetch(TPL_API+'/'+encodeURIComponent(overwriteId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({template:meta,canvas,preview})});
      if(!r.ok)throw new Error('HTTP '+r.status);
      _tplManifest=null;flashHint(lang==='en'?'Template updated':'模板已更新');
    }else{
      const r=await fetch(TPL_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({template:meta,canvas,preview})});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const data=await r.json();if(data&&data.entry)currentTemplateId=data.entry.id;
      _tplEditMode=true;          // 之后再保存默认覆盖这个新建模板
      _tplManifest=null;flashHint(lang==='en'?'Template saved':'模板已保存');
    }
  }catch(err){
    console.warn('save template failed',err);
    // 无写入后端时兜底：下载模板 JSON，提示放入 templates/
    const doc={schemaVersion:'tpl-1',template:{name:res.name,nameEn:res.nameEn,desc:res.desc,builtin:false},canvas,preview};
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}));
    a.download=(res.name||'template')+'.json';a.click();
    flashHint(lang==='en'?'Save API unavailable — JSON downloaded; drop it into templates/ (auto-listed by folder scan)':'保存接口不可用：已下载 JSON，放入 templates/ 目录即可（清单由目录扫描自动生成）');
    return;
  }
  if(document.getElementById('tpl-overlay').classList.contains('show')){try{renderTemplateCards(await loadTplManifest(true));}catch(e){}}
}
async function renameTemplate(id){
  const mf=await loadTplManifest();const e=(mf.templates||[]).find(t=>t.id===id);if(!e)return;
  // 重名校验（排除自身）放在「重命名」点击处：中/英名与其它模板重复则阻止并保持对话框打开。
  const res=await tplDialog({title:lang==='en'?'✎ Rename template':'✎ 重命名模板',name:e.name,nameEn:e.nameEn,desc:e.desc,okText:lang==='en'?'Rename':'重命名',
    validate:(r)=>{
      const clash=tplNameClash(mf.templates,r.name,r.nameEn,id);
      if(!clash)return null;
      const cn=(lang==='en'?(clash.nameEn||clash.name):clash.name)||clash.id;
      return lang==='en'?('A template named “'+cn+'” already exists (name / English name must be unique) — use another name'):('已存在同名模板「'+cn+'」（中/英文名均不可重复），请改用其它名称');
    }});
  if(!res)return;
  try{
    const r=await fetch(TPL_API+'/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({template:{name:res.name,nameEn:res.nameEn,desc:res.desc}})});
    if(!r.ok)throw new Error('HTTP '+r.status);
    _tplManifest=null;flashHint(lang==='en'?'Renamed':'已重命名');
    renderTemplateCards(await loadTplManifest(true));
  }catch(err){console.warn(err);flashHint(lang==='en'?'Rename API unavailable (needs backend)':'重命名接口不可用（需后端支持）');}
}
async function deleteTemplateById(id){
  const mf=await loadTplManifest();const e=(mf.templates||[]).find(t=>t.id===id);if(!e)return;
  const nm=(lang==='en'?(e.nameEn||e.name):e.name)||id;
  const ok=await uiConfirm(lang==='en'?('Delete template “'+nm+'”? Its JSON file will be removed.'):('确定删除模板「'+nm+'」？将删除其 JSON 文件。'),true);
  if(!ok)return;
  try{
    const r=await fetch(TPL_API+'/'+encodeURIComponent(id),{method:'DELETE'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    if(currentTemplateId===id){currentTemplateId=null;_tplEditMode=false;}
    _tplManifest=null;flashHint(lang==='en'?'Deleted':'已删除');
    renderTemplateCards(await loadTplManifest(true));
  }catch(err){console.warn(err);flashHint(lang==='en'?'Delete API unavailable (needs backend)':'删除接口不可用（需后端支持）');}
}
// 整理走线：无障碍走直线，有障碍走正交，交叉则尝试正交化（无提示版，供初始化调用）
function _rawPathFor(e){ return edgePathRaw(e); }
function _countCrossRaw(){
  const paths=edges.map(e=>_rawPathFor(e)).filter(Boolean);
  let n=0;
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){if(pathsCross(paths[i],paths[j]))n++;}
  return n;
}
function applyTidyRouting(){
  // 交给智能路由引擎统一计算：重算端口 · 最短避障 · 少交叉
  resetEdgeRoutingForAutoLayout(edges);
  invalidateRouting(); recomputeAllPaths();
}
function _countCrossRendered(){ return _countCross(); }
function setRouteStyle(s){ routeStyle=parseInt(s); applyTidyRouting(); invalidateRouting(); snapshot();
  document.querySelectorAll('#seg-route .seg-btn').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.rs)===routeStyle));
  flashHint(['','全部正交走线','直连优先','智能(默认)'][routeStyle]+' · 剩余交叉 '+_countCross()); }

// ══════════════════════════════════════════════════════════════
// ★ 只读运行模式（前端嵌入/独立托管）：与运营端编辑器同一份渲染器 + 同一套规则引擎，
//   保证前端拓扑/连线/流向/字段与运营端「像素级一致」。前端动态拉取画布 JSON 与实时数据即可。
//   开启方式（任选）：
//     1) URL 参数：?mode=runtime&topology=<画布JSON地址>&signals=<实时数据地址>&interval=2000
//        其它参数：fit=0 关闭自动适配；interactive=1 允许平移/缩放（默认只读不可交互）
//     2) iframe 内嵌：父页面 postMessage({type:'topo:topology',data:画布JSON对象})、
//        {type:'topo:signals',data:{信号:值}}（整批覆盖）、{type:'topo:merge',data:{...}}（增量合并）
//     3) JS API：window.TopoRuntime.loadTopology(对象或URL) / setSignals(obj) / mergeSignals(obj) / fit()
//   实时数据键名 = 规则里用的信号名：节点字段「节点id.字段英文名」、全局信号名。
// ══════════════════════════════════════════════════════════════
let _rtCfg=null,_rtTimer=null;
function topoRuntimeConfig(){
  let cfg=null;
  try{
    const q=new URLSearchParams(location.search);
    const mode=(q.get('mode')||'').toLowerCase();
    const on=(mode==='runtime'||mode==='view'||mode==='embed'||q.has('embed')||(typeof window!=='undefined'&&window.__TOPO_RUNTIME__));
    if(!on)return null;
    cfg={ topology:q.get('topology')||q.get('topo')||null,
          signals:q.get('signals')||null,
          interval:parseInt(q.get('interval')||'0',10)||0,
          fit:q.get('fit')!=='0',
          interactive:q.get('interactive')==='1' };
    if(window.__TOPO_RUNTIME__&&typeof window.__TOPO_RUNTIME__==='object')cfg=Object.assign(cfg,window.__TOPO_RUNTIME__);
  }catch(e){ cfg=(typeof window!=='undefined'&&window.__TOPO_RUNTIME__)?Object.assign({fit:true},window.__TOPO_RUNTIME__):null; }
  return cfg;
}
// 实时数据 → 既喂规则(signalValues)，又回写字段值/状态用于显示（与编辑器同一套字段渲染）
function applyLiveSignals(payload){
  if(!payload||typeof payload!=='object')return;
  Object.keys(payload).forEach(k=>{
    const v=payload[k];
    signalValues[k]=v;                                   // 规则求值用
    const ps=parseSignal(k);                             // 映射到节点字段→更新显示
    if(ps&&ps.node&&ps.node!=='@global'){
      const n=nodes.find(x=>x.id===ps.node); if(!n)return;
      // 仅把实时值映射到节点「数据字段」用于显示；status / online 已移除（任意键仍存入 signalValues 供规则求值）
      const f=(n.data||[]).find(d=>fieldSigKey(d)===ps.field); if(f)f.dv=v;
    }
  });
  // 流向/显隐由渲染循环每帧按 signalValues 实时求值，无需手动重绘
}
async function rtLoadTopology(src){
  let obj=src;
  try{ if(typeof src==='string'){ const r=await fetch(src,{cache:'no-store'}); obj=await r.json(); } }
  catch(e){ console.error('[TopoRuntime] 拉取画布 JSON 失败：',e); return false; }
  nodes=[];edges=[];selNode=selEdge=null; try{selSet&&selSet.clear&&selSet.clear();}catch(e){}   // 置空以跳过导入二次确认
  try{ await importCanvasJSON(obj); }catch(e){ console.error('[TopoRuntime] 还原画布失败：',e); return false; }
  previewMode=true;                                      // 运行视图：被规则隐藏者彻底不画
  if(!_rtCfg||_rtCfg.fit!==false){ resizeCanvas(); fitView(); }
  return true;
}
function _rtStartSignalFeed(){
  if(!_rtCfg||!_rtCfg.signals)return;
  const pull=()=>fetch(_rtCfg.signals,{cache:'no-store'}).then(r=>r.json()).then(applyLiveSignals).catch(e=>console.error('[TopoRuntime] 拉取实时数据失败：',e));
  pull();
  if(_rtCfg.interval>0){ if(_rtTimer)clearInterval(_rtTimer); _rtTimer=setInterval(pull,_rtCfg.interval); }
}
function enterRuntimeMode(cfg){
  _rtCfg=cfg||{fit:true};
  previewMode=true;
  document.body.classList.add('rt'); if(!_rtCfg.interactive)document.body.classList.add('rt-lock');
  // 注入只读样式：隐藏编辑器全部外壳，画布铺满容器
  if(!document.getElementById('topo-rt-style')){
    const st=document.createElement('style');st.id='topo-rt-style';
    st.textContent='body.rt #topbar,body.rt #ebar,body.rt #alignbar,body.rt #sidebar-wrap,body.rt #props,body.rt .panel-toggle,body.rt #chint,body.rt #ehint,body.rt #corner-info,body.rt #bgpanel,body.rt #bgpanel-overlay,body.rt .simpanel,body.rt #jpanel,body.rt #ctxmenu,body.rt #uo{display:none!important}'
      +'body.rt #main{height:100vh}body.rt #cwrap{width:100vw;height:100vh}body.rt.rt-lock #c{pointer-events:none}';
    document.head.appendChild(st);
  }
  resizeCanvas();
  // 对外 JS API
  window.TopoRuntime={ loadTopology:rtLoadTopology,
    setSignals:o=>{signalValues={};applyLiveSignals(o);},
    mergeSignals:applyLiveSignals,
    fit:()=>{resizeCanvas();fitView();},
    config:()=>_rtCfg };
  // iframe 内嵌：接收父页面推送的拓扑与实时数据
  window.addEventListener('message',ev=>{ const d=ev&&ev.data; if(!d||typeof d!=='object')return;
    if(d.type==='topo:topology'&&d.data)rtLoadTopology(d.data);
    else if(d.type==='topo:signals'&&d.data){ signalValues={}; applyLiveSignals(d.data); }
    else if(d.type==='topo:merge'&&d.data) applyLiveSignals(d.data); });
  // 容器尺寸变化时重新适配
  window.addEventListener('resize',()=>{ resizeCanvas(); if(_rtCfg.fit!==false)fitView(); });
  // 初始拓扑 → 实时数据
  if(_rtCfg.topology){ rtLoadTopology(_rtCfg.topology).then(_rtStartSignalFeed); }
  else { _rtStartSignalFeed(); }
  // 通知宿主已就绪（iframe 场景可据此再 postMessage 数据）
  try{ if(window.parent&&window.parent!==window)window.parent.postMessage({type:'topo:ready'},'*'); }catch(e){}
}
// 初始主题 setTheme('blue_screen') 与应用启动均移至 topology-editor-12-bootstrap.js（最后加载）。
