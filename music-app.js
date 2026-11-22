/* ============================================================
   music-app.js —— 小手机「音乐」：本地 mp3 导入 + 歌单 + 播放器
   · 文件存在 IndexedDB（刷新、关掉都还在），不上传任何服务器
   · 读 ID3 标签拿歌名/歌手/专辑/封面，读不到就用文件名兜底
   · 支持 Media Session：锁屏 / 通知栏显示歌曲信息与控制
   挂载：index.html <head> 一行 <script src="music-app.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var DB_NAME = 'xxjMusicDB';
  var STORE = 'blobs';
  var META_KEY = 'xxjMusicV1';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mmss(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return Math.floor(sec / 60) + ':' + pad(sec % 60);
  }
  function toast(msg) {
    if (typeof window.toast === 'function') return window.toast(msg);
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:60px;transform:translateX(-50%);z-index:99999;'
      + 'background:rgba(20,24,32,.92);color:#e8eef7;font-size:12px;padding:9px 14px;border-radius:12px;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1600);
  }
  function mb(bytes) { return (bytes / 1048576).toFixed(1) + ' MB'; }

  /* ---------- IndexedDB ---------- */
  var db = null;
  function openDB() {
    return new Promise(function (res, rej) {
      if (db) return res(db);
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = function () { db = req.result; res(db); };
      req.onerror = function () { rej(req.error); };
    });
  }
  function idbPut(key, val) {
    return openDB().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(val, key);
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbGet(key) {
    return openDB().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(STORE, 'readonly');
        var r = tx.objectStore(STORE).get(key);
        r.onsuccess = function () { res(r.result || null); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }
  function idbDel(key) {
    return openDB().then(function (d) {
      return new Promise(function (res) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function () { res(true); };
      });
    });
  }

  /* ---------- 元数据 ---------- */
  var M = { tracks: [], cur: null };
  function loadMeta() {
    try {
      var raw = localStorage.getItem(META_KEY);
      if (raw) {
        var o = JSON.parse(raw) || {};
        M.tracks = Array.isArray(o.tracks) ? o.tracks : [];
      }
    } catch (e) { M.tracks = []; }
  }
  function saveMeta() {
    try {
      localStorage.setItem(META_KEY, JSON.stringify({ tracks: M.tracks }));
    } catch (e) {}
  }

  /* ---------- ID3v2 读取（TIT2 / TPE1 / TALB / APIC） ---------- */
  function syncsafe(b, i) {
    return ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f);
  }
  function decodeText(bytes) {
    try {
      var s = '';
      for (var i = 0; i < bytes.length; i++) s += '%' + pad(bytes[i].toString(16)).slice(-2);
      return decodeURIComponent(s);
    } catch (e) {
      return '';
    }
  }
  function readID3(buf) {
    var out = {};
    try {
      var b = new Uint8Array(buf);
      if (b.length < 12 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return out; /* "ID3" */
      var ver = b[3];
      var flags = b[5];
      var size = syncsafe(b, 6);
      var pos = 10;
      if (flags & 0x40) pos += 4;               /* 扩展头 */
      var end = Math.min(10 + size, b.length);
      while (pos + 10 <= end) {
        var id = String.fromCharCode(b[pos], b[pos + 1], b[pos + 2], b[pos + 3]);
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        var fsz = ver >= 4 ? syncsafe(b, pos + 4)
          : ((b[pos + 4] << 24) | (b[pos + 5] << 16) | (b[pos + 6] << 8) | b[pos + 7]);
        if (fsz <= 0) break;
        var body = b.subarray(pos + 10, pos + 10 + fsz);
        if (id === 'TIT2' || id === 'TPE1' || id === 'TALB') {
          var enc = body[0];
          var txt = body.subarray(1);
          var val;
          if (enc === 1 || enc === 2) {
            /* UTF-16 */
            var u = '';
            for (var i = 0; i + 1 < txt.length; i += 2) {
              var c = txt[i] | (txt[i + 1] << 8);
              if (c) u += String.fromCharCode(c);
            }
            val = u;
          } else if (enc === 0) {
            val = decodeText(txt);
          } else {
            val = decodeText(txt);
          }
          val = (val || '').replace(/\u0000/g, '').trim();
          if (id === 'TIT2') out.title = val;
          if (id === 'TPE1') out.artist = val;
          if (id === 'TALB') out.album = val;
        } else if (id === 'APIC' && !out.cover) {
          var mimeLen = 0;
          var j = 1;
          while (j < body.length && body[j] !== 0) { j++; }
          var mime = decodeText(body.subarray(1, j)) || 'image/jpeg';
          j++;                              /* 跳过 0 */
          j++;                              /* 图片类型 1 字节 */
          while (j < body.length && body[j] !== 0) { j++; }   /* 描述 */
          j++;
          var img = body.subarray(j);
          if (img.length > 400) {
            out.coverBytes = img;
            out.coverMime = mime.indexOf('png') >= 0 ? 'image/png' : 'image/jpeg';
          }
        }
        pos += 10 + fsz;
      }
    } catch (e) {}
    return out;
  }

  /* 封面压成小图，避免把大图存下来 */
  function shrinkCover(bytes, mime) {
    return new Promise(function (res) {
      try {
        var blob = new Blob([bytes], { type: mime });
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          try {
            var side = 220;
            var c = document.createElement('canvas');
            var ratio = Math.min(1, side / Math.max(img.width, img.height));
            c.width = Math.round(img.width * ratio) || side;
            c.height = Math.round(img.height * ratio) || side;
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            res(c.toDataURL('image/jpeg', 0.72));
          } catch (e) { res(''); }
          URL.revokeObjectURL(url);
        };
        img.onerror = function () { URL.revokeObjectURL(url); res(''); };
        img.src = url;
      } catch (e) { res(''); }
    });
  }

  /* 时长：临时 objectURL 探一下 */
  function probeDuration(file) {
    return new Promise(function (res) {
      try {
        var url = URL.createObjectURL(file);
        var a = new Audio();
        var done = false;
        function finish(v) { if (done) return; done = true; URL.revokeObjectURL(url); res(v); }
        a.preload = 'metadata';
        a.onloadedmetadata = function () { finish(isFinite(a.duration) ? a.duration : 0); };
        a.onerror = function () { finish(0); };
        setTimeout(function () { finish(0); }, 6000);
        a.src = url;
      } catch (e) { res(0); }
    });
  }

  /* ---------- 导入 ---------- */
  var importing = false;
  function importFiles(files) {
    if (importing) return toast('正在导入，等一下');
    var list = Array.prototype.slice.call(files || []).filter(function (f) {
      return /audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|webm|flac)$/i.test(f.name);
    });
    if (!list.length) return toast('没识别到音频文件');
    importing = true;
    var bad = 0, done = 0;
    toast('开始导入 ' + list.length + ' 首…');
    list.reduce(function (chain, f) {
      return chain.then(function () {
        return addOne(f).then(function (ok) {
          if (!ok) bad++;
          done++;
          if (done % 3 === 0 || done === list.length) toast('已导入 ' + (done - bad) + '/' + list.length);
        });
      });
    }, Promise.resolve()).then(function () {
      importing = false;
      saveMeta();
      render();
      if (bad) toast('有 ' + bad + ' 个文件读不了（可能是加密格式 .ncm/.qmc）');
    }).catch(function () { importing = false; toast('导入出错'); });
  }

    function addOne(file) {
    var name = file.name.replace(/\.(mp3|m4a|aac|wav|ogg|webm|flac)$/i, '');
    /* 先尝试读前 1MB 里的 ID3 */
    var headSlice = file.slice(0, Math.min(file.size, 1048576));
    return headSlice.arrayBuffer().then(function (buf) {
      var id3 = readID3(buf);
      var meta = {
        id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: id3.title || name,
        artist: id3.artist || '未知歌手',
        album: id3.album || '',
        size: file.size,
        dur: 0,
        cover: '',
        addedAt: Date.now(),
        mime: file.type || 'audio/mpeg'
      };
      return Promise.all([
        idbPut(meta.id, file),
        id3.coverBytes ? shrinkCover(id3.coverBytes, id3.coverMime) : Promise.resolve(''),
        probeDuration(file)
      ]).then(function (r) {
        meta.cover = r[1] || '';
        meta.dur = Math.round(r[2] || 0);
        /* 同名同歌手同大小视为重复 */
        var dup = M.tracks.some(function (x) {
          return x.name === meta.name && x.artist === meta.artist && Math.abs((x.size || 0) - meta.size) < 2048;
        });
        if (dup) return idbDel(meta.id).then(function () { return false; });
        M.tracks.unshift(meta);
        return true;
      });
    }).catch(function () { return false; });
  }

  /* ---------- 播放器 ---------- */
  var audio = new Audio();
    audio.preload = 'metadata';
  var curUrl = null;
  var playing = false;

  function setCover(el, t) {
    if (!el) return;
    if (t && t.cover) {
      el.style.backgroundImage = 'url(' + t.cover + ')';
      el.textContent = '';
      el.style.backgroundSize = 'cover';
    } else {
      el.style.backgroundImage = 'none';
      el.style.backgroundSize = '';
      el.textContent = (t && t.artist ? t.artist.slice(0, 1) : '·');
    }
  }

  function playTrack(id, opts) {
    var t = M.tracks.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    M.cur = t.id;
    render();          /* 先切卡片，哪怕后面自动播放被拦了，也能看到这首歌 */
    idbGet(id).then(function (blob) {
      if (!blob) { toast('文件丢了，重新导入一下'); return; }
      if (curUrl) URL.revokeObjectURL(curUrl);
      curUrl = URL.createObjectURL(blob);
      audio.src = curUrl;
      audio.play().then(function () {
        playing = true;
        syncMediaSession(t);
        render();
      }).catch(function () { toast('点一下播放键试试'); });
    });
  }

  function syncMediaSession(t) {
    try {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.name,
        artist: t.artist,
        album: t.album || '小手机',
        artwork: t.cover ? [{ src: t.cover, sizes: '220x220', type: 'image/jpeg' }] : []
      });
      navigator.mediaSession.setActionHandler('play', function () { audio.play(); });
      navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { step(-1); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { step(1); });
      navigator.mediaSession.setActionHandler('seekbackward', function () { audio.currentTime = Math.max(0, audio.currentTime - 10); });
      navigator.mediaSession.setActionHandler('seekforward', function () { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
    } catch (e) {}
  }

  function step(dir) {
    if (!M.tracks.length) return;
    var i = M.tracks.findIndex(function (x) { return x.id === M.cur; });
    i = (i + dir + M.tracks.length) % M.tracks.length;
    playTrack(M.tracks[i].id);
  }

  /* ---------- 界面 ---------- */
  var CSS = [
    /* 全部吃主站的 CSS 变量，浅色 / 深色主题自动跟着变 */
    '.xxj-mu{position:fixed;inset:0;z-index:75;display:none;flex-direction:column;',
    'background:var(--bg-body,#0f1218);color:var(--text-main,#e6edf7);',
    'font-family:-apple-system,"PingFang SC",system-ui,sans-serif;}',
    '.xxj-mu.open{display:flex;}',
    '.xxj-mu-top{flex:none;display:flex;align-items:center;gap:10px;padding:14px 16px 6px;}',
    '.xxj-mu-back{border:0;background:transparent;color:var(--accent,#5b7fa6);font-size:12px;padding:6px 2px;cursor:pointer;}',
    '.xxj-mu-tag{margin-left:auto;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.18em;opacity:.5;}',
    '.xxj-mu-body{flex:1;min-height:0;overflow-y:auto;padding:6px 16px 26px;-webkit-overflow-scrolling:touch;}',
    '.xxj-mu-now{background:var(--bg-card,#1c212a);border:1px solid var(--line,rgba(255,255,255,.10));',
    'border-radius:18px;padding:14px;box-shadow:var(--shadow-card,0 5px 24px rgba(0,0,0,.06));}',
    '.xxj-mu-row{display:flex;align-items:center;gap:12px;}',
    '.xxj-mu-cover{width:62px;height:62px;border-radius:14px;flex:none;background:rgba(var(--tint-rgb,58,92,137),.10);',
    'display:grid;place-items:center;font-size:20px;color:var(--accent,#5b7fa6);overflow:hidden;}',
    '.xxj-mu-meta{flex:1;min-width:0;}',
    '.xxj-mu-name{font-size:15px;margin:0;color:var(--text-main,#17191c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.xxj-mu-artist{font-size:11.5px;color:var(--text-sub,#6d727b);margin:3px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.xxj-mu-time{font-size:10.5px;font-family:ui-monospace,monospace;color:var(--text-sub,#6d727b);margin-top:6px;}',
    '.xxj-mu-bar{height:5px;border-radius:999px;background:rgba(var(--tint-rgb,58,92,137),.14);margin:10px 0 6px;overflow:hidden;}',
    '.xxj-mu-bar i{display:block;height:100%;width:0;border-radius:999px;background:var(--accent,#5b7fa6);}',
    '.xxj-mu-ctrl{display:flex;align-items:center;justify-content:center;gap:22px;margin-top:10px;}',
    '.xxj-mu-btn{border:0;background:transparent;color:var(--text-main,#17191c);font-size:20px;cursor:pointer;padding:6px;}',
    '.xxj-mu-play{width:46px;height:46px;border-radius:50%;background:var(--accent,#5b7fa6);color:#fff;font-size:18px;',
    'display:grid;place-items:center;border:0;cursor:pointer;}',
    '.xxj-mu-sec{display:flex;align-items:center;justify-content:space-between;margin:16px 0 8px;}',
    '.xxj-mu-lab{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-sub,#6d727b);}',
    '.xxj-mu-add{border:1px solid rgba(var(--tint-rgb,58,92,137),.22);background:rgba(var(--tint-rgb,58,92,137),.07);',
    'color:var(--accent,#5b7fa6);border-radius:10px;font-size:11.5px;padding:7px 12px;cursor:pointer;}',
    '.xxj-mu-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}',
    '.xxj-mu-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;',
    'background:rgba(var(--tint-rgb,58,92,137),.045);cursor:pointer;}',
    '.xxj-mu-item.on{background:rgba(var(--tint-rgb,58,92,137),.14);}',
    '.xxj-mu-thumb{width:36px;height:36px;border-radius:9px;flex:none;background:rgba(var(--tint-rgb,58,92,137),.10);',
    'display:grid;place-items:center;font-size:13px;color:var(--accent,#5b7fa6);overflow:hidden;}',
    '.xxj-mu-it{flex:1;min-width:0;}',
    '.xxj-mu-it b{display:block;font-size:12.5px;font-weight:500;color:var(--text-main,#17191c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.xxj-mu-it span{display:block;font-size:10.5px;color:var(--text-sub,#6d727b);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.xxj-mu-del{border:0;background:transparent;color:var(--text-sub,#6d727b);opacity:.6;font-size:13px;cursor:pointer;padding:0 4px;}',
    '.xxj-mu-empty{font-size:11.5px;color:var(--text-sub,#6d727b);opacity:.8;line-height:1.8;margin:6px 0 0;}',
    '.xxj-mu-tip{font-size:10.5px;color:var(--text-sub,#6d727b);opacity:.7;line-height:1.7;margin-top:14px;}'
  ].join('');

  function injectCss() {
    if (document.getElementById('xxj-mu-css')) return;
    var s = document.createElement('style');
    s.id = 'xxj-mu-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function curTrack() {
    return M.tracks.filter(function (x) { return x.id === M.cur; })[0] || null;
  }

  function render() {
    var body = document.getElementById('xxj-mu-body');
    if (!body) return;
    var t = curTrack();
    var total = M.tracks.reduce(function (a, x) { return a + (x.size || 0); }, 0);
    var now = t
      ? '<div class="xxj-mu-now">'
        + '<div class="xxj-mu-row">'
        + '<div class="xxj-mu-cover" id="xxj-mu-cover"></div>'
        + '<div class="xxj-mu-meta"><p class="xxj-mu-name">' + esc(t.name) + '</p>'
        + '<p class="xxj-mu-artist">' + esc(t.artist) + (t.album ? ' · ' + esc(t.album) : '') + '</p>'
        + '<p class="xxj-mu-time" id="xxj-mu-time">0:00 / ' + mmss(t.dur) + '</p></div></div>'
        + '<div class="xxj-mu-bar"><i id="xxj-mu-prog"></i></div>'
        + '<div class="xxj-mu-ctrl">'
        + '<button class="xxj-mu-btn" data-mu-step="-1">⏮</button>'
        + '<button class="xxj-mu-play" data-mu-toggle>' + (audio.paused ? '▶' : '❚❚') + '</button>'
        + '<button class="xxj-mu-btn" data-mu-step="1">⏭</button>'
        + '</div></div>'
      : '<div class="xxj-mu-now"><p class="xxj-mu-name">还没有在放的歌</p>'
        + '<p class="xxj-mu-artist">从下面歌单里点一首</p></div>';

    var list = M.tracks.length
      ? '<ul class="xxj-mu-list">' + M.tracks.map(function (x) {
        return '<li class="xxj-mu-item ' + (x.id === M.cur ? 'on' : '') + '" data-mu-play="' + x.id + '">'
          + '<div class="xxj-mu-thumb"></div>'
          + '<div class="xxj-mu-it"><b>' + esc(x.name) + '</b>'
          + '<span>' + esc(x.artist) + ' · ' + mmss(x.dur) + ' · ' + mb(x.size || 0) + '</span></div>'
          + '<button class="xxj-mu-del" data-mu-del="' + x.id + '">×</button></li>';
      }).join('') + '</ul>'
      : '<p class="xxj-mu-empty">歌单还是空的。<br>点右边「导入音频」，从手机里选 mp3/m4a 等文件就行。</p>';

    body.innerHTML = now
      + '<div class="xxj-mu-sec"><span class="xxj-mu-lab">我的歌单 · ' + M.tracks.length + ' 首 · ' + mb(total) + '</span>'
      + '<button class="xxj-mu-add" data-mu-import>导入音频</button></div>'
      + list
      + '<p class="xxj-mu-tip">文件只存在本机浏览器里，不上传。加密格式（网易云 .ncm、QQ 音乐 .qmc）读不了，需要先转成 mp3。</p>'
      + '<input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple hidden id="xxj-mu-file">';

    /* 封面 / 缩略图 / 进度 */
    setCover(document.getElementById('xxj-mu-cover'), t);
    body.querySelectorAll('[data-mu-play]').forEach(function (li) {
      var id = li.dataset.muPlay;
      var tr = M.tracks.filter(function (x) { return x.id === id; })[0];
      setCover(li.querySelector('.xxj-mu-thumb'), tr);
    });
    tick();
  }

  function tick() {
    var el = document.getElementById('xxj-mu-prog');
    var tm = document.getElementById('xxj-mu-time');
    if (!el || !tm) return;
    var d = audio.duration || (curTrack() ? curTrack().dur : 0) || 0;
    var c = audio.currentTime || 0;
    el.style.width = (d ? Math.min(100, c / d * 100) : 0) + '%';
    tm.textContent = mmss(c) + ' / ' + mmss(d);
  }

  audio.addEventListener('timeupdate', tick);
  audio.addEventListener('play', function () {
    playing = true;
    var b = document.querySelector('[data-mu-toggle]');
    if (b) b.textContent = '❚❚';
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  });
  audio.addEventListener('pause', function () {
    playing = false;
    var b = document.querySelector('[data-mu-toggle]');
    if (b) b.textContent = '▶';
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  });
  audio.addEventListener('ended', function () { step(1); });

  function ensureUI() {
    var el = document.getElementById('xxj-mu');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'xxj-mu';
    el.className = 'xxj-mu';
    el.innerHTML = '<header class="xxj-mu-top">'
      + '<button class="xxj-mu-back" data-mu-back data-back>‹ 桌面</button>'
      + '<span class="xxj-mu-tag">MUSIC</span></header>'
      + '<div class="xxj-mu-body" id="xxj-mu-body"></div>';
    document.body.appendChild(el);
    return el;
  }

  function openMusic() {
    injectCss();
    ensureUI();
    loadMeta();
    render();
    document.getElementById('xxj-mu').classList.add('open');
  }
  function closeMusic() {
    var el = document.getElementById('xxj-mu');
    if (el) el.classList.remove('open');
  }

  function bind() {
    var el = ensureUI();
    if (el.dataset.bind === '1') return;
    el.dataset.bind = '1';
    el.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(
        '[data-mu-back],[data-mu-toggle],[data-mu-step],[data-mu-play],[data-mu-del],[data-mu-import]'
      ) : null;
      if (!t) return;
      var d = t.dataset;
      if (d.muBack !== undefined) { e.preventDefault(); closeMusic(); return; }
      if (d.muToggle !== undefined) {
        e.preventDefault();
        if (!M.cur) { if (M.tracks.length) playTrack(M.tracks[0].id); return; }
        if (audio.paused) audio.play().catch(function () {}); else audio.pause();
        return;
      }
      if (d.muStep) { e.preventDefault(); step(parseInt(d.muStep, 10)); return; }
      if (d.muPlay) { e.preventDefault(); playTrack(d.muPlay); return; }
      if (d.muDel) {
        e.preventDefault(); e.stopPropagation();
        var id = d.muDel;
        idbDel(id);
        M.tracks = M.tracks.filter(function (x) { return x.id !== id; });
        if (M.cur === id) { M.cur = null; audio.pause(); audio.removeAttribute('src'); }
        saveMeta(); render();
        return;
      }
      if (d.muImport !== undefined) {
        e.preventDefault();
        var f = document.getElementById('xxj-mu-file');
        if (f) f.click();
        return;
      }
    }, true);
    el.addEventListener('change', function (e) {
      var f = e.target;
      if (!f || f.id !== 'xxj-mu-file') return;
      var files = f.files;
      if (files && files.length) importFiles(files);
      f.value = '';
    }, true);
    /* 点进度条跳转 */
    el.addEventListener('click', function (e) {
      var bar = e.target && e.target.closest ? e.target.closest('.xxj-mu-bar') : null;
      if (!bar) return;
      var r = bar.getBoundingClientRect();
      var d = audio.duration || 0;
      if (!d) return;
      audio.currentTime = Math.max(0, Math.min(d, (e.clientX - r.left) / r.width * d));
      tick();
    }, true);
  }

  /* ---------- 挂到桌面网格 ---------- */
  function addTile() {
    var grid = document.getElementById('app-grid');
    if (!grid) return false;
    if (grid.dataset.xxjMusic === '1') return true;
    var pages = grid.querySelectorAll('.xxj-pg');
    if (!pages.length) return false;
    var last = pages[pages.length - 1];
    if (last.querySelector('.app-tile[data-app="音乐"]')) {
      grid.dataset.xxjMusic = '1';
      return true;
    }
    var btn = document.createElement('button');
    btn.className = 'app-tile';
    btn.type = 'button';
    btn.setAttribute('data-app', '音乐');
    btn.innerHTML = '<span class="app-tile-ico"><i class="ph ph-music-notes"></i></span>'
      + '<span class="app-tile-name">音乐</span>';
    last.appendChild(btn);
    grid.dataset.xxjMusic = '1';
    return true;
  }

  function bindTile() {
    if (document.__xxjMusicClick) return;
    document.__xxjMusicClick = true;
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('#app-grid [data-app="音乐"]') : null;
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      openMusic();
    }, true);
  }

  /* 给外部（角色反应 / 分享卡片）留的接口 */
  window.xxjMusicOpen = openMusic;

  window.xxjMusicNow = function () {
    var t = curTrack();
    if (!t) return null;
    return { id: t.id, name: t.name, artist: t.artist, album: t.album, pos: Math.round(audio.currentTime || 0), dur: Math.round(audio.duration || t.dur || 0), playing: !audio.paused };
  };
  window.xxjMusicImport = function () { openMusic(); var f = document.getElementById('xxj-mu-file'); if (f) f.click(); };
  window.xxjMusicPlayByName = function (name, artist) {
    var hit = M.tracks.filter(function (x) {
      return (name && x.name.indexOf(name) >= 0) || (artist && x.artist === artist && name && x.name.indexOf(name) >= 0);
    })[0];
    if (hit) { playTrack(hit.id); return true; }
    return false;
  };

  window.__xxjMusicDebug = {
    importFiles: function (files) { return importFiles(files); },
    addOne: function (f) { return addOne(f); },
    state: function () { return { tracks: M.tracks.length, cur: M.cur, importing: importing }; },
    idb: function () { return openDB().then(function () { return 'db-ok'; }).catch(function (e) { return 'db-fail:' + e; }); }
  };

  var n = 0;
  var iv = setInterval(function () {
    n++;
    if (document.getElementById('app-grid')) {
      addTile();
      bindTile();
      if (document.getElementById('xxj-mu')) bind();
      else bind();
      clearInterval(iv);
    }
    if (n > 200) clearInterval(iv);
  }, 300);
})();
