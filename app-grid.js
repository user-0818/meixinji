/* 主屏 App 图标 v7（meixinji / 没心机）
 *  ─ 底栏（主线 / 消息 / 角色库 / 我的）完全不动
 *  ─ 主屏网格去掉与底栏重复的「我的」（聊天、人设保留）
 *  ─ 一页 8 个，放不下的自动到第二页；左右滑动 + 淡入淡出 + 页码点
 *  ─ v6 修复：翻页后图标不再偏移（复位方向位移），滑动判据更稳
 *  ─ v6 调整：不再主动调用浏览器全屏（去掉 Chrome 的全屏提示）
 *  ─ v7 调整：去掉顶部黑条（状态栏内边距压到最小）
 *  ─ v7 新增：顶部时间卡片改成 p2 风格的对话框，气泡文字可点击修改并记住
 *
 *  用法：仓库根目录放本文件；index.html 的 <head> 里加一行
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
  var SLIDE = 20;      /* 侧滑位移量 px */
  var DUR = 280;       /* 过渡时长 ms */

  var CSS = [
    /* ===== 铺满整屏：去掉左右黑边 / 上下留白 / 顶部黑条 ===== */
    '.stage{min-height:100dvh !important;padding:0 !important;display:block !important;place-items:stretch !important;}',
    '.phone{width:100% !important;max-width:none !important;height:100dvh !important;max-height:100dvh !important;',
    'border-radius:0 !important;box-shadow:none !important;margin:0 !important;}',
    'html,body{overflow:hidden !important;-webkit-text-size-adjust:100% !important;background:transparent !important;}',
    /* 顶部不再为系统状态栏留出黑条：状态栏内边距压到最小 */
    '.statusbar{padding-top:8px !important;padding-left:16px !important;padding-right:16px !important;padding-bottom:2px !important;}',
    ':fullscreen .phone,.phone:fullscreen{height:100vh !important;max-height:100vh !important;}',

    /* ===== 时间卡片 → 对话框（p2 风格） ===== */
    '#desktop-hero-card{display:flex !important;flex-direction:column !important;gap:10px !important;',
    'padding:16px 14px 12px !important;}',
    '#desktop-hero-card .hero-meta,#desktop-hero-card .hero-kicker,#hero-time{display:none !important;}',
    '#desktop-hero-card #hero-note{align-self:flex-start !important;max-width:80% !important;margin:0 !important;',
    'padding:12px 16px !important;border-radius:20px !important;border-bottom-left-radius:8px !important;',
    'background:#f3f5f9 !important;color:#20242c !important;font-size:15px !important;line-height:1.55 !important;',
    'font-family:inherit !important;letter-spacing:0 !important;text-transform:none !important;',
    'box-shadow:0 8px 20px rgba(0,0,0,.18) !important;white-space:pre-wrap !important;word-break:break-word !important;',
    'outline:none !important;min-height:22px !important;}',
    '#desktop-hero-card .xxj-bub-r{align-self:flex-end !important;max-width:62% !important;',
    'padding:10px 15px !important;border-radius:18px !important;border-bottom-right-radius:8px !important;',
    'background:#ffffff !important;color:#20242c !important;font-size:14px !important;line-height:1.4 !important;',
    'box-shadow:0 8px 20px rgba(0,0,0,.16) !important;white-space:pre-wrap !important;word-break:break-word !important;',
    'outline:none !important;min-height:20px !important;}',
    '#desktop-hero-card #hero-note:focus,#desktop-hero-card .xxj-bub-r:focus{',
    'box-shadow:0 0 0 2px rgba(91,127,166,.6),0 8px 20px rgba(0,0,0,.2) !important;}',
    '#desktop-hero-card .xxj-chat-tip{align-self:flex-start !important;font-size:10px !important;',
    'letter-spacing:.08em !important;opacity:.45 !important;text-transform:uppercase !important;margin:0 !important;}',
    '#desktop-hero-card .hero-actions{align-self:flex-end !important;margin:0 !important;}',

    /* ===== 网格容器：分页舞台 ===== */
    '#app-grid.app-tower{display:block !important;position:relative !important;overflow:hidden !important;',
    'padding:12px 8px 6px !important;background:rgba(255,255,255,.42) !important;',
    'border:1px solid rgba(255,255,255,.55) !important;border-radius:24px !important;',
    'box-shadow:0 10px 26px rgba(120,150,180,.12) !important;',
    'backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);',
    'height:auto !important;min-height:0 !important;}',

    /* 分页层：所有页叠在同一格，非当前页透明且不接收点击 */
    '#app-grid .xxj-pager{display:grid;overflow:hidden;}',
    '#app-grid .xxj-pg{grid-area:1/1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 2px;',
    'align-content:start;justify-items:center;width:100%;box-sizing:border-box;',
    'opacity:0;transform:translateX(' + SLIDE + 'px);',
    'transition:opacity ' + DUR + 'ms ease,transform ' + DUR + 'ms cubic-bezier(.22,.61,.36,1);',
    'will-change:opacity,transform;pointer-events:none;}',
    /* 从左侧进来时，先摆到左边，再入场 */
    '#app-grid .xxj-pg.xxj-from-left:not(.xxj-on){opacity:0;transform:translateX(-' + SLIDE + 'px);}',
    /* 当前页：必须最后一条，保证 wins，transform 一定归零 */
    '#app-grid .xxj-pg.xxj-on{opacity:1 !important;transform:translateX(0) !important;pointer-events:auto;}',

    /* 页码点 */
    '#app-grid .xxj-dots{display:flex;justify-content:center;gap:6px;margin-top:10px;}',
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
    if (document.getElementById('xxj-app-icon-grid-v7')) return;
    var s = document.createElement('style');
    s.id = 'xxj-app-icon-grid-v7';
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

  /* 当前页索引，从 DOM 状态推导，避免与真实状态不一致 */
  function activeIndex(pages) {
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].classList.contains('xxj-on')) return i;
    }
    return -1;
  }

  function setPage(grid, target, dir) {
    var pages = Array.prototype.slice.call(grid.querySelectorAll('.xxj-pg'));
    if (!pages.length) return;
    if (target < 0) target = 0;
    if (target > pages.length - 1) target = pages.length - 1;
    if (target === activeIndex(pages)) return;

    pages.forEach(function (pg, idx) {
      if (idx === target) {
        pg.classList.remove('xxj-from-left');
        if (dir === 'left') pg.classList.add('xxj-from-left');
        /* 先让浏览器记住"排到左边"这个起始位置，再入场，否则会跳 */
        void pg.offsetWidth;
        pg.classList.add('xxj-on');
      } else {
        pg.classList.remove('xxj-on');
        pg.classList.remove('xxj-from-left');
      }
    });

    grid.querySelectorAll('.xxj-dots span').forEach(function (d, idx) {
      d.classList.toggle('on', idx === target);
    });

    /* 动画结束后清掉方向类，保证下一次从干净状态开始 */
    setTimeout(function () {
      pages.forEach(function (pg) { pg.classList.remove('xxj-from-left'); });
    }, DUR + 60);
  }

  function bindSwipe(grid) {
    if (grid.dataset.xxjSwipeV7 === '1') return;
    grid.dataset.xxjSwipeV7 = '1';
    var x0 = 0, y0 = 0, t0 = 0, tracking = false;
    grid.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      t0 = Date.now(); tracking = true;
    }, { passive: true });
    grid.addEventListener('touchmove', function (e) {
      if (!tracking || e.touches.length !== 1) return;
      var dy = Math.abs(e.touches[0].clientY - y0);
      if (dy > 30) tracking = false;    /* 垂直滚动优先，不当作翻页 */
    }, { passive: true });
    grid.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - x0, dy = t.clientY - y0;
      var dt = Date.now() - t0;
      if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx) || dt > 600) return;
      var cur = activeIndex(Array.prototype.slice.call(grid.querySelectorAll('.xxj-pg')));
      if (cur < 0) cur = 0;
      setPage(grid, dx < 0 ? cur + 1 : cur - 1, dx < 0 ? 'right' : 'left');
    }, { passive: true });
    grid.addEventListener('click', function (e) {
      var d = e.target && e.target.closest ? e.target.closest('.xxj-dots span') : null;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      var pages = Array.prototype.slice.call(grid.querySelectorAll('.xxj-pg'));
      var cur = activeIndex(pages); if (cur < 0) cur = 0;
      var target = parseInt(d.dataset.dot, 10) || 0;
      setPage(grid, target, target > cur ? 'right' : 'left');
    }, true);
  }

  function buildGrid() {
    var grid = document.getElementById('app-grid');
    if (!grid || grid.dataset.xxjTileGrid === 'v7') return;
    grid.dataset.xxjTileGrid = 'v7';

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
    if (document.__xxjTileClickV7) return;
    document.__xxjTileClickV7 = true;
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

  /* ===== 顶部时间卡片 → 对话框（p2 风格，文字可改） ===== */
  var LS_R = 'xxjChatRightV7';

  function buildChat() {
    var card = document.getElementById('desktop-hero-card');
    var note = document.getElementById('hero-note');
    if (!card || !note) return;
    if (card.dataset.xxjChat === 'v7') return;
    card.dataset.xxjChat = 'v7';

    var right = card.querySelector('.xxj-bub-r');
    if (!right) {
      right = document.createElement('div');
      right.className = 'xxj-bub-r';
      right.setAttribute('contenteditable', 'true');
      right.setAttribute('spellcheck', 'false');
      var saved = '';
      try { saved = localStorage.getItem(LS_R) || ''; } catch (e) {}
      right.textContent = saved || '♡ 收到啦';
      right.addEventListener('blur', function () {
        var v = (right.textContent || '').trim();
        if (!v) { v = '♡'; right.textContent = v; }
        try { localStorage.setItem(LS_R, v); } catch (e) {}
      });
      right.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); right.blur(); }
      });
      if (note.parentNode === card) note.insertAdjacentElement('afterend', right);
      else card.appendChild(right);
    }

    /* 点气泡时不触发外层手势 / 路由 */
    [note, right].forEach(function (el) {
      if (el.dataset.xxjNoBubble === '1') return;
      el.dataset.xxjNoBubble = '1';
      ['touchstart', 'mousedown', 'click'].forEach(function (ev) {
        el.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
      });
    });

    if (!card.querySelector('.xxj-chat-tip')) {
      var tip = document.createElement('p');
      tip.className = 'xxj-chat-tip';
      tip.textContent = 'Tap bubbles to edit';
      card.appendChild(tip);
    }
  }

  var n = 0;
  var iv = setInterval(function () {
    n++;
    if (typeof openChatListScreen === 'function' && document.getElementById('app-grid')) {
      injectCss();
      buildGrid();
      buildChat();
      bindClicks();
      clearInterval(iv);
    }
    if (n > 200) clearInterval(iv);
  }, 300);
})();
