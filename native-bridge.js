/* ============================================================
   native-bridge.js —— 只在安卓 APK 里生效的桥
   · 把网页的「后台保活」打开，让角色能在 App 退到后台时也发消息
   · 后台收到角色主动消息 → 调用原生发一条微信式通知（横幅 + 声音 + 震动）
   · 收供原生保活服务定时调用 window.xxjNativeTick()
   在浏览器里 window.AndroidBridge 不存在，整个文件会直接 return。
   ============================================================ */
(function () {
  'use strict';

  var B = window.AndroidBridge;
  if (!B) return;                    /* 浏览器里什么都不做 */

  /* ---------- 1. 后台策略：默认「轻模式」，不挂常驻通知 ----------
     · light：系统每 15 分钟静默唤醒一次（无常驻通知，可能晚到）
     · full ：常驻前台服务（最稳，但通知栏会挂一条）
     想换回常驻：localStorage.setItem('xxj_apk_mode','full') 后重开 App */
  var KEY = 'xxj_bg_keepalive_enabled';
  var MODE_KEY = 'xxj_apk_mode';

  function readMode() {
    try {
      var m = localStorage.getItem(MODE_KEY);
      return m === 'full' ? 'full' : 'light';
    } catch (e) { return 'light'; }
  }

  function applyMode() {
    var mode = readMode();
    /* 网页自己的扫描开关得是开着的，否则后台那条路根本不会被触发 */
    try {
      if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, 'true');
    } catch (e) {}
    try { if (B.setMode) B.setMode(mode); } catch (e) {}
    /* 只有常驻模式才动用网页自己的保活（那段会跑静音音频维持定时器） */
    if (mode === 'full') {
      try { if (typeof window.syncBgKeepAliveState === 'function') window.syncBgKeepAliveState(); } catch (e) {}
    }
  }

  var modeTimer = setInterval(function () {
    if (document.getElementById('app-grid')) {
      clearInterval(modeTimer);
      applyMode();
      document.addEventListener('click', function () { setTimeout(applyMode, 500); }, true);
    }
  }, 500);
  setTimeout(function () { clearInterval(modeTimer); }, 60000);

  /* ---------- 2. 角色主动消息 → 原生通知 ---------- */
  function hidden() {
    try { return document.visibilityState === 'hidden'; } catch (e) { return true; }
  }

  function nameOf(row) {
    try {
      var th = row && row.th;
      if (th) {
        var n = th.name || th.title || th.peerName || th.nick || th.remark;
        if (n) return String(n);
      }
    } catch (e) {}
    return '小心机';
  }

  function lastAssistantText(maskId, threadId) {
    try {
      var log = window.readChatLogForMaskThread
        ? window.readChatLogForMaskThread(maskId, threadId)
        : [];
      for (var i = log.length - 1; i >= 0; i--) {
        var m = log[i];
        if (!m || m.role !== 'assistant') continue;
        var t = m.text || m.content || '';
        if (typeof t === 'string' && t.trim()) {
          return t.replace(/\s+/g, ' ').slice(0, 120);
        }
      }
    } catch (e) {}
    return '发来一条新消息';
  }

  function notifyRow(row) {
    if (!row) return;
    var maskId = String(row.maskId || '');
    var threadId = String(row.threadId || '');
    if (!maskId || !threadId) return;
    var who = nameOf(row);
    var text = lastAssistantText(maskId, threadId);
    try {
      B.notifyMessage(who, text, 'xxj-' + maskId + '-' + threadId);
    } catch (e) {}
  }

  /* 这个函数是"角色主动发一条"的唯一漏斗，包一层就能拿到结果 */
  function wrapProactive() {
    var orig = window.executeChatProactiveForDueRow;
    if (typeof orig !== 'function' || orig.__xxjWrapped) return !!(orig && orig.__xxjWrapped);
    var wrapped = function (row) {
      var p = orig.apply(this, arguments);
      try {
        if (p && typeof p.then === 'function') {
          p.then(function (ok) {
            if (ok && hidden()) notifyRow(row);
            return ok;
          }, function () {});
        } else if (p && hidden()) {
          notifyRow(row);
        }
      } catch (e) {}
      return p;
    };
    wrapped.__xxjWrapped = true;
    try { window.executeChatProactiveForDueRow = wrapped; } catch (e) {}
    return true;
  }

  var wrapTimer = setInterval(function () {
    if (wrapProactive()) clearInterval(wrapTimer);
  }, 800);
  setTimeout(function () { clearInterval(wrapTimer); }, 120000);

  /* ---------- 3. 原生保活服务每 5 分钟来一脚 ---------- */
  window.xxjNativeTick = function () {
    try {
      if (typeof window.runChatProactiveScanOnce === 'function') {
        window.runChatProactiveScanOnce({ requireKeepAlive: true });
      }
    } catch (e) {}
    try {
      if (typeof window.runRelationDmProactiveBackgroundScan === 'function') {
        window.runRelationDmProactiveBackgroundScan();
      }
    } catch (e) {}
  };

  /* 网页里如果自己弹过通知，避免重复（这里不拦，交给原生） */
  window.xxjNativeNotify = function (who, text, tag) {
    try { B.notifyMessage(who, text, tag); } catch (e) {}
  };
})();
