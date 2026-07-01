// ══════════════════════════════════════════════════════════════
// ★ 数据驱动引擎（动态显隐 / 流向 / 条件连线）——编辑器预览与运行端共用同一套逻辑
// ══════════════════════════════════════════════════════════════
const RULE_OPS=[{v:'>=',t:'≥'},{v:'<=',t:'≤'},{v:'>',t:'>'},{v:'<',t:'<'},{v:'==',t:'='},{v:'!=',t:'≠'},
  {v:'in',t:'属于'},{v:'between',t:'区间'},{v:'truthy',t:'为真'},{v:'falsy',t:'为假'},{v:'exists',t:'存在'}];
const RULE_DIRS=[{v:'forward',t:'正向 →'},{v:'reverse',t:'反向 ←'},{v:'both',t:'双向 ↔'},{v:'none',t:'无流向'}];
const _OPT={'>=':'≥','<=':'≤','>':'>','<':'<','==':'=','!=':'≠','in':'∈','between':'∈区间','truthy':'为真','falsy':'为假','exists':'存在'};
function _num(x){if(typeof x==='number')return x;if(typeof x==='boolean')return x?1:0;const f=parseFloat(x);return isNaN(f)?NaN:f;}
function _looseEq(a,b){if(a===b)return true;const na=_num(a),nb=_num(b);if(!isNaN(na)&&!isNaN(nb))return na===nb;return String(a)===String(b);}
function _toList(rv){if(Array.isArray(rv))return rv;return String(rv==null?'':rv).split(',').map(s=>s.trim()).filter(s=>s!=='');}
function autoNum(v){if(typeof v!=='string')return v;const t=v.trim();if(t==='')return '';if(t==='true')return true;if(t==='false')return false;if(/^-?\d+(\.\d+)?$/.test(t))return parseFloat(t);return v;}
// 单条件求值
function cmpOp(lv,op,rv){
  switch(op){
    case '==': return _looseEq(lv,rv);
    case '!=': return !_looseEq(lv,rv);
    case '>':  return _num(lv)>_num(rv);
    case '>=': return _num(lv)>=_num(rv);
    case '<':  return _num(lv)<_num(rv);
    case '<=': return _num(lv)<=_num(rv);
    case 'truthy': return !!lv && lv!=='false' && lv!=='0';
    case 'falsy':  return !lv || lv==='false' || lv==='0';
    case 'exists': return lv!==undefined && lv!==null && lv!=='';
    case 'in':     return _toList(rv).some(x=>_looseEq(lv,x));
    case 'between':{const a=_toList(rv).map(_num);if(a.length<2)return false;return _num(lv)>=Math.min(a[0],a[1])&&_num(lv)<=Math.max(a[0],a[1]);}
    default: return true;
  }
}
// 条件树求值：null/无条件 → true；支持 all/any/not + 叶子{var,op,val|ref}
function evalCond(cond, ctx){
  if(cond==null)return true;
  if(typeof cond!=='object')return !!cond;
  if(Array.isArray(cond.all))return cond.all.every(c=>evalCond(c,ctx));
  if(Array.isArray(cond.any))return cond.any.some(c=>evalCond(c,ctx));
  if(cond.not!=null)return !evalCond(cond.not,ctx);
  if(cond.var==null)return true;
  const lv=ctx[cond.var];
  const rv=(cond.ref!=null)?ctx[cond.ref]:cond.val;
  return cmpOp(lv,cond.op||'truthy',rv);
}
// 汇总当前画布全部可用信号：节点字段(id.字段) + 自定义全局信号（status/online 已移除）
function collectSignals(){
  const out=[],seen=new Set();
  const add=(name,label)=>{if(name&&!seen.has(name)){seen.add(name);out.push({name,label:label||name});}};
  nodes.forEach(n=>{
    // 节点的可用信号 = 仅它「合法的数据字段」；不合法(空名/同节点重名)字段不作为可用信号，避免选到半成品或重名冲突键
    const iss=fieldNameIssues(n);
    (n.data||[]).forEach((f,i)=>{if(fieldSigKey(f)&&fieldNameOk(iss[i]))add(fieldSig(n,f),nodeLabel(n)+' · '+(f.key||fieldSigKey(f)));});
  });
  const gi=globalSigIssues();   // 全局信号：信号键=英文名，仅合法(中英文名必填且唯一)的入列
  (customSignals||[]).forEach((s,i)=>{if(fieldSigKey(s)&&fieldNameOk(gi[i]))add(fieldSigKey(s),sigDisplayName(s));});
  return out;
}
// 构造求值上下文：静态默认值(节点字段dv/自定义样例) 叠加注入的样例值
function buildCtx(values){
  const ctx={};
  nodes.forEach(n=>{
    // 仅以节点「合法数据字段」的默认值入栈；不合法(空名/同节点重名)字段不参与求值，避免重名键相互覆盖
    const iss=fieldNameIssues(n);
    (n.data||[]).forEach((f,i)=>{if(fieldSigKey(f)&&fieldNameOk(iss[i]))ctx[fieldSig(n,f)]=f.dv;});
  });
  const gi=globalSigIssues();
  (customSignals||[]).forEach((s,i)=>{if(fieldSigKey(s)&&fieldNameOk(gi[i])&&s.dv!==undefined)ctx[fieldSigKey(s)]=s.dv;});
  if(values)Object.keys(values).forEach(k=>{ctx[k]=values[k];});
  return ctx;
}
// 连线有效流向：按 dirRules 顺序匹配，首个命中生效，否则用 e.dir
function edgeDirFor(e,ctx){
  if(Array.isArray(e.dirRules))for(const r of e.dirRules){if(evalCond(r.when,ctx))return r.dir;}
  return e.dir||'forward';
}
// 节点有效图标：按 iconRules 顺序匹配，首个命中生效，否则用节点自身 type（返回 type 字符串）
function nodeIconFor(n,ctx){
  if(Array.isArray(n.iconRules))for(const r of n.iconRules){if(r&&r.icon&&evalCond(r.when,ctx))return r.icon;}
  return n.type;
}
// 计算一帧的动态结果：隐藏节点集、隐藏连线集、流向覆盖表、图标覆盖表(仅存放"与自身type不同"的生效图标)
function computeDynamic(ctx){
  const hiddenNodes=new Set(),hiddenEdges=new Set(),dirMap=new Map(),iconMap=new Map();
  nodes.forEach(n=>{
    if(n.visibleWhen!=null&&!evalCond(n.visibleWhen,ctx))hiddenNodes.add(n.id);
    if(Array.isArray(n.iconRules)&&n.iconRules.length){const it=nodeIconFor(n,ctx);if(it&&it!==n.type)iconMap.set(n.id,it);}
  });
  edges.forEach(e=>{
    let hidden=hiddenNodes.has(e.from)||hiddenNodes.has(e.to);
    if(!hidden&&e.showWhen!=null&&!evalCond(e.showWhen,ctx))hidden=true;
    if(hidden)hiddenEdges.add(e);
    else if(Array.isArray(e.dirRules)&&e.dirRules.length)dirMap.set(e,edgeDirFor(e,ctx));
  });
  return {hiddenNodes,hiddenEdges,dirMap,iconMap};
}
// 渲染期取连线有效流向：流向规则随信号实时求值并自动生效（编辑态与预览态一致）；
// 有命中规则时用规则结果（dirMap），否则用连线自身的「固定流向」e.dir 兜底。仅改流向，不改连线类型/走线。
function effDir(e){ return _dyn.dirMap.has(e)?_dyn.dirMap.get(e):(e.dir||'forward'); }
// 渲染期取节点有效图标 type：命中图标规则时用规则结果(iconMap)，否则用节点自身 type。仅改绘制图标，不改节点 type/尺寸/其它逻辑。
function effIconType(n){ return (_dyn.iconMap&&_dyn.iconMap.has(n.id))?_dyn.iconMap.get(n.id):n.type; }
function nodeHasRule(n){ return n&&(n.visibleWhen!=null||(Array.isArray(n.iconRules)&&n.iconRules.length>0)); }
function edgeHasRule(e){ return e&&(e.showWhen!=null||(Array.isArray(e.dirRules)&&e.dirRules.length>0)); }
// 编辑态下「带规则」的元素角标：琥珀色小圆角标签内含「规」字(EN: R)，语义明确——表示该元素配置了数据驱动规则，
// 与青色的数据值卡片区分，避免被误认为多余的数据点。
function drawCondBadge(x,y){
  ctx.save();ctx.shadowBlur=0;ctx.setLineDash([]);
  const w=17/zoom,h=17/zoom,rr=4.5/zoom;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(x-w/2,y-h/2,w,h,rr);else ctx.rect(x-w/2,y-h/2,w,h);
  ctx.fillStyle='#ffcc44';ctx.fill();
  ctx.lineWidth=1.2/zoom;ctx.strokeStyle='#3a2a00';ctx.stroke();
  // 漏斗(过滤/条件)图标——矢量填充，任意缩放都清晰；语义=按条件筛选→「带规则」，不会被误认为数据点
  const k=4.4/zoom;
  ctx.fillStyle='#241a00';
  ctx.beginPath();
  ctx.moveTo(x-k,     y-k*0.78);
  ctx.lineTo(x+k,     y-k*0.78);
  ctx.lineTo(x+k*0.32,y+k*0.05);
  ctx.lineTo(x+k*0.32,y+k*0.92);
  ctx.lineTo(x-k*0.32,y+k*0.92);
  ctx.lineTo(x-k*0.32,y+k*0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
// 「被规则隐藏」标记：在虚化的元素/连线上画一个醒目的斜杠圆（⊘），与普通线区分，避免混淆。强制满透明绘制。
function drawHiddenBadge(x,y){
  ctx.save();ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.setLineDash([]);
  const r=6.5/zoom;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle='rgba(16,24,40,0.95)';ctx.fill();
  ctx.lineWidth=1.7/zoom;ctx.strokeStyle='#8aa0bf';ctx.stroke();
  const d=r*0.6;ctx.beginPath();ctx.moveTo(x-d,y+d);ctx.lineTo(x+d,y-d);ctx.lineWidth=1.8/zoom;ctx.strokeStyle='#cdd8ea';ctx.stroke();
  ctx.restore();
}

// ───── 条件 ↔ 编辑态(扁平组) 互转 ─────
function _leafToRow(c){const row={var:c.var||'',op:c.op||'>=',isRef:(c.ref!=null)};if(c.ref!=null)row.ref=c.ref;else row.val=(c.val!=null?c.val:'');return row;}
function condToEdit(cond){
  if(cond==null)return {mode:'all',rows:[]};
  if(Array.isArray(cond.all))return {mode:'all',rows:cond.all.filter(c=>c&&c.var!=null).map(_leafToRow)};
  if(Array.isArray(cond.any))return {mode:'any',rows:cond.any.filter(c=>c&&c.var!=null).map(_leafToRow)};
  if(cond.var!=null)return {mode:'all',rows:[_leafToRow(cond)]};
  return {mode:'all',rows:[]};
}
function _rowToLeaf(r){
  if(!r.var)return null;
  const leaf={var:r.var,op:r.op};
  if(['truthy','falsy','exists'].includes(r.op))return leaf;
  if(r.isRef){if(!r.ref)return null;leaf.ref=r.ref;}
  else leaf.val=autoNum(r.val);
  return leaf;
}
function editToCond(st){
  const leaves=st.rows.map(_rowToLeaf).filter(Boolean);
  if(!leaves.length)return null;
  if(leaves.length===1)return leaves[0];
  return {[st.mode]:leaves};
}
// 条件 → 可读摘要
function condSummary(cond){
  function leaf(c){const v=c.var||'?';if(['truthy','falsy','exists'].includes(c.op))return v+_OPT[c.op];const r=(c.ref!=null)?c.ref:c.val;return v+(_OPT[c.op]||c.op)+r;}
  function walk(c){if(c==null)return '';if(Array.isArray(c.all))return c.all.map(walk).filter(Boolean).join(' 且 ');if(Array.isArray(c.any))return '('+c.any.map(walk).filter(Boolean).join(' 或 ')+')';if(c.not!=null)return '非('+walk(c.not)+')';if(c.var!=null)return leaf(c);return '';}
  return walk(cond)||null;
}

// ───── 信号选择器：先选分类（元素 / 全局信号），再选具体信号 ─────
// value 为完整信号名（如 bms_1.SOC(%) 或自定义全局信号名）；变更时回调 onChange(完整信号名)
function makeSignalPicker(value, onChange){
  const wrap=document.createElement('span');wrap.className='rm-sigwrap';
  const nsel=document.createElement('select');nsel.className='rm-sig-node';
  const fsel=document.createElement('select');fsel.className='rm-sig-field';
  const state={node:'',field:''};
  if(value){const p=parseSignal(value);state.node=p.node;state.field=p.field;}
  const opt=(v,t)=>{const o=document.createElement('option');o.value=v;o.textContent=t;return o;};
  function fillNodes(){
    nsel.innerHTML='';
    nsel.appendChild(opt('',lang==='en'?'Category…':'选择分类…'));
    nodes.forEach(n=>nsel.appendChild(opt(n.id,nodeLabel(n))));
    if((customSignals&&customSignals.length)||state.node==='@global')nsel.appendChild(opt('@global',lang==='en'?'＊Global signals':'＊全局信号'));
    nsel.value=state.node;
  }
  function fillFields(){
    fsel.innerHTML='';
    fsel.appendChild(opt('',lang==='en'?'Signal…':'选择信号…'));
    const opts=state.node?fieldOptionsFor(state.node):[];
    opts.forEach(o=>fsel.appendChild(opt(o.v,o.t)));
    // 兜底：当前值在选项中已不存在（节点/字段被删或导入残留），仍展示并保留
    if(state.field&&!opts.some(o=>o.v===state.field))fsel.appendChild(opt(state.field,state.field+(lang==='en'?' (missing)':'（已失效）')));
    fsel.value=state.field;fsel.disabled=!state.node;
  }
  const emit=()=>onChange(injSignalName({node:state.node,field:state.field})||'');
  nsel.onchange=e=>{state.node=e.target.value;state.field='';fillFields();emit();};
  fsel.onchange=e=>{state.field=e.target.value;emit();};
  fillNodes();fillFields();
  wrap.appendChild(nsel);wrap.appendChild(fsel);
  return wrap;
}
// ───── 信号值语义：决定规则里「值」用「布尔/枚举下拉」还是「数值/文本输入」，避免全部混为一谈 ─────
function signalValueMeta(name){
  if(!name)return {kind:'text'};
  const p=parseSignal(name);
  if(p.node==='@global'){
    const s=(customSignals||[]).find(c=>fieldSigKey(c)===p.field);
    if(!s)return {kind:'text'};
    // 与节点数据字段一致：按默认值(dv)推断类型（不再有显式类型列）
    if(typeof s.dv==='boolean')return {kind:'bool'};
    if(typeof s.dv==='number')return {kind:'num'};
    if(s.dv!==''&&s.dv!=null&&!isNaN(Number(s.dv)))return {kind:'num'};
    return {kind:'text'};
  }
  const n=nodes.find(x=>x.id===p.node);
  const f=n&&(n.data||[]).find(d=>fieldSigKey(d)===p.field);   // 信号键段用英文名，需按英文名匹配字段
  if(f){
    if(typeof f.dv==='boolean')return {kind:'bool'};
    if(typeof f.dv==='number')return {kind:'num'};
    if(f.dv!==''&&f.dv!=null&&!isNaN(Number(f.dv)))return {kind:'num'};
    return {kind:'text'};
  }
  return {kind:'num'};   // 节点数据字段默认按数值
}
// 按信号语义与运算符，生成规则里「常量值」的输入控件
function makeRuleValueInput(row){
  const meta=signalValueMeta(row.var);
  const multi=(row.op==='between'||row.op==='in');
  if(!multi&&meta.kind==='bool'){
    const sel=document.createElement('select');sel.className='rm-val';
    [['',(lang==='en'?'value…':'值…')],['true','true'],['false','false']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o);});
    sel.value=(row.val!=null?String(row.val):'');sel.onchange=e=>row.val=e.target.value;return sel;
  }
  if(!multi&&meta.kind==='enum'){
    const sel=document.createElement('select');sel.className='rm-val';
    sel.appendChild((()=>{const o=document.createElement('option');o.value='';o.textContent=(lang==='en'?'value…':'值…');return o;})());
    const opts=(meta.options||[]).map(String);
    if(row.val!=null&&row.val!==''&&!opts.includes(String(row.val)))opts.push(String(row.val));
    opts.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);});
    sel.value=(row.val!=null?String(row.val):'');sel.onchange=e=>row.val=e.target.value;return sel;
  }
  if(!multi&&meta.kind==='num'){
    const inp=document.createElement('input');inp.className='rm-val';inp.type='number';inp.placeholder=(lang==='en'?'number':'数值');inp.value=(row.val!=null?row.val:'');inp.oninput=e=>row.val=e.target.value;return inp;
  }
  const inp=document.createElement('input');inp.className='rm-val';
  inp.placeholder=(row.op==='between'?'a,b':(row.op==='in'?(lang==='en'?'v1,v2':'值1,值2'):(lang==='en'?'value':'值')));
  inp.value=(row.val!=null?row.val:'');inp.oninput=e=>row.val=e.target.value;return inp;
}
// 渲染一个「条件组」编辑器到容器；直接就地修改传入的 st 对象（{mode,rows}）
function renderCond(box, st){
  box.innerHTML='';box.className='rm-cond';
  const head=document.createElement('div');head.className='rm-row rm-head';
  const ms=document.createElement('select');ms.className='rm-mode';
  [['all','全部满足(且)'],['any','任一满足(或)']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;ms.appendChild(o);});
  ms.value=st.mode;ms.onchange=e=>{st.mode=e.target.value;};
  head.appendChild(document.createTextNode('匹配 '));head.appendChild(ms);box.appendChild(head);
  const list=document.createElement('div');box.appendChild(list);
  function drawRows(){
    list.innerHTML='';
    st.rows.forEach((row,idx)=>{
      const r=document.createElement('div');r.className='rm-row';
      const vIn=makeSignalPicker(row.var,v=>{row.var=v;rebuildVal();});  // 换信号→按新信号语义重建值输入（保留已填的值，含 0，不清空）
      const op=document.createElement('select');op.className='rm-op';
      RULE_OPS.forEach(o=>{const opt=document.createElement('option');opt.value=o.v;opt.textContent=o.t;op.appendChild(opt);});
      op.value=row.op||'>=';
      const valWrap=document.createElement('span');valWrap.className='rm-valwrap';
      function rebuildVal(){
        valWrap.innerHTML='';
        if(['truthy','falsy','exists'].includes(row.op))return;
        if(row.isRef){
          valWrap.appendChild(makeSignalPicker(row.ref,v=>{row.ref=v;}));
        }else{
          valWrap.appendChild(makeRuleValueInput(row));
        }
        const tg=document.createElement('button');tg.type='button';tg.className='rm-reftg'+(row.isRef?' on':'');tg.textContent=row.isRef?'信号':'常量';tg.title='切换：与常量比较 / 与另一个信号比较';
        tg.onclick=()=>{row.isRef=!row.isRef;rebuildVal();};
        valWrap.appendChild(tg);
      }
      op.onchange=e=>{row.op=e.target.value;rebuildVal();};
      const del=document.createElement('button');del.type='button';del.className='rm-del';del.textContent='×';del.title='删除此条件';
      del.onclick=()=>{st.rows.splice(idx,1);drawRows();};
      r.appendChild(vIn);r.appendChild(op);r.appendChild(valWrap);r.appendChild(del);
      list.appendChild(r);rebuildVal();
    });
    if(!st.rows.length){const em=document.createElement('div');em.className='rm-empty';em.textContent='无条件（始终满足）';list.appendChild(em);}
  }
  drawRows();
  const add=document.createElement('button');add.type='button';add.className='rm-add';add.textContent='+ 添加条件';
  add.onclick=()=>{st.rows.push({var:'',op:'>=',val:''});drawRows();};
  box.appendChild(add);
}
function _mkBtn(t,fn,title){const b=document.createElement('button');b.type='button';b.className='rm-mini';b.textContent=t;if(title)b.title=title;b.onclick=fn;return b;}
// 渲染「流向规则表」编辑器（ds={def,rules:[{when:editState,dir}]}）
function renderDirRules(box, ds){
  box.innerHTML='';box.className='rm-cond';
  const hint=document.createElement('div');hint.className='rm-hint';hint.textContent='按顺序匹配，第一个命中的规则决定流向；都不命中时用连线自身的「流向」设置。仅修改流向，不改变连线类型与走线方式。';box.appendChild(hint);
  const list=document.createElement('div');box.appendChild(list);
  function draw(){
    list.innerHTML='';
    ds.rules.forEach((r,idx)=>{
      const card=document.createElement('div');card.className='rm-dircard';
      const top=document.createElement('div');top.className='rm-dirtop';
      top.appendChild(document.createTextNode('规则'+(idx+1)+' 命中 ⇒ 流向 '));
      const dsel=document.createElement('select');RULE_DIRS.forEach(d=>{const o=document.createElement('option');o.value=d.v;o.textContent=d.t;dsel.appendChild(o);});dsel.value=r.dir;dsel.onchange=e=>r.dir=e.target.value;
      top.appendChild(dsel);
      const sp=document.createElement('span');sp.className='rm-dirbtns';
      sp.appendChild(_mkBtn('↑',()=>{if(idx>0){const t=ds.rules[idx-1];ds.rules[idx-1]=ds.rules[idx];ds.rules[idx]=t;draw();}},'上移'));
      sp.appendChild(_mkBtn('↓',()=>{if(idx<ds.rules.length-1){const t=ds.rules[idx+1];ds.rules[idx+1]=ds.rules[idx];ds.rules[idx]=t;draw();}},'下移'));
      sp.appendChild(_mkBtn('×',()=>{ds.rules.splice(idx,1);draw();},'删除规则'));
      top.appendChild(sp);card.appendChild(top);
      const condBox=document.createElement('div');card.appendChild(condBox);renderCond(condBox,r.when);
      list.appendChild(card);
    });
    // 兜底流向只读展示——它就是连线自身的「流向」，请在属性面板里改；此处不改连线本身，避免编辑流向规则时动到走线
    const defRow=document.createElement('div');defRow.className='rm-dirdefault';
    const defLbl=(RULE_DIRS.find(d=>d.v===ds.def)||{t:ds.def}).t;
    defRow.appendChild(document.createTextNode('都不命中 ⇒ 用连线流向：'+defLbl+'（在属性面板修改）'));
    list.appendChild(defRow);
  }
  draw();
  const add=document.createElement('button');add.type='button';add.className='rm-add';add.textContent='+ 添加流向规则';
  add.onclick=()=>{ds.rules.push({when:{mode:'all',rows:[{var:'',op:'>',val:'0'}]},dir:'forward'});draw();};
  box.appendChild(add);
}

// ───── 图标规则（数据驱动换图标）：按信号顺序匹配，首个命中的 icon 生效，都不命中用节点自身 type ─────
// 图标选择器：列出元素库里「有图标」的全部 type（按分组），value=type
function mkIconSelect(value,onChange){
  const sel=document.createElement('select');sel.className='rm-iconsel';
  const groups={},order=[];
  allLibraryEntries().forEach(e=>{
    if(!iconSrcOf(e.type))return;   // 无图标（文本/变量等纯绘制元素）跳过
    if(!groups[e.group]){groups[e.group]=[];order.push(e.group);}
    groups[e.group].push(e);
  });
  order.forEach(g=>{
    const og=document.createElement('optgroup');og.label=g;
    groups[g].forEach(e=>{const o=document.createElement('option');o.value=e.type;o.textContent=(lang==='en'?e.labelEn:e.labelZh)+'（'+e.type+'）';og.appendChild(o);});
    sel.appendChild(og);
  });
  if(value)sel.value=value;
  sel.onchange=e=>onChange(e.target.value);
  return sel;
}
function _iconPreviewEl(type){
  const img=document.createElement('img');img.className='rm-iconprev';img.alt=type||'';img.title=type||'';
  const src=iconSrcOf(type);if(src)img.src=src;
  return img;
}
// 渲染「图标规则表」编辑器（ds={def:节点type, rules:[{when:editState, icon:type}]}）
function renderIconRules(box, ds){
  box.innerHTML='';box.className='rm-cond';
  const hint=document.createElement('div');hint.className='rm-hint';hint.textContent='按顺序匹配，第一个命中的规则决定显示哪个图标；都不命中时用元素自身图标。仅切换图标，不改变元素类型/尺寸/数据字段。';box.appendChild(hint);
  const list=document.createElement('div');box.appendChild(list);
  function draw(){
    list.innerHTML='';
    ds.rules.forEach((r,idx)=>{
      const card=document.createElement('div');card.className='rm-dircard';
      const top=document.createElement('div');top.className='rm-dirtop';
      top.appendChild(document.createTextNode('规则'+(idx+1)+' 命中 ⇒ 图标 '));
      let prev=_iconPreviewEl(r.icon);
      const isel=mkIconSelect(r.icon,v=>{r.icon=v;const np=_iconPreviewEl(v);prev.replaceWith(np);prev=np;});
      top.appendChild(isel);top.appendChild(prev);
      const sp=document.createElement('span');sp.className='rm-dirbtns';
      sp.appendChild(_mkBtn('↑',()=>{if(idx>0){const t=ds.rules[idx-1];ds.rules[idx-1]=ds.rules[idx];ds.rules[idx]=t;draw();}},'上移'));
      sp.appendChild(_mkBtn('↓',()=>{if(idx<ds.rules.length-1){const t=ds.rules[idx+1];ds.rules[idx+1]=ds.rules[idx];ds.rules[idx]=t;draw();}},'下移'));
      sp.appendChild(_mkBtn('×',()=>{ds.rules.splice(idx,1);draw();},'删除规则'));
      top.appendChild(sp);card.appendChild(top);
      const condBox=document.createElement('div');card.appendChild(condBox);renderCond(condBox,r.when);
      list.appendChild(card);
    });
    // 兜底：都不命中时用元素自身图标（type）
    const defRow=document.createElement('div');defRow.className='rm-dirdefault';
    defRow.appendChild(document.createTextNode('都不命中 ⇒ 用元素自身图标（'+(ds.def||'')+'）'));
    list.appendChild(defRow);
  }
  draw();
  const add=document.createElement('button');add.type='button';add.className='rm-add';add.textContent='+ 添加图标规则';
  add.onclick=()=>{ds.rules.push({when:{mode:'all',rows:[{var:'',op:'==',val:''}]},icon:ds.def||''});draw();};
  box.appendChild(add);
}
// 图标规则 → 可读摘要
function iconRuleSummary(n){
  if(!n||!Array.isArray(n.iconRules)||!n.iconRules.length)return null;
  return n.iconRules.map(r=>(condSummary(r.when)||'?')+'⇒'+(r.icon||'?')).join('；')+'；否则'+n.type;
}

// ───── 规则编辑模态 ─────
let _ruleSaver=null,_ruleClearer=null;
// 在模态顶部显示「当前绑定的元素/连线」，避免不知道规则属于谁
function setRuleTarget(target){
  const el=document.getElementById('rm-target');if(!el)return;
  if(!target){el.style.display='none';return;}
  el.style.display='';
  el.style.borderLeftColor=target.color||'var(--ui-accent)';
  el.innerHTML='';
  const top=document.createElement('div');top.className='rm-tg-top';
  const chip=document.createElement('span');chip.className='rm-tg-chip';chip.textContent=target.kind;
  const main=document.createElement('span');main.className='rm-tg-main';main.textContent=target.main;
  top.appendChild(chip);top.appendChild(main);el.appendChild(top);
  if(target.sub){const sub=document.createElement('div');sub.className='rm-tg-sub';sub.textContent=target.sub;el.appendChild(sub);}
}
// 连线的目标描述：起点 → 终点（类型 / 标签）
function edgeTargetDesc(e){
  const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
  const al=a?(nodeLabel(a)||a.id):e.from, bl=b?(nodeLabel(b)||b.id):e.to;
  const cfg=ET[e.et]||ET.ac_power;
  const tl=(lang==='en'?(cfg.labelEn||cfg.label):cfg.label)||e.et;
  const sub=(lang==='en'?'Type: ':'类型：')+tl+(e.lbl?((lang==='en'?'  ·  Label: ':'  ·  标签：')+e.lbl):'');
  return {kind:(lang==='en'?'EDGE':'连线'), main:al+'  →  '+bl, sub:sub, color:cfg.color};
}
function nodeTargetDesc(n){
  return {kind:(lang==='en'?'NODE':'元素'), main:(nodeLabel(n)||n.id), sub:n.id+'  ·  '+n.type, color:n.fontColor||'var(--ui-accent)'};
}
function openRuleModal(title, target, bodyRenderer, saver, clearer){
  setSigPanel(false);
  closeBgPanel();
  document.getElementById('rm-title').textContent=title;
  setRuleTarget(target);
  const body=document.getElementById('rm-body');body.innerHTML='';
  bodyRenderer(body);
  _ruleSaver=saver;_ruleClearer=clearer||null;
  document.getElementById('rulemodal-ov').classList.add('show');
}
function closeRuleModal(){document.getElementById('rulemodal-ov').classList.remove('show');_ruleSaver=_ruleClearer=null;}
function saveRuleModal(){if(_ruleSaver)_ruleSaver();closeRuleModal();}
function clearRuleModalState(){if(_ruleClearer)_ruleClearer();}
// 节点显示条件（可传入指定节点；不传则用当前选中——属性面板与规则总览共用）
function editNodeRule(n){
  n=n||nodes.find(x=>x.id===selNode);if(!n)return;
  const st=condToEdit(n.visibleWhen);
  openRuleModal((lang==='en'?'Show condition':'显示条件'), nodeTargetDesc(n),
    box=>renderCond(box,st),
    ()=>{snapshot();n.visibleWhen=editToCond(st);snapshot();afterRuleChange(n);},
    ()=>{st.rows=[];renderCond(document.getElementById('rm-body'),st);});
}
// 节点图标规则（按信号切换图标）
function editNodeIconRules(n){
  n=n||nodes.find(x=>x.id===selNode);if(!n)return;
  const ds={def:n.type,rules:(Array.isArray(n.iconRules)?n.iconRules:[]).map(r=>({when:condToEdit(r.when),icon:r.icon||''}))};
  openRuleModal((lang==='en'?'Icon rules':'图标规则'), nodeTargetDesc(n),
    box=>renderIconRules(box,ds),
    ()=>{snapshot();
      // 只写入图标规则，绝不改动节点自身 type / 尺寸 / 数据字段
      const rules=ds.rules.map(r=>({when:editToCond(r.when),icon:r.icon})).filter(r=>r.when!=null&&r.icon);
      if(rules.length)n.iconRules=rules;else delete n.iconRules;
      snapshot();afterRuleChange(n);},
    ()=>{ds.rules=[];renderIconRules(document.getElementById('rm-body'),ds);});
}
// 连线显示条件
function editEdgeShowRule(e){
  e=e||selEdge;if(!e)return;
  const st=condToEdit(e.showWhen);
  openRuleModal((lang==='en'?'Edge show condition':'连线显示条件'), edgeTargetDesc(e),
    box=>renderCond(box,st),
    ()=>{snapshot();e.showWhen=editToCond(st);snapshot();afterRuleChange(e);},
    ()=>{st.rows=[];renderCond(document.getElementById('rm-body'),st);});
}
// 连线流向规则
function editEdgeDirRules(e){
  e=e||selEdge;if(!e)return;
  const ds={def:e.dir||'forward',rules:(Array.isArray(e.dirRules)?e.dirRules:[]).map(r=>({when:condToEdit(r.when),dir:r.dir||'forward'}))};
  openRuleModal((lang==='en'?'Edge direction rules':'连线流向规则'), edgeTargetDesc(e),
    box=>renderDirRules(box,ds),
    ()=>{snapshot();
      // 只写入流向规则，绝不改动连线的固定流向(e.dir)、类型(e.et)、走线方式(e.route)与拐点(e.waypoints)
      const rules=ds.rules.map(r=>({when:editToCond(r.when),dir:r.dir})).filter(r=>r.when!=null);
      if(rules.length)e.dirRules=rules;else delete e.dirRules;
      snapshot();afterRuleChange(e);},
    ()=>{ds.rules=[];renderDirRules(document.getElementById('rm-body'),ds);});
}
// 规则改动后：同步刷新属性面板摘要(若该元素正被选中) + 抽屉「规则总览」，两边一致
function afterRuleChange(ref){
  if(ref&&typeof ref==='object'){
    if(ref.id!==undefined&&ref.id===selNode){refreshNodeRuleSummary(ref);refreshNodeIconRuleSummary(ref);}
    if(ref===selEdge)refreshEdgeRuleSummary(ref);
  }
  renderRulesList();
  _pathCacheSig='';
}
// 规则总览：增/删/改入口（与属性面板共用同一套编辑器与数据）
function openRuleEditor(kind, ref){
  if(kind==='nodeShow')editNodeRule(ref);
  else if(kind==='nodeIcon')editNodeIconRules(ref);
  else if(kind==='edgeShow')editEdgeShowRule(ref);
  else if(kind==='edgeDir')editEdgeDirRules(ref);
}
function clearRuleOf(kind, ref){
  snapshot();
  if(kind==='nodeShow')delete ref.visibleWhen;
  else if(kind==='nodeIcon')delete ref.iconRules;
  else if(kind==='edgeShow')delete ref.showWhen;
  else if(kind==='edgeDir')delete ref.dirRules;
  snapshot();afterRuleChange(ref);
}
function ruleItemInfo(kind, ref){
  const dt={forward:'正向→',reverse:'反向←',both:'双向↔',none:'无'};
  if(kind==='nodeShow')return {chip:(lang==='en'?'NODE':'元素'), tag:(lang==='en'?'Show':'显示'), name:(nodeLabel(ref)||ref.id), sum:(condSummary(ref.visibleWhen)||'—'), color:ref.fontColor||'var(--ui-accent)'};
  if(kind==='nodeIcon')return {chip:(lang==='en'?'NODE':'元素'), tag:(lang==='en'?'Icon':'图标'), name:(nodeLabel(ref)||ref.id), sum:(iconRuleSummary(ref)||'—'), color:ref.fontColor||'var(--ui-accent)'};
  const a=nodes.find(n=>n.id===ref.from),b=nodes.find(n=>n.id===ref.to);
  const nm=(a?(nodeLabel(a)||a.id):ref.from)+' → '+(b?(nodeLabel(b)||b.id):ref.to);
  const cfg=ET[ref.et]||ET.ac_power;
  if(kind==='edgeShow')return {chip:(lang==='en'?'EDGE':'连线'), tag:(lang==='en'?'Show':'显示'), name:nm, sum:(condSummary(ref.showWhen)||'—'), color:cfg.color};
  const sum=(Array.isArray(ref.dirRules)?ref.dirRules.map(r=>(condSummary(r.when)||'?')+'⇒'+(dt[r.dir]||r.dir)).join('；'):'')+'；否则'+(dt[ref.dir||'forward']||'正向→');
  return {chip:(lang==='en'?'EDGE':'连线'), tag:(lang==='en'?'Dir':'流向'), name:nm, sum:sum, color:cfg.color};
}
function renderRulesList(){
  const wrap=document.getElementById('sim-rules');if(!wrap)return;
  wrap.innerHTML='';
  const rows=[];
  nodes.forEach(n=>{if(n.visibleWhen!=null)rows.push({kind:'nodeShow',ref:n});if(Array.isArray(n.iconRules)&&n.iconRules.length)rows.push({kind:'nodeIcon',ref:n});});
  edges.forEach(e=>{if(e.showWhen!=null)rows.push({kind:'edgeShow',ref:e});if(Array.isArray(e.dirRules)&&e.dirRules.length)rows.push({kind:'edgeDir',ref:e});});
  // 鼠标移出整张规则列表时，恢复进入列表前的选中；移入某条规则时临时选中其元素/连线
  wrap.onmouseleave=()=>{ if(!_ruleHovering)return; _ruleHovering=false; const p=_ruleHoverPrev;_ruleHoverPrev=null; restoreSelection(p); };
  if(!rows.length){const d=document.createElement('div');d.className='sim-empty';d.textContent=(lang==='en'?'No rules yet. Select an element/edge on the canvas, then set its show/direction condition in the property panel — it takes effect immediately.':'暂无规则。在画布上选中元素或连线，于右侧属性面板设置「显示条件 / 流向规则」，保存后立即生效。');wrap.appendChild(d);}
  else rows.forEach(r=>{
    const info=ruleItemInfo(r.kind,r.ref);
    const it=document.createElement('div');it.className='rule-item';it.style.borderLeftColor=info.color;it.style.cursor='pointer';
    const head=document.createElement('div');head.className='rule-item-head';
    const chip=document.createElement('span');chip.className='rule-item-chip';chip.textContent=info.chip+' · '+info.tag;
    const nm=document.createElement('span');nm.className='rule-item-name';nm.textContent=info.name;nm.title=info.name;
    head.appendChild(chip);head.appendChild(nm);
    const sum=document.createElement('div');sum.className='rule-item-sum';sum.textContent=info.sum;sum.title=info.sum;
    const btns=document.createElement('div');btns.className='rule-item-btns';
    const ed=document.createElement('button');ed.type='button';ed.className='rm-mini rm-wide';ed.textContent=(lang==='en'?'Edit':'编辑');ed.onclick=()=>{_ruleHovering=false;_ruleHoverPrev=null;selectRuleTarget(r.kind,r.ref);openRuleEditor(r.kind,r.ref);};
    const cl=document.createElement('button');cl.type='button';cl.className='rm-mini rm-wide';cl.textContent=(lang==='en'?'Clear':'清除');cl.onclick=()=>clearRuleOf(r.kind,r.ref);
    btns.appendChild(ed);btns.appendChild(cl);
    // 悬停高亮：临时选中对应元素/连线，便于辨认是哪个；记住进入列表前的选中以便复原
    it.onmouseenter=()=>{ if(!_ruleHovering){_ruleHovering=true;_ruleHoverPrev={node:selNode,edge:selEdge};} selectRuleTarget(r.kind,r.ref); };
    it.appendChild(head);it.appendChild(sum);it.appendChild(btns);
    wrap.appendChild(it);
  });
}
// 悬停规则总览的恢复：还原进入列表前的选中态
function restoreSelection(p){
  try{
    if(p&&p.node&&nodes.some(n=>n.id===p.node)){ selectNode(p.node); }
    else if(p&&p.edge&&edges.indexOf(p.edge)>=0){ selectEdge(p.edge); }
    else { selNode=selEdge=null; showPanel('none'); }
  }catch(e){}
}
// 从规则总览定位并选中对应元素/连线（便于在画布上看到它，并与属性面板联动）
function selectRuleTarget(kind, ref){
  try{ if(kind==='nodeShow'||kind==='nodeIcon'){ if(typeof selectNode==='function')selectNode(ref.id); } else { if(typeof selectEdge==='function')selectEdge(ref); } }catch(e){}
}
// 批量样例文本框：按内容自适应高度（无内部滚动条）
function autoGrowSimJSON(){ const ta=document.getElementById('sim-json'); if(!ta)return; ta.style.height='auto'; ta.style.height=(ta.scrollHeight+4)+'px'; }
// 用当前信号值生成一份完整 JSON 模板，便于看清「批量样例 JSON」的格式；填入后自适应高度并滚动到底部定位到批量样例处
function fillSimTemplate(){
  const ctxv=buildCtx(signalValues);const obj={};
  collectSignals().forEach(s=>{obj[s.name]=ctxv[s.name];});
  const ta=document.getElementById('sim-json');if(ta)ta.value=JSON.stringify(obj,null,2);
  autoGrowSimJSON();   // 同步改高度（内部读取 scrollHeight 触发回流）→ 此后 body 高度已是最新，可直接滚到底
  const body=document.getElementById('sig-body');
  if(body){ body.scrollTop=body.scrollHeight; setTimeout(()=>{ if(body)body.scrollTop=body.scrollHeight; },60); }   // 定位到底部「批量样例」处
}
// 面板规则摘要
function refreshNodeRuleSummary(n){
  const el=document.getElementById('np-rule-sum');if(!el)return;
  const s=n&&condSummary(n.visibleWhen);
  el.textContent=s||(lang==='en'?'None (always show)':'无（始终显示）');
  el.classList.toggle('has',!!s);
}
function refreshNodeIconRuleSummary(n){
  const el=document.getElementById('np-icon-sum');if(!el)return;
  const s=n&&iconRuleSummary(n);
  el.textContent=s||(lang==='en'?'None (uses own icon)':'无（用自身图标）');
  el.classList.toggle('has',!!s);
}
function refreshEdgeRuleSummary(e){
  const se=document.getElementById('ep-show-sum');
  if(se){const s=e&&condSummary(e.showWhen);se.textContent=s||(lang==='en'?'None (always show)':'无（始终显示）');se.classList.toggle('has',!!s);}
  const de=document.getElementById('ep-dir-sum');
  if(de){
    const dt={forward:'正向→',reverse:'反向←',both:'双向↔',none:'无'};
    let txt,has=false;
    if(e&&Array.isArray(e.dirRules)&&e.dirRules.length){has=true;txt=e.dirRules.map(r=>(condSummary(r.when)||'?')+'⇒'+(dt[r.dir]||r.dir)).join('；')+'；否则'+(dt[e.dir||'forward']||'正向→');}
    else txt=(lang==='en'?'No rules (uses fixed direction below)':'无规则（用下面的固定流向）');
    de.textContent=txt;de.classList.toggle('has',has);
  }
}

// ───── 「信号」面板 + 「规则」面板（右侧共用槽位，互斥）+ 运行视图 ─────
// 规则始终实时生效（编辑态虚化、运行视图彻底隐藏）。信号面板=全局信号管理+注入测试+批量JSON；规则面板=运行视图+规则总览。
let sidePanel=null;   // 'signal' | 'rule' | null
// 直接设定当前侧栏（不做切换）；切换语义放在 toggle* 里，避免 setSidePanel('signal') 被误当成 toggle
function setSidePanel(which){
  sidePanel=which||null;
  panelOpen=!!sidePanel;                                       // 兼容旧标志
  const sp=document.getElementById('sigpanel'),rp=document.getElementById('rulepanel');
  if(sp)sp.classList.toggle('show',sidePanel==='signal');
  if(rp)rp.classList.toggle('show',sidePanel==='rule');
  const bs=document.getElementById('btn-signals'),br=document.getElementById('btn-rules');
  if(bs)bs.classList.toggle('act',sidePanel==='signal');
  if(br)br.classList.toggle('act',sidePanel==='rule');
  // 规则标记：进入规则面板默认开启、离开(切走/关闭)则关闭；面板内可手动切换
  showRuleBadges=(sidePanel==='rule');
  const rbt=document.getElementById('rule-badge-toggle');if(rbt)rbt.checked=showRuleBadges;
  if(sidePanel)renderSimPanel();
}
function toggleSignalPanel(){ setSidePanel(sidePanel==='signal'?null:'signal'); }   // 再次点击同一按钮=关闭
function toggleRulePanel(){ setSidePanel(sidePanel==='rule'?null:'rule'); }
function toggleRuleBadges(on){ showRuleBadges=(on!=null)?!!on:!showRuleBadges; const rbt=document.getElementById('rule-badge-toggle');if(rbt)rbt.checked=showRuleBadges; }
function closeSidePanels(){ setSidePanel(null); }
// 兼容旧入口：setSigPanel(true)=打开信号面板(可靠打开，不 toggle)；(false)=关闭
function setSigPanel(on){ if(on)setSidePanel('signal'); else closeSidePanels(); }
function toggleSigPanel(){ toggleSignalPanel(); }
// 运行视图/预览开关：开=彻底隐藏被规则隐藏的元素并应用数据驱动流向（看整图运行效果）；关=回到编辑态（被隐藏者虚化+⊘标记，仍可编辑）
function toggleRunView(on){
  previewMode=(on!=null)?!!on:!previewMode;
  const cb=document.getElementById('sim-runview');if(cb)cb.checked=previewMode;
  const b=document.getElementById('btn-runview');
  if(b){b.classList.toggle('act',previewMode);b.textContent=previewMode?(lang==='en'?'■ Exit Preview':'■ 退出预览'):(lang==='en'?'▶ Preview':'▶ 预览效果');}
  _pathCacheSig='';
}
// 兼容旧入口名
function togglePreview(){ toggleSigPanel(); }
// 注入行 → 信号名（@global 用字段名本身，否则 节点id.字段）
function injSignalName(r){ if(!r)return null; if(r.node==='@global')return r.field||null; if(r.node&&r.field)return r.node+'.'+r.field; return null; }
// 信号名 → 注入行结构（导入/粘贴时反解）
function parseSignal(name){ const i=String(name).lastIndexOf('.'); if(i>0){const nd=name.slice(0,i),fd=name.slice(i+1);if(nodes.some(n=>n.id===nd))return {node:nd,field:fd};} return {node:'@global',field:name}; }
// 注入行 → signalValues（供求值用）。全局信号为自由文本，保留原样(不 autoNum，避免把 "true"/"false" 等字符悄悄转类型)；
// 节点字段沿用 autoNum。数值/布尔比较由 cmpOp 在求值时用 _num/_looseEq 强转，字符串同样能命中规则。
function syncInjections(){ signalValues={}; injRows.forEach(r=>{const nm=injSignalName(r);if(nm&&r.val!=='')signalValues[nm]=(r.node==='@global')?r.val:autoNum(r.val);}); }
function signalExistsForRow(r){
  if(!r||!r.node||!r.field)return false;
  return fieldOptionsFor(r.node).some(o=>o.v===r.field);
}
function pruneInvalidInjections(){
  const before=injRows.length;
  injRows=injRows.filter(signalExistsForRow);
  if(injDraft&&injDraft.node&&injDraft.field&&!signalExistsForRow(injDraft))injDraft=null;
  if(injRows.length!==before)syncInjections();
}
// 某元素的「字段」可选项
function fieldOptionsFor(node){
  if(node==='@global'){const gi=globalSigIssues();return (customSignals||[]).map((s,i)=>({v:fieldSigKey(s),t:sigDisplayName(s),_bad:!fieldNameOk(gi[i])})).filter(o=>o.v&&!o._bad).map(o=>({v:o.v,t:o.t}));}
  const n=nodes.find(x=>x.id===node);if(!n)return [];
  // 仅暴露节点「合法的已绑定数据字段」；不合法(空名/同节点重名)字段不入列——与 buildCtx 的过滤一致，避免规则引用到求值时被忽略的信号
  // 信号值(v)=英文名(端到端信号键)；显示(t)=中文名，便于运营端识别
  const iss=fieldNameIssues(n);
  const opts=[];
  (n.data||[]).forEach((f,i)=>{if(fieldSigKey(f)&&fieldNameOk(iss[i]))opts.push({v:fieldSigKey(f),t:(f.key||fieldSigKey(f))});});
  return opts;
}
// 某行「值」的下拉建议（在线→true/false；状态→常见状态；数值→当前静态值）
function valSuggestFor(r){
  const n=(r&&r.node&&r.node!=='@global')?nodes.find(x=>x.id===r.node):null;
  if(r.node==='@global'){const s=(customSignals||[]).find(c=>fieldSigKey(c)===r.field);if(!s)return [];return (s.dv!==''&&s.dv!=null)?[String(s.dv)]:[];}
  const f=n&&(n.data||[]).find(d=>fieldSigKey(d)===r.field);return (f&&f.dv!=='')?[String(f.dv)]:[];
}
function renderSimPanel(){ renderRulesList(); renderInjRows(); renderCustomSignals(); autoGrowSimJSON(); }
// 某元素「尚未被其它注入行占用」的字段（去重用；exceptIdx 为当前行自身，排除在外）
function remainingFieldsFor(node, exceptIdx){
  const used=new Set();
  injRows.forEach((r,i)=>{ if(i===exceptIdx)return; if(r.node===node && r.field) used.add(r.field); });
  return fieldOptionsFor(node).filter(o=>!used.has(o.v));
}
// 是否所有可用信号都已注入（节点字段/状态/在线 + 全局信号）
function allSignalsInjected(){
  const avail=collectSignals(); if(!avail.length)return false;
  const inj=new Set(injRows.map(injSignalName).filter(Boolean));
  return avail.every(s=>inj.has(s.name));
}
// 是否正在新增（存在待确认草稿）→ 用于禁用「+ 添加注入」，一次只编辑一条草稿
function hasPendingInjRow(){ return !!injDraft; }
// 注入「值」控件：按信号语义决定控件类型——布尔/枚举(在线、状态、枚举型全局信号)用下拉；数值/文本用输入框（不再用 datalist 让数值也带下拉）
function makeInjValueInput(r){
  const name=injSignalName(r);
  // 全局信号无固定类型，值可为任意字符 → 一律用自由文本输入(占位「值」)，不锁数值/下拉
  const isGlobal=name&&parseSignal(name).node==='@global';
  const meta=(name&&!isGlobal)?signalValueMeta(name):{kind:'text'};
  if(meta.kind==='bool'){
    const sel=document.createElement('select');sel.className='sim-val';
    [['',(lang==='en'?'value…':'值…')],['true','true'],['false','false']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o);});
    sel.value=(r.val!=null?String(r.val):'');sel.onchange=e=>{r.val=e.target.value;syncInjections();};return sel;
  }
  if(meta.kind==='enum'){
    const sel=document.createElement('select');sel.className='sim-val';
    const ph=document.createElement('option');ph.value='';ph.textContent=(lang==='en'?'value…':'值…');sel.appendChild(ph);
    const opts=(meta.options||[]).map(String);
    if(r.val!=null&&r.val!==''&&!opts.includes(String(r.val)))opts.push(String(r.val));
    opts.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);});
    sel.value=(r.val!=null?String(r.val):'');sel.onchange=e=>{r.val=e.target.value;syncInjections();};return sel;
  }
  const inp=document.createElement('input');inp.className='sim-val';
  if(meta.kind==='num'){inp.type='number';inp.placeholder=(lang==='en'?'number':'数值');}else{inp.placeholder=(lang==='en'?'value':'值');}
  inp.value=(r.val!=null?r.val:'');inp.oninput=e=>{r.val=e.target.value;syncInjections();};return inp;
}
// 已确认注入行（分组内紧凑行）：字段 + 值 + 删除（元素由分组头表示）
function buildInjCompactRow(idx){
  const r=injRows[idx];
  const row=document.createElement('div');row.className='sim-irow';
  const fsel=document.createElement('select');fsel.className='sim-sel';
  const optList=remainingFieldsFor(r.node, idx);                                   // 排除同元素其它行已占字段 → 防重复
  if(r.field && !optList.some(o=>o.v===r.field)){ const own=fieldOptionsFor(r.node).find(o=>o.v===r.field); optList.push(own||{v:r.field,t:r.field}); }
  if(!r.field && optList.length)r.field=optList[0].v;
  optList.forEach(o=>{const op=document.createElement('option');op.value=o.v;op.textContent=o.t;fsel.appendChild(op);});
  fsel.value=r.field||'';
  fsel.onchange=e=>{r.field=e.target.value;r.val='';syncInjections();renderInjRows();};
  const vctrl=makeInjValueInput(r);
  const del=document.createElement('button');del.type='button';del.className='rm-del';del.textContent='×';del.title=(lang==='en'?'Remove':'删除');del.onclick=()=>{injRows.splice(idx,1);syncInjections();renderInjRows();};
  row.appendChild(fsel);row.appendChild(vctrl);row.appendChild(del);
  return row;
}
// 新增注入草稿卡：选元素 → 选字段 → 填值 → 点 ✓ 确认后才并入分组列表（× 取消）；选完元素不再立即跳转
function buildInjDraftCard(){
  const d=injDraft;
  const box=document.createElement('div');box.className='sim-igroup draft';
  const head=document.createElement('div');head.className='sim-ghead';
  const name=document.createElement('span');name.className='sim-gname';name.style.color='var(--ui-text2)';name.textContent=(lang==='en'?'New injection…':'新增注入…');
  head.appendChild(name);box.appendChild(head);
  const fullTag=(lang==='en'?' (all injected)':'（已全部注入）');
  // 第一行：元素下拉（已全部注入的元素置灰）
  const r1=document.createElement('div');r1.className='sim-irow';
  const nsel=document.createElement('select');nsel.className='sim-sel';
  const ph=document.createElement('option');ph.value='';ph.textContent=(lang==='en'?'Element':'选择元素');nsel.appendChild(ph);
  nodes.forEach(n=>{const o=document.createElement('option');o.value=n.id;o.textContent=nodeLabel(n);if(remainingFieldsFor(n.id,-1).length===0){o.disabled=true;o.textContent+=fullTag;}nsel.appendChild(o);});
  const og=document.createElement('option');og.value='@global';og.textContent=(lang==='en'?'＊Global signals':'＊全局信号');if(remainingFieldsFor('@global',-1).length===0){og.disabled=true;og.textContent+=((customSignals&&customSignals.length)?fullTag:(lang==='en'?' (none)':'（无全局信号）'));}nsel.appendChild(og);
  nsel.value=d.node||'';
  nsel.onchange=e=>{d.node=e.target.value;const rem=remainingFieldsFor(d.node,-1);d.field=(rem[0]?rem[0].v:'');d.val='';renderInjRows();};
  r1.appendChild(nsel);box.appendChild(r1);
  // 第二行：字段 + 值 + ✓ 确认 + × 取消
  const r2=document.createElement('div');r2.className='sim-irow';
  const fsel=document.createElement('select');fsel.className='sim-sel';
  if(!d.node){const fph=document.createElement('option');fph.value='';fph.textContent=(lang==='en'?'Field':'选择字段');fsel.appendChild(fph);fsel.disabled=true;}
  else{const optList=remainingFieldsFor(d.node,-1);if(!d.field&&optList.length)d.field=optList[0].v;optList.forEach(o=>{const op=document.createElement('option');op.value=o.v;op.textContent=o.t;fsel.appendChild(op);});fsel.value=d.field||'';}
  fsel.onchange=e=>{d.field=e.target.value;d.val='';renderInjRows();};
  const vctrl=d.field?makeInjValueInput(d):(function(){const i=document.createElement('input');i.className='sim-val';i.placeholder=(lang==='en'?'value':'值');i.disabled=true;return i;})();
  const ok=document.createElement('button');ok.type='button';ok.className='sim-ok';ok.textContent='✓';ok.title=(lang==='en'?'Confirm & add':'确认添加到列表');
  ok.disabled=!(d.node&&d.field);
  ok.onclick=()=>{ if(!(d.node&&d.field))return; injRows.push({node:d.node,field:d.field,val:(d.val!=null?d.val:'')}); injCollapsed.delete(d.node); injDraft=null; syncInjections(); renderInjRows(); };
  const cancel=document.createElement('button');cancel.type='button';cancel.className='rm-del';cancel.textContent='×';cancel.title=(lang==='en'?'Cancel':'取消');cancel.onclick=()=>{injDraft=null;renderInjRows();};
  r2.appendChild(fsel);r2.appendChild(vctrl);r2.appendChild(ok);r2.appendChild(cancel);box.appendChild(r2);
  return box;
}
function renderInjRows(){
  const wrap=document.getElementById('sim-inj');if(!wrap)return;
  wrap.innerHTML='';
  const addBtn=document.getElementById('sim-add-inj');
  const tools=document.getElementById('sim-inj-tools');
  pruneInvalidInjections();
  if(!nodes.length&&!customSignals.length){
    wrap.innerHTML='<div class="sim-empty">'+(lang==='en'?'No elements/signals yet: add nodes & data fields, or add a global signal below.':'画布暂无元素/信号：先添加节点与数据字段，或在下方添加全局信号。')+'</div>';
    if(addBtn)addBtn.disabled=true; if(tools)tools.style.display='none'; _injInited=false; return;
  }
  // 鼠标移出注入列表 → 恢复进入前的选中（与「规则总览」共用悬停高亮机制）
  wrap.onmouseleave=()=>{ if(!_ruleHovering)return; _ruleHovering=false; const p=_ruleHoverPrev;_ruleHoverPrev=null; restoreSelection(p); };
  const committed=injRows.filter(r=>r.node);   // 已确认（完整）注入；草稿单独存在 injDraft
  if(!committed.length)_injInited=false;
  if(!committed.length && !injDraft){
    wrap.innerHTML='<div class="sim-empty">'+(lang==='en'?'Click "+ Add injection" to pick an element & field and inject preview data.':'点「+ 添加注入」选择元素与字段，注入预览数据。')+'</div>';
    if(tools)tools.style.display='none';
  } else {
    // 按元素分组（首次出现顺序）——仅已确认行参与分组
    const order=[],map={};
    injRows.forEach((r,idx)=>{ if(!r.node)return; const key=r.node; if(!(key in map)){map[key]={node:r.node,items:[]};order.push(key);} map[key].items.push(idx); });
    const realKeys=order;
    if(!_injInited){ _injInited=true; injCollapsed=new Set(realKeys.slice(1)); }   // 手风琴：默认仅首张展开
    if(tools)tools.style.display=(realKeys.length>=2)?'flex':'none';               // ≥2 个分组才显示「全部展开/折叠」
    order.forEach(key=>{
      const g=map[key];
      const box=document.createElement('div');box.className='sim-igroup';
      // 悬停卡片 → 高亮画布上对应元素（及其数据字段）；全局信号无对应元素则临时清空高亮
      box.onmouseenter=()=>{ if(!_ruleHovering){_ruleHovering=true;_ruleHoverPrev={node:selNode,edge:selEdge};}
        if(g.node&&g.node!=='@global'&&nodes.some(n=>n.id===g.node)){ try{ selectNode(g.node); }catch(e){} }
        else { selNode=null;selEdge=null; } };
      const head=document.createElement('div');head.className='sim-ghead';
      const name=document.createElement('span');name.className='sim-gname';
      const collapsed=injCollapsed.has(key);
      if(collapsed)box.classList.add('collapsed');
      head.classList.add('clk');
      const chev=document.createElement('span');chev.className='sim-gchev';chev.textContent=collapsed?'▶':'▼';
      const chip=document.createElement('span');chip.className='sim-gchip';chip.textContent=(g.node==='@global'?(lang==='en'?'GLOBAL':'全局'):(lang==='en'?'NODE':'元素'));
      const nd=nodes.find(x=>x.id===g.node);
      const lab=document.createElement('span');lab.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      lab.textContent=(g.node==='@global'?(lang==='en'?'Global signals':'全局信号'):(nd?nodeLabel(nd):g.node));
      name.appendChild(chip);name.appendChild(lab);
      const cnt=document.createElement('span');cnt.className='sim-gcount';cnt.textContent='('+g.items.length+')';
      const gadd=document.createElement('button');gadd.type='button';gadd.className='sim-gadd';gadd.textContent=(lang==='en'?'+ field':'+ 字段');
      const rem=remainingFieldsFor(g.node,-1);
      gadd.disabled=!rem.length;gadd.title=rem.length?(lang==='en'?'Inject another field of this element':'为该元素再注入一个字段'):(lang==='en'?'All fields of this element are injected':'该元素的字段已全部注入');
      gadd.onclick=ev=>{ev.stopPropagation();const r2=remainingFieldsFor(g.node,-1);if(!r2.length)return;injCollapsed.delete(g.node);injRows.push({node:g.node,field:r2[0].v,val:''});syncInjections();renderInjRows();};
      head.appendChild(chev);head.appendChild(name);head.appendChild(cnt);head.appendChild(gadd);box.appendChild(head);
      head.onclick=ev=>{ if(ev.target.closest('.sim-gadd'))return; if(injCollapsed.has(key))injCollapsed.delete(key);else injCollapsed.add(key); renderInjRows(); };
      if(!collapsed){const body=document.createElement('div');body.className='sim-gbody';g.items.forEach(idx=>body.appendChild(buildInjCompactRow(idx)));box.appendChild(body);}
      wrap.appendChild(box);
    });
    // 草稿卡（待确认）放最后
    if(injDraft)wrap.appendChild(buildInjDraftCard());
  }
  // 「+ 添加注入」：所有可用信号都已注入 或 正在编辑草稿 时禁用
  if(addBtn){
    const noneLeft=allSignalsInjected(),drafting=!!injDraft;
    addBtn.disabled=noneLeft||drafting;
    addBtn.title=noneLeft?(lang==='en'?'All available signals are injected':'所有可用信号都已注入，无需再添加')
              :drafting?(lang==='en'?'Finish the new injection below first':'请先完成下方「新增注入」并点 ✓ 确认')
              :'';
  }
}
function addInjRow(){
  if(allSignalsInjected()){ flashHint(lang==='en'?'All available signals are already injected':'所有可用信号都已注入，无需再添加'); renderInjRows(); return; }
  if(injDraft){ flashHint(lang==='en'?'Finish the new injection below first':'请先完成下方「新增注入」并点 ✓ 确认'); renderInjRows(); return; }
  injDraft={node:'',field:'',val:''};renderInjRows();
}
// 全局信号类型：number(数值) / bool(布尔) / enum(枚举) / text(文本)。老数据无 type 时按样例值推断。
// 全局信号内部模型：{key:中文名, keyEn:英文名, dv:默认值, type, options?, bind?}——与数据字段一致，信号键=fieldSigKey(=keyEn||key)。
// 归一化：兼容 旧导出{name,label,sample,type,options} / 新导出{key:{zh,en},value,type,options,bind} / 内部{key,keyEn,dv,...}
function normalizeSignal(s){
  if(!s||typeof s!=='object')return null;
  if(s.key&&typeof s.key==='object'){                 // 新导出格式
    // 保留 en 的真实值（含空串）——不兜底成中文名，否则会掩盖「缺英文名」使校验失效
    const zh=s.key.zh||'', en=s.key.en||'';
    if(!zh&&!en)return null;
    const o={key:zh, keyEn:en, dv:(s.value!==undefined?s.value:''), type:s.type};
    if(Array.isArray(s.options))o.options=s.options.slice();
    if(s.bind&&s.bind.field)o.bind={field:s.bind.field, deviceType:s.bind.deviceType||'', deviceId:s.bind.deviceId||''};
    return o;
  }
  if(typeof s.key==='string'||s.keyEn){               // 已是内部格式
    const o={key:s.key||'', keyEn:s.keyEn||'', dv:(s.dv!==undefined?s.dv:''), type:s.type};
    if(Array.isArray(s.options))o.options=s.options.slice();
    if(s.bind&&s.bind.field)o.bind={field:s.bind.field, deviceType:s.bind.deviceType||'', deviceId:s.bind.deviceId||''};
    return o;
  }
  if(s.name){                                          // 旧导出格式：keyEn=name(保持信号键不变)，key=label||name
    const o={key:(s.label||s.name), keyEn:s.name, dv:(s.sample!==undefined?s.sample:''), type:s.type};
    if(Array.isArray(s.options))o.options=s.options.slice();
    return o;
  }
  return null;
}
// 全局信号的显示名（中文名优先）
function sigDisplayName(s){ return (s&&(s.key||s.keyEn))||''; }
function sigTypeOf(s){ if(s&&s.type)return s.type; if(typeof (s&&s.dv)==='boolean')return 'bool'; if(typeof (s&&s.dv)==='number')return 'number'; return 'text'; }
function sigTypeLabel(t){ return ({number:(lang==='en'?'NUM':'数值'),bool:(lang==='en'?'BOOL':'布尔'),enum:(lang==='en'?'ENUM':'枚举'),text:(lang==='en'?'TEXT':'文本')})[t]||t; }
// 全局信号列表：与数据字段一致的网格（中文名｜英文名｜类型｜默认值｜绑定），中英文名必填且全局唯一(红框校验)，可绑定后台字段
function renderCustomSignals(){
  const wrap=document.getElementById('sim-custom');if(!wrap)return;
  wrap.className='siggrid';
  let html='<span class="dh dh-zh" data-i18n="中文名">中文名</span><span class="dh dh-en" data-i18n="英文名">英文名</span><span class="dh dh-val" data-i18n="默认值">默认值</span><span class="dh dh-act" data-i18n="绑定">绑定</span>';
  wrap.innerHTML=html;
  if(!customSignals.length){
    const e=document.createElement('div');e.className='sim-empty';e.style.gridColumn='1/-1';
    e.textContent=(lang==='en'?'No global signals yet (e.g. 运行模式/mode). Add below — Chinese & English names required; English name is the signal key.':'暂无全局信号（如 运行模式/mode、并网/islanding）。点下方添加；中英文名必填，英文名作信号键，任意规则可引用。');
    wrap.appendChild(e);return;
  }
  const gi=globalSigIssues();
  customSignals.forEach((s,idx)=>{
    const iss=gi[idx]||{};
    const zh=document.createElement('input');zh.className='df-zh-in'+((iss.emptyZh||iss.dupZh)?' df-invalid':'');zh.value=s.key||'';zh.placeholder='中文名(必填)';zh.title=iss.dupZh?'中文名重复（全局唯一）':'中文名（必填）';zh.oninput=e=>{s.key=e.target.value;refreshGlobalSigValidity();_pathCacheSig='';};
    const en=document.createElement('input');en.className='df-en-in'+((iss.emptyEn||iss.dupEn)?' df-invalid':'');en.value=s.keyEn||'';en.placeholder='英文名(必填)';en.title=iss.dupEn?'英文名重复（全局唯一·作信号键会冲突）':'英文名（必填·作信号键）';en.oninput=e=>{s.keyEn=e.target.value;refreshGlobalSigValidity();_pathCacheSig='';};
    // 默认值：与数据字段一致的普通输入框（类型按值自动推断，无需单列）
    const dv=document.createElement('input');dv.className='df-val-in';dv.value=(s.dv==null?'':String(s.dv));dv.placeholder='--';dv.title='默认值（可留空）';dv.oninput=e=>{s.dv=e.target.value;_pathCacheSig='';};
    const acts=document.createElement('span');acts.className='df-acts';
    const bound=!!(s.bind&&s.bind.field);
    const bindBtn=document.createElement('button');bindBtn.type='button';bindBtn.className='df-bind'+(bound?' bound':'');bindBtn.textContent='🔗';bindBtn.title=bound?'已绑定后台字段，点击修改':'绑定后台字段';bindBtn.onclick=()=>openGlobalBind(idx);
    const del=document.createElement('button');del.type='button';del.className='df-del';del.textContent='✕';del.title='删除信号';del.onclick=()=>{customSignals.splice(idx,1);renderSimPanel();_pathCacheSig='';};
    acts.appendChild(bindBtn);acts.appendChild(del);
    wrap.appendChild(zh);wrap.appendChild(en);wrap.appendChild(dv);wrap.appendChild(acts);
    if(bound){
      const bl=document.createElement('div');bl.className='df-bindline'+((s.bind.deviceId)?'':' warn');
      const sum=document.createElement('span');sum.className='df-bindsum';sum.textContent='↳ '+(sigDisplayName(s)||('信号'+(idx+1)))+'  ←  '+globalBindSummary(s);sum.onclick=()=>openGlobalBind(idx);sum.title='点击编辑绑定';
      const clr=document.createElement('button');clr.type='button';clr.className='df-bindclr';clr.textContent='✕';clr.title='清除此信号的绑定';clr.onclick=()=>clearGlobalBind(idx);
      bl.appendChild(sum);bl.appendChild(clr);wrap.appendChild(bl);
    }
  });
}
// 全局信号名必填且唯一：即时红框（不整体重渲染，避免输入丢焦点）
function refreshGlobalSigValidity(){
  const gi=globalSigIssues();
  const zhs=document.querySelectorAll('#sim-custom .df-zh-in'), ens=document.querySelectorAll('#sim-custom .df-en-in');
  gi.forEach((s,i)=>{ if(zhs[i])zhs[i].classList.toggle('df-invalid',s.emptyZh||s.dupZh); if(ens[i])ens[i].classList.toggle('df-invalid',s.emptyEn||s.dupEn); });
}
// 全局信号后台绑定摘要
function globalBindSummary(s){
  if(!s.bind||!s.bind.field)return '';
  const did=s.bind.deviceId||'', dt=s.bind.deviceType||'';
  if(!did)return '⚠ 未指定设备实例 · '+s.bind.field;
  return (dt?deviceTypeLabel(dt)+'·':'')+deviceNameOf(did)+' / '+s.bind.field;
}
// 新增一条「空」全局信号（中英文名留空由用户填写，即时红框校验）；已有信号名不完整/重复时先修正
function addCustomSignal(){
  if(customSignals.some((s,i)=>!fieldNameOk(globalSigIssues()[i]))){flashHint(lang==='en'?'Fix existing global signal names (required & unique) before adding':'请先补全/修正现有全局信号的中英文名（必填且不可重复），再添加');return;}
  customSignals.push({key:'',keyEn:'',dv:''});   // 与数据字段一致：无类型列，默认值为普通文本(类型按值推断)
  renderSimPanel();_pathCacheSig='';
  const zhs=document.querySelectorAll('#sim-custom .df-zh-in');const last=zhs[zhs.length-1];if(last)last.focus();
}
function pasteSimJSON(){
  const ta=document.getElementById('sim-json');const txt=ta.value.trim();if(!txt)return;
  let obj;try{obj=JSON.parse(txt);}catch(err){alert(lang==='en'?('Invalid JSON: '+err.message):('JSON 解析失败：'+err.message));return;}
  if(obj&&typeof obj==='object')Object.keys(obj).forEach(k=>{
    const existing=injRows.find(r=>injSignalName(r)===k);
    if(existing)existing.val=obj[k];
    else{const ps=parseSignal(k);injRows.push({node:ps.node,field:ps.field,val:obj[k]});}
  });
  syncInjections();renderSimPanel();autoGrowSimJSON();flashHint(lang==='en'?'Sample data applied':'已应用样例数据');
}
function clearSim(){injRows=[];signalValues={};_injInited=false;injDraft=null;const ta=document.getElementById('sim-json');if(ta)ta.value='';autoGrowSimJSON();renderSimPanel();}
// 注入信号手风琴：全部展开 / 全部折叠（仅作用于已选元素的分组，待指定行不折叠）
function injExpandAll(){ injCollapsed.clear(); renderInjRows(); }
function injCollapseAll(){ const ks=new Set(); injRows.forEach(r=>{ if(r.node)ks.add(r.node); }); injCollapsed=ks; renderInjRows(); }

// ───── 极简 ZIP 打包器（store 模式，无需外部库）─────
function crc32(buf){
  let c, crc=0xFFFFFFFF;
  if(!crc32.table){crc32.table=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crc32.table[n]=c;}}
  for(let i=0;i<buf.length;i++)crc=crc32.table[(crc^buf[i])&0xFF]^(crc>>>8);
  return (crc^0xFFFFFFFF)>>>0;
}
function strToBytes(s){return new TextEncoder().encode(s);}
function makeZip(files){
  // files: [{name, data(Uint8Array)}]
  const enc=[];const central=[];let offset=0;
  const u16=v=>[v&0xFF,(v>>8)&0xFF];
  const u32=v=>[v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF];
  files.forEach(f=>{
    const nameB=strToBytes(f.name), data=f.data, crc=crc32(data);
    const local=[].concat(u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameB.length),u16(0));
    enc.push(new Uint8Array(local), nameB, data);
    const cen=[].concat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameB.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset));
    central.push(new Uint8Array(cen), nameB);
    offset+=local.length+nameB.length+data.length;
  });
  let cenSize=0;central.forEach(c=>cenSize+=c.length);
  const end=new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cenSize),u32(offset),u16(0)));
  const parts=[...enc,...central,end];
  let total=0;parts.forEach(p=>total+=p.length);
  const out=new Uint8Array(total);let pos=0;parts.forEach(p=>{out.set(p,pos);pos+=p.length;});
  return out;
}
function dataURLtoBytes(dataURL){
  const b64=dataURL.split(',')[1];
  const bin=atob(b64);const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return arr;
}
// 导出图标 ZIP 包：所有用到的图标文件 + iconMap.json + README
function dlIconsZip(){
  const usedTypes=usedTypeList();
  const files=[];const iconMap={};
  usedTypes.forEach(t=>{
    const src=iconSrcOf(t);if(!src)return;
    const fn=iconFileName(t);
    iconMap[t]=fn;
    files.push({name:'icons/'+fn, data:dataURLtoBytes(src)});
  });
  if(files.length===0){alert('当前画布无可导出的图标');return;}
  // 映射表
  iconMap_meta={ note:'type → 图标文件名。前端：iconUrl = baseDir + iconMap[node.type]', generatedAt:new Date().toISOString() };
  const mapObj={meta:iconMap_meta, iconMap};
  files.push({name:'iconMap.json', data:strToBytes(JSON.stringify(mapObj,null,2))});
  // README
  const readme=
'储能拓扑图标包\n================\n\n'+
'目录结构：\n'+
'  icons/         各设备图标文件（.png 实拍图 / .svg 线框图标）\n'+
'  iconMap.json   type → 文件名 的映射表\n\n'+
'前端用法：\n'+
'  1) 将 icons/ 目录部署到你的静态资源目录，例如 /assets/topo-icons/\n'+
'  2) 读取拓扑 topology.json，遍历 nodes：\n'+
'       const fname = node.icon;            // 如 "pcs.png"\n'+
'       const url   = "/assets/topo-icons/" + fname;\n'+
'       // 在 (node.x, node.y) 处按 meta.iconSizeByType[node.type] 绘制\n'+
'  3) 文字：中文 node.label.zh / 英文 node.label.en\n'+
'  4) 连线样式见 topology.json 的 edgeStyles\n';
  files.push({name:'README.txt', data:strToBytes(readme)});
  const zip=makeZip(files);
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([zip],{type:'application/zip'}));
  a.download='topo-icons.zip';a.click();
}
let iconMap_meta=null;

// ───── 收集左侧元素库的全部元素（所有分组 + 自定义图标）─────
function allLibraryEntries(){
  const out=[];
  DEVICE_GROUPS.forEach(g=>g.devices.forEach(d=>{
    out.push({type:d.type, labelZh:d.label||d.type, labelEn:d.label_en||d.type,
              group:g.title||'', groupEn:g.title_en||g.title||'', tab:g.tab||'device'});
  }));
  (customIcons||[]).forEach(ci=>out.push({type:ci.type, labelZh:ci.zh||ci.type, labelEn:ci.en||ci.type,
              group:'自定义', groupEn:'Custom', tab:'custom'}));
  return out;
}
