/*!
 * @enercloud/topology-runtime/rules —— 数据驱动规则求值（headless，纯函数）
 *
 * 单一事实源：与编辑器「数据预览」同一套求值逻辑；前端渲染器经此包消费，
 * 保证 线上 = 编辑器预览。函数体与元素库包导出的 runtime.js 逐字一致。
 *
 * 双形态加载（普通脚本 + CJS 尾巴，无需构建）：
 *   · 浏览器 <script> → 得到全局 TopoRules
 *   · Node / 打包器  require/import '@enercloud/topology-runtime/rules'
 *
 * ⚠️ 适用数据形态：buildContext/resolveDynamic 面向**导出文档格式**（字段 key 为 {zh,en} 或
 *   字符串、静态值在 f.value、信号键英文名优先）。两个现存宿主都有自己的上下文适配层，勿混用：
 *   · 编辑器内部画布：字段值在 f.dv（见 topology-editor-09-rules 的 collectSignals/buildCtx）；
 *   · 前端 dashboard：lib/topo/rule-engine.ts 直接消费本包 buildContext/resolveDynamic
 *     （2026-07-02 起语义完全收敛，仅适配返回结构）。
 *   evalCond/cmpOp 是纯条件树求值，对所有宿主通用。
 *
 * 用法：
 *   const state = TopoRules.resolveDynamic(topology, signals);
 *   state.nodes: [{...node, visible, iconType}] // visible=false → 不渲染；iconType=图标规则生效后的图标
 *   state.edges: [{...edge, visible, dir}]      // visible=false → 不渲染；dir=动态流向
 * signals：扁平对象，如 { "bms_1.SOC(%)": 20, "grid_1.P(kW)": 383, "mode": "island" }
 *   未提供的信号回退到画布静态值（节点字段 value / topology.signals 样例 / sampleSignals）。
 */
var TopoRules = (function () {
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
  function evalCond(cond, ctx){
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
  // ★ 计算绑定（bind.calc）：多操作数「链式」计算/比较——按操作数顺序左→右依次结合，无括号/优先级。
  //   calc = { operands:[ {field,deviceType?,deviceId?} | {const:值} ... ], operators:[op,...], decimals? }
  //   （operators.length = operands.length-1；op ∈ + - * / % > >= < <= == !=，比较结果为 1/0，可再配值字典转文案；
  //     decimals=数值结果保留小数位，0~3，缺省 2——中间步骤保持全精度，只在最终结果上取整）
  //   字段操作数的实时值由后台按「主信号键@操作数下标」推送（见 dataBindings 的 calcOf 条目），
  //   get(operand, i) 由宿主提供取值：编辑器/前端读 ctx[主信号键+'@'+i]，常量操作数本函数直接取 const。
  //   任一字段操作数无值(null/undefined/'') 或算术结果非有限数 → 返回 undefined（宿主保留静态默认值，不吞显示）。
  function calcValue(calc, get){
    if(!calc||!Array.isArray(calc.operands)||!calc.operands.length)return undefined;
    var ops=Array.isArray(calc.operators)?calc.operators:[];
    var acc=null;
    for(var i=0;i<calc.operands.length;i++){
      var o=calc.operands[i]||{};
      var v=(o.const!==undefined)?o.const:get(o,i);
      if(v==null||v==='')return undefined;
      if(i===0){acc=v;continue;}
      var op=ops[i-1]||'+';
      if(op==='+'||op==='-'||op==='*'||op==='/'||op==='%'){
        var a=_num(acc),b=_num(v);
        acc=(op==='+')?a+b:(op==='-')?a-b:(op==='*')?a*b:(op==='/')?a/b:a%b;
      }else if(op==='>'||op==='>='||op==='<'||op==='<='||op==='=='||op==='!='){
        acc=cmpOp(acc,op,v)?1:0;
      }else{
        return undefined;   // 未知运算符（手改/坏数据）：不猜语义，与操作数缺值同一降级——保留静态默认值
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
  // 计算绑定在「导出文档格式」上下文里的落值：主信号 = calcValue(操作数信号 ctx[sig@i])。
  // 在 buildContext 末尾调用——操作数实时值(signals)已并入 ctx；算不出（操作数缺值）时保留 ctx 里的静态默认/直推值。
  function applyCalcSignals(topology, ctx){
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
  function buildContext(topology, signals){
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
  function resolveDynamic(topology, signals){
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
  return { _num:_num, _looseEq:_looseEq, _toList:_toList, cmpOp:cmpOp, evalCond:evalCond, calcValue:calcValue, applyCalcSignals:applyCalcSignals, buildContext:buildContext, resolveDynamic:resolveDynamic };
})();

// CJS 尾巴：Node / 打包器消费；浏览器 <script> 引入时走全局 TopoRules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TopoRules;
  // 下列显式赋值与上一行等价(同一批属性),仅为让 Node 原生 ESM 互操作(cjs-module-lexer)
  // 能静态识别命名导出——否则 `import { cmpOp } from '.../rules'` 在非打包环境下报
  // "Named export not found"。新增导出时此处要同步补一行。
  module.exports._num = TopoRules._num;
  module.exports._looseEq = TopoRules._looseEq;
  module.exports._toList = TopoRules._toList;
  module.exports.cmpOp = TopoRules.cmpOp;
  module.exports.evalCond = TopoRules.evalCond;
  module.exports.calcValue = TopoRules.calcValue;
  module.exports.applyCalcSignals = TopoRules.applyCalcSignals;
  module.exports.buildContext = TopoRules.buildContext;
  module.exports.resolveDynamic = TopoRules.resolveDynamic;
}
