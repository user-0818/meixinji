/* 主屏 App 图标 v5（meixinji / 没心机）
 *  ─ 底栏（主线 / 消息 / 角色库 / 我的）完全不动
 *  ─ 主屏网格去掉与底栏重复的「我的」（聊天、人设保留）
 *  ─ 一页 8 个，放不下的自动到第二页；左右滑动切换，带横向位移 + 淡入淡出 + 页码点
 *  ─ 铺满整屏，并在用户首次触摸时请求全屏，隐藏手机自带系统状态栏（只留小手机状态栏）
 *
 *  用法：仓库根目录放本文件；index.html 的 </body> 前加一行
 *         <script src="app-grid.js"></script>
 */
(function () {
  var APPS = [
    ["聊天", "ph-chat-circle-text"],
    ["查岗", "ph-device-mobile-camera"],
    ["关系", "ph-heart-straight"],
    ["人设", "ph-identification-card"],
    ["漫游", "ph-footprints"],
    ["世界书", "ph-book-open-text"],
    ["论坛", "ph-chats-circle"],
    ["表情包", "ph-smiley"],
    ["装扮", "ph-paint-brush"],
    ["设置", "ph-gear-six"],
    ["备份", "ph-archive-box"]
  ];
  var PER_PAGE = 8;

  var CSS = [
    /* ===== 全屏铺满：去掉左右黑边 / 上下留白 ===== */
    '.stage{min-height:100dvh !important;padding:0 !important;display:block !important;place-items:stretch !important;}',
    '.phone{width:100% !important;max-width:none !important;height:100dvh !important;max-height:100dvh !important;',
    'border-radius:0 !important;box-shadow:none !important;margin:0 !important;}',
    'html,body{overflow:hidden !important;-webkit-text-size-adjust:100% !important;}',
    ':fullscreen .phone,.phone:fullscreen{height:100vh !important;max-height:100vh !important;}',
    ':fullscreen .statusbar{padding-top:calc(16px + env(safe-area-inset-top,0px)) !important;}',

    /* ===== 网格容器：分页舞台 ===== */
    '#app-grid.app-tower{display:block !important;position:relative !important;overflow:hidden !important;',
    'padding:12px 8px 6px !important;background:rgba(255,255,255,.42) !important;',
    'border:1px solid rgba(255,255,255,.55) !important;border-radius:24px !important;',
    'box-shadow:0 10px 26px rgba(120,150,180,.12) !important;',
    'backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);',
    'height:auto !important;min-height:0 !important;}',
    '#app-grid .xxj-pager{display:grid;overflow:hidden;}',
    '#app-grid .xxj-pg{grid-area:1/1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 2px;',
    'opacity:0;transform:translateX(24px);transition:opacity .3s ease,transform .3s cubic-bezier(.22,.61,.36,1);',
    'pointer-events:none;}',
    '#app-grid .xxj-pg.xxj-on{opacity:1;transform:none;pointer-events:auto;}',
    '#app-grid .xxj-pg.xxj-from-left{transform:translateX(-24px);}',

    /* 页码点 */
    '#app-grid .xxj-dots{display:flex;justify-content:center;gap:6px;margin-top:8px;}',
    '#app-grid .xxj-dots span{width:6px;height:6px;border-radius:50%;background:rgba(120,150,180,.35);',
    'transition:background .2s,transform .2s;cursor:pointer;}',
    '#app-grid .xxj-dots span.on{background:#5b7fa6;transform:scale(1.3);}',
    'body.dark #app-grid .xxj-dots span{background:rgba(220,232,245,.32);}',
    'body.dark #app-grid .xxj-dots span.on{background:#dfe9f5;}',

    /* 单个图标 */
    '#app-grid .app-tile{all:unset;display:flex !important;flex-direction:column !important;align-items:center !important;',
    'justify-content:flex-start !important;gap:6px !important;padding:4px 2px 2px !important;cursor:pointer;',
    '-webkit-tap-highlight-color:transparent;width:auto !important;box-sizing:border-box;}',
    '#app-grid .app-tile:active{transform:scale(.93);transition:transform .12s ease;}',
    '#app-grid .app-tile-ico{width:52px;height:52px;border-radius:15px;display:flex;align-items:center;justify-content:center;',
    'font-size:24px;line-height:1;color:#3a5c89;',
    'background:linear-gradient(160deg,rgba(255,255,255,.92) 0%,rgba(198,219,240,.55) 100%);',
    'border:1px solid rgba(255,255,255,.78);box-shadow:0 6px 16px rgba(80,120,160,.16),inset 0 1px 0 rgba(255,255,255,.9);}',
    '#app-grid .app-tile-name{font-size:11px;line-height:1.2;color:#2f4a63;text-align:center;max-width:100%;',
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',

    /* 深色主题 */
    'body.dark #app-grid.app-tower{background:rgba(30,34,42,.55) !important;border-color:rgba(255,255,255,.12) !important;}',
    'body.dark #app-grid .app-tile-ico{color:#dfe9f5;',
    'background:linear-gradient(160deg,rgba(78,90,108,.92) 0%,rgba(40,48,60,.72) 100%);',
    'border-color:rgba(255,255,255,.18);box-shadow:0 6px 16px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.12);}',
    'body.dark #app-grid .app-tile-name{color:#dfe9f5;}',

    '@media (max-width:360px){#app-grid .app-tile-ico{width:46px;height:46px;font-size:21px;}#app-grid .app-tile-name{font-size:10px;}}'
  ].join('');

  function injectCss() {
    if (document.getElementById('xxj-app-icon-grid-v5')) return;
    var s = document.createElement('style');
    s.id = 'xxj-app-icon-grid-v5';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function toast(t) {
    try { if (typeof showToast === 'function') return showToast(t); } catch (e) {}
  }

  function tile(a) {
    return '<button class="app-tile" data-app="' + a[0] + '" type="button">'
      + '<span class="app-tile-ico"><i class="ph ' + a[1] + '"></i></span>'
      + '<span class="app-tile-name">' + a[0] + '</span></button>';
  }

  var cur = 0;

  function setPage(grid, i, dir) {
    var pages = Array.prototype.slice.call(grid.querySelectorAll('.xxj-pg'));
    if (!pages.length) return;
    if (i < 0) i = 0;
    if (i > pages.length - 1) i = pages.length - 1;
    if (i === cur && pages[cur] && pages[cur].classList.contains('xxj-on')) return;
    cur = i;
    pages.forEach(function (pg, idx) {
      if (idx === i) {
        pg.classList.toggle('xxj-from-left', dir === 'left');
        pg.classList.add('xxj-on');
      } else {
        pg.classList.remove('xxj-on');
      }
    });
    grid.querySelectorAll('.xxj-dots span').forEach(function (d, idx) {
      d.classList.toggle('on', idx === i);
    });
  }

  function bindSwipe(grid) {
    if (grid.dataset.xxjSwipeV5 === '1') return;
    grid.dataset.xxjSwipeV5 = '1';
    var x0 = 0, y0 = 0, tracking = false;
    grid.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    grid.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
      setPage(grid, dx < 0 ? cur + 1 : cur - 1, dx < 0 ? 'right' : 'left');
    }, { passive: true });
    grid.addEventListener('click', function (e) {
      var d = e.target && e.target.closest ? e.target.closest('.xxj-dots span') : null;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      var target = parseInt(d.dataset.dot, 10) || 0;
      setPage(grid, target, target > cur ? 'right' : 'left');
    }, true);
  }

  function buildGrid() {
    var grid = document.getElementById('app-grid');
    if (!grid || grid.dataset.xxjTileGrid === 'v5') return;
    grid.dataset.xxjTileGrid = 'v5';

    var pageCount = Math.ceil(APPS.length / PER_PAGE);
    var pagesHtml = '';
    for (var p = 0; p < pageCount; p++) {
      var slice = APPS.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
      pagesHtml += '<div class="xxj-pg' + (p === 0 ? ' xxj-on' : '') + '" data-pg="' + p + '">'
        + slice.map(tile).join('') + '</div>';
    }
    var dots = '';
    for (var i = 0; i < pageCount; i++) {
      dots += '<span class="' + (i === 0 ? 'on' : '') + '" data-dot="' + i + '"></span>';
    }

    grid.innerHTML = '<div class="xxj-pager">' + pagesHtml + '</div>'
      + (pageCount > 1 ? '<div class="xxj-dots">' + dots + '</div>' : '');
    injectCss();
    bindSwipe(grid);
  }

  /* 点击路由：app.js 的主屏网格没覆盖到的入口在这里补齐 */
  var MAP = {
    '世界书': function () { openWorldBookScreen(); },
    '论坛': function () { if (typeof openForumScreen === 'function') openForumScreen(); else toast('论坛模块未加载'); },
    '装扮': function () { openWardrobeScreen(); },
    '备份': function () { openBackupZipModal(); },
    '表情包': function () { openStickerScreen('manage'); }
  };

  function bindClicks() {
    if (document.__xxjTileClickV5) return;
    document.__xxjTileClickV5 = true;
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('#app-grid [data-app]') : null;
      if (!t) return;
      var fn = MAP[t.dataset.app];
      if (!fn) return;
      e.preventDefault();
      e.stopPropagation();
      try { fn(); } catch (err) { toast(t.dataset.app + ' · 打开失败'); }
    }, true);
  }

  /* 全屏：隐藏浏览器栏与手机自带状态栏，只保留小手机内部状态栏 */
  function tryFullscreen() {
    try {
      var el = document.documentElement;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      var fn = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!fn) return;
      var ret = fn.call(el, { navigationUI: 'hide' });
      if (ret && ret.catch) ret.catch(function () {});
    } catch (e) {}
  }

  function armFullscreen() {
    if (document.__xxjFsV5) return;
    document.__xxjFsV5 = true;
    var once = function () {
      window.removeEventListener('touchend', once, true);
      window.removeEventListener('click', once, true);
      tryFullscreen();
    };
    window.addEventListener('touchend', once, true);
    window.addEventListener('click', once, true);
  }

  var n = 0;
  var iv = setInterval(function () {
    n++;
    if (typeof openChatListScreen === 'function' && document.getElementById('app-grid')) {
      injectCss();
      buildGrid();
      bindClicks();
      armFullscreen();
      clearInterval(iv);
    }
    if (n > 200) clearInterval(iv);
  }, 300);
})();
