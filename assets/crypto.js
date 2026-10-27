/* ============================================================
   纪念日网站 · 加密模块
   网页解锁和本地加密工具共用这一份代码。
   原理：暗号 --PBKDF2--> 密钥 --AES-GCM--> 密文
   暗号只在你自己的浏览器里参与运算，不会发到任何地方。
   ============================================================ */

(function () {
  "use strict";

  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var DEFAULT_ITER = 300000;

  /* ---------- base64 ---------- */

  function toB64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function fromB64(str) {
    var bin = atob(String(str));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* 把暗号编码成可以放进网址的形式（钥匙链接用） */
  function toB64Url(text) {
    return toB64(enc.encode(text))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function fromB64Url(str) {
    var b = String(str).replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    return dec.decode(fromB64(b));
  }

  /* ---------- 密钥 ---------- */

  function subtle() {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("当前环境不支持加密接口：请用 https 网址或本地文件打开（局域网 http 地址不行）");
    }
    return window.crypto.subtle;
  }

  function deriveKey(password, salt, iter, extractable) {
    var s = subtle();
    return s
      .importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return s.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: iter || DEFAULT_ITER, hash: "SHA-256" },
          base,
          { name: "AES-GCM", length: 256 },
          !!extractable,
          ["encrypt", "decrypt"]
        );
      });
  }

  /* ---------- 加密 ---------- */

  function encrypt(text, password, hint) {
    var s = subtle();
    var salt = window.crypto.getRandomValues(new Uint8Array(16));
    var iv = window.crypto.getRandomValues(new Uint8Array(12));

    return deriveKey(password, salt, DEFAULT_ITER, false).then(function (key) {
      return s.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(text));
    }).then(function (buf) {
      return {
        v: 1,
        kdf: "PBKDF2-SHA256",
        iter: DEFAULT_ITER,
        salt: toB64(salt),
        iv: toB64(iv),
        ct: toB64(new Uint8Array(buf)),
        hint: hint || ""
      };
    });
  }

  /* ---------- 解密 ---------- */

  function decryptWithKey(blob, key) {
    var s = subtle();
    return s
      .decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, key, fromB64(blob.ct))
      .then(function (buf) {
        return dec.decode(buf);
      });
  }

  function decrypt(blob, password) {
    var salt = fromB64(blob.salt);
    return deriveKey(password, salt, blob.iter, true).then(function (key) {
      return decryptWithKey(blob, key).then(function (text) {
        return { text: text, key: key };
      });
    });
  }

  /* ---------- 「在这台设备上记住」用：导出/导入密钥 ---------- */

  function exportKey(key) {
    return window.crypto.subtle.exportKey("raw", key).then(function (raw) {
      return toB64(new Uint8Array(raw));
    });
  }

  function importKey(b64) {
    return subtle().importKey("raw", fromB64(b64), { name: "AES-GCM" }, true, ["decrypt"]);
  }

  /* 换过 secret.js 之后，旧密钥就作废了，用指纹判断 */
  function fingerprint(blob) {
    return blob.salt + "|" + blob.iter + "|" + String(blob.ct).slice(0, 24);
  }

  window.AnnivCrypto = {
    encrypt: encrypt,
    decrypt: decrypt,
    decryptWithKey: decryptWithKey,
    exportKey: exportKey,
    importKey: importKey,
    fingerprint: fingerprint,
    toB64Url: toB64Url,
    fromB64Url: fromB64Url,
    toB64: toB64,
    fromB64: fromB64,
    DEFAULT_ITER: DEFAULT_ITER
  };
})();