// Icon containers — populated at runtime from the file-based icon library (icons/index.json).
// 图标已抽离为 icons/ 目录下的独立图片文件。增删改图标 = 直接增删改 icons/ 里的图片，无需改动代码。
// IMG_DATA: type -> 图片 URL；IMGS: type -> 已加载的 Image 对象（drawImage 用）。详见 topology-editor.js 的 loadIconLibrary()。
const IMG_DATA={};
const IMGS={};
