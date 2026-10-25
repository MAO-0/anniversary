/* ============================================================
   纪念日网站 · 解锁控制
   没有正确暗号之前，页面上不会出现任何内容。
   ============================================================ */

(function () {
  "use strict";

  var C = window.AnnivCrypto;
  var body = document.body;
  var KEY_STORE = "anniv.key";
  var FP_STORE = "anniv.fp";

  function $(id) { return document.getElementById(id); }

  var lock = $("lock");
  var form = $("lock-form");
  var input = $("lock-input");
  var button = $("lock-btn");
  var remember = $("lock-remember");
  var errorBox = $("lock-error");
  var sub = $("lock-sub");

  function store(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* 隐私模式等，忽略 */ }
  }
  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function drop(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove("is-bad");
    void errorBox.offsetWidth; // 重新触发抖动动画
    errorBox.classList.add("is-bad");
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.remove("is-bad");
  }

  function busy(on) {
    button.disabled = on;
    input.disabled = on;
    button.textContent = on ? "解锁中…" : "进入";
  }

  function enter(cfg) {
    body.classList.remove("is-locked");
    lock.hidden = true;
    window.scrollTo(0, 0);
    if (typeof window.startSite === "function") window.startSite(cfg);
    // 解锁后补一次滚动淡入（display:none 期间观察器不会触发）
    setTimeout(function () {
      var items = document.querySelectorAll(".reveal");
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) items[i].classList.add("is-visible");
      }
    }, 60);
  }

  function parse(text) {
    var cfg = JSON.parse(text);
    if (!cfg || typeof cfg !== "object") throw new Error("内容格式不对");
    return cfg;
  }

  /* 用暗号解锁 */
  function unlockWithPassword(password, rememberMe) {
    return C.decrypt(window.ENCRYPTED_DATA, password).then(function (res) {
      var cfg = parse(res.text);
      if (rememberMe) {
        return C.exportKey(res.key).then(function (raw) {
          store(KEY_STORE, raw);
          store(FP_STORE, C.fingerprint(window.ENCRYPTED_DATA));
          enter(cfg);
        });
      }
      drop(KEY_STORE);
      drop(FP_STORE);
      enter(cfg);
    });
  }

  /* 用本机记住的密钥解锁（不用重新输暗号） */
  function unlockWithStoredKey() {
    var raw = read(KEY_STORE);
    var fp = read(FP_STORE);
    if (!raw || fp !== C.fingerprint(window.ENCRYPTED_DATA)) {
      drop(KEY_STORE);
      drop(FP_STORE);
      return Promise.reject(new Error("stale"));
    }
    return C.importKey(raw).then(function (key) {
      return C.decryptWithKey(window.ENCRYPTED_DATA, key);
    }).then(function (text) {
      enter(parse(text));
    });
  }

  /* 钥匙链接：#k=暗号 */
  function passwordFromHash() {
    var m = /[#&]k=([^&]+)/.exec(window.location.hash || "");
    if (!m) return null;
    try { return C.fromB64Url(m[1]); } catch (e) { return null; }
  }

  function stripHash() {
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (e) { /* file:// 下可能受限，忽略 */ }
  }

  /* ---------- 启动 ---------- */

  function init() {
    if (!window.ENCRYPTED_DATA || !window.ENCRYPTED_DATA.ct) {
      sub.textContent = "还没生成加密内容";
      form.hidden = true;
      showError("找不到 secret.js。请先用「加密工具.html」生成，再上传到仓库。");
      $("lock-foot").hidden = false;
      return;
    }

    if (window.ENCRYPTED_DATA.hint) {
      var hint = $("lock-hint");
      hint.textContent = "提示：" + window.ENCRYPTED_DATA.hint;
      hint.hidden = false;
    }

    if (!window.crypto || !window.crypto.subtle) {
      sub.textContent = "这个地址打不开";
      form.hidden = true;
      showError("浏览器在这个地址下禁用了加密接口。请用 https 网址打开（GitHub Pages 的网址就行），局域网 http 地址不行。");
      return;
    }

    // 1) 钥匙链接优先
    var pw = passwordFromHash();
    if (pw !== null) {
      busy(true);
      unlockWithPassword(pw, false)
        .then(stripHash)
        .catch(function () {
          busy(false);
          stripHash();
          showError("这条钥匙链接已经失效（暗号可能换过了），请手动输入暗号。");
        });
      return;
    }

    // 2) 本机记住的密钥
    if (read(KEY_STORE)) {
      unlockWithStoredKey().catch(function () { /* 静默回到输入框 */ });
      return;
    }

    // 3) 手动输入
    input.focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var password = input.value;
    if (!password) { showError("请输入暗号"); input.focus(); return; }

    clearError();
    busy(true);

    unlockWithPassword(password, remember && remember.checked).catch(function (err) {
      busy(false);
      input.select();
      showError(err && err.message && err.message.indexOf("加密接口") >= 0
        ? err.message
        : "暗号不对，再想想？");
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();