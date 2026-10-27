/* ============================================================
   背景音乐
   ------------------------------------------------------------
   打开网页就尝试自动播放，音量由小到大淡入（默认 2.5 秒到设定音量）。

   浏览器的自动播放限制是硬规矩，所以实际表现是：
   · 允许自动播放时（例如你常来这个站）
       → 一打开就响
   · 被拦下时 → 你第一次点/按页面任何地方（通常是点密码框）
       → 立刻开始播，不用专门去点右下角按钮

   右下角的音符按钮随时可以暂停 / 继续。
   ============================================================ */

window.SITE_MUSIC = {
  file: "assets/music/miss.m4a",  // 音乐文件（放在 assets/music/ 里）
  startAt: 13,                    // 从第几秒开始播：13 或 "0:13"
  loop: false,                    // 播完是否重头再来
  volume: 0.5,                    // 最终音量 0 ~ 1
  fadeIn: true,                   // 音量由小到大
  fadeMs: 2500,                   // 渐入时长（毫秒）
  title: "错过 — 王力宏"           // 鼠标悬停时显示的名字
};

window.SiteMusic = (function () {
  "use strict";

  var cfg = window.SITE_MUSIC || {};
  var audio = null;
  var button = null;
  var failed = false;
  var fadeTimer = null;
  var gestureBound = false;

  function toSeconds(v) {
    if (typeof v === "number" && isFinite(v)) return Math.max(0, v);
    var m = /^(\d+):(\d{1,2})$/.exec(String(v == null ? "" : v));
    return m ? (+m[1]) * 60 + (+m[2]) : 0;
  }

  function targetVolume() {
    var v = typeof cfg.volume === "number" ? cfg.volume : 0.5;
    return Math.min(1, Math.max(0, v));
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
    audio.volume = 0; // 先静音，等 play 成功后再渐入
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

  /* 音量渐变：从当前音量滑到目标音量 */
  function fadeTo(target, ms) {
    var a = audio;
    if (!a) return;

    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }

    if (cfg.fadeIn === false || !ms) { a.volume = target; return; }

    var from = a.volume;
    if (Math.abs(from - target) < 0.02) { a.volume = target; return; }

    var steps = Math.max(1, Math.round(ms / 50));
    var i = 0;
    fadeTimer = setInterval(function () {
      i++;
      a.volume = Math.min(1, Math.max(0, from + (target - from) * (i / steps)));
      if (i >= steps) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        a.volume = target;
      }
    }, 50);
  }

  function play(instant) {
    var a = ensure();
    if (!a) { hide(); return; }

    var target = targetVolume();

    // 已经在播：只把音量补到目标值，不要重新跳回起点
    if (!a.paused) { fadeTo(target, instant ? 150 : 500); return; }

    var start = toSeconds(cfg.startAt);
    // 首次/自动播放：音量从 0 渐入；手动恢复播放：直接到目标音量，别让人等
    if (cfg.fadeIn !== false) a.volume = instant ? target : 0;

    function begin() {
      if (start > 0 && Math.abs(a.currentTime - start) > 1.5) {
        try { a.currentTime = start; } catch (e) { /* 还没准备好，忽略 */ }
      }
      var p = a.play();
      if (p && p.then) {
        p.then(function () {
          fadeTo(target, instant ? 0 : (cfg.fadeMs || 2500));
        }).catch(function () {
          icon(false); // 被浏览器拦住了，等第一次点击/按键
        });
      }
    }

    // 音频还没读到时长信息时，先等它一下再跳到起点
    if (start > 0 && a.readyState < 1) {
      a.addEventListener("loadedmetadata", begin, { once: true });
    } else {
      begin();
    }
  }

  /* 被自动播放拦下时，第一次点击/按键就立刻开始 */
  function bindGestureStart() {
    if (gestureBound) return;
    gestureBound = true;

    function handler() {
      document.removeEventListener("pointerdown", handler, true);
      document.removeEventListener("touchstart", handler, true);
      document.removeEventListener("keydown", handler, true);
      var a = ensure();
      if (a && !a.paused) return; // 已经在播就不用再动
      play();
    }

    document.addEventListener("pointerdown", handler, true);
    document.addEventListener("touchstart", handler, true);
    document.addEventListener("keydown", handler, true);
  }

  /* 页面一加载就调用：先试着直接播，播不了就等第一次交互 */
  function autoStart() {
    mount();
    play();
    bindGestureStart();
  }

  function toggle() {
    var a = ensure();
    if (!a) return;
    if (a.paused) play(true); else a.pause();
  }

  return {
    mount: mount,
    play: play,
    toggle: toggle,
    autoStart: autoStart
  };
})();