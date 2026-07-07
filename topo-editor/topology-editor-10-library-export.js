// 导出「全部」左侧元素图标（不限于当前画布）——产出前端可直接使用的图标包：
// 真实图标文件 + 路径映射(JSON) + 开箱即用 ES 模块(icons.js) + 可视化预览(preview.html)
// ★ 运行端数据驱动库（随元素库包导出）：与编辑器预览同一套求值逻辑，保证线上=预览
const RUNTIME_JS=`// 储能拓扑 · 数据驱动运行端（与编辑器「数据预览」同一套逻辑）
// 用法：
//   import { resolveDynamic } from './runtime.js';
//   const state = resolveDynamic(topology, signals);
//   state.nodes: [{...node, visible, iconType}] // visible=false → 不渲染该元素；iconType=按图标规则生效的图标(默认=node.type)，前端用 type→图标文件同一张映射解析
//   state.edges: [{...edge, visible, dir}]    // visible=false → 不渲染（含"条件不满足时无连线"）；dir=动态流向
// signals：扁平对象，如 { "bms_1.SOC(%)": 20, "grid_1.P(kW)": 383, "mode": "island" }（键=节点id.英文字段名 或 全局信号名）
//   未提供的信号回退到画布静态值（节点字段 value / topology.signals 样例）。
function _num(x){if(typeof x==='number')return x;if(typeof x==='boolean')return x?1:0;var f=parseFloat(x);return isNaN(f)?NaN:f;}
function _looseEq(a,b){if(a===b)return true;var na=_num(a),nb=_num(b);if(!isNaN(na)&&!isNaN(nb))return na===nb;return String(a)===String(b);}
function _toList(rv){if(Array.isArray(rv))return rv;return String(rv==null?'':rv).split(',').map(function(s){return s.trim();}).filter(function(s){return s!=='';});}
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
    case 'in':     return _toList(rv).some(function(x){return _looseEq(lv,x);});
    case 'between':{
      // 区间写法："a,b"=含两端（默认，兼容旧数据）；"[a,b)"/"(a,b]"/"(a,b)"=按括号决定端点是否包含
      // （括号检测不用正则：本函数体会逐字内嵌进导出的 RUNTIME_JS 模板串，反斜杠转义会两处不一致）
      var s=(typeof rv==='string')?rv.trim():rv, lo=true, hi=true;
      if(typeof s==='string'&&s.length>1){
        var c0=s.charAt(0),c1=s.charAt(s.length-1);
        if((c0==='['||c0==='(')&&(c1===']'||c1===')')){lo=(c0==='[');hi=(c1===']');s=s.slice(1,-1);}
      }
      var a=_toList(s).map(_num);if(a.length<2)return false;
      var mn=a[0],mx=a[1],t;
      if(mn>mx){t=mn;mn=mx;mx=t;t=lo;lo=hi;hi=t;}   // 端点乱序(a>b)：数值与含端标志一起交换，括号仍贴着书写位置的那个数
      var v=_num(lv);
      return (lo?v>=mn:v>mn)&&(hi?v<=mx:v<mx);
    }
    default: return true;
  }
}
export function evalCond(cond, ctx){
  if(cond==null)return true;
  if(typeof cond!=='object')return !!cond;
  if(Array.isArray(cond.all))return cond.all.every(function(c){return evalCond(c,ctx);});
  if(Array.isArray(cond.any))return cond.any.some(function(c){return evalCond(c,ctx);});
  if(cond.not!=null)return !evalCond(cond.not,ctx);
  if(cond.var==null)return true;
  var lv=ctx[cond.var];
  var rv=(cond.ref!=null)?ctx[cond.ref]:cond.val;
  return cmpOp(lv,cond.op||'truthy',rv);
}
// ★ 计算绑定（bind.calc）：多操作数链式计算/比较（左→右依次结合，无优先级；比较结果 1/0）。
//   字段操作数实时值由后台按「主信号键@操作数下标」推送（dataBindings 带 calcOf 的条目），主信号由本函数算出。
export function calcValue(calc, get){
  if(!calc||!Array.isArray(calc.operands)||!calc.operands.length)return undefined;
  var ops=Array.isArray(calc.operators)?calc.operators:[];
  var acc=null;
  for(var i=0;i<calc.operands.length;i++){
    var o=calc.operands[i]||{};
    var v=(o.const!==undefined)?o.const:get(o,i);
    if(v==null||v==='')return undefined;
    if(i===0){acc=v;continue;}
    var op=ops[i-1];
    if(op==='+'||op==='-'||op==='*'||op==='/'||op==='%'){
      var a=_num(acc),b=_num(v);
      acc=(op==='+')?a+b:(op==='-')?a-b:(op==='*')?a*b:(op==='/')?a/b:a%b;
    }else if(op==='>'||op==='>='||op==='<'||op==='<='||op==='=='||op==='!='){
      acc=cmpOp(acc,op,v)?1:0;
    }else{
      return undefined;   // 未知/缺失/空串运算符（手改/坏数据）：不猜语义，与操作数缺值同一降级——保留静态默认值
    }
  }
  if(typeof acc==='number'){
    if(!isFinite(acc))return undefined;
    // 数值结果按 decimals 保留小数位（0~3，缺省 2）；顺带消掉 IEEE754 浮点尾差（0.1+0.2 → 0.3）
    var dp=(calc.decimals!=null?Math.max(0,Math.min(3,calc.decimals|0)):2);
    var f=Math.pow(10,dp);
    acc=Math.round(acc*f)/f;
  }
  return acc;
}
export function applyCalcSignals(topology, ctx){
  function visit(sig, bind){
    if(!sig||!bind||!bind.calc)return;
    var v=calcValue(bind.calc, function(o,i){ return ctx[sig+'@'+i]; });
    if(v!==undefined)ctx[sig]=v;
  }
  (topology.nodes||[]).forEach(function(n){
    (n.data||[]).forEach(function(f){
      var key=(f.key&&typeof f.key==='object')?(f.key.en||f.key.zh):f.key;
      if(key!=null&&f.bind)visit(n.id+'.'+key, f.bind);
    });
  });
  (topology.signals||[]).forEach(function(s){
    if(!s||!s.bind)return;
    var key=(s.key&&typeof s.key==='object')?(s.key.en||s.key.zh):(s.name!=null?s.name:null);
    if(key!=null)visit(key, s.bind);
  });
}
export function buildContext(topology, signals){
  var ctx={};
  (topology.nodes||[]).forEach(function(n){
    (n.data||[]).forEach(function(f){
      // 信号键段统一用英文名（导出字段 key={zh,en}；旧数据无 en 时兜底 zh）
      var key=(f.key&&typeof f.key==='object')?(f.key.en||f.key.zh):f.key;
      if(key!=null)ctx[n.id+'.'+key]=(f.value==='--'?'':f.value);
    });
    // 节点上下文仅含其数据字段；status / online 已移除（如需可经 signals / sampleSignals 自行提供任意键）
  });
  (topology.signals||[]).forEach(function(s){
    if(!s)return;
    var key,val;
    if(s.key&&typeof s.key==='object'){ key=s.key.en||s.key.zh; val=s.value; }   // 新格式 {key:{zh,en},value}
    else if(s.name!=null){ key=s.name; val=s.sample; }                            // 旧格式 {name,sample}
    if(key!=null&&val!==undefined)ctx[key]=val;
  });
  if(topology.sampleSignals)Object.keys(topology.sampleSignals).forEach(function(k){ctx[k]=topology.sampleSignals[k];});
  if(signals)Object.keys(signals).forEach(function(k){ctx[k]=signals[k];});
  applyCalcSignals(topology, ctx);   // ★ 计算绑定：由操作数信号(sig@i)算出主信号值（算不出保留上面已并入的静态/直推值）
  return ctx;
}
export function resolveDynamic(topology, signals){
  var ctx=buildContext(topology, signals);
  var hidden={};
  (topology.nodes||[]).forEach(function(n){if(n.visibleWhen!=null&&!evalCond(n.visibleWhen,ctx))hidden[n.id]=true;});
  var nodes=(topology.nodes||[]).map(function(n){
    var o={},k;for(k in n)o[k]=n[k];o.visible=!hidden[n.id];
    // 图标规则：顺序匹配，首个命中的 icon 生效；都不命中用节点自身 type。iconType 即前端应绘制的图标 type（默认=node.type）
    var it=n.type,j;
    if(Array.isArray(n.iconRules)){for(j=0;j<n.iconRules.length;j++){if(n.iconRules[j]&&n.iconRules[j].icon&&evalCond(n.iconRules[j].when,ctx)){it=n.iconRules[j].icon;break;}}}
    o.iconType=it;
    return o;
  });
  var edges=(topology.edges||[]).map(function(e){
    var visible=!(hidden[e.from]||hidden[e.to]);
    if(visible&&e.showWhen!=null)visible=evalCond(e.showWhen,ctx);
    var dir=e.dir||'forward',i;
    if(Array.isArray(e.dirRules)){for(i=0;i<e.dirRules.length;i++){if(evalCond(e.dirRules[i].when,ctx)){dir=e.dirRules[i].dir;break;}}}
    var o={},k;for(k in e)o[k]=e[k];o.visible=visible;o.dir=dir;return o;
  });
  return {ctx:ctx, nodes:nodes, edges:edges};
}
export default resolveDynamic;
`;
function dlAllIconsZip(){
  const entries=allLibraryEntries();
  const files=[]; const seen=new Set();
  const paths={};     // type -> "icons/xxx.png"
  const meta={};      // type -> {file,labelZh,labelEn,group,groupEn,tab,sizeWorld}
  const dataMap={};   // type -> dataURI（内联，零请求）
  entries.forEach(e=>{
    if(seen.has(e.type))return; seen.add(e.type);
    const src=iconSrcOf(e.type); if(!src)return;          // 无图标(如纯文本)跳过
    const path='icons/'+e.type+'.'+iconExt(src);
    files.push({name:path, data:dataURLtoBytes(src)});
    paths[e.type]=path;
    dataMap[e.type]=src;
    meta[e.type]={file:path,labelZh:e.labelZh,labelEn:e.labelEn,group:e.group,groupEn:e.groupEn,tab:e.tab,sizeWorld:Math.round(nsz(e.type))};
  });
  const n=Object.keys(paths).length;
  if(n===0){alert('没有可导出的图标');return;}

  // 1) icon-map.json —— 规范映射（扁平 paths + 富信息 icons）
  files.push({name:'icon-map.json', data:strToBytes(JSON.stringify({
    meta:{note:'type→图标路径。前端：iconUrl = baseDir + paths[type]', total:n, generatedAt:new Date().toISOString()},
    paths, icons:meta
  },null,2))});

  // 2) icons.js —— 开箱即用的 ES 模块（路径 / 元信息 / 内联 dataURI 任选其一）
  const js=
'// 自动生成 · 储能拓扑全部元素图标（前端直接 import 使用）\n'+
'// 用法A(静态资源)：<img src={ICON_BASE + ICON_PATHS[type]} />\n'+
'// 用法B(零请求/内联)：<img src={ICON_DATA[type]} />\n'+
'export const ICON_BASE  = "/assets/topo-icons/"; // 改成你的部署目录\n'+
'export const ICON_PATHS = '+JSON.stringify(paths,null,2)+';\n'+
'export const ICON_META  = '+JSON.stringify(meta,null,2)+';\n'+
'export const ICON_DATA  = '+JSON.stringify(dataMap,null,2)+';\n'+
'export default ICON_PATHS;\n';
  files.push({name:'icons.js', data:strToBytes(js)});

  // 2.5) element-library.json —— 后台维护的「元素库 + 字典」单一事实来源（前端加载一次）
  files.push({name:'element-library.json', data:strToBytes(JSON.stringify(buildLibraryObj(),null,2))});

  // 2.6) runtime.js —— 数据驱动运行端（与编辑器预览同一套逻辑：动态显隐/流向/条件连线）
  files.push({name:'runtime.js', data:strToBytes(RUNTIME_JS)});

  // 3) preview.html —— 双击在浏览器打开即可看到全部图标
  let cards='';
  Object.keys(meta).forEach(t=>{const m=meta[t];
    cards+='<figure><img src="'+m.file+'" alt="'+t+'"><figcaption><b>'+t+'</b><span>'+m.labelZh+' · '+m.labelEn+'</span><em>'+m.group+'</em></figcaption></figure>';});
  const preview=
'<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>图标预览</title>'+
'<style>body{margin:0;background:#0d1a2e;color:#d8e4f0;font-family:-apple-system,"Microsoft YaHei",sans-serif;padding:24px}'+
'h1{font-size:18px;color:#4dd0ff;margin:0 0 16px}'+
'.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}'+
'figure{margin:0;background:#0a1628;border:1px solid #1a3a5c;border-radius:10px;padding:14px;text-align:center}'+
'figure img{width:64px;height:64px;object-fit:contain;display:block;margin:0 auto 10px;background:#08111f;border-radius:6px;padding:6px}'+
'figcaption b{display:block;font-size:13px;color:#4dd0ff;word-break:break-all}figcaption span{display:block;font-size:11px;color:#8aa8c4;margin:2px 0}figcaption em{font-size:10px;color:#5a7a98;font-style:normal}'+
'</style></head><body><h1>⚡ 储能拓扑 · 全部元素图标（'+n+'）</h1><div class="grid">'+cards+'</div></body></html>';
  files.push({name:'preview.html', data:strToBytes(preview)});

  // 4) README
  const readme=
'储能拓扑 · 元素库包\n==================\n\n'+
'架构：前端与后台共享同一套元素库；后台维护本包并提供给前端。\n'+
'前端加载本包(元素库+字典+图标)一次；之后每张「画布 JSON」只引用库版本(meta.libraryRef)，\n'+
'按 node.type 到库里取图标/默认字段/默认尺寸，再叠加画布 JSON 的实例信息即可还原渲染。\n\n'+
'目录：\n'+
'  element-library.json  ★元素库+字典(单一事实来源)：version / tabs / groups(每type: icon, defaultData, defaultSizeWorld) / edgeTypes / statusDict / dataLabelDict\n'+
'  runtime.js            ★数据驱动运行端：resolveDynamic(topology, signals) → 按规则算出每个节点/连线的 visible 与连线 dir（与编辑器预览同逻辑）\n'+
'  icons/                每个元素的图标文件（.png 实拍 / .svg 线框）\n'+
'  icon-map.json         type → 图标路径 映射（轻量）\n'+
'  icons.js              开箱即用 ES 模块：ICON_PATHS / ICON_META / ICON_DATA(内联 dataURI)\n'+
'  preview.html          双击在浏览器打开，预览全部图标\n\n'+
'当前库版本：'+LIBRARY_NAME+' @ '+LIBRARY_VERSION+'\n\n'+
'前端渲染流程：\n'+
'  1) 启动时加载 element-library.json（含全部 type 的图标文件名/默认值/分组/连线样式/字典）\n'+
'  2) 加载某张画布 topology.json，校验 meta.libraryRef.version 与本库一致\n'+
'  3) 遍历 nodes：icon = ICON_BASE + (库中该 type 的 icon)；位置用 node.position、尺寸用 node.sizeWorld；\n'+
'     名称/字段显隐用 node.display；文本/占位点分别读 node.textStyle / node.anchorStyle\n'+
'  4) 遍历 edges：样式查 library.edgeTypes[edge.edgeType]，按 route / waypoints 走线\n\n'+
'图标用法（任选）：\n'+
'  A) 静态资源：icons/ 部署到 /assets/topo-icons/，url = ICON_BASE + ICON_PATHS[type]\n'+
'  B) 内联零请求：ICON_DATA[type]（已是 dataURI）\n\n'+
'数据驱动（动态显隐 / 流向 / 条件连线 / 图标切换）：\n'+
'  画布 JSON 中：node.visibleWhen（显示条件）、node.iconRules（图标规则：按信号切换图标）、edge.showWhen（显示/存在条件）、edge.dirRules（流向规则，顺序匹配 e.dir 兜底）、顶层 signals（自定义全局信号）。\n'+
'  条件结构：叶子 {var,op,val|ref}；组合 {all:[...]}/{any:[...]}/{not:{...}}；op ∈ == != > >= < <= in between truthy falsy exists。\n'+
'  信号寻址：节点字段=“节点id.字段英文名”，以及 signals 里的全局信号。\n'+
'  图标规则 iconRules：[{when:条件, icon:"图标type"}]，顺序匹配首个命中生效，都不命中用 node.type 自身图标。icon 是元素库里的 type，前端用 ICON_PATHS[iconType] 取文件（与 node.type 同一张映射表）。\n'+
'  运行端用法：\n'+
'    import { resolveDynamic } from "./runtime.js";\n'+
'    const state = resolveDynamic(topology, liveSignals);   // liveSignals 形如 {"bms_1.SOC(%)":18,"grid_1.P(kW)":383}\n'+
'    state.nodes/state.edges 上的 visible 决定是否渲染，edge.dir 为动态流向，node.iconType 为当前应绘制的图标 type（ICON_PATHS[node.iconType]）。\n\n'+
'前端接入（两种方式，按需选）：\n'+
'  方式A（推荐·零重写·像素级一致）：直接把本编辑器 HTML 以「只读运行模式」托管/内嵌，复用同一份渲染器+规则，\n'+
'    流向动画/智能走线/母线汇流/字段卡片都与运营端完全一致，无需自己实现渲染。\n'+
'    • URL 方式： 编辑器.html?mode=runtime&topology=<画布JSON地址>&signals=<实时数据地址>&interval=2000\n'+
'        其它参数：fit=0 关闭自动适配；interactive=1 允许平移缩放（默认只读不可交互）。\n'+
'    • iframe 内嵌：父页面 postMessage 推送：\n'+
'        iframe.contentWindow.postMessage({type:"topo:topology",data:画布JSON对象},"*");\n'+
'        iframe.contentWindow.postMessage({type:"topo:signals",data:{"grid_1.P(kW)":-2,"bms_1.SOC(%)":55}},"*");  // 整批覆盖\n'+
'        iframe.contentWindow.postMessage({type:"topo:merge",data:{"bms_1.SOC(%)":55}},"*");                         // 增量合并\n'+
'        iframe 就绪后会向父页面 postMessage({type:"topo:ready"})，收到后再推数据更稳妥。\n'+
'    • JS API（同源/直接托管时）：window.TopoRuntime.loadTopology(对象或URL) / setSignals(obj) / mergeSignals(obj) / fit()\n'+
'    实时数据键名 = 规则里的信号名：节点字段「节点id.字段英文名」、全局信号名；\n'+
'    同一份实时数据既驱动规则(显隐/流向)，也用于字段卡片数值显示（注意编辑器约定：字段值为 0 显示为 --）。\n'+
'  方式B（自研渲染器）：用 runtime.js 的 resolveDynamic 仅取 visible/dir，再按上面「前端渲染流程」自行绘制\n'+
'    （注意 route="smart" 的智能走线路径未存入 JSON，自研渲染需自行实现走线，否则线形可能与运营端不一致）。\n';
  files.push({name:'README.md', data:strToBytes(readme)});

  const zip=makeZip(files);
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([zip],{type:'application/zip'}));
  a.download='topo-element-library.zip';a.click();
}

