/* ============================================================
   back-swipe.js —— 全站「侧滑返回」v4
   · 屏幕左/右边缘往内滑 → 返回上一层
   · 桌面翻页不受影响；只在有界面打开时生效
   · v4 修复：层识别不再只看 body 的直接子元素
     （论坛 / 关系 / 漫游 / 人设 / 查岗 这些屏幕其实挂在 .phone 里，
       旧版按 body 子元素扫，全漏了 —— 那几个 App 不能侧滑回退就是这原因）
   · v4：关闭时优先调各模块自己的 closeXxxScreen()，没有才点返回键 / 摘类名
   挂载：index.html <head> 一行 <script src="back-swipe.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var EDGE = 18;        /* 起手必须从边缘 18px 内开始 */
  var MIN_DX = 62;      /* 横向至少滑 62px */
  var MAX_DY_RATIO = 0.6;
  var MAX_MS = 900;

  /* ---------- 基础判断 ---------- */
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05;
  }

  function effZ(el) {
    var z = 0, n = el;
    while (n && n !== document.body) {
      var v = parseInt(getComputedStyle(n).zIndex, 10);
      if (!isNaN(v)) z = Math.max(z, v);
      n = n.parentElement;
    }
    return z;
  }

  /* 一个「打开的界面」：带 is-open / open 类、铺得够大、真的可见 */
  function isLayer(el) {
    if (!el || el.nodeType !== 1 || !el.classList) return false;
    if (!(el.classList.contains('is-open') || el.classList.contains('open'))) return false;
    if (el.id === 'app-grid' || el.classList.contains('stage')) return false;
    if (!visible(el)) return false;
    var cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    var r = el.getBoundingClientRect();
    if (r.width < window.innerWidth * 0.7) return false;
    if (r.height < window.innerHeight * 0.3) return false;
    return true;
  }

  /* 所有打开的界面，层级从高到低（同级时 DOM 靠后的算更上层） */
  function layers() {
    var out = [];
    var all;
    try { all = document.querySelectorAll('.is-open, .open'); } catch (e) { return out; }
    for (var i = 0; i < all.length; i++) {
      if (!isLayer(all[i])) continue;
      out.push({ el: all[i], z: effZ(all[i]), i: i });
    }
    out.sort(function (a, b) { return (b.z - a.z) || (b.i - a.i); });
    return out;
  }

  function topLayerEl() {
    var ls = layers();
    return ls.length ? ls[0].el : null;
  }

  /* 学习 / 天气 / 生活 的老逻辑留着（它们有二级页） */
  function studyOpen() {
    var el = document.getElementById('xxj-study');
    return !!(el && el.classList.contains('open'));
  }
  function lifeOpen() {
    var el = document.getElementById('xxj-life');
    return !!(el && el.classList.contains('open'));
  }
  function weatherOpen() {
    var el = document.getElementById('xxj-wx');
    return !!(el && el.classList.contains('open'));
  }
  function planOverlay() {
    var el = document.getElementById('xxj-pn-ov');
    return el && el.classList.contains('open') ? el : null;
  }

  function hasLayer() {
    if (planOverlay() || studyOpen() || lifeOpen() || weatherOpen()) return true;
    return !!topLayerEl();
  }

  /* ---------- 找模块自己的 close 函数 ---------- */
  var ALIAS = {
    'char-lock-screen': 'closeCharLockFocusScreen',
    'chat-video-call-screen': 'closeChatCallScreen',
    'checkup-device-screen': 'closeCheckupScreen',
    'sticker-add-open-screen': 'closeStickerScreen'
  };

  function camelOf(id) {
    return String(id).replace(/(^|-)([a-z])/g, function (m, dash, ch) { return ch.toUpperCase(); });
  }

  function closerFor(el) {
    var id = el.id || '';
    if (!id) return null;
    var names = [];
    if (ALIAS[id]) names.push(ALIAS[id]);
    var c = camelOf(id);
    names.push('close' + c);
    if (/Screen$/.test(c)) names.push('close' + c.slice(0, -6));
    for (var i = 0; i < names.length; i++) {
      var fn = window[names[i]];
      if (typeof fn === 'function') return fn;
    }
    return null;
  }

  /* ---------- 层内「返回」控件 ---------- */
  var BACK_SEL = [
    '[data-back]', '[data-pn-back]', '[data-lf-back]', '[data-wx-back]', '[data-mu-back]',
    '[data-cd-back]', '[data-nav-back]', '[data-go-back]', '[data-pn-close]',
    '.xxj-sd-back', '.xxj-lf-back', '.xxj-wx-back', '.xxj-mu-back', '.xxj-cd-back',
    '[class*="appbar-back"]', '[class*="header-back"]', '[class*="nav-back"]',
    '[class*="back-chip"]', '[class*="back-btn"]',
    '[aria-label="返回"]', '[aria-label="Back"]'
  ].join(',');

  function backControlIn(root) {
    var list = [];
    try { list = root.querySelectorAll(BACK_SEL); } catch (e) { list = []; }
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!visible(el)) continue;
      var cls = typeof el.className === 'string' ? el.className : '';
      if (cls.indexOf('backdrop') >= 0) continue;
      return el;
    }
    var btns = root.querySelectorAll('button, [role="button"], a');
    for (var j = 0; j < btns.length; j++) {
      var b = btns[j];
      if (!visible(b)) continue;
      var txt = (b.textContent || '').trim();
      var ico = b.querySelector ? b.querySelector('i') : null;
      var icls = ico && typeof ico.className === 'string' ? ico.className : '';
      if (/^(‹|←|<|«|返回|Back)$/.test(txt) || /(caret-left|arrow-left|arrow-u-left)/.test(icls)) return b;
    }
    return null;
  }

  function hideLayer(el) {
    el.classList.remove('is-open', 'open');
    if (el.hasAttribute('aria-hidden')) el.setAttribute('aria-hidden', 'true');
  }

  function closeOne(target) {
    if (!target) return null;
    var closer = closerFor(target);
    if (closer) {
      try { closer(); return 'fn:' + (target.id || target.className); } catch (e) {}
    }
    var btn = backControlIn(target);
    if (btn) {
      try { btn.click(); return 'click:' + (target.id || target.className); } catch (e) {}
    }
    hideLayer(target);
    return 'hide:' + (target.id || target.className);
  }

  /* ---------- 返回 ---------- */
  function goBack(viaPop) {
    /* 1) 试卷 / 任务池弹层 */
    var ov = planOverlay();
    if (ov) {
      var x = ov.querySelector('[data-pn-close]');
      if (x) { x.click(); return 'pn:close'; }
      hideLayer(ov);
      return 'pn:hide';
    }

    /* 2) 学习 App：任务池 → 科目 → 首页 */
    if (studyOpen()) {
      var host = document.querySelector('[data-pn-host]');
      if (host && host.querySelector('[data-pn-back]')) {
        host.querySelector('[data-pn-back]').click();
        return 'study:pool';
      }
      var body = document.getElementById('xxj-sd-body');
      var isHome = body && body.querySelector('.xxj-sd-grid');
      var sBack = document.querySelector('#xxj-study .xxj-sd-back');
      if (!isHome && sBack) { sBack.click(); return 'study:subject'; }
      document.getElementById('xxj-study').classList.remove('open');
      return 'study:home';
    }

    /* 3) 天气 / 生活 */
    if (weatherOpen()) {
      var wb = document.querySelector('#xxj-wx [data-wx-back]');
      if (wb) { wb.click(); return 'weather:close'; }
      document.getElementById('xxj-wx').classList.remove('open');
      return 'weather:close';
    }
    if (lifeOpen()) {
      var lb = document.querySelector('#xxj-life [data-lf-back]');
      if (lb) { lb.click(); return 'life:close'; }
      document.getElementById('xxj-life').classList.remove('open');
      return 'life:close';
    }

    /* 4) 通用：最上层那个打开的界面（不管挂在 body 还是 .phone 里） */
    var top = topLayerEl();
    if (top) {
      var r = closeOne(top);
      if (r) return r;
    }

    /* 5) 兜底：浏览器历史 */
    if (!viaPop && window.history && history.length > 1) { history.back(); return 'history'; }
    return null;
  }

  /* ---------- 边缘手势 ---------- */
  var tracking = false, bar = null, dir = 'left';
  var sx = 0, sy = 0, st = 0;

  function mkBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;bottom:0;width:3px;z-index:2147483000;'
      + 'background:linear-gradient(180deg,#8fc0ea,#5b7fa6);opacity:0;'
      + 'transition:opacity .12s,width .12s;pointer-events:none;';
    document.body.appendChild(bar);
    return bar;
  }

  function placeBar(which) {
    var b = mkBar();
    b.style.left = which === 'left' ? '0' : 'auto';
    b.style.right = which === 'right' ? '0' : 'auto';
  }

  function edgeOf(t) {
    var w = window.innerWidth;
    if (t.clientX <= EDGE) return 'left';
    if (t.clientX >= w - EDGE) return 'right';
    return null;
  }

  function progress(t) {
    return dir === 'left' ? (t.clientX - sx) : (sx - t.clientX);
  }

  function onStart(e) {
    var t = e.touches ? e.touches[0] : e;
    if (!t) { tracking = false; return; }
    var edge = edgeOf(t);
    if (!edge || !hasLayer()) { tracking = false; return; }
    tracking = true;
    dir = edge;
    sx = t.clientX; sy = t.clientY; st = Date.now();
  }

  function onMove(e) {
    if (!tracking) return;
    var t = e.touches ? e.touches[0] : e;
    if (!t) return;
    var p = progress(t);
    var dy = t.clientY - sy;
    if (p > 6 && Math.abs(dy) < p * 1.4) {
      var q = Math.min(1, p / MIN_DX);
      placeBar(dir);
      bar.style.opacity = String(0.25 + q * 0.6);
      bar.style.width = (3 + q * 5) + 'px';
      try { e.preventDefault(); } catch (err) {}
    }
  }

  function onEnd(e) {
    if (bar) { bar.style.opacity = '0'; bar.style.width = '3px'; }
    if (!tracking) return;
    tracking = false;
    var t = (e.changedTouches && e.changedTouches[0]) || e;
    var p = t ? progress(t) : 0;
    var dy = t ? t.clientY - sy : 0;
    var ms = Date.now() - st;
    var fast = ms < 260 && p > 30;
    var ok = p >= MIN_DX || fast;
    if (ok && Math.abs(dy) < Math.max(70, Math.abs(p) * MAX_DY_RATIO) && ms < MAX_MS) {
      var r = goBack();
      if (r && navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
    }
  }

  function killOverscroll() {
    if (document.getElementById('xxj-back-css')) return;
    var st2 = document.createElement('style');
    st2.id = 'xxj-back-css';
    st2.textContent = 'html,body{overscroll-behavior-x:none!important;overscroll-behavior-y:auto;'
      + '-webkit-overflow-scrolling:touch;}';
    document.head.appendChild(st2);
  }

  var guard = 0;
  function armGuard() {
    if (guard) return;
    try { history.pushState({ xxjBackGuard: 1 }, '', location.href); guard = 1; } catch (e) {}
  }

  function onPop() {
    var r = goBack(true);
    if (r) { guard = 0; armGuard(); }
    else { guard = 0; }
  }

  function bind() {
    if (document.__xxjBackSwipe) return;
    document.__xxjBackSwipe = true;
    killOverscroll();
    armGuard();
    window.addEventListener('popstate', onPop);
    document.addEventListener('touchstart', onStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onMove, { passive: false, capture: true });
    document.addEventListener('touchend', onEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', function () {
      tracking = false;
      if (bar) bar.style.opacity = '0';
    }, { passive: true, capture: true });
  }

  /* 给 APK 外壳的返回键用 */
  window.xxjGoBack = goBack;
  window.__xxjGoBack = goBack;
  window.__xxjLayerOpen = hasLayer;
  window.xxjLayerOpen = hasLayer;
  window.xxjBackLayers = function () {
    return layers().map(function (x) { return (x.el.id || x.el.className) + '|z' + x.z; });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
