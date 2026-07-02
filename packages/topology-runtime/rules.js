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
      case 'between':{var a=_toList(rv).map(_num);if(a.length<2)return false;return _num(lv)>=Math.min(a[0],a[1])&&_num(lv)<=Math.max(a[0],a[1]);}
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
  return { _num:_num, _looseEq:_looseEq, _toList:_toList, cmpOp:cmpOp, evalCond:evalCond, buildContext:buildContext, resolveDynamic:resolveDynamic };
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
  module.exports.buildContext = TopoRules.buildContext;
  module.exports.resolveDynamic = TopoRules.resolveDynamic;
}
