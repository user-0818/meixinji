/* 天气 App（meixinji / 没心机）— 独立补丁，不改 app-grid.js
 *  作用：
 *   1. 把主屏「世界书」那格换成「天气」，世界书自动挪到第 2 页末尾；
 *   2. 点开是一个天气页（Open-Meteo，免 key、支持跨域）：当前天气 + 逐小时 + 未来 3 天；
 *   3. 把当前天气作为一条系统上下文注入到与角色的对话请求里，让角色知道今天什么天气。
 *
 *  用法：仓库根目录放本文件；index.html 的 <head> 里、app-grid.js 那行后面加一行
 *        <script src="weather-app.js"></script>
 */
(function () {
  var W_KEY = 'xxjWeatherV1';        /* 地点 + 最近一次数据缓存 */
  var CACHE_MS = 30 * 60 * 1000;     /* 缓存 30 分钟 */

  /* ===== 天气代码 → 中文 + 图标 ===== */
  var WCODE = {
    0: ['晴', '☀'], 1: ['晴间多云', '🌤'], 2: ['多云', '⛅'], 3: ['阴', '☁'],
    45: ['雾', '🌫'], 48: ['冻雾', '🌫'],
    51: ['小毛毛雨', '🌦'], 53: ['毛毛雨', '🌦'], 55: ['大毛毛雨', '🌦'],
    56: ['冻毛毛雨', '🌧'], 57: ['强冻毛毛雨', '🌧'],
    61: ['小雨', '🌧'], 63: ['中雨', '🌧'], 65: ['大雨', '🌧'],
    66: ['冻雨', '🌧'], 67: ['强冻雨', '🌧'],
    71: ['小雪', '🌨'], 73: ['中雪', '🌨'], 75: ['大雪', '🌨'], 77: ['雪粒', '🌨'],
    80: ['阵雨', '🌦'], 81: ['强阵雨', '🌧'], 82: ['暴雨', '⛈'],
    85: ['阵雪', '🌨'], 86: ['强阵雪', '❄'],
    95: ['雷雨', '⛈'], 96: ['雷雨伴冰雹', '⛈'], 99: ['强雷雨伴冰雹', '⛈']
  };
  function wdesc(code) { return (WCODE[code] || ['未知', '·'])[0]; }
  function wicon(code) { return (WCODE[code] || ['未知', '·'])[1]; }

  var CSS = [
    '.xxj-wx{position:fixed;inset:0;z-index:70;display:none;flex-direction:column;',
    'background:linear-gradient(180deg,#1b2430 0%,#101620 60%,#0c1015 100%);color:#e8eef7;',
    'font-family:-apple-system,"PingFang SC",system-ui,sans-serif;}',
    '.xxj-wx.open{display:flex;}',
    '.xxj-wx-top{flex:none;display:flex;align-items:center;gap:10px;padding:14px 16px 4px;}',
    '.xxj-wx-back{border:0;background:transparent;color:#9fb6cf;font-size:12px;padding:6px 2px;cursor:pointer;}',
    '.xxj-wx-title{margin-left:auto;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.18em;opacity:.55;}',
    '.xxj-wx-body{flex:1;min-height:0;overflow-y:auto;padding:6px 16px 30px;-webkit-overflow-scrolling:touch;}',
    '.xxj-wx-hero{display:flex;align-items:flex-end;gap:16px;padding:8px 4px 14px;}',
    '.xxj-wx-ico{font-size:44px;line-height:1;}',
    '.xxj-wx-temp{font-size:44px;line-height:1;font-weight:300;letter-spacing:-.02em;}',
    '.xxj-wx-temp small{font-size:16px;opacity:.6;margin-left:2px;}',
    '.xxj-wx-meta{display:flex;flex-direction:column;gap:3px;padding-bottom:4px;}',
    '.xxj-wx-place{font-size:13px;letter-spacing:.04em;}',
    '.xxj-wx-desc{font-size:11px;opacity:.62;}',
    '.xxj-wx-card{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10);',
    'border-radius:18px;padding:12px;margin-bottom:10px;}',
    '.xxj-wx-lab{font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.6;margin:0 0 8px;}',
    '.xxj-wx-kv{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}',
    '.xxj-wx-kv div{display:flex;flex-direction:column;gap:3px;}',
    '.xxj-wx-kv b{font-size:15px;font-weight:500;font-family:ui-monospace,monospace;}',
    '.xxj-wx-kv span{font-size:10px;opacity:.5;}',
    '.xxj-wx-hours{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;}',
    '.xxj-wx-hours::-webkit-scrollbar{display:none;}',
    '.xxj-wx-hour{flex:none;width:44px;text-align:center;display:flex;flex-direction:column;gap:5px;align-items:center;}',
    '.xxj-wx-hour span{font-size:10px;opacity:.55;}',
    '.xxj-wx-hour b{font-size:12px;font-weight:500;font-family:ui-monospace,monospace;}',
    '.xxj-wx-hour i{font-size:16px;font-style:normal;}',
    '.xxj-wx-day{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px dashed rgba(255,255,255,.10);}',
    '.xxj-wx-day:first-child{border-top:0;padding-top:0;}',
    '.xxj-wx-day em{width:52px;font-style:normal;font-size:11px;opacity:.62;}',
    '.xxj-wx-day i{font-style:normal;font-size:15px;}',
    '.xxj-wx-day .d{flex:1;font-size:11.5px;opacity:.8;}',
    '.xxj-wx-day b{font-family:ui-monospace,monospace;font-size:12px;font-weight:500;}',
    '.xxj-wx-acts{display:flex;gap:8px;margin:4px 0 10px;}',
    '.xxj-wx-btn{flex:1;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#e6eef7;',
    'border-radius:12px;font-size:11.5px;padding:9px 10px;cursor:pointer;}',
    '.xxj-wx-input{flex:1;min-width:0;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);',
    'border-radius:12px;color:#e8eef7;font-size:12px;padding:9px 11px;outline:none;}',
    '.xxj-wx-tip{font-size:10.5px;opacity:.42;margin:0 0 8px;}',
    '.xxj-wx-city{display:flex;flex-direction:column;gap:6px;}',
    '.xxj-wx-city button{text-align:left;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);',
    'border-radius:10px;color:#e8eef7;font-size:12px;padding:8px 10px;cursor:pointer;}',
    'body:not(.dark) .xxj-wx{background:linear-gradient(180deg,#eaf1f8 0%,#f6f9fc 60%,#ffffff 100%);color:#1e2633;}',
    'body:not(.dark) .xxj-wx-card,body:not(.dark) .xxj-wx-city button{background:rgba(20,30,45,.045);border-color:rgba(20,30,45,.10);}',
    'body:not(.dark) .xxj-wx-back{color:#4a6f96;}',
    'body:not(.dark) .xxj-wx-input{background:rgba(20,30,45,.05);border-color:rgba(20,30,45,.12);color:#1e2633;}',
    'body:not(.dark) .xxj-wx-btn{background:rgba(20,30,45,.05);border-color:rgba(20,30,45,.12);color:#25313f;}'
  ].join('');

  function injectCss() {
    if (document.getElementById('xxj-wx-css-v1')) return;
    var s = document.createElement('style');
    s.id = 'xxj-wx-css-v1';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function toast(t) {
    try { if (typeof showToast === 'function') return showToast(t); } catch (e) {}
  }

  function readState() {
    var d = { place: null, data: null, ts: 0 };
    try {
      var raw = localStorage.getItem(W_KEY);
      if (raw) d = JSON.parse(raw) || d;
    } catch (e) {}
    return d;
  }
  function writeState(d) {
    try { localStorage.setItem(W_KEY, JSON.stringify(d)); } catch (e) {}
  }

  /* 默认地点：山东省德州市德城区（没设置过、或者以前用的是「当前位置」，都落到这儿） */
  var DEFAULT_PLACE = { name: '山东 · 德州 · 德城区', lat: 37.4508, lon: 116.3166 };
  var DZ_KEY = 'xxjWeatherDezhou';

  var st = readState();
  (function () {
    var force = false;
    try { force = localStorage.getItem(DZ_KEY) !== '1'; } catch (e) { force = true; }
    if (force || !st.place || !st.place.name || st.place.name === '当前位置') {
      st.place = DEFAULT_PLACE;
      st.data = null; st.ts = 0;
      writeState(st);
      try { localStorage.setItem(DZ_KEY, '1'); } catch (e) {}
    }
  })();
  var view = 'home';     /* home | city */
  var loading = false;

  /* ===== 取数 ===== */
  function fetchWeather(lat, lon) {
    var u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
      + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m'
      + '&hourly=temperature_2m,weather_code'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min'
      + '&timezone=auto&forecast_days=4';
    return fetch(u, { cache: 'no-store' }).then(function (r) { return r.json(); });
  }

  function searchCity(q) {
    var u = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q)
      + '&count=6&language=zh&format=json';
    return fetch(u, { cache: 'no-store' }).then(function (r) { return r.json(); });
  }

  function refresh(silent) {
    if (!st.place) { useGeo(true); return; }
    loading = true;
    if (!silent) render();
    fetchWeather(st.place.lat, st.place.lon).then(function (j) {
      st.data = j; st.ts = Date.now(); loading = false;
      writeState(st); render();
    }).catch(function () {
      loading = false; if (!silent) { toast('天气接口暂时取不到'); render(); }
    });
  }

  function useGeo(ask) {
    if (!navigator.geolocation) {
      if (ask) toast('这个浏览器不支持定位，手动填城市');
      view = 'city'; render(); return;
    }
    if (ask) toast('正在定位…');
    navigator.geolocation.getCurrentPosition(function (p) {
      st.place = { name: '当前位置', lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) };
      writeState(st);
      refresh();
    }, function () {
      toast('定位没成功，手动填个城市'); view = 'city'; render();
    }, { timeout: 8000, maximumAge: 600000 });
  }

  /* ===== 渲染 ===== */
  function heroHtml() {
    if (!st.data || !st.data.current) {
      return '<div class="xxj-wx-hero"><div class="xxj-wx-ico">🌤</div>'
        + '<div class="xxj-wx-meta"><span class="xxj-wx-place">' + (st.place ? st.place.name : '未设置地点') + '</span>'
        + '<span class="xxj-wx-desc">' + (loading ? '正在取天气…' : '还没有数据，点下面的刷新') + '</span></div></div>';
    }
    var c = st.data.current;
    var t = Math.round(c.temperature_2m);
    return '<div class="xxj-wx-hero"><div class="xxj-wx-ico">' + wicon(c.weather_code) + '</div>'
      + '<div class="xxj-wx-temp">' + t + '<small>°C</small></div>'
      + '<div class="xxj-wx-meta"><span class="xxj-wx-place">' + esc(st.place ? st.place.name : '') + '</span>'
      + '<span class="xxj-wx-desc">' + wdesc(c.weather_code) + ' · 体感 ' + Math.round(c.apparent_temperature) + '°</span></div></div>';
  }

  function kvHtml() {
    if (!st.data || !st.data.current) return '';
    var c = st.data.current, d = st.data.daily;
    return '<div class="xxj-wx-card"><p class="xxj-wx-lab">Today</p><div class="xxj-wx-kv">'
      + '<div><b>' + Math.round(d.temperature_2m_max[0]) + '°</b><span>最高</span></div>'
      + '<div><b>' + Math.round(d.temperature_2m_min[0]) + '°</b><span>最低</span></div>'
      + '<div><b>' + Math.round(c.relative_humidity_2m) + '%</b><span>湿度</span></div>'
      + '<div><b>' + Math.round(c.wind_speed_10m) + '</b><span>风速 km/h</span></div>'
      + '</div></div>';
  }

  function hoursHtml() {
    if (!st.data || !st.data.hourly) return '';
    var h = st.data.hourly, now = new Date();
    var idx = 0;
    for (var i = 0; i < h.time.length; i++) {
      if (new Date(h.time[i]) >= now) { idx = i; break; }
    }
    var out = '';
    for (var k = idx; k < Math.min(idx + 24, h.time.length); k += 2) {
      var hh = h.time[k].slice(11, 16);
      out += '<div class="xxj-wx-hour"><span>' + hh + '</span><i>' + wicon(h.weather_code[k]) + '</i>'
        + '<b>' + Math.round(h.temperature_2m[k]) + '°</b></div>';
    }
    return '<div class="xxj-wx-card"><p class="xxj-wx-lab">Next hours</p><div class="xxj-wx-hours">' + out + '</div></div>';
  }

  function daysHtml() {
    if (!st.data || !st.data.daily) return '';
    var d = st.data.daily, out = '';
    var WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    for (var i = 0; i < d.time.length; i++) {
      var dt = new Date(d.time[i] + 'T00:00:00');
      var lab = i === 0 ? '今天' : (i === 1 ? '明天' : WK[dt.getDay()]);
      out += '<div class="xxj-wx-day"><em>' + lab + '</em><i>' + wicon(d.weather_code[i]) + '</i>'
        + '<span class="d">' + wdesc(d.weather_code[i]) + '</span>'
        + '<b>' + Math.round(d.temperature_2m_min[i]) + '° / ' + Math.round(d.temperature_2m_max[i]) + '°</b></div>';
    }
    return '<div class="xxj-wx-card"><p class="xxj-wx-lab">Forecast</p>' + out + '</div>';
  }

  function cityHtml() {
    return '<div class="xxj-wx-card"><p class="xxj-wx-lab">选个城市</p>'
      + '<div class="xxj-wx-acts"><input class="xxj-wx-input" data-wx-q placeholder="输入城市名，如 杭州">'
      + '<button class="xxj-wx-btn" data-wx-search>搜索</button></div>'
      + '<div class="xxj-wx-city" data-wx-list></div>'
      + '<p class="xxj-wx-tip">数据来自 Open-Meteo，免费公开接口</p></div>';
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function render() {
    var body = document.getElementById('xxj-wx-body');
    if (!body) return;
    if (view === 'city') { body.innerHTML = cityHtml(); return; }
    body.innerHTML = heroHtml()
      + '<div class="xxj-wx-acts"><button class="xxj-wx-btn" data-wx-refresh>刷新</button>'
      + '<button class="xxj-wx-btn" data-wx-geo>用定位</button>'
      + '<button class="xxj-wx-btn" data-wx-city>换城市</button></div>'
      + kvHtml() + hoursHtml() + daysHtml();
  }

  function ensureEl() {
    var el = document.getElementById('xxj-wx');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'xxj-wx';
    el.className = 'xxj-wx';
    el.innerHTML = '<header class="xxj-wx-top">'
      + '<button type="button" class="xxj-wx-back" data-wx-back>‹ 桌面</button>'
      + '<span class="xxj-wx-title">WEATHER</span></header>'
      + '<div class="xxj-wx-body" id="xxj-wx-body"></div>';
    document.body.appendChild(el);
    bind();
    return el;
  }

  function openWeather() {
    injectCss();
    var el = ensureEl();
    view = 'home';
    render();
    el.classList.add('open');
    if (!st.place) useGeo(true);
    else if (!st.data || Date.now() - st.ts > CACHE_MS) refresh();
  }

  function closeWeather() {
    var el = document.getElementById('xxj-wx');
    if (el) el.classList.remove('open');
  }

  function bind() {
    var el = ensureEl();
    if (el.dataset.bind === '1') return;
    el.dataset.bind = '1';

    el.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(
        '[data-wx-back],[data-wx-refresh],[data-wx-geo],[data-wx-city],[data-wx-search],[data-wx-pick]'
      ) : null;
      if (!t) return;
      var d = t.dataset;
      if (d.wxBack !== undefined) {
        e.preventDefault(); e.stopPropagation();
        if (view === 'city') { view = 'home'; render(); } else closeWeather();
        return;
      }
      if (d.wxRefresh !== undefined) { e.preventDefault(); e.stopPropagation(); refresh(); return; }
      if (d.wxGeo !== undefined) { e.preventDefault(); e.stopPropagation(); useGeo(true); return; }
      if (d.wxCity !== undefined) { e.preventDefault(); e.stopPropagation(); view = 'city'; render(); return; }
      if (d.wxPick) {
        e.preventDefault(); e.stopPropagation();
        st.place = { name: d.wxPick, lat: parseFloat(d.wxLat), lon: parseFloat(d.wxLon) };
        writeState(st); st.data = null; view = 'home'; render(); refresh();
        return;
      }
      if (d.wxSearch !== undefined) {
        e.preventDefault(); e.stopPropagation();
        var q = el.querySelector('[data-wx-q]');
        var kw = q ? (q.value || '').trim() : '';
        if (!kw) { toast('先写个城市名'); return; }
        var list = el.querySelector('[data-wx-list]');
        if (list) list.innerHTML = '<p class="xxj-wx-tip">搜索中…</p>';
        searchCity(kw).then(function (j) {
          var arr = (j && j.results) || [];
          if (!arr.length) { if (list) list.innerHTML = '<p class="xxj-wx-tip">没找到这个城市</p>'; return; }
          if (list) {
            list.innerHTML = arr.map(function (r) {
              return '<button type="button" data-wx-pick="' + esc(r.name) + '" data-wx-lat="' + r.latitude
                + '" data-wx-lon="' + r.longitude + '">' + esc(r.name)
                + (r.admin1 ? ' · ' + esc(r.admin1) : '') + (r.country ? ' · ' + esc(r.country) : '') + '</button>';
            }).join('');
          }
        }).catch(function () { toast('搜索失败，稍后再试'); });
        return;
      }
    }, true);
  }

  /* ===== 主屏格子改造：世界书 → 天气，世界书挪到第 2 页 ===== */
  function patchGrid() {
    var grid = document.getElementById('app-grid');
    if (!grid) return false;
    if (grid.dataset.xxjWeather === '1') return true;
    var pages = grid.querySelectorAll('.xxj-pg');
    if (!pages.length) return false;
    var wb = grid.querySelector('.app-tile[data-app="世界书"]');
    if (!wb) return false;

    grid.dataset.xxjWeather = '1';

    /* 原「世界书」格子改成「天气」 */
    wb.dataset.app = '天气';
    var ico = wb.querySelector('.app-tile-ico i');
    if (ico) ico.className = 'ph ph-cloud-sun';
    var nm = wb.querySelector('.app-tile-name');
    if (nm) nm.textContent = '天气';

    /* 世界书克隆到第 2 页末尾 */
    var last = pages[pages.length - 1];
    var hasWB = last.querySelector('.app-tile[data-app="世界书"]');
    if (!hasWB) {
      var btn = document.createElement('button');
      btn.className = 'app-tile';
      btn.type = 'button';
      btn.setAttribute('data-app', '世界书');
      btn.innerHTML = '<span class="app-tile-ico"><i class="ph ph-book-open-text"></i></span>'
        + '<span class="app-tile-name">世界书</span>';
      last.appendChild(btn);
    }
    return true;
  }

  /* 点「天气」时接管 */
  function bindTile() {
    if (document.__xxjWeatherClick) return;
    document.__xxjWeatherClick = true;
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('#app-grid [data-app="天气"]') : null;
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      openWeather();
    }, true);
  }

  /* ===== 把天气注入对话上下文 ===== */
  function contextLine() {
    if (!st.data || !st.data.current || !st.place) return '';
    var c = st.data.current, d = st.data.daily;
    var line = '[天气] ' + st.place.name + ' ' + wdesc(c.weather_code) + ' '
      + Math.round(c.temperature_2m) + '℃（体感 ' + Math.round(c.apparent_temperature) + '℃）'
      + '，今日 ' + Math.round(d.temperature_2m_min[0]) + '~' + Math.round(d.temperature_2m_max[0]) + '℃'
      + '，湿度 ' + Math.round(c.relative_humidity_2m) + '%，风 ' + Math.round(c.wind_speed_10m) + 'km/h'
      + '（更新于 ' + new Date(st.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '）';
    return line;
  }

  function installContextInject() {
    if (window.__xxjWeatherFetch) return;
    var orig = window.fetch;
    if (!orig) return;
    window.__xxjWeatherFetch = true;
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (/\/chat\/completions/.test(url) && init && typeof init.body === 'string') {
          var line = contextLine();
          if (line) {
            var body = JSON.parse(init.body);
            if (body && Array.isArray(body.messages)) {
              var has = body.messages.some(function (m) {
                return m && typeof m.content === 'string' && m.content.indexOf('[天气]') === 0;
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

  /* ===== 启动：等 app-grid 把网格建好再改 ===== */
  var n = 0;
  var iv = setInterval(function () {
    n++;
    var ok = patchGrid();
    if (ok) {
      bindTile();
      installContextInject();
      /* 已经有地点就静默拉一次，保证角色对话里的天气是新的 */
      if (st.place && (!st.data || Date.now() - st.ts > CACHE_MS)) refresh(true);
      clearInterval(iv);
    }
    if (n > 400) clearInterval(iv);
  }, 250);
})();
