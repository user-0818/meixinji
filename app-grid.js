/* 主屏 App 图标 v10（meixinji / 没心机）
 *  ─ 底栏（主线 / 消息 / 角色库 / 我的）完全不动
 *  ─ 主屏网格去掉与底栏重复的「我的」（聊天、人设保留）
 *  ─ 一页 8 个，放不下的自动到第二页；左右滑动 + 淡入淡出 + 页码点
 *  ─ v6 修复：翻页后图标不再偏移（复位方向位移），滑动判据更稳
 *  ─ v6 调整：不再主动调用浏览器全屏（去掉 Chrome 的全屏提示）
 *  ─ v7 调整：去掉顶部黑条（状态栏内边距压到最小）
 *  ─ v7 新增：顶部时间卡片改成 p2 风格的对话框，气泡文字可点击修改并记住
 *  ─ v8 调整：对话框字号改小；页面改为物理贴边（消除顶部黑条）
 *  ─ v9 调整：整体下移一点；图标网格靠近底栏（填掉底栏上方空档）
 *  ─ v9 调整：已装成 App 时不再主动请求全屏（不弹系统提示）
 *  ─ v10 新增：「学习」App（移植自茶茶机版本，七科：语数英地可排任务＋监督员，理化生只留角色留下的材料）
 *  ─ v10 调整：学习占原「表情包」格位，表情包移到第二页首格
 *  ─ v11 调整：音乐挪到第一页（占原「人设」格位），人设移到第二页；新增「倒数日」（第二页）
 *
 *  用法：仓库根目录放本文件；index.html 的 <head> 里加一行
 *         <script src="app-grid.js"></script>
 */
(function () {
  var APPS = [
    ["聊天", "ph-chat-circle-text"],
    ["查岗", "ph-device-mobile-camera"],
    ["关系", "ph-heart-straight"],
    ["音乐", "ph-music-notes"],
    ["漫游", "ph-footprints"],
    ["世界书", "ph-book-open-text"],
    ["论坛", "ph-chats-circle"],
    ["学习", "ph-notebook"],
    ["人设", "ph-identification-card"],
    ["表情包", "ph-smiley"],
    ["装扮", "ph-paint-brush"],
    ["设置", "ph-gear-six"],
    ["备份", "ph-archive-box"],
    ["倒数日", "ph-calendar"]
  ];
  var PER_PAGE = 8;
  var SLIDE = 20;      /* 侧滑位移量 px */
  var DUR = 280;       /* 过渡时长 ms */

  var CSS = [
    /* ===== 铺满整屏：物理贴边，消灭顶部黑条 ===== */
    'html,body{margin:0 !important;padding:0 !important;overflow:hidden !important;height:100% !important;',
    'background:#0f1218 !important;-webkit-text-size-adjust:100% !important;}',
    '.stage{position:fixed !important;inset:0 !important;padding:0 !important;margin:0 !important;',
    'display:block !important;place-items:stretch !important;background:#0f1218 !important;}',
    '.phone{position:absolute !important;inset:0 !important;width:100% !important;max-width:none !important;',
    'height:100% !important;max-height:none !important;border-radius:0 !important;box-shadow:none !important;margin:0 !important;}',
    '.ambience,.ambience .wallpaper{inset:0 !important;background-size:cover !important;background-position:center top !important;}',
    /* 状态栏内边距压到最小，不再为系统状态栏预留 */
    '.statusbar{padding:14px 16px 2px !important;}',
    '.layout-shell{margin-top:12px !important;padding-bottom:10px !important;}',
    '.after-polaroid{margin-top:auto !important;}',
    ':fullscreen .phone,.phone:fullscreen{height:100vh !important;max-height:100vh !important;}',

    /* ===== 时间卡片 → 对话框（p2 风格，字号收敛） ===== */
    '#desktop-hero-card{display:flex !important;flex-direction:column !important;gap:8px !important;',
    'padding:14px 12px 10px !important;}',
    '#desktop-hero-card .hero-meta,#desktop-hero-card .hero-kicker,#hero-time{display:none !important;}',
    '#desktop-hero-card #hero-note{align-self:flex-start !important;max-width:78% !important;margin:0 !important;',
    'padding:9px 13px !important;border-radius:16px !important;border-bottom-left-radius:6px !important;',
    'background:#f3f5f9 !important;color:#20242c !important;font-size:12.5px !important;line-height:1.45 !important;',
    'font-family:inherit !important;letter-spacing:0 !important;text-transform:none !important;font-weight:400 !important;',
    'box-shadow:0 6px 16px rgba(0,0,0,.16) !important;white-space:pre-wrap !important;word-break:break-word !important;',
    'outline:none !important;min-height:18px !important;}',
    '#desktop-hero-card .xxj-bub-r{align-self:flex-end !important;max-width:60% !important;',
    'padding:7px 12px !important;border-radius:14px !important;border-bottom-right-radius:6px !important;',
    'background:#ffffff !important;color:#20242c !important;font-size:11.5px !important;line-height:1.35 !important;',
    'font-family:inherit !important;letter-spacing:0 !important;text-transform:none !important;font-weight:400 !important;',
    'box-shadow:0 6px 16px rgba(0,0,0,.14) !important;white-space:pre-wrap !important;word-break:break-word !important;',
    'outline:none !important;min-height:16px !important;}',
    '#desktop-hero-card #hero-note:focus,#desktop-hero-card .xxj-bub-r:focus{',
    'box-shadow:0 0 0 2px rgba(91,127,166,.6),0 6px 16px rgba(0,0,0,.18) !important;}',
    '#desktop-hero-card .xxj-chat-tip{align-self:flex-start !important;font-size:9px !important;',
    'letter-spacing:.08em !important;opacity:.42 !important;text-transform:uppercase !important;margin:0 !important;}',
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

  function syncThemeColor() {
    try {
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', '#0f1218');
    } catch (e) {}
  }

  function injectCss() {
    if (document.getElementById('xxj-app-icon-grid-v10')) return;
    var s = document.createElement('style');
    s.id = 'xxj-app-icon-grid-v10';
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
    if (grid.dataset.xxjSwipeV11 === '1') return;
    grid.dataset.xxjSwipeV11 = '1';

    /* 滑动区域放宽到整个桌面（含小组件、hero 卡），不再只有图标网格那一块；
       屏幕最左右两侧留给 back-swipe 的侧滑返回，这里不抢。 */
    var host = grid.closest('.layout-shell') || grid;
    var EDGE_IGNORE = 34;

    var x0 = 0, y0 = 0, t0 = 0, tracking = false, locked = '';

    function pages() {
      return Array.prototype.slice.call(grid.querySelectorAll('.xxj-pg'));
    }
    function edgeOk(x) {
      return x > EDGE_IGNORE && x < (window.innerWidth - EDGE_IGNORE);
    }
    function turn(dx) {
      var cur = activeIndex(pages());
      if (cur < 0) cur = 0;
      setPage(grid, dx < 0 ? cur + 1 : cur - 1, dx < 0 ? 'right' : 'left');
    }

    /* 翻页那一下松手会顺带触发 click，把落点上的图标误打开，这里吞掉一次 */
    var swallow = 0;
    function swallowClick() { swallow = Date.now(); }
    host.addEventListener('click', function (e) {
      if (Date.now() - swallow < 500) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    /* ---- 触摸 ---- */
    host.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      var t = e.touches[0];
      if (!edgeOk(t.clientX)) { tracking = false; return; }
      x0 = t.clientX; y0 = t.clientY;
      t0 = Date.now(); tracking = true; locked = '';
    }, { passive: true });

    host.addEventListener('touchmove', function (e) {
      if (!tracking || e.touches.length !== 1) return;
      var t = e.touches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      if (!locked) {
        /* 先判断意图：横向够明显就算翻页，纵向明显就放开手让页面滚 */
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15) locked = 'x';
        else if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx) * 1.15) locked = 'y';
      }
      if (locked === 'x' && e.cancelable) e.preventDefault();
    }, { passive: false });

    host.addEventListener('touchcancel', function () { tracking = false; }, { passive: true });

    host.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      if (locked === 'y') return;
      var dx = t.clientX - x0, dy = t.clientY - y0;
      var dt = Math.max(1, Date.now() - t0);
      var speed = Math.abs(dx) / dt;          /* px/ms */
      var far = Math.abs(dx) >= 26;
      var fling = Math.abs(dx) >= 14 && speed >= 0.25;
      if (!far && !fling) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dt > 900) return;
      if (Math.abs(dy) > 90) return;
      swallowClick();
      turn(dx);
    }, { passive: true });

    /* ---- 鼠标拖动（桌面/网页版也能划） ---- */
    var mDown = false, mx0 = 0, my0 = 0, mt0 = 0;
    host.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (!edgeOk(e.clientX)) return;
      mDown = true; mx0 = e.clientX; my0 = e.clientY; mt0 = Date.now();
    });
    host.addEventListener('mouseup', function (e) {
      if (!mDown) return;
      mDown = false;
      var dx = e.clientX - mx0, dy = e.clientY - my0;
      if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx) || Date.now() - mt0 > 900) return;
      swallowClick();
      turn(dx);
    });

    /* ---- 圆点 ---- */
    grid.addEventListener('click', function (e) {
      var d = e.target && e.target.closest ? e.target.closest('.xxj-dots span') : null;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      var cur = activeIndex(pages()); if (cur < 0) cur = 0;
      var target = parseInt(d.dataset.dot, 10) || 0;
      setPage(grid, target, target > cur ? 'right' : 'left');
    }, true);
  }

  function buildGrid() {
    var grid = document.getElementById('app-grid');
    if (!grid || grid.dataset.xxjTileGrid === 'v10') return;
    grid.dataset.xxjTileGrid = 'v10';

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
    '表情包': function () { openStickerScreen('manage'); },
    '学习': function () { openStudy(); },
    '音乐': function () {
      if (typeof window.xxjMusicOpen === 'function') window.xxjMusicOpen();
      else toast('音乐模块未加载');
    },
    '倒数日': function () {
      if (typeof window.xxjCdOpen === 'function') window.xxjCdOpen();
      else toast('倒数日模块未加载');
    }
  };

  function bindClicks() {
    if (document.__xxjTileClickV10) return;
    document.__xxjTileClickV10 = true;
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


  /* ===== 全屏：隐去系统状态栏（只在浏览器模式下请求一次） ===== */
  function inAppDisplay() {
    try {
      return !!(window.matchMedia && (
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: standalone)').matches
      ));
    } catch (e) { return false; }
  }

  function requestFs() {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      var el = document.documentElement;
      var fn = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!fn) return;
      var ret = fn.call(el, { navigationUI: 'hide' });
      if (ret && ret.catch) ret.catch(function () {});
    } catch (e) {}
  }

  function armFullscreen() {
    if (document.__xxjFsV10) return;
    document.__xxjFsV10 = true;
    /* 已经装成 App（standalone / fullscreen 显示模式）就别再请求，避免弹系统提示 */
    if (inAppDisplay()) return;
    try { if (sessionStorage.getItem('xxjFsV10') === '1') return; } catch (e) {}
    var first = function () {
      window.removeEventListener('touchend', first, true);
      window.removeEventListener('click', first, true);
      try { sessionStorage.setItem('xxjFsV10', '1'); } catch (e) {}
      requestFs();
    };
    window.addEventListener('touchend', first, true);
    window.addEventListener('click', first, true);
  }

  /* ===== 顶部时间卡片 → 对话框（p2 风格，文字可改） ===== */
  var LS_R = 'xxjChatRightV10';

  function buildChat() {
    var card = document.getElementById('desktop-hero-card');
    var note = document.getElementById('hero-note');
    if (!card || !note) return;
    if (card.dataset.xxjChat === 'v10') return;
    card.dataset.xxjChat = 'v10';

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

  /* ===== 学习 App（移植自茶茶机的版本，纯 DOM 实现） ===== */
  var STUDY_KEY = 'xxjStudyV1';
  var SUBJECTS = [
    { k: 'cn', n: '语文', main: true, hint: '阅读 · 文言 · 作文' },
    { k: 'ma', n: '数学', main: true, hint: '函数 · 几何 · 概率' },
    { k: 'en', n: '英语', main: true, hint: '单词 · 语法 · 听说' },
    { k: 'ge', n: '地理', main: true, hint: '地图 · 气候 · 人文' },
    { k: 'ph', n: '物理', main: false, hint: '受力 · 电路 · 公式' },
    { k: 'ch', n: '化学', main: false, hint: '方程式 · 实验 · 物质' },
    { k: 'bi', n: '生物', main: false, hint: '细胞 · 遗传 · 生态' }
  ];
  var MATS = [['paper', '做过的卷子'], ['trace', '学习痕迹'], ['wrong', '错题本']];

  var STUDY_CSS = [
    '.xxj-study{position:fixed;inset:0;z-index:70;display:none;flex-direction:column;',
    'background:#0f1218;color:#dfe9f5;font-family:-apple-system,"PingFang SC",system-ui,sans-serif;}',
    '.xxj-study.open{display:flex;}',
    '.xxj-sd-top{flex:none;display:flex;align-items:center;gap:10px;padding:14px 16px 6px;}',
    '.xxj-sd-back{border:0;background:transparent;color:#9fb6cf;font-size:12px;padding:6px 2px;cursor:pointer;}',
    '.xxj-sd-title{margin-left:auto;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.18em;opacity:.55;}',
    '.xxj-sd-body{flex:1;min-height:0;overflow-y:auto;padding:4px 16px 30px;-webkit-overflow-scrolling:touch;}',
    '.xxj-sd-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;}',
    '.xxj-sd-card{all:unset;box-sizing:border-box;padding:14px 14px 12px;border-radius:18px;cursor:pointer;',
    'background:rgba(38,43,52,.9);border:1px solid rgba(255,255,255,.10);display:flex;flex-direction:column;gap:6px;}',
    '.xxj-sd-card:active{transform:scale(.97);}',
    '.xxj-sd-name{font-size:15px;letter-spacing:.04em;}',
    '.xxj-sd-hint{font-size:10px;opacity:.5;letter-spacing:.03em;}',
    '.xxj-sd-foot{font-size:10.5px;color:#8fa8c2;font-family:ui-monospace,monospace;margin-top:4px;}',
    '.xxj-sd-sec{margin-top:8px;}',
    '.xxj-sd-sec-head{display:flex;align-items:baseline;gap:10px;margin-bottom:12px;}',
    '.xxj-sd-sec-t{font-size:22px;margin:0;letter-spacing:.06em;}',
    '.xxj-sd-sec-s{font-size:10px;opacity:.45;}',
    '.xxj-sd-block{background:rgba(38,43,52,.86);border:1px solid rgba(255,255,255,.10);border-radius:18px;',
    'padding:12px 12px 10px;margin-bottom:10px;}',
    '.xxj-sd-block-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}',
    '.xxj-sd-lab{font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.62;}',
    '.xxj-sd-count{font-size:10.5px;font-family:ui-monospace,monospace;opacity:.55;}',
    '.xxj-sd-tasks,.xxj-sd-mats{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:6px;}',
    '.xxj-sd-tasks li{display:flex;align-items:center;gap:9px;font-size:12.5px;padding:6px 8px;border-radius:12px;',
    'background:rgba(255,255,255,.05);}',
    '.xxj-sd-tasks li.done .xxj-sd-task-t{opacity:.42;text-decoration:line-through;}',
    '.xxj-sd-check{width:18px;height:18px;flex:none;border-radius:50%;border:1px solid rgba(255,255,255,.28);',
    'background:transparent;color:#dfe9f5;font-size:10px;line-height:1;padding:0;cursor:pointer;}',
    '.xxj-sd-tasks li.done .xxj-sd-check{background:#5b7fa6;border-color:#5b7fa6;}',
    '.xxj-sd-task-t{flex:1;min-width:0;word-break:break-word;}',
    '.xxj-sd-del{flex:none;border:0;background:transparent;color:rgba(220,232,245,.45);font-size:13px;padding:0 2px;cursor:pointer;}',
    '.xxj-sd-mats li{display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 8px;border-radius:10px;',
    'background:rgba(255,255,255,.04);}',
    '.xxj-sd-mats li span{flex:1;min-width:0;word-break:break-word;}',
    '.xxj-sd-empty{font-size:11px;opacity:.4;margin:2px 0 8px;}',
    '.xxj-sd-add{display:flex;gap:8px;align-items:center;}',
    '.xxj-sd-input{flex:1;min-width:0;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);',
    'border-radius:10px;color:#dfe9f5;font-size:12px;padding:8px 10px;outline:none;}',
    '.xxj-sd-input:focus{border-color:rgba(91,127,166,.7);}',
    '.xxj-sd-btn{flex:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.10);color:#e6eef7;',
    'border-radius:10px;font-size:11.5px;padding:8px 12px;cursor:pointer;}',
    '.xxj-sd-sup{display:flex;align-items:center;gap:10px;margin-bottom:10px;}',
    '.xxj-sd-mat{padding-top:8px;border-top:1px dashed rgba(255,255,255,.10);}',
    '.xxj-sd-mat:first-child{border-top:0;padding-top:0;}',
    '.xxj-sd-mat-t{font-size:11px;opacity:.6;margin:0 0 6px;}',
    'body:not(.dark) .xxj-study{background:#f4f6fa;color:#20242c;}',
    'body:not(.dark) .xxj-sd-card,body:not(.dark) .xxj-sd-block{background:#fff;border-color:rgba(20,30,45,.10);}',
    'body:not(.dark) .xxj-sd-input{background:#f1f4f8;border-color:rgba(20,30,45,.14);color:#20242c;}',
    'body:not(.dark) .xxj-sd-btn{background:#eef2f7;border-color:rgba(20,30,45,.12);color:#2a3442;}',
    'body:not(.dark) .xxj-sd-back{color:#5b7fa6;}',
    'body:not(.dark) .xxj-sd-tasks li,body:not(.dark) .xxj-sd-mats li{background:rgba(20,30,45,.04);}'
  ].join('');

  function injectStudyCss() {
    if (document.getElementById('xxj-study-css-v1')) return;
    var s = document.createElement('style');
    s.id = 'xxj-study-css-v1';
    s.textContent = STUDY_CSS;
    document.head.appendChild(s);
  }

  function blankStudy() { return { tasks: {}, mats: {}, sup: {} }; }

  function loadStudy() {
    var d = blankStudy();
    try {
      var raw = localStorage.getItem(STUDY_KEY);
      if (raw) d = JSON.parse(raw) || d;
    } catch (e) {}
    d.tasks = d.tasks || {}; d.mats = d.mats || {}; d.sup = d.sup || {};
    SUBJECTS.forEach(function (s) {
      d.tasks[s.k] = Array.isArray(d.tasks[s.k]) ? d.tasks[s.k] : [];
      d.mats[s.k] = d.mats[s.k] || {};
      MATS.forEach(function (m) {
        d.mats[s.k][m[0]] = Array.isArray(d.mats[s.k][m[0]]) ? d.mats[s.k][m[0]] : [];
      });
    });
    return d;
  }

  function saveStudy() {
    try { localStorage.setItem(STUDY_KEY, JSON.stringify(study)); } catch (e) {}
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  var study = null, sdSub = null;

  function studyHomeHtml() {
    return '<section class="xxj-sd-grid">' + SUBJECTS.map(function (s) {
      var t = study.tasks[s.k] || [];
      var done = t.filter(function (x) { return x.d; }).length;
      var mats = MATS.reduce(function (n, m) { return n + (study.mats[s.k][m[0]] || []).length; }, 0);
      var foot = s.main ? (done + '/' + t.length + ' 今日') : (mats + ' 份记录');
      return '<button type="button" class="xxj-sd-card" data-sd-open="' + s.k + '">'
        + '<span class="xxj-sd-name">' + s.n + '</span>'
        + '<span class="xxj-sd-hint">' + s.hint + '</span>'
        + '<span class="xxj-sd-foot">' + foot + '</span></button>';
    }).join('') + '</section>';
  }

  function sdTasksHtml(s) {
    var t = study.tasks[s.k] || [];
    var done = t.filter(function (x) { return x.d; }).length;
    return '<div class="xxj-sd-block"><div class="xxj-sd-block-head">'
      + '<span class="xxj-sd-lab">今日任务</span><span class="xxj-sd-count">' + done + '/' + t.length + '</span></div>'
      + (t.length ? '<ul class="xxj-sd-tasks">' + t.map(function (x, i) {
        return '<li class="' + (x.d ? 'done' : '') + '">'
          + '<button type="button" class="xxj-sd-check" data-sd-tgl="' + s.k + '" data-i="' + i + '">' + (x.d ? '✓' : '') + '</button>'
          + '<span class="xxj-sd-task-t">' + esc(x.t) + '</span>'
          + '<button type="button" class="xxj-sd-del" data-sd-delt="' + s.k + '" data-i="' + i + '">×</button></li>';
      }).join('') + '</ul>' : '<p class="xxj-sd-empty">还没有任务，先加一条</p>')
      + '<div class="xxj-sd-add"><input class="xxj-sd-input" data-sd-newt="' + s.k + '" placeholder="加一条今日任务">'
      + '<button type="button" class="xxj-sd-btn" data-sd-addt="' + s.k + '">添加</button></div></div>';
  }

  function sdMatsHtml(s) {
    return '<div class="xxj-sd-block"><div class="xxj-sd-block-head">'
      + '<span class="xxj-sd-lab">角色留下的</span></div>'
      + MATS.map(function (m) {
        var arr = study.mats[s.k][m[0]] || [];
        return '<div class="xxj-sd-mat"><p class="xxj-sd-mat-t">' + m[1] + '</p>'
          + (arr.length ? '<ul class="xxj-sd-mats">' + arr.map(function (x, i) {
            return '<li><span>' + esc(x) + '</span>'
              + '<button type="button" class="xxj-sd-del" data-sd-delm="' + s.k + '" data-m="' + m[0] + '" data-i="' + i + '">×</button></li>';
          }).join('') + '</ul>' : '<p class="xxj-sd-empty">暂无</p>')
          + '<div class="xxj-sd-add"><input class="xxj-sd-input" data-sd-newm="' + s.k + '" data-m="' + m[0] + '" placeholder="记一条">'
          + '<button type="button" class="xxj-sd-btn" data-sd-addm="' + s.k + '" data-m="' + m[0] + '">＋</button></div></div>';
      }).join('') + '</div>';
  }

  function sdSubjectHtml(k) {
    var s = SUBJECTS.filter(function (x) { return x.k === k; })[0];
    if (!s) return '';
    var html = '<section class="xxj-sd-sec">'
      + '<div class="xxj-sd-sec-head"><p class="xxj-sd-sec-t">' + s.n + '</p>'
      + '<span class="xxj-sd-sec-s">' + s.hint + '</span></div>';
    if (s.main) {
      html += sdTasksHtml(s);
      html += '<div class="xxj-sd-block"><div class="xxj-sd-block-head"><span class="xxj-sd-lab">监督员</span></div>'
        + '<div class="xxj-sd-add"><input class="xxj-sd-input" data-sd-sup="' + s.k + '" value="'
        + esc(study.sup[s.k] || '') + '" placeholder="谁在督促这一科"></div></div>';
    }
    html += sdMatsHtml(s);
    return html + '</section>';
  }

  function renderStudy() {
    var body = document.getElementById('xxj-sd-body');
    if (!body) return;
    body.innerHTML = sdSub ? sdSubjectHtml(sdSub) : studyHomeHtml();
  }

  function ensureStudy() {
    var el = document.getElementById('xxj-study');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'xxj-study';
    el.className = 'xxj-study';
    el.innerHTML = '<header class="xxj-sd-top">'
      + '<button type="button" class="xxj-sd-back" data-sd-back>‹ 桌面</button>'
      + '<span class="xxj-sd-title">STUDY</span></header>'
      + '<div class="xxj-sd-body" id="xxj-sd-body"></div>';
    document.body.appendChild(el);
    return el;
  }

  function openStudy() {
    injectStudyCss();
    ensureStudy();
    bindStudy();
    study = loadStudy();
    sdSub = null;
    renderStudy();
    document.getElementById('xxj-study').classList.add('open');
  }

  function closeStudy() {
    var el = document.getElementById('xxj-study');
    if (el) el.classList.remove('open');
  }

  function sdVal(sel, k, m, t) {
    var q = document.querySelector('[data-sd-' + sel + '="' + k + '"]' + (m ? '[data-m="' + m + '"]' : ''));
    if (!q) return '';
    var v = (q.value || '').trim();
    return v;
  }

  function bindStudy() {
    var el = ensureStudy();
    if (el.dataset.bind === '1') return;
    el.dataset.bind = '1';

    el.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(
        '[data-sd-back],[data-sd-open],[data-sd-tgl],[data-sd-delt],[data-sd-addt],[data-sd-delm],[data-sd-addm]'
      ) : null;
      if (!t) return;
      var d = t.dataset;

      if (d.sdBack !== undefined) {
        e.preventDefault(); e.stopPropagation();
        if (sdSub) { sdSub = null; renderStudy(); }
        else closeStudy();
        return;
      }
      if (d.sdOpen) { e.preventDefault(); e.stopPropagation(); sdSub = d.sdOpen; renderStudy(); return; }
      if (d.sdTgl) {
        e.preventDefault(); e.stopPropagation();
        var arr = study.tasks[d.sdTgl] || [];
        var i = parseInt(d.i, 10);
        if (arr[i]) { arr[i].d = !arr[i].d; saveStudy(); renderStudy(); }
        return;
      }
      if (d.sdDelt) {
        e.preventDefault(); e.stopPropagation();
        var a2 = study.tasks[d.sdDelt] || [];
        a2.splice(parseInt(d.i, 10), 1);
        saveStudy(); renderStudy();
        return;
      }
      if (d.sdAddt) {
        e.preventDefault(); e.stopPropagation();
        var v = sdVal('newt', d.sdAddt);
        if (!v) { toast('先写一条任务'); return; }
        (study.tasks[d.sdAddt] = study.tasks[d.sdAddt] || []).push({ t: v, d: false });
        saveStudy(); renderStudy();
        return;
      }
      if (d.sdDelm) {
        e.preventDefault(); e.stopPropagation();
        var m = d.m, arr2 = (study.mats[d.sdDelm] || {})[m] || [];
        arr2.splice(parseInt(d.i, 10), 1);
        saveStudy(); renderStudy();
        return;
      }
      if (d.sdAddm) {
        e.preventDefault(); e.stopPropagation();
        var v2 = sdVal('newm', d.sdAddm, d.m);
        if (!v2) { toast('先写点内容'); return; }
        var mm = (study.mats[d.sdAddm] = study.mats[d.sdAddm] || {});
        (mm[d.m] = mm[d.m] || []).push(v2);
        saveStudy(); renderStudy();
        return;
      }
    }, true);

    el.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.dataset || !t.dataset.sdSup) return;
      study.sup[t.dataset.sdSup] = (t.value || '').trim();
      saveStudy();
    }, true);

    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var t = e.target;
      if (!t || !t.dataset) return;
      if (t.dataset.sdNewt) {
        e.preventDefault();
        var b = el.querySelector('[data-sd-addt="' + t.dataset.sdNewt + '"]');
        if (b) b.click();
      } else if (t.dataset.sdNewm) {
        e.preventDefault();
        var b2 = el.querySelector('[data-sd-addm="' + t.dataset.sdNewm + '"][data-m="' + t.dataset.m + '"]');
        if (b2) b2.click();
      }
    }, true);
  }

  var n = 0;
  var iv = setInterval(function () {
    n++;
    if (typeof openChatListScreen === 'function' && document.getElementById('app-grid')) {
      injectCss();
      syncThemeColor();
      buildGrid();
      buildChat();
      bindClicks();
      armFullscreen();
      clearInterval(iv);
    }
    if (n > 200) clearInterval(iv);
  }, 300);
})();
