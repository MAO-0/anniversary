/* ============================================================
   背景音乐（可选功能）
   ------------------------------------------------------------
   怎么用：
   1. 把音乐文件放进 assets/music/ 文件夹（例如 miss.mp3）
   2. 在下面把 file 改成你的文件名，startAt 改成要开始的秒数
   3. 想让它循环就设 loop: true

   关于起点：startAt 支持两种写法——秒数 83，或者 "1:23"
   （"我从来没想过"那句在第几分几秒，自己听着填就行）

   关于自动播放：浏览器不允许网页自己出声，所以音乐是在
   你点「进入」那一刻开始播的；如果是用钥匙链接直接进来的，
   可能不会自动响，点右下角的音符按钮即可。
   ============================================================ */

window.SITE_MUSIC = {
  file: "assets/music/miss.m4a",  // 音乐文件（放在 assets/music/ 里）
  startAt: 13,                    // 从第几秒开始播：13 或 "0:13"
  loop: false,                    // 播完是否重头再来
  volume: 0.5,                    // 音量 0 ~ 1
  title: "错过 — 王力宏"           // 鼠标悬停时显示的名字
};

window.SiteMusic = (function () {
  "use strict";

  var cfg = window.SITE_MUSIC || {};
  var audio = null;
  var button = null;
  var failed = false;

  function toSeconds(v) {
    if (typeof v === "number" && isFinite(v)) return Math.max(0, v);
    var m = /^(\d+):(\d{1,2})$/.exec(String(v == null ? "" : v));
    return m ? (+m[1]) * 60 + (+m[2]) : 0;
  }

  function icon(playing) {
    if (button) button.textContent = playing ? "🔊" : "🔈";
  }

  function makeButton() {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "music-btn";
    b.textContent = "🔈";
    b.title = cfg.title || "背景音乐";
    b.setAttribute("aria-label", cfg.title || "背景音乐");
    b.addEventListener("click", toggle);
    document.body.appendChild(b);
    return b;
  }

  function ensure() {
    if (audio || failed) return audio;
    if (!cfg.file) { failed = true; return null; }

    audio = new Audio();
    audio.preload = "auto";
    audio.loop = !!cfg.loop;
    audio.volume = typeof cfg.volume === "number" ? cfg.volume : 0.5;
    audio.src = cfg.file;
    audio.addEventListener("error", function () { failed = true; hide(); });
    audio.addEventListener("play", function () { icon(true); });
    audio.addEventListener("pause", function () { icon(false); });
    return audio;
  }

  function hide() {
    if (button) button.classList.remove("is-on");
  }

  /* 解锁之后调用，把右下角的按钮挂出来 */
  function mount() {
    if (failed) return;
    if (!button) button = makeButton();
    button.classList.add("is-on");
  }

  function play() {
    var a = ensure();
    if (!a) { hide(); return; }

    var start = toSeconds(cfg.startAt);

    function begin() {
      if (start > 0 && Math.abs(a.currentTime - start) > 1.5) {
        try { a.currentTime = start; } catch (e) { /* 还没准备好，忽略 */ }
      }
      var p = a.play();
      if (p && p.catch) p.catch(function () { icon(false); });
    }

    // 音频还没读到时长信息时，先等它一下再跳到起点
    if (start > 0 && a.readyState < 1) {
      a.addEventListener("loadedmetadata", begin, { once: true });
      return;
    }
    begin();
  }

  function toggle() {
    var a = ensure();
    if (!a) return;
    if (a.paused) play(); else a.pause();
  }

  return {
    mount: mount,
    play: play,
    toggle: toggle
  };
})();