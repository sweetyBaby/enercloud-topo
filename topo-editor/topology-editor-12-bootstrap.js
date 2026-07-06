// ══════════════════════════════════════════════════════════════
// 应用入口（必须是最后加载的脚本）
// ---------------------------------------------------------------
// 原单文件里所有函数声明在任何代码运行前就已解析，故启动代码放在文件任意位置都安全。
// 拆成多个 <script> 后，每个标签「先执行、再加载下一个」，函数声明不跨 <script> 提升。
// init() 体内会调用分布在 02(buildSidebar/buildEdgeBar/buildSelects/buildBg)、03(resizeCanvas)、
// 06(loop)、11(topoRuntimeConfig/enterRuntimeMode/loadDefaultTemplate) 等后续文件的函数；
// 若启动代码留在 01，一旦 loadIconLibrary/loadBackendBindingData 在 02–11 加载完成前 resolve，
// init() 就会抛 ReferenceError。因此把「初始主题 + 启动」统一放到 01→11 之后的本文件执行。
setTheme('blue_screen');
Promise.all([loadIconLibrary(),loadBackendBindingData(),loadValueDicts()]).then(init).catch(err=>{console.error('初始化失败：',err);init();});
