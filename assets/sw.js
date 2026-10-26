/* ============================================================
   极简 Service Worker
   ------------------------------------------------------------
   它只有一个作用：让安卓 Chrome 认为这是一个"可以安装的 App"，
   从而支持「添加到主屏幕」后全屏打开（像 App 一样，没有地址栏）。

   刻意不做任何缓存 —— 所以永远不会出现"改了内容还是旧的"。
   如果你不需要安卓那种安装体验，直接删掉这个文件、并把
   index.html 末尾那段注册代码删掉即可，其他功能不受影响。
   ============================================================ */

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

/* 不拦截任何请求：浏览器照常直接访问网络 */
self.addEventListener("fetch", function () {
  /* 故意留空 */
});