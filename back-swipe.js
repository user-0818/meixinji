/* ============================================================
   back-swipe.js —— 全站「侧滑返回」（像手机一样）
   · 屏幕左边缘向右滑 → 返回上一层
     - App 首页 → 返回桌面
     - App 的二级页 / 弹层 → 返回上一级
   · 只在有界面打开时生效，桌面上的左右翻页不受影响
   挂载：index.html <head> 一行 <script src="back-swipe.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var EDGE = 18;        /* 起手必须从左边缘 18px 内开始 */
  var MIN_DX = 62;      /* 横向至少滑 62px */
  var MAX_DY_RATIO = 0.6;
  var MAX_MS = 900;

  /* ---------- 判断当前有没有"界面"打开 ---------- */
  function visible(el) {
    if (!el) return false;
    if (el.offsetWidth <= 0 && el.offsetHeight <= 0) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05;
  }

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

  /* 最上层的可见"层"：z-index 最高的全屏/浮层元素 */
  function topLayer() {
    var best = null, bestZ = -1;
    var all = document.querySelectorAll('body > div, body > section, body > aside, body > main');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!visible(el)) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      var z = parseInt(cs.zIndex, 10);
      if (isNaN(z) || z < 6) continue;        /* 桌面层的层级都很低，不算 */

      if (el.id === 'app-grid') continue;
      /* 必须真的盖住大部分屏幕，否则不算"打开了一个界面" */
      var r = el.getBoundingClientRect();
      if (r.width < window.innerWidth * 0.88 || r.height < window.innerHeight * 0.55) continue;
      if (z > bestZ) { bestZ = z; best = el; }
    }
    return best;
  }

  function hasLayer() {
    if (planOverlay() || studyOpen() || lifeOpen() || weatherOpen()) return true;
    var t = topLayer();
    return !!t;
  }

  /* ---------- 找"返回"控件 ---------- */
  function backCandidates(root) {
    var sel = [
      '[data-pn-back]', '[data-lf-back]', '[data-wx-back]', '[data-back]', '[data-nav-back]',
      '[data-go-back]', '.xxj-sd-back', '.xxj-lf-back', '.xxj-wx-back',
      '[class*="appbar-back"]', '[class*="header-back"]', '[class*="nav-back"]',
      '[class*="back-chip"]', '[class*="back-btn"]', '[class*="backBtn"]',
      '[class*="-back"][role="button"]',
      '[aria-label="返回"]', '[aria-label="Back"]'
    ].join(',');
    var list = [];
    try { list = (root || document).querySelectorAll(sel); } catch (e) { list = []; }
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!visible(el)) continue;
      var cls = el.className && el.className.baseVal != null ? el.className.baseVal : (el.className || '');
      if (typeof cls === 'string' && cls.indexOf('backdrop') >= 0) continue;
      if (el.closest('[data-pn-host]')) continue;
      out.push(el);
    }
    return out;
  }

  function iconBackCandidates(root) {
    var out = [];
    var all = (root || document).querySelectorAll('button, [role="button"], a');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!visible(el)) continue;
      var txt = (el.textContent || '').trim();
      var ico = el.querySelector ? el.querySelector('i') : null;
      var icls = ico && typeof ico.className === 'string' ? ico.className : '';
      if (/^(‹|←|<|«|返回|Back)$/.test(txt) || /(caret-left|arrow-left|arrow-u-left)/.test(icls)) {
        if (el.closest('[data-pn-host]')) continue;
        out.push(el);
      }
    }
    return out;
  }

  function depthOf(el) {
    var z = 0;
    var n = el;
    while (n && n !== document.body) {
      var cs = getComputedStyle(n);
      var v = parseInt(cs.zIndex, 10);
      if (!isNaN(v)) z = Math.max(z, v);
      n = n.parentElement;
    }
    return z;
  }

  function bestBackTarget() {
    var layer = topLayer();
    var scopes = layer ? [layer, document] : [document];
    var best = null, bestZ = -1;
    for (var s = 0; s < scopes.length; s++) {
      var cands = backCandidates(scopes[s]).concat(iconBackCandidates(scopes[s]));
      for (var i = 0; i < cands.length; i++) {
        var z = depthOf(cands[i]);
        if (z > bestZ) { bestZ = z; best = cands[i]; }
      }
      if (best) break;      /* 找到就不去全站乱找 */
    }
    return best;
  }

  /* ---------- 返回 ---------- */
  function goBack(viaPop) {
    /* 1) 试卷/详情弹层 */
    var ov = planOverlay();
    if (ov) {
      var x = ov.querySelector('[data-pn-close]');
      if (x) { x.click(); return 'closed:' + 'pn'; }
      ov.classList.remove('open');
      return 'closed:pn';
    }

    /* 2) 学习 App */
    if (studyOpen()) {
      var host = document.querySelector('[data-pn-host]');
      if (host && host.querySelector('[data-pn-back]')) {
        host.querySelector('[data-pn-back]').click();     /* 任务池 → 首页 */
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

    /* 4) 其它（聊天、设置、论坛…这些由 app.js 生成）：点它自己的返回按钮 */
    var t = bestBackTarget();
    if (t) {
      try {
        t.click();
        return 'click:' + (t.className || t.tagName);
      } catch (e) {}
    }

    /* 5) 兜底：交给浏览器历史（由 popstate 触发时不再递归调用） */
    if (!viaPop && window.history && history.length > 1) { history.back(); return 'history'; }
    return null;
  }

  /* ---------- 边缘手势 ---------- */
  var tracking = false, sx = 0, sy = 0, st = 0, armed = false, bar = null;

  function mkBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;top:0;bottom:0;width:3px;z-index:9999;'
      + 'background:linear-gradient(180deg,#8fc0ea,#5b7fa6);opacity:0;'
      + 'transition:opacity .12s,width .12s;pointer-events:none;';
    document.body.appendChild(bar);
    return bar;
  }

  function onStart(e) {
    var t = e.touches ? e.touches[0] : e;
    if (!t) return;
    if (t.clientX > EDGE) { armed = false; return; }
    if (!hasLayer()) { armed = false; return; }
    armed = true;
    tracking = true;
    sx = t.clientX; sy = t.clientY; st = Date.now();
  }

  function onMove(e) {
    if (!tracking) return;
    var t = e.touches ? e.touches[0] : e;
    if (!t) return;
    var dx = t.clientX - sx, dy = t.clientY - sy;
    if (dx > 8 && Math.abs(dy) < dx * 1.4) {
      var p = Math.min(1, dx / MIN_DX);
      var b = mkBar();
      b.style.opacity = String(0.25 + p * 0.6);
      b.style.width = (3 + p * 5) + 'px';
      if (!e.__xPassive) { try { e.preventDefault(); } catch (err) {} }
    }
  }

  function onEnd(e) {
    if (bar) { bar.style.opacity = '0'; bar.style.width = '3px'; }
    if (!tracking) { armed = false; return; }
    tracking = false;
    var t = (e.changedTouches && e.changedTouches[0]) || e;
    var dx = t ? t.clientX - sx : 0;
    var dy = t ? t.clientY - sy : 0;
    var ms = Date.now() - st;
    var fast = ms < 260 && dx > 34;
    var ok = dx >= MIN_DX || fast;
    if (ok && Math.abs(dy) < Math.max(70, Math.abs(dx) * MAX_DY_RATIO) && ms < MAX_MS) {
      var r = goBack();
      if (r && navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
    }
    armed = false;
  }

  /* ---------- 关键：抢回浏览器的"边缘返回手势" ---------- */
  function killOverscroll() {
    if (document.getElementById('xxj-back-css')) return;
    var st = document.createElement('style');
    st.id = 'xxj-back-css';
    /* 这两条是让 Chrome 不再把左右边缘滑动当成"浏览器后退" */
    st.textContent = 'html,body{overscroll-behavior-x:none!important;overscroll-behavior-y:auto;'
      + '-webkit-overflow-scrolling:touch;}';
    document.head.appendChild(st);
  }

  /* 历史里垫一个"挡板"，系统返回先吃掉这一层，不会直接退出页面 */
  var guard = 0;
  function armGuard() {
    if (guard) return;
    try {
      history.pushState({ xxjBackGuard: 1 }, '', location.href);
      guard = 1;
    } catch (e) {}
  }

  function onPop() {
    var r = goBack(true);
    if (r) { guard = 0; armGuard(); }      /* 还有界面 → 补一层，继续留在页面里 */
    else { guard = 0; }                    /* 已经在桌面 → 放行走人 */
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
    document.addEventListener('touchcancel', function () { tracking = false; if (bar) bar.style.opacity = '0'; }, { passive: true, capture: true });
  }

  /* 公开出去，方便别处调用 */
  window.xxjGoBack = goBack;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
