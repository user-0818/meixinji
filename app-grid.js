/* 主屏 App 图标网格补丁（meixinji / 没心机）
 * 用法：仓库根目录新增本文件，并在 index.html 的 </body> 前加一行：
 *   <script src="app-grid.js"></script>
 * 作用：把 #app-grid 里的三块大卡片替换成 4 列 iOS 风格图标网格，
 *      并为「世界书 / 论坛 / 装扮 / 备份 / 表情包」补上点击入口。
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
    ["我的", "ph-user-circle"],
    ["装扮", "ph-paint-brush"],
    ["设置", "ph-gear-six"],
    ["备份", "ph-archive-box"]
  ];

  var CSS = [
    /* === 全屏适配：去掉左右黑边与上下留白，铺满整块屏幕 === */
    '@media (max-width:820px){',
    '.stage{min-height:100dvh !important;padding:0 !important;display:block !important;place-items:stretch !important;}',
    '.phone{width:100% !important;max-width:none !important;height:100dvh !important;max-height:100dvh !important;',
    'border-radius:0 !important;box-shadow:none !important;margin:0 !important;}',
    'body{overflow:hidden !important;-webkit-text-size-adjust:100% !important;}',
    '}',
    /* === 主屏图标网格 === */
    '#app-grid.app-tower{display:grid !important;grid-template-columns:repeat(4,minmax(0,1fr)) !important;',
    'gap:8px 2px !important;padding:14px 8px !important;background:rgba(255,255,255,.42) !important;',
    'border:1px solid rgba(255,255,255,.55) !important;border-radius:24px !important;',
    'box-shadow:0 10px 26px rgba(120,150,180,.12) !important;backdrop-filter:blur(14px) saturate(1.2);',
    '-webkit-backdrop-filter:blur(14px) saturate(1.2);grid-auto-rows:auto !important;height:auto !important;min-height:0 !important;}',
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
    'body.dark #app-grid.app-tower{background:rgba(30,34,42,.55) !important;border-color:rgba(255,255,255,.12) !important;}',
    'body.dark #app-grid .app-tile-ico{color:#dfe9f5;',
    'background:linear-gradient(160deg,rgba(78,90,108,.92) 0%,rgba(40,48,60,.72) 100%);',
    'border-color:rgba(255,255,255,.18);box-shadow:0 6px 16px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.12);}',
    'body.dark #app-grid .app-tile-name{color:#dfe9f5;}',
    '@media (max-width:360px){#app-grid .app-tile-ico{width:46px;height:46px;font-size:21px;}#app-grid .app-tile-name{font-size:10px;}}'
  ].join('');

  function injectCss() {
    if (document.getElementById('xxj-app-icon-grid')) return;
    var s = document.createElement('style');
    s.id = 'xxj-app-icon-grid';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function toast(t) {
    try { if (typeof showToast === 'function') return showToast(t); } catch (e) {}
  }

  function buildGrid() {
    var grid = document.getElementById('app-grid');
    if (!grid || grid.dataset.xxjTileGrid === '1') return;
    grid.dataset.xxjTileGrid = '1';
    var html = '';
    APPS.forEach(function (a) {
      html += '<button class="app-tile" data-app="' + a[0] + '" type="button">'
        + '<span class="app-tile-ico"><i class="ph ' + a[1] + '"></i></span>'
        + '<span class="app-tile-name">' + a[0] + '</span></button>';
    });
    grid.innerHTML = html;
    injectCss();
  }

  var MAP = {
    '聊天': function () { openChatListScreen(); },
    '查岗': function () { openCheckupScreen(); },
    '关系': function () { openRelationScreen(); },
    '人设': function () { openCharScreen(); },
    '漫游': function () { openRoamScreen(); },
    '世界书': function () { openWorldBookScreen(); },
    '论坛': function () { openForumScreen(); },
    '表情包': function () { openStickerScreen('manage'); },
    '我的': function () { openMyScreen(); },
    '装扮': function () { openWardrobeScreen(); },
    '设置': function () { openSettings(); },
    '备份': function () { openBackupZipModal(); }
  };

  function bindClicks() {
    if (document.__xxjTileClickBound) return;
    document.__xxjTileClickBound = true;
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

  var n = 0;
  var iv = setInterval(function () {
    n++;
    if (typeof openChatListScreen === 'function' && document.getElementById('app-grid')) {
      buildGrid();
      bindClicks();
      clearInterval(iv);
    }
    if (n > 200) clearInterval(iv);
  }, 300);
})();
