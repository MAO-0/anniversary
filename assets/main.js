/* ============================================================
   纪念日网站 · 逻辑
   由解锁页（gate.js）在暗号正确后调用 window.startSite(配置)
   ============================================================ */

window.startSite = function (cfg) {
  "use strict";

  if (window.__siteStarted) return;
  window.__siteStarted = true;

  cfg = cfg || {};
  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  /* ---------- 日期工具 ---------- */

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function parseStart(str) {
    var d = new Date(str);
    if (isNaN(d.getTime())) {
      console.warn("[纪念日] 配置里的 startDate 填得不对：", str);
      d = new Date();
    }
    return d;
  }

  function parseMonthDay(md) {
    var p = String(md).split("-").map(Number);
    return { m: p[0], d: p[1] };
  }

  function nextYearly(md, now) {
    var o = parseMonthDay(md);
    var today = startOfDay(now);
    var t = new Date(now.getFullYear(), o.m - 1, o.d);
    if (t.getTime() < today.getTime()) t = new Date(now.getFullYear() + 1, o.m - 1, o.d);
    return t;
  }

  function parseOnce(str) {
    var p = String(str).split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function daysUntil(target, now) {
    return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / 86400000);
  }

  function fmtDate(d) {
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日 · " + WEEK[d.getDay()];
  }

  function fmtShort(d) {
    return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate());
  }

  /* ---------- 基本信息 ---------- */

  var start = parseStart(cfg.startDate);
  var names = cfg.names || {};

  /* 是否把开始那天也算作第 1 天（默认算上，想只算经过的整天可设 countStartDay: false） */
  var countStartDay = cfg.countStartDay !== false;

  function daysTogether(now) {
    var diff = Math.max(0, now.getTime() - start.getTime());
    return Math.floor(diff / 86400000) + (countStartDay ? 1 : 0);
  }
  var me = names.me || "我";
  var you = names.you || "你";

  document.title = me + " ♥ " + you + " · 我们的纪念日";
  $("slogan").textContent = cfg.slogan || "";
  $("name-me").textContent = me;
  $("name-you").textContent = you;
  $("since").textContent = "从 " + fmtShort(start) + " 开始";

  /* 自动生成「在一起」周年，再加上配置里写的其他纪念日 */
  var events = [{
    title: "在一起",
    emoji: "💞",
    yearly: true,
    md: pad(start.getMonth() + 1) + "-" + pad(start.getDate()),
    baseYear: start.getFullYear()
  }];

  (cfg.anniversaries || []).forEach(function (item) {
    if (!item || !item.date) return;
    var parts = String(item.date).split("-");
    var isYearly = parts.length === 2 && item.yearly !== false;
    events.push({
      title: item.title || "纪念日",
      emoji: item.emoji || "🎈",
      yearly: isYearly,
      md: isYearly ? item.date : null,
      once: isYearly ? null : parseOnce(item.date)
    });
  });

  function buildSchedule(now) {
    var list = [];

    events.forEach(function (ev) {
      var date, index = null;

      if (ev.yearly) {
        date = nextYearly(ev.md, now);
        if (ev.baseYear) index = date.getFullYear() - ev.baseYear;
      } else {
        date = ev.once;
      }

      if (!date || isNaN(date.getTime())) return;

      var days = daysUntil(date, now);
      if (days < 0) return; // 已经过去的一次性纪念日就不显示了

      list.push({ ev: ev, date: date, index: index, days: days });
    });

    list.sort(function (a, b) { return a.days - b.days; });
    return list;
  }

  /* ---------- 渲染：下一个纪念日 ---------- */

  function renderNext(now) {
    var list = buildSchedule(now);
    var top = list[0];
    var today = false;

    if (!top) {
      $("next-emoji").textContent = "📝";
      $("next-title").textContent = "还没有纪念日";
      $("next-date").textContent = "去加密工具里添几个吧";
      $("next-note").textContent = "";
      $("next-days").textContent = "—";
      $("next-unit").textContent = "";
      document.body.classList.remove("is-today");
      return;
    }

    $("next-emoji").textContent = top.ev.emoji;
    $("next-title").textContent = top.ev.title + (top.index ? " · 第 " + top.index + " 个" : "");
    $("next-date").textContent = fmtDate(top.date);

    if (top.days === 0) {
      today = true;
      $("next-days").textContent = "就是今天";
      $("next-unit").textContent = "";
      $("next-note").textContent = "别忘了对 " + you + " 说点什么 ♥";
    } else {
      $("next-days").textContent = top.days;
      $("next-unit").textContent = "天";
      $("next-note").textContent = top.days >= 14
        ? "大约 " + Math.round(top.days / 7) + " 周之后"
        : (top.days === 1 ? "就是明天了" : "很快了");
    }

    document.body.classList.toggle("is-today", today);
  }

  /* ---------- 渲染：所有纪念日 ---------- */

  function renderGrid(now) {
    var list = buildSchedule(now);
    var box = $("grid");
    box.innerHTML = "";

    list.forEach(function (item) {
      var card = document.createElement("div");
      card.className = "card" + (item.days === 0 ? " is-today" : "");

      var top = document.createElement("div");
      top.className = "card__top";

      var emoji = document.createElement("span");
      emoji.className = "card__emoji";
      emoji.textContent = item.ev.emoji;

      var title = document.createElement("h3");
      title.className = "card__title";
      title.textContent = item.ev.title + (item.index ? " " + item.index + " 周年" : "");

      top.appendChild(emoji);
      top.appendChild(title);

      var date = document.createElement("p");
      date.className = "card__date";
      date.textContent = fmtShort(item.date) + " " + WEEK[item.date.getDay()];

      var chip = document.createElement("span");
      chip.className = "card__chip";
      chip.textContent = item.days === 0 ? "今天" : "还有 " + item.days + " 天";

      card.appendChild(top);
      card.appendChild(date);
      card.appendChild(chip);
      box.appendChild(card);
    });
  }

  /* ---------- 渲染：里程碑 ---------- */

  function nextMilestone(days) {
    var marks = [];
    var top = Math.ceil(days / 100) + 3;
    for (var k = 1; k <= top; k++) marks.push(k * 100);
    [520, 999, 1314, 2000, 3000, 5200].forEach(function (n) { marks.push(n); });

    marks = marks
      .filter(function (n, i) { return marks.indexOf(n) === i; })
      .sort(function (a, b) { return a - b; });

    for (var i = 0; i < marks.length; i++) {
      if (marks[i] > days) return marks[i];
    }
    return null;
  }

  function renderMilestone(days) {
    var n = nextMilestone(days);
    var panel = $("milestone-panel");

    if (!n) { panel.hidden = true; return; }

    var text = $("milestone-text");
    text.innerHTML = "";

    text.appendChild(document.createTextNode("距离第 "));
    var b = document.createElement("b");
    b.textContent = n;
    text.appendChild(b);
    text.appendChild(document.createTextNode(" 天，还有 " + (n - days) + " 天"));

    var sub = $("milestone-sub");
    if (n === 520) sub.textContent = "520 天，一个说起来会笑的数字。";
    else if (n === 999) sub.textContent = "999 天，比长久还差一天。";
    else if (n === 1314) sub.textContent = "1314 天，一生一世。";
    else sub.textContent = "第 " + (n / 100) + " 个一百天。";

    panel.hidden = false;
  }

  /* ---------- 渲染：时间轴 ---------- */

  function renderTimeline() {
    var items = (cfg.timeline || []).filter(function (it) { return it && it.date; });
    var panel = $("timeline-panel");

    if (!items.length) { panel.hidden = true; return; }

    items = items.slice().sort(function (a, b) {
      return parseOnce(a.date) - parseOnce(b.date);
    });

    var ol = $("timeline");
    ol.innerHTML = "";

    items.forEach(function (it) {
      var li = document.createElement("li");

      var time = document.createElement("time");
      time.textContent = fmtShort(parseOnce(it.date));

      var h3 = document.createElement("h3");
      h3.textContent = it.title || "";

      li.appendChild(time);
      li.appendChild(h3);

      if (it.text) {
        var p = document.createElement("p");
        p.textContent = it.text;
        li.appendChild(p);
      }

      ol.appendChild(li);
    });

    panel.hidden = false;
  }

  /* ---------- 渲染：页脚那句话 ---------- */

  function renderQuote(now) {
    var quotes = (cfg.quotes && cfg.quotes.length)
      ? cfg.quotes
      : ["愿我们把每个普通的日子都过成纪念日。"];

    var dayOfYear = Math.floor(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
        Date.UTC(now.getFullYear(), 0, 0)) / 86400000
    );

    $("quote").textContent = quotes[dayOfYear % quotes.length];
  }

  /* ---------- 每秒更新 ---------- */

  function tick() {
    var now = new Date();
    var diff = now.getTime() - start.getTime();
    if (diff < 0) diff = 0;

    var days = daysTogether(now);
    var rest = diff % 86400000;

    $("days").textContent = String(days).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    $("clock").textContent =
      pad(Math.floor(rest / 3600000)) + ":" +
      pad(Math.floor(rest / 60000) % 60) + ":" +
      pad(Math.floor(rest / 1000) % 60);
  }

  function refreshPanels() {
    var now = new Date();
    renderNext(now);
    renderGrid(now);
    renderQuote(now);
    renderMilestone(daysTogether(now));
  }

  /* ---------- 飘动的心 ---------- */

  function makeHearts() {
    var box = $("hearts");
    if (!box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var count = window.innerWidth < 560 ? 7 : 13;

    for (var i = 0; i < count; i++) {
      var s = document.createElement("span");
      s.textContent = i % 3 === 1 ? "♡" : "♥";
      s.style.left = (Math.random() * 96 + 2).toFixed(2) + "%";
      s.style.fontSize = (11 + Math.random() * 16).toFixed(1) + "px";
      s.style.animationDuration = (15 + Math.random() * 14).toFixed(1) + "s";
      s.style.animationDelay = (-Math.random() * 24).toFixed(1) + "s";
      box.appendChild(s);
    }
  }

  /* ---------- 滚动淡入 ---------- */

  function setupReveal() {
    var items = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add("is-visible");
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    for (var j = 0; j < items.length; j++) io.observe(items[j]);
  }

  /* ---------- 启动 ---------- */

  makeHearts();
  renderTimeline();
  refreshPanels();
  tick();
  setupReveal();

  setInterval(tick, 1000);
  setInterval(refreshPanels, 60000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refreshPanels();
  });
};