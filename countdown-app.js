/* ============================================================
   countdown-app.js —— 小手机「倒数日」
   · 桌面：把拍立得照片板缩成正方形小组件，右边并一个倒数日小组件
   · App：新建 / 编辑 / 删除 日子（倒数日、纪念日、每年重复）
   · 数据存在 localStorage（xxjCountdownV1），不上传
   挂载：index.html <head> 一行 <script src="countdown-app.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'xxjCountdownV1';
  var D = { items: [] };

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toast(msg) {
    if (typeof window.toast === 'function') return window.toast(msg);
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:99999;'
      + 'background:rgba(20,24,32,.92);color:#e8eef7;font-size:12px;padding:9px 14px;border-radius:12px;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1600);
  }

  /* ---------- 数据 ---------- */
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      D.items = Array.isArray(o.items) ? o.items : [];
    } catch (e) { D.items = []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ items: D.items })); } catch (e) {}
  }

  /* ---------- 日期计算 ---------- */
  function today() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function parseDate(s) {
    var p = String(s || '').split('-');
    if (p.length < 3) return null;
    var y = +p[0], m = +p[1] - 1, d = +p[2];
    if (!y || m < 0 || !d) return null;
    return new Date(y, m, d);
  }
  function diffDays(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }
  function fmtDate(dt) {
    return String(dt.getFullYear()) + '.' + pad(dt.getMonth() + 1) + '.' + pad(dt.getDate());
  }
  function nextYearly(dt) {
    var t = today();
    var c = new Date(t.getFullYear(), dt.getMonth(), dt.getDate());
    if (c.getTime() < t.getTime()) c = new Date(t.getFullYear() + 1, dt.getMonth(), dt.getDate());
    return c;
  }
  var MODE_TEXT = { down: '倒数日', up: '纪念日', yearly: '每年' };

  function compute(it) {
    var dt = parseDate(it.date);
    if (!dt) return null;
    var t = today();
    var mode = it.mode === 'up' || it.mode === 'yearly' ? it.mode : 'down';
    var prefix, big, target = dt;

    if (mode === 'yearly') {
      target = nextYearly(dt);
      big = diffDays(t, target);
      prefix = big === 0 ? '就是' : '还有';
    } else if (mode === 'up') {
      big = diffDays(dt, t);
      if (big >= 0) prefix = '已经';
      else { big = -big; prefix = '还有'; }
    } else {
      big = diffDays(t, dt);
      if (big > 0) prefix = '还有';
      else if (big === 0) { prefix = '就是'; big = 0; }
      else { big = -big; prefix = '已过'; }
    }
    return { mode: mode, prefix: prefix, big: big, target: target, dateText: fmtDate(target) };
  }

  /* 小组件里放哪一个：优先「最近的一个还没到的」，都没有就放已过的最近一个 */
  function pickOne() {
    var rows = [];
    D.items.forEach(function (it) {
      var c = compute(it);
      if (c) rows.push({ it: it, c: c, score: (c.prefix === '还有' || c.prefix === '就是') ? c.big : c.big + 100000 });
    });
    if (!rows.length) return null;
    rows.sort(function (a, b) { return a.score - b.score; });
    return rows[0];
  }

  /* ---------- 样式 ---------- */
  var CSS = [
    /* ===== 桌面：一条横着的倒数日小组件 ===== */
    '.polaroid-board{display:none !important;}',
    '.layout-shell>.after-polaroid{margin-top:9px !important;}',
    '#app-grid{margin-top:0 !important;}',
    '#xxj-cdc{display:flex;flex-direction:column;width:100%;margin:0;padding:9px 13px 8px;text-align:left;',
    'cursor:pointer;border-radius:20px;border:1px solid var(--line,rgba(255,255,255,.10));background:var(--bg-card,#fff);',
    'box-shadow:0 4px 16px -6px rgba(0,0,0,.10);font-family:inherit;color:var(--text-main,#17191c);',
    '-webkit-tap-highlight-color:transparent;}',
    '#xxj-cdc .xxj-cdc-top{display:flex;align-items:center;justify-content:space-between;flex:none;margin-bottom:4px;}',
    '#xxj-cdc .xxj-cdc-lab{font-family:"Space Mono",ui-monospace,monospace;font-size:7px;letter-spacing:.16em;',
    'text-transform:uppercase;color:var(--text-sub,#6d727b);opacity:.8;}',
    '#xxj-cdc .xxj-cdc-plus{font-size:11px;color:var(--accent,#5b7fa6);opacity:.85;line-height:1;}',
    '#xxj-cdc .xxj-cdc-rows{display:flex;flex-direction:column;gap:0;flex:none;}',
    '#xxj-cdc .xxj-cdc-r{display:flex;align-items:center;gap:8px;padding:4.5px 0;}',
    '#xxj-cdc .xxj-cdc-r+.xxj-cdc-r{border-top:1px solid rgba(var(--tint-rgb,58,92,137),.12);}',
    '#xxj-cdc .xxj-cdc-rl{flex:1;min-width:0;}',
    '#xxj-cdc .xxj-cdc-rl b{display:block;font-size:11px;font-weight:500;line-height:1.25;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '#xxj-cdc .xxj-cdc-rl i{display:block;font-style:normal;font-size:8px;letter-spacing:.03em;',
    'color:var(--text-sub,#6d727b);margin-top:1.5px;}',
    '#xxj-cdc .xxj-cdc-rr{flex:none;text-align:right;display:flex;align-items:baseline;gap:2px;}',
    '#xxj-cdc .xxj-cdc-rr em{font-family:"Space Mono",ui-monospace,monospace;font-style:normal;font-size:17.5px;',
    'line-height:1;color:var(--accent,#5b7fa6);}',
    '#xxj-cdc .xxj-cdc-rr i{font-style:normal;font-size:8px;color:var(--text-sub,#6d727b);}',
    '#xxj-cdc .xxj-cdc-more{font-size:8.5px;color:var(--text-sub,#6d727b);opacity:.7;margin-top:6px;flex:none;',
    'letter-spacing:.04em;}',
    '#xxj-cdc.is-empty .xxj-cdc-rows{padding:2px 0 4px;}',
    '#xxj-cdc.is-empty .xxj-cdc-name{font-size:10.5px;color:var(--text-sub,#6d727b);line-height:1.5;}',
    'body.dark #xxj-cdc{background:rgba(26,31,39,.72);}',

    /* ===== App 界面 ===== */
    '.xxj-cd{position:fixed;inset:0;z-index:76;display:none;flex-direction:column;',
    'background:var(--bg-body,#0f1218);color:var(--text-main,#e6edf7);',
    'font-family:-apple-system,"PingFang SC",system-ui,sans-serif;}',
    '.xxj-cd.open{display:flex;}',
    '.xxj-cd-top{flex:none;display:flex;align-items:center;gap:10px;padding:14px 16px 6px;}',
    '.xxj-cd-back{border:0;background:transparent;color:var(--accent,#5b7fa6);font-size:12px;padding:6px 2px;cursor:pointer;}',
    '.xxj-cd-tag{margin-left:auto;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.18em;opacity:.5;}',
    '.xxj-cd-body{flex:1;min-height:0;overflow-y:auto;padding:4px 16px 26px;-webkit-overflow-scrolling:touch;}',
    '.xxj-cd-sec{display:flex;align-items:center;justify-content:space-between;margin:8px 0 8px;}',
    '.xxj-cd-lab{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-sub,#6d727b);}',
    '.xxj-cd-add{border:1px solid rgba(var(--tint-rgb,58,92,137),.22);background:rgba(var(--tint-rgb,58,92,137),.07);',
    'color:var(--accent,#5b7fa6);border-radius:10px;font-size:11.5px;padding:7px 12px;cursor:pointer;}',
    '.xxj-cd-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;}',
    '.xxj-cd-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;cursor:pointer;',
    'padding:11px 12px;border-radius:15px;border:1px solid var(--line,rgba(255,255,255,.10));',
    'background:var(--bg-card,#1c212a);color:inherit;font-family:inherit;}',
    '.xxj-cd-item .xxj-cd-it-l{flex:1;min-width:0;}',
    '.xxj-cd-item b{display:block;font-size:12.5px;font-weight:500;color:var(--text-main,#17191c);',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.xxj-cd-item span{display:block;font-size:10.5px;color:var(--text-sub,#6d727b);margin-top:3px;}',
    '.xxj-cd-it-r{flex:none;text-align:right;}',
    '.xxj-cd-it-r em{display:block;font-family:"Space Mono",ui-monospace,monospace;font-style:normal;',
    'font-size:19px;line-height:1;color:var(--accent,#5b7fa6);}',
    '.xxj-cd-it-r i{display:block;font-style:normal;font-size:9px;color:var(--text-sub,#6d727b);margin-top:3px;}',
    '.xxj-cd-empty{font-size:11.5px;color:var(--text-sub,#6d727b);opacity:.8;line-height:1.9;margin:8px 0 0;}',
    '.xxj-cd-form{display:flex;flex-direction:column;gap:9px;margin-top:10px;padding:13px;border-radius:16px;',
    'background:var(--bg-card,#1c212a);border:1px solid var(--line,rgba(255,255,255,.10));}',
    '.xxj-cd-input{width:100%;box-sizing:border-box;border:1px solid rgba(var(--tint-rgb,58,92,137),.18);',
    'background:rgba(var(--tint-rgb,58,92,137),.05);color:var(--text-main,#17191c);border-radius:11px;',
    'font-size:12.5px;padding:10px 12px;font-family:inherit;outline:none;-webkit-appearance:none;}',
    '.xxj-cd-input:focus{border-color:rgba(var(--tint-rgb,58,92,137),.5);}',
    '.xxj-cd-seg{display:flex;gap:6px;}',
    '.xxj-cd-seg button{flex:1;border:1px solid rgba(var(--tint-rgb,58,92,137),.18);background:transparent;',
    'color:var(--text-sub,#6d727b);font-size:11px;padding:8px 0;border-radius:10px;cursor:pointer;font-family:inherit;}',
    '.xxj-cd-seg button.on{background:var(--accent,#5b7fa6);border-color:var(--accent,#5b7fa6);color:#fff;}',
    '.xxj-cd-acts{display:flex;gap:8px;align-items:center;}',
    '.xxj-cd-acts .xxj-cd-del{border:0;background:transparent;color:#c8697a;font-size:11.5px;padding:8px 4px;cursor:pointer;}',
    '.xxj-cd-acts .xxj-cd-save{margin-left:auto;border:0;background:var(--accent,#5b7fa6);color:#fff;font-size:12px;',
    'padding:9px 18px;border-radius:11px;cursor:pointer;font-family:inherit;}',
    '.xxj-cd-tip{font-size:10.5px;color:var(--text-sub,#6d727b);opacity:.72;line-height:1.7;margin-top:12px;}',
    'body.dark #xxj-cdc{background:rgba(26,31,39,.72);}',
  ].join('');

  function injectCss() {
    if (document.getElementById('xxj-cd-css')) return;
    var s = document.createElement('style');
    s.id = 'xxj-cd-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function sortedRows() {
    var rows = D.items.map(function (it) { return { it: it, c: compute(it) }; })
      .filter(function (x) { return x.c; });
    rows.sort(function (a, b) {
      var sa = (a.c.prefix === '还有' || a.c.prefix === '就是') ? a.c.big : a.c.big + 100000;
      var sb = (b.c.prefix === '还有' || b.c.prefix === '就是') ? b.c.big : b.c.big + 100000;
      return sa - sb;
    });
    return rows;
  }

  /* ---------- 桌面小组件 ---------- */
  function renderCard() {
    var el = document.getElementById('xxj-cdc');
    if (!el) return;
    var rows = sortedRows();
    if (!rows.length) {
      el.classList.add('is-empty');
      el.innerHTML = '<span class="xxj-cdc-top"><span class="xxj-cdc-lab">Countdown</span>'
        + '<span class="xxj-cdc-plus">＋</span></span>'
        + '<span class="xxj-cdc-rows"><span class="xxj-cdc-name">还没有记着哪个日子 · 点开加一个</span></span>';
      return;
    }
    el.classList.remove('is-empty');
    var show = rows.slice(0, 5);
    var html = '<span class="xxj-cdc-top"><span class="xxj-cdc-lab">Countdown</span>'
      + '<span class="xxj-cdc-plus">＋</span></span><span class="xxj-cdc-rows">';
    html += show.map(function (x) {
      return '<span class="xxj-cdc-r"><span class="xxj-cdc-rl"><b>' + esc(x.it.name || '未命名') + '</b>'
        + '<i>' + esc(x.c.prefix) + ' · ' + esc(x.c.dateText) + (x.c.mode === 'yearly' ? ' · 每年' : '')
        + '</i></span><span class="xxj-cdc-rr"><em>' + x.c.big + '</em><i>天</i></span></span>';
    }).join('');
    html += '</span>';
    if (rows.length > show.length) {
      html += '<span class="xxj-cdc-more">还有 ' + (rows.length - show.length) + ' 个 · 点开看全部</span>';
    }
    el.innerHTML = html;
  }

  function buildRow() {
    var board = document.querySelector('.polaroid-board');
    if (!board || !board.parentNode) return false;
    if (document.getElementById('xxj-cdc')) return true;
    var card = document.createElement('button');
    card.type = 'button';
    card.id = 'xxj-cdc';
    card.setAttribute('aria-label', '倒数日');
    var after = document.querySelector('.after-polaroid');
    if (after && after.parentNode === board.parentNode) board.parentNode.insertBefore(card, after);
    else board.parentNode.insertBefore(card, board.nextSibling);
    renderCard();
    return true;
  }

  /* ---------- App 界面 ---------- */
  var F = { open: false, id: null, name: '', date: '', mode: 'down' };

  function ensureUI() {
    var el = document.getElementById('xxj-cd');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'xxj-cd';
    el.className = 'xxj-cd';
    el.innerHTML = '<header class="xxj-cd-top">'
      + '<button class="xxj-cd-back" data-cd-back data-back>‹ 桌面</button>'
      + '<span class="xxj-cd-tag">COUNTDOWN</span></header>'
      + '<div class="xxj-cd-body" id="xxj-cd-body"></div>';
    document.body.appendChild(el);
    return el;
  }

  function render() {
    var body = document.getElementById('xxj-cd-body');
    if (!body) return;
    var rows = sortedRows();
    var html = '<div class="xxj-cd-sec"><span class="xxj-cd-lab">日子 · ' + D.items.length + '</span>'
      + '<button class="xxj-cd-add" data-cd-new>＋ 新建</button></div>';

    if (!rows.length) {
      html += '<p class="xxj-cd-empty">还没有记任何日子。<br>点「＋ 新建」，写个名字、挑个日期就行。</p>';
    } else {
      html += '<ul class="xxj-cd-list">' + rows.map(function (x) {
        return '<li><button class="xxj-cd-item" data-cd-edit="' + esc(x.it.id) + '">'
          + '<span class="xxj-cd-it-l"><b>' + esc(x.it.name || '未命名') + '</b>'
          + '<span>' + esc(x.c.dateText) + ' · ' + esc(MODE_TEXT[x.c.mode]) + ' · ' + esc(x.c.prefix) + '</span></span>'
          + '<span class="xxj-cd-it-r"><em>' + x.c.big + '</em><i>天</i></span>'
          + '</button></li>';
      }).join('') + '</ul>';
    }

    if (F.open) {
      html += '<div class="xxj-cd-form">'
        + '<input class="xxj-cd-input" id="xxj-cd-name" type="text" maxlength="18" '
        + 'placeholder="写个名字，比如 第一次见面" value="' + esc(F.name) + '" />'
        + '<input class="xxj-cd-input" id="xxj-cd-date" type="date" value="' + esc(F.date) + '" />'
        + '<div class="xxj-cd-seg">'
        + ['down', 'up', 'yearly'].map(function (m) {
          return '<button data-cd-mode="' + m + '"' + (F.mode === m ? ' class="on"' : '') + '>'
            + MODE_TEXT[m] + '</button>';
        }).join('')
        + '</div>'
        + '<div class="xxj-cd-acts">'
        + (F.id ? '<button class="xxj-cd-del" data-cd-del>删除</button>' : '')
        + '<button class="xxj-cd-save" data-cd-save>保存</button></div>'
        + '</div>';
    }

    html += '<p class="xxj-cd-tip">「倒数日」算还有几天；「纪念日」算已经过去几天；「每年」每年到那天重新数。<br>'
      + '数据只存在这台手机上，不上传。</p>';
    body.innerHTML = html;
  }

  function openApp() {
    injectCss();
    ensureUI();
    load();
    F.open = false;
    render();
    document.getElementById('xxj-cd').classList.add('open');
  }
  function closeApp() {
    var el = document.getElementById('xxj-cd');
    if (el) el.classList.remove('open');
  }
  function readForm() {
    var n = document.getElementById('xxj-cd-name');
    var d = document.getElementById('xxj-cd-date');
    return {
      name: n ? n.value.trim() : F.name,
      date: d ? d.value : F.date
    };
  }
  function doSave() {
    var v = readForm();
    if (!v.name) { toast('先给这个日子起个名字'); return; }
    if (!parseDate(v.date)) { toast('挑一个日期'); return; }
    if (F.id) {
      D.items = D.items.map(function (x) {
        return x.id === F.id ? { id: x.id, name: v.name, date: v.date, mode: F.mode } : x;
      });
    } else {
      D.items.push({ id: 'cd' + Date.now().toString(36), name: v.name, date: v.date, mode: F.mode });
    }
    save();
    F.open = false; F.id = null;
    render(); renderCard();
    toast('记下了');
  }

  function bind() {
    var el = ensureUI();
    if (el.dataset.bind === '1') return;
    el.dataset.bind = '1';

    el.addEventListener('click', function (e) {
      var t = e.target;
      var back = t.closest('[data-cd-back]');
      if (back) { closeApp(); return; }

      var nw = t.closest('[data-cd-new]');
      if (nw) {
        var d = new Date();
        d.setDate(d.getDate() + 30);
        F.open = true; F.id = null; F.name = '';
        F.date = String(d.getFullYear()) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        F.mode = 'down';
        render();
        return;
      }
      var ed = t.closest('[data-cd-edit]');
      if (ed) {
        var id = ed.getAttribute('data-cd-edit');
        var it = D.items.filter(function (x) { return x.id === id; })[0];
        if (!it) return;
        F.open = true; F.id = id; F.name = it.name || '';
        F.date = it.date || ''; F.mode = it.mode === 'up' || it.mode === 'yearly' ? it.mode : 'down';
        render();
        return;
      }
      var md = t.closest('[data-cd-mode]');
      if (md) {
        var v = readForm();
        F.name = v.name; F.date = v.date;
        F.mode = md.getAttribute('data-cd-mode');
        render();
        return;
      }
      if (t.closest('[data-cd-save]')) { doSave(); return; }
      if (t.closest('[data-cd-del]')) {
        if (!F.id) return;
        D.items = D.items.filter(function (x) { return x.id !== F.id; });
        save();
        F.open = false; F.id = null;
        render(); renderCard();
        toast('已删除');
      }
    });

    var card = document.getElementById('xxj-cdc');
    if (card && card.dataset.bind !== '1') {
      card.dataset.bind = '1';
      card.addEventListener('click', function (e) {
        e.preventDefault();
        openApp();
      });
    }
  }


  /* ===== 让角色知道这些日子：给每次 AI 请求垫一条 [日子] 系统消息 ===== */
  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function dateIso(dt) {
    return String(dt.getFullYear()) + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }

  function contextLine() {
    if (!D.items.length) return '';
    var rows = sortedRows();
    if (!rows.length) return '';
    var t = today();
    var parts = rows.slice(0, 6).map(function (x) {
      var tail = '（' + dateIso(x.c.target) + (x.c.mode === 'yearly' ? '，每年' : '') + '）';
      return (x.it.name || '未命名') + ' ' + x.c.prefix + x.c.big + '天' + tail;
    });
    return '[日子] 今天 ' + dateIso(t) + '（' + WEEK[t.getDay()] + '）。'
      + '用户（和你）在桌面上记着这些日子：' + parts.join('；') + '。'
      + '聊到、问起或者寒暄时，可以自然地提一句（比如还有几天、过了多久），'
      + '但不要机械罗列、不要每次都提。';
  }

  function installContextInject() {
    if (window.__xxjCdFetch) return;
    var orig = window.fetch;
    if (!orig) return;
    window.__xxjCdFetch = true;
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (/\/chat\/completions/.test(url) && init && typeof init.body === 'string') {
          var line = contextLine();
          if (line) {
            var body = JSON.parse(init.body);
            if (body && Array.isArray(body.messages)) {
              var has = body.messages.some(function (m) {
                return m && typeof m.content === 'string' && m.content.indexOf('[日子]') === 0;
              });
              if (!has) {
                body.messages.unshift({ role: 'system', content: line });
                init = Object.assign({}, init, { body: JSON.stringify(body) });
              }
            }
          }
        }
      } catch (e) {}
      return orig.call(this, input, init);
    };
  }

  /* ---------- 网格兜底：万一 app-grid 的 APPS 还没带「倒数日」 ---------- */
  function addTile() {
    var grid = document.getElementById('app-grid');
    if (!grid) return false;
    if (grid.dataset.xxjCd === '1') return true;
    if (grid.querySelector('.app-tile[data-app="倒数日"]')) { grid.dataset.xxjCd = '1'; return true; }
    if (!grid.querySelector('.xxj-pager')) return false;
    var pages = grid.querySelectorAll('.xxj-pg');
    if (!pages.length) return false;
    var last = pages[pages.length - 1];
    var btn = document.createElement('button');
    btn.className = 'app-tile';
    btn.type = 'button';
    btn.setAttribute('data-app', '倒数日');
    btn.innerHTML = '<span class="app-tile-ico"><i class="ph ph-calendar"></i></span>'
      + '<span class="app-tile-name">倒数日</span>';
    last.appendChild(btn);
    grid.dataset.xxjCd = '1';
    return true;
  }

  function bindTile() {
    if (document.__xxjCdClick) return;
    document.__xxjCdClick = true;
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('#app-grid [data-app="倒数日"]') : null;
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      openApp();
    }, true);
  }

  /* ---------- 启动 ---------- */
  window.xxjCdOpen = openApp;
  window.xxjCdContextLine = function () { load(); return contextLine(); };

  function boot() {
    injectCss();
    load();
    buildRow();
    bind();
    installContextInject();
    addTile();
    bindTile();
    renderCard();
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    boot();
    if (document.getElementById('xxj-cdc') && document.querySelector('#app-grid .xxj-pager')) {
      clearInterval(timer);
    }
    if (tries > 60) clearInterval(timer);
  }, 400);

  if (document.readyState !== 'loading') setTimeout(boot, 0);
  else document.addEventListener('DOMContentLoaded', boot);

  /* 跨天或从后台回来时重算一次 */
  setInterval(renderCard, 60000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) renderCard();
  });
})();
