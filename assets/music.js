/* ============================================================
   背景音乐
   ------------------------------------------------------------
   打开网页就尝试自动播放，音量由小到大淡入（默认 2.5 秒到设定音量）。

   浏览器（尤其 iPhone）的自动播放限制是硬规矩，所以实际表现是：
   · 允许自动播放时 → 一打开就响
   · 被拦下时 → 你第一次点/按页面任何地方就立刻开始播

   为了让"第一次点"一定生效，这里做了两件事：
   1) 点击监听在脚本加载时就挂好，不依赖其他文件是否更新
   2) 点击的瞬间立刻调用 play()（不再等音频元数据加载完），
      否则会丢掉"用户手势"，iOS 就会拒绝播放

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
  var gestureHandlers = [];

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
    audio.addEventListener("play", function () { icon(true); unbindGesture(); });
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

  /* 跳到起点：能设就立刻设，不能设就等元数据到了再设（此时已经在播了） */
  function seekToStart(a) {
    var start = toSeconds(cfg.startAt);
    if (start <= 0) return;

    function jump() {
      try {
        if (Math.abs(a.currentTime - start) > 1.5) a.currentTime = start;
      } catch (e) { /* 忽略 */ }
    }

    if (a.readyState >= 1) jump();
    else a.addEventListener("loadedmetadata", jump, { once: true });
  }

  /* instant = true 表示手动点的继续：立刻到目标音量，不要再渐入 */
  function play(instant) {
    var a = ensure();
    if (!a) { hide(); return; }

    var target = targetVolume();

    // 已经在播：只把音量补到目标值，不要重新跳回起点
    if (!a.paused) { fadeTo(target, instant ? 150 : 500); return; }

    // 首次/自动播放：音量从 0 渐入；手动继续：直接到目标音量
    if (cfg.fadeIn !== false) a.volume = instant ? target : 0;

    // 关键：立刻调用 play()，保住"用户手势"这个资格
    var p = a.play();

    seekToStart(a);

    if (p && p.then) {
      p.then(function () {
        fadeTo(target, instant ? 0 : (cfg.fadeMs || 2500));
      }).catch(function () {
        icon(false); // 被浏览器拦住了，等第一次点击/按键
      });
    }
  }

  /* 被自动播放拦下时，第一次触摸/点击/按键就立刻开始。
     重要：触摸时 pointerdown 那一刻浏览器还没给"用户手势"资格
     （触摸的资格在 pointerup / touchend 才生效），所以：
     · 每个事件都试一次，直到真的播起来
     · 只有播放真正开始后，才把监听撤掉 */
  var gestureEvents = ["pointerdown", "pointerup", "touchend", "click", "keydown"];

  function unbindGesture() {
    if (!gestureBound) return;
    gestureBound = false;
    gestureEvents.forEach(function (name, i) {
      if (gestureHandlers[i]) document.removeEventListener(name, gestureHandlers[i], true);
    });
    gestureHandlers = [];
  }

  function bindGestureStart() {
    if (gestureBound) return;
    gestureBound = true;
    gestureHandlers = [];

    gestureEvents.forEach(function (name) {
      var handler = function () {
        var a = ensure();
        if (a && !a.paused) { unbindGesture(); return; }
        play(); // 这一下不成功也没关系，下一个事件还会再试
      };
      gestureHandlers.push(handler);
      document.addEventListener(name, handler, true);
    });
  }

  /* 页面加载时就调用；也可以由解锁逻辑再调一次（重复调用没影响） */
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

  /* 脚本一加载就把点击监听挂好：
     这样即使别的文件还是浏览器缓存的旧版本，第一次点击也一定能起播 */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindGestureStart);
  } else {
    bindGestureStart();
  }

  return {
    mount: mount,
    play: play,
    toggle: toggle,
    autoStart: autoStart
  };
})();