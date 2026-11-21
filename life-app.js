/* 生活 App（meixinji / 没心机）— 独立补丁，不改 app-grid.js
 *  内容：
 *   1. 主屏「漫游」那格换成「生活」，漫游自动挪到第 2 页末尾
 *   2. 两位角色（角色 A＝小米手环 / 角色 B＝Apple Watch，名字导入人设后再填）的手表数据：步数、心率、睡眠（含深/浅/清醒）、消费、近况
 *      —— 纯本地模拟，按日期 + 人物固定种子生成，同一天刷新不变；睡眠/起床时间随机浮动（会熬夜、会赖床）
 *   3. 「我」页：手动录入 / 粘贴导入自己的手环数据（华为系浏览器端读不到，见页面说明）
 *   4. 把两人的今天 + 我的今天注入对话上下文，角色能看到你一天的状态
 *
 *  用法：index.html 的 <head> 里、weather-app.js 那行后面加一行
 *        <script src="life-app.js"></script>
 */
(function () {
  var KEY_ME = 'xxjLife.Me';        /* 我自己的录入数据 */
  var TZ = 8;

  /* ===== 种子随机 ===== */
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function rf(r, a, b) { return a + r() * (b - a); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(min) { return pad(Math.floor(min / 60) % 24) + ':' + pad(min % 60); }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ===== 两位角色设定（山东高中、走读、物化生 / 物化地）===== */
  var PEOPLE = [
    {
      k: 'wsh', name: '', tag: '角色 A', device: '小米手环 8', tint: '#e2a86f',
      wakeBase: 365, bedBase: 1395, sleepDeep: 0.22, stepsBase: 7600, hrRest: 58
    },
    {
      k: 'whd', name: '', tag: '角色 B', device: 'Apple Watch S8', tint: '#7fb2e5',
      wakeBase: 372, bedBase: 1410, sleepDeep: 0.19, stepsBase: 6200, hrRest: 66
    }
  ];

  /* 角色名：导入人设后再填，没填就显示科目 */
  var KEY_NAMES = 'xxjLife.Names';
  var names = {};
  try { names = JSON.parse(localStorage.getItem(KEY_NAMES) || '{}') || {}; } catch (e) { names = {}; }
  function personName(p) { return String(names[p.k] || '').trim() || p.tag; }
  function refreshTabs() {
    var el = document.getElementById('xxj-life');
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll('.xxj-lf-tab'), function (b) {
      var k = b.dataset.tab;
      if (!k || k === 'me') return;
      var p = PEOPLE.filter(function (x) { return x.k === k; })[0];
      if (p) b.textContent = personName(p);
    });
  }

  /* ===== 一天的数据生成（同人同日固定）===== */
  function genDay(p, date) {
    var r = rng(hash(p.k + '#' + dayKey(date)));
    var wk = date.getDay();                 /* 0 周日；山东常见周六也上课 */
    var school = wk >= 1 && wk <= 6;

    /* 睡眠：普遍晚睡；约 1/4 熬夜到 0:40–1:40；约 1/5 赖床 */
    var lateNight = r() < 0.26;
    var lazy = r() < (lateNight ? 0.42 : 0.14);
    var dur = 395 + ri(r, -45, 45);
    if (lateNight) dur -= ri(r, 25, 95);              /* 熬夜 → 睡得少 */
    if (!school) dur += ri(r, 45, 95);
    if (dur < 280) dur = 280;
    if (dur > 690) dur = 690;
    var wakeMin = p.wakeBase + ri(r, -18, 22) + (lazy ? ri(r, 22, 58) : 0) + (!school ? ri(r, 35, 85) : 0);
    var bedAbs = wakeMin - dur;                       /* 可能为负，表示前一天晚上 */
    var bed = ((bedAbs % 1440) + 1440) % 1440;
    var wake = wakeMin % 1440;
    var totalMin = dur;

    /* 深/浅/清醒 */
    var deep = Math.round(totalMin * (p.sleepDeep + rf(r, -0.05, 0.05)));
    var awake = Math.round(totalMin * rf(r, 0.03, 0.09));
    var light = totalMin - deep - awake;
    var score = Math.max(38, Math.min(96, Math.round(
      70 + (totalMin - 420) * 0.08 + deep * 0.05 - awake * 0.28 + rf(r, -5, 7)
    )));

    /* 睡眠分段（画条用） */
    var segs = [], left = totalMin, i = 0;
    while (left > 8) {
      var kind = i % 3 === 1 ? 'deep' : (r() < 0.06 ? 'awake' : 'light');
      var len = Math.min(left, kind === 'deep' ? ri(r, 25, 70) : kind === 'awake' ? ri(r, 4, 16) : ri(r, 30, 95));
      segs.push(kind); left -= len; i++;
    }

    /* 步数：工作日有跑操 + 上下学走读；周末几乎不动 */
    var steps = school ? p.stepsBase + ri(r, -900, 1400) : ri(r, 900, 2600);
    if (school) steps += 1800;                /* 大课间跑操 */
    if (r() < 0.3) steps += ri(r, -600, 400); /* 体育课 */
    if (lateNight) steps -= ri(r, 200, 700);

    /* 心率：日间均值 + 跑操峰值 */
    var rest = p.hrRest + ri(r, -3, 4) + (lateNight ? ri(r, 3, 7) : 0);
    var series = [];
    series.push({ h: 6, v: rest + 12 });
    series.push({ h: 10, v: 168 + ri(r, -12, 10) });   /* 跑操 */
    series.push({ h: 12, v: rest + 18 });
    series.push({ h: 15, v: school ? rest + 22 : rest + 8 });
    series.push({ h: 18, v: rest + 14 });
    series.push({ h: 21, v: rest + 6 });
    if (r() < 0.35) series.push({ h: 23, v: rest + ri(r, 2, 12) });

    /* 消费：食堂三餐 + 小超市 + 偶发医务室 */
    var spend = [];
    var t = 7 * 60 + ri(r, -20, 20);
    spend.push({ t: hm(t), place: '食堂', item: pick(r, ['鸡蛋灌饼', '豆浆+包子', '豆腐脑', '粥+鸡蛋']), amount: ri(r, 4, 7) });
    if (school) {
      spend.push({ t: '12:' + pad(ri(r, 5, 40)), place: '食堂', item: pick(r, ['两荤一素', '盖浇饭', '面条', '米饭+菜']), amount: ri(r, 10, 14) });
      spend.push({ t: '17:' + pad(ri(r, 30, 55)), place: '食堂', item: pick(r, ['小吃', '馄饨', '肉夹馍', '粥']), amount: ri(r, 6, 11) });
    }
    var stops = ri(r, 0, 2);
    for (var s2 = 0; s2 < stops; s2++) {
      spend.push({
        t: hm(ri(r, 600, 1250)), place: '小超市',
        item: pick(r, ['矿泉水', '酸奶', '辣条', '功能饮料', '面包', '冰红茶']),
        amount: ri(r, 2, 6)
      });
    }
    if (lateNight && r() < 0.45) {
      spend.push({ t: '21:' + pad(ri(r, 5, 45)), place: '医务室', item: pick(r, ['人工泪液', '眼药水']), amount: ri(r, 9, 16) });
    }
    if (r() < 0.12) {
      spend.push({ t: hm(ri(r, 500, 1100)), place: '医务室', item: pick(r, ['创可贴', '感冒冲剂', '胃药']), amount: ri(r, 3, 18) });
    }

    /* 近况（他们会主动说的小事） */
    var notes = [];
    if (school) notes.push('早自习 ' + hm(p.wakeBase + ri(r, 0, 15)) + ' 到教室了，手机在兜里');
    if (school && r() < 0.5) notes.push('大课间跑操，' + (lateNight ? '腿还是软的' : '跑完还挺爽'));
    if (r() < 0.45) notes.push(pick(r, ['月考卷子发下来了', '物理作业又堆了一摞', '化学方程式背到吐', '被老师抽上去讲题了']));
    if (lateNight) notes.push(pick(r, ['又熬夜了，明早肯定起不来', '错题抄到手酸，睡了']));

    return {
      school: school, steps: Math.max(300, steps), rest: rest, series: series,
      sleep: {
        bed: bed % 1440, wake: wake % 1440, total: totalMin,
        deep: deep, light: light, awake: awake, segs: segs, score: score,
        late: lateNight, lazy: lazy
      },
      spend: spend, notes: notes
    };
  }

  /* ===== 当前时段状态 ===== */
  function nowState(date) {
    var d = new Date();
    var m = d.getHours() * 60 + d.getMinutes();
    var wk = date.getDay();
    if (wk === 0) return m < 540 ? '还在睡' : '周末在家';
    if (m < 380) return '还在睡';
    if (m < 460) return '早自习';
    if (m < 720) return '上课中';
    if (m < 830) return '午休';
    if (m < 1080) return '上课中';
    if (m < 1310) return '晚自习';
    if (m < 1350) return '放学回家';
    return '在家写作业';
  }

  /* ===== 样式 ===== */
  var CSS = [
    '.xxj-life{position:fixed;inset:0;z-index:70;display:none;flex-direction:column;',
    'background:linear-gradient(180deg,#141a23 0%,#0d1117 60%,#0a0d12 100%);color:#e8eef7;',
    'font-family:-apple-system,"PingFang SC",system-ui,sans-serif;}',
    '.xxj-life.open{display:flex;}',
    '.xxj-lf-top{flex:none;display:flex;align-items:center;gap:8px;padding:13px 14px 6px;}',
    '.xxj-lf-back{border:0;background:transparent;color:#9fb6cf;font-size:12px;padding:6px 2px;cursor:pointer;}',
    '.xxj-lf-title{margin-left:auto;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.18em;opacity:.55;}',
    '.xxj-lf-tabs{flex:none;display:flex;gap:6px;padding:2px 14px 8px;overflow-x:auto;scrollbar-width:none;}',
    '.xxj-lf-tabs::-webkit-scrollbar{display:none;}',
    '.xxj-lf-tab{flex:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#cfdcea;',
    'border-radius:999px;font-size:11.5px;padding:7px 13px;cursor:pointer;}',
    '.xxj-lf-tab.on{background:#5b7fa6;border-color:#5b7fa6;color:#fff;}',
    '.xxj-lf-body{flex:1;min-height:0;overflow-y:auto;padding:0 14px 30px;-webkit-overflow-scrolling:touch;}',
    '.xxj-lf-card{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);border-radius:18px;',
    'padding:12px;margin-bottom:10px;}',
    '.xxj-lf-lab{display:flex;align-items:center;justify-content:space-between;font-size:10px;letter-spacing:.16em;',
    'text-transform:uppercase;opacity:.62;margin:0 0 10px;}',
    '.xxj-lf-lab em{font-style:normal;opacity:.85;letter-spacing:.04em;text-transform:none;font-size:10.5px;}',
    '.xxj-lf-hero{display:flex;align-items:baseline;gap:8px;margin-bottom:6px;}',
    '.xxj-lf-dps{font-size:34px;font-weight:300;line-height:1;font-family:ui-monospace,monospace;}',
    '.xxj-lf-unit{font-size:10.5px;opacity:.5;}',
    '.xxj-lf-bar{height:6px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;}',
    '.xxj-lf-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#5b7fa6,#8fc0ea);}',
    '.xxj-lf-kv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;}',
    '.xxj-lf-kv div{display:flex;flex-direction:column;gap:2px;}',
    '.xxj-lf-kv b{font-size:14px;font-weight:500;font-family:ui-monospace,monospace;}',
    '.xxj-lf-kv span{font-size:10px;opacity:.5;}',
    '.xxj-lf-sleep-bar{display:flex;height:14px;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.06);}',
    '.xxj-lf-sleep-bar i{display:block;height:100%;}',
    '.xxj-lf-sleep-bar .deep{background:#3f6fa5;}',
    '.xxj-lf-sleep-bar .light{background:#7fa8cf;opacity:.8;}',
    '.xxj-lf-sleep-bar .awake{background:#c9a06a;}',
    '.xxj-lf-sleep-line{display:flex;justify-content:space-between;font-size:10.5px;opacity:.6;margin-top:6px;}',
    '.xxj-lf-hr{display:flex;align-items:flex-end;gap:3px;height:64px;margin-top:4px;}',
    '.xxj-lf-hr span{flex:1;background:linear-gradient(180deg,#8fc0ea,#4a6f96);border-radius:3px;min-height:6px;}',
    '.xxj-lf-hr-x{display:flex;justify-content:space-between;font-size:9px;opacity:.4;margin-top:3px;}',
    '.xxj-lf-sp{display:flex;flex-direction:column;gap:7px;}',
    '.xxj-lf-sp-row{display:flex;align-items:center;gap:8px;font-size:11.5px;}',
    '.xxj-lf-sp-row em{font-style:normal;font-family:ui-monospace,monospace;font-size:10.5px;opacity:.5;width:42px;flex:none;}',
    '.xxj-lf-sp-row .tag{font-size:9.5px;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.10);opacity:.8;flex:none;}',
    '.xxj-lf-sp-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.xxj-lf-sp-row b{font-family:ui-monospace,monospace;font-size:11.5px;font-weight:500;}',
    '.xxj-lf-total{display:flex;justify-content:space-between;border-top:1px dashed rgba(255,255,255,.12);',
    ' margin-top:9px;padding-top:8px;font-size:11.5px;opacity:.8;}',
    '.xxj-lf-note{font-size:11.5px;line-height:1.7;opacity:.78;margin:0;padding-left:10px;border-left:2px solid rgba(255,255,255,.14);}',
    '.xxj-lf-tip{font-size:10.5px;line-height:1.6;opacity:.45;margin:2px 0 0;}',
    '.xxj-lf-form{display:flex;flex-direction:column;gap:8px;}',
    '.xxj-lf-form label{display:flex;align-items:center;gap:8px;font-size:11px;opacity:.7;}',
    '.xxj-lf-form label span{width:64px;flex:none;}',
    '.xxj-lf-input{flex:1;min-width:0;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);',
    'border-radius:10px;color:#e8eef7;font-size:12px;padding:8px 10px;outline:none;}',
    '.xxj-lf-btn{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.09);color:#e6eef7;',
    'border-radius:11px;font-size:11.5px;padding:9px 12px;cursor:pointer;}',
    'body:not(.dark) .xxj-life{background:linear-gradient(180deg,#eef3f9 0%,#f8fbfe 60%,#fff 100%);color:#1d2635;}',
    'body:not(.dark) .xxj-lf-card{background:rgba(20,30,45,.045);border-color:rgba(20,30,45,.10);}',
    'body:not(.dark) .xxj-lf-input{background:rgba(20,30,45,.05);border-color:rgba(20,30,45,.12);color:#1d2635;}',
    'body:not(.dark) .xxj-lf-btn{background:rgba(20,30,45,.05);border-color:rgba(20,30,45,.12);color:#26313f;}',
    'body:not(.dark) .xxj-lf-tab{background:rgba(20,30,45,.05);border-color:rgba(20,30,45,.12);color:#33404f;}',
    'body:not(.dark) .xxj-lf-back{color:#4a6f96;}'
  ].join('');

  function injectCss() {
    if (document.getElementById('xxj-life-css-v1')) return;
    var s = document.createElement('style');
    s.id = 'xxj-life-css-v1';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function toast(t) {
    try { if (typeof showToast === 'function') return showToast(t); } catch (e) {}
  }

  var view = 'wsh';       /* wsh | whd | me */
  var me = null;

  function loadMe() {
    try {
      var raw = localStorage.getItem(KEY_ME);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveMe(d) {
    try { localStorage.setItem(KEY_ME, JSON.stringify(d)); } catch (e) {}
  }

  /* ===== 渲染 ===== */
  function todayCards(d, p) {
    var st = nowState(new Date());
    var s = d.sleep;
    var totalSpend = d.spend.reduce(function (a, x) { return a + x.amount; }, 0);
    var pct = Math.min(100, Math.round(d.steps / 8000 * 100));

    var hrBars = '';
    var maxHr = 185;
    for (var h = 6; h <= 23; h++) {
      var v = d.rest + 6;
      d.series.forEach(function (pt) { if (pt.h === h) v = pt.v; });
      if (h > 6 && h < 22) v += Math.round(12 * Math.sin((h - 6) / 16 * Math.PI));
      hrBars += '<span style="height:' + Math.max(8, Math.round(v / maxHr * 64)) + 'px"></span>';
    }

    return '<div class="xxj-lf-card">'
      + '<p class="xxj-lf-lab">今天 · ' + personName(p) + '<em>' + esc(p.device) + ' · ' + st + '</em></p>'
      + '<div class="xxj-lf-hero"><b class="xxj-lf-dps">' + d.steps + '</b><span class="xxj-lf-unit">步 / 目标 8000</span></div>'
      + '<div class="xxj-lf-bar"><i style="width:' + pct + '%"></i></div>'
      + '<div class="xxj-lf-kv">'
      + '<div><b>' + d.rest + '</b><span>静息心率</span></div>'
      + '<div><b>' + Math.floor(s.total / 60) + 'h' + (s.total % 60) + '</b><span>昨晚睡眠</span></div>'
      + '<div><b>' + totalSpend + '</b><span>今日消费 / 元</span></div>'
      + '</div></div>'
      + '<div class="xxj-lf-card"><p class="xxj-lf-lab">睡眠<em>' + hm(s.bed) + ' → ' + hm(s.wake) + '</em></p>'
      + '<div class="xxj-lf-sleep-bar">'
      + '<i class="deep" style="width:' + Math.round(s.deep / s.total * 100) + '%"></i>'
      + '<i class="light" style="width:' + Math.round(s.light / s.total * 100) + '%"></i>'
      + '<i class="awake" style="width:' + Math.round(s.awake / s.total * 100) + '%"></i>'
      + '</div>'
      + '<div class="xxj-lf-sleep-line"><span>深睡 ' + s.deep + ' 分</span><span>浅睡 ' + s.light + ' 分</span>'
      + '<span>清醒 ' + s.awake + ' 分</span></div>'
      + '<div class="xxj-lf-kv" style="grid-template-columns:repeat(2,1fr)">'
      + '<div><b>' + s.score + '</b><span>睡眠评分</span></div>'
      + '<div><b>' + (s.late ? '熬夜' : '正常') + (s.lazy ? ' · 赖床' : '') + '</b><span>昨晚状态</span></div>'
      + '</div></div>'
      + '<div class="xxj-lf-card"><p class="xxj-lf-lab">心率<em>日间曲线</em></p>'
      + '<div class="xxj-lf-hr">' + hrBars + '</div>'
      + '<div class="xxj-lf-hr-x"><span>06</span><span>12</span><span>18</span><span>23</span></div></div>'
      + '<div class="xxj-lf-card"><p class="xxj-lf-lab">消费<em>' + d.spend.length + ' 笔</em></p>'
      + '<div class="xxj-lf-sp">' + d.spend.map(function (x) {
        return '<div class="xxj-lf-sp-row"><em>' + esc(x.t) + '</em><span class="tag">' + esc(x.place) + '</span>'
          + '<span>' + esc(x.item) + '</span><b>' + x.amount + '</b></div>';
      }).join('') + '</div>'
      + '<div class="xxj-lf-total"><span>合计</span><b>' + totalSpend + ' 元</b></div></div>'
      + (d.notes.length ? '<div class="xxj-lf-card"><p class="xxj-lf-lab">近况<em>他说的</em></p>'
        + '<p class="xxj-lf-note">' + d.notes.map(esc).join('<br>') + '</p></div>' : '');
  }

  function meCards(m) {
    var totalSpend = (m.spend || []).reduce(function (a, x) { return a + x.amount; }, 0);
    var total = m.total || 0;
    var deep = m.deep || 0, awake = m.awake || 0;
    var light = Math.max(0, total - deep - awake);
    var pct = Math.min(100, Math.round((m.steps || 0) / 8000 * 100));
    return '<div class="xxj-lf-card"><p class="xxj-lf-lab">今天<em>' + esc(m.device || '我的手环') + '</em></p>'
      + '<div class="xxj-lf-hero"><b class="xxj-lf-dps">' + (m.steps || 0) + '</b><span class="xxj-lf-unit">步 / 目标 8000</span></div>'
      + '<div class="xxj-lf-bar"><i style="width:' + pct + '%"></i></div>'
      + '<div class="xxj-lf-kv"><div><b>' + (m.rest || '—') + '</b><span>静息心率</span></div>'
      + '<div><b>' + (total ? Math.floor(total / 60) + 'h' + (total % 60) : '—') + '</b><span>昨晚睡眠</span></div>'
      + '<div><b>' + totalSpend + '</b><span>今日消费 / 元</span></div></div></div>'
      + (total ? '<div class="xxj-lf-card"><p class="xxj-lf-lab">睡眠<em>' + hm(m.bed) + ' → ' + hm(m.wake) + '</em></p>'
        + '<div class="xxj-lf-sleep-bar"><i class="deep" style="width:' + Math.round(deep / total * 100) + '%"></i>'
        + '<i class="light" style="width:' + Math.round(light / total * 100) + '%"></i>'
        + '<i class="awake" style="width:' + Math.round(awake / total * 100) + '%"></i></div>'
        + '<div class="xxj-lf-sleep-line"><span>深睡 ' + deep + ' 分</span><span>浅睡 ' + light + ' 分</span>'
        + '<span>清醒 ' + awake + ' 分</span></div></div>' : '');
  }

  function meForm(m) {
    m = m || {};
    return '<div class="xxj-lf-card"><p class="xxj-lf-lab">我的手环<em>手动录入</em></p>'
      + '<div class="xxj-lf-form">'
      + '<label><span>设备名</span><input class="xxj-lf-input" data-me="device" value="' + esc(m.device || '') + '" placeholder="如 华为手环 9"></label>'
      + '<label><span>步数</span><input class="xxj-lf-input" data-me="steps" inputmode="numeric" value="' + esc(m.steps || '') + '"></label>'
      + '<label><span>入睡</span><input class="xxj-lf-input" data-me="bed" value="' + esc(m.bed ? hm(m.bed) : '') + '" placeholder="23:40"></label>'
      + '<label><span>起床</span><input class="xxj-lf-input" data-me="wake" value="' + esc(m.wake ? hm(m.wake) : '') + '" placeholder="06:30"></label>'
      + '<label><span>深睡分钟</span><input class="xxj-lf-input" data-me="deep" inputmode="numeric" value="' + esc(m.deep || '') + '"></label>'
      + '<label><span>清醒分钟</span><input class="xxj-lf-input" data-me="awake" inputmode="numeric" value="' + esc(m.awake || '') + '"></label>'
      + '<label><span>静息心率</span><input class="xxj-lf-input" data-me="rest" inputmode="numeric" value="' + esc(m.rest || '') + '"></label>'
      + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:10px">'
      + '<button class="xxj-lf-btn" data-me-save>保存</button>'
      + '<button class="xxj-lf-btn" data-me-clear>清空</button></div>'
      + '<div class="xxj-lf-form" style="margin-top:10px">'
      + '<label><span>角色 A</span><input class="xxj-lf-input" data-me-name="wsh" value="' + esc(names.wsh || '') + '" placeholder="填角色 A 的名字（小米手环）"></label>'
      + '<label><span>角色 B</span><input class="xxj-lf-input" data-me-name="whd" value="' + esc(names.whd || '') + '" placeholder="填角色 B 的名字（Apple Watch）"></label>'
      + '</div>'
      + '<p class="xxj-lf-tip">角色名字导入人设后再填，只存在这台手机上。</p>'
      + '<p class="xxj-lf-tip">华为手环/手表用的是私有协议，不广播标准心率服务，网页端（Web Bluetooth）扫不到；'
      + '苹果健康可以一次性导出 XML，但也要在手机上转成上面的字段。所以这里用手动录入 + 导入，省得给你一个点了没反应的假按钮。</p>'
      + '<div class="xxj-lf-form" style="margin-top:10px">'
      + '<label><span>粘贴导入</span><textarea class="xxj-lf-input" data-me-import style="min-height:74px;resize:vertical;font-family:ui-monospace,monospace;line-height:1.5" '
      + 'placeholder="CSV 一行：日期,步数,静息心率,入睡,起床,深睡分钟,清醒分钟&#10;或 JSON：{&quot;steps&quot;:8342,&quot;rest&quot;:62,&quot;bed&quot;:&quot;23:40&quot;,&quot;wake&quot;:&quot;06:25&quot;,&quot;deep&quot;:72,&quot;awake&quot;:18}"></textarea></label>'
      + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:10px">'
      + '<label class="xxj-lf-btn" style="flex:1;text-align:center;cursor:pointer;margin:0">选择文件导入'
      + '<input type="file" accept=".json,.csv,.txt" data-me-file hidden></label>'
      + '<button class="xxj-lf-btn" data-me-do-import>解析并填入</button></div>'
      + '</div>';
  }

  function render() {
    var body = document.getElementById('xxj-lf-body');
    if (!body) return;
    var tabs = document.getElementById('xxj-lf-tabs');
    if (tabs) {
      Array.prototype.forEach.call(tabs.querySelectorAll('.xxj-lf-tab'), function (b) {
        b.classList.toggle('on', b.dataset.tab === view);
      });
    }
    if (view === 'me') {
      me = me || loadMe();
      body.innerHTML = (me ? meCards(me) : '') + meForm(me);
      return;
    }
    var p = PEOPLE.filter(function (x) { return x.k === view; })[0] || PEOPLE[0];
    var d = genDay(p, new Date());
    body.innerHTML = todayCards(d, p);
  }

  function ensureEl() {
    var el = document.getElementById('xxj-life');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'xxj-life';
    el.className = 'xxj-life';
    el.innerHTML = '<header class="xxj-lf-top">'
      + '<button type="button" class="xxj-lf-back" data-lf-back>‹ 桌面</button>'
      + '<span class="xxj-lf-title">LIFE</span></header>'
      + '<div class="xxj-lf-tabs" id="xxj-lf-tabs">'
      + PEOPLE.map(function (p) {
        return '<button type="button" class="xxj-lf-tab" data-tab="' + p.k + '">' + personName(p) + '</button>';
      }).join('')
      + '<button type="button" class="xxj-lf-tab" data-tab="me">我</button>'
      + '</div><div class="xxj-lf-body" id="xxj-lf-body"></div>';
    document.body.appendChild(el);
    bind();
    return el;
  }

  function openLife() {
    injectCss();
    var el = ensureEl();
    render();
    el.classList.add('open');
  }
  function closeLife() {
    var el = document.getElementById('xxj-life');
    if (el) el.classList.remove('open');
  }

  function parseHM(v) {
    var m = String(v || '').match(/(\d{1,2})[:：](\d{2})/);
    if (!m) return 0;
    return (+m[1] % 24) * 60 + (+m[2]);
  }

  function parseImport(txt) {
    txt = String(txt || '').trim();
    if (!txt) return null;
    try {
      if (txt.charAt(0) === '{') {
        var j = JSON.parse(txt);
        var bed = parseHM(j.bed || j.sleepStart), wake = parseHM(j.wake || j.sleepEnd);
        var total = (bed && wake) ? ((wake - bed + 1440) % 1440) : 0;
        if (total === 0 && bed && wake) total = 1440;
        return {
          device: j.device || '', steps: parseInt(j.steps, 10) || 0, rest: parseInt(j.rest || j.restingHr, 10) || 0,
          bed: bed, wake: wake, total: total,
          deep: parseInt(j.deep, 10) || 0, awake: parseInt(j.awake, 10) || 0,
          spend: Array.isArray(j.spend) ? j.spend : [], ts: Date.now()
        };
      }
      var line = txt.split(/\r?\n/).filter(function (x) {
        return x.trim() && !/^(日期|date)/i.test(x.trim());
      })[0];
      if (!line) return null;
      var p2 = line.split(',').map(function (x) { return x.trim(); });
      if (p2.length < 5) return null;
      var b2 = parseHM(p2[3]), w2 = parseHM(p2[4]);
      var t2 = (b2 && w2) ? ((w2 - b2 + 1440) % 1440) : 0;
      if (t2 === 0 && b2 && w2) t2 = 1440;
      return {
        device: '', steps: parseInt(p2[1], 10) || 0, rest: parseInt(p2[2], 10) || 0,
        bed: b2, wake: w2, total: t2,
        deep: parseInt(p2[5], 10) || 0, awake: parseInt(p2[7], 10) || 0, spend: [], ts: Date.now()
      };
    } catch (e) { return null; }
  }

  function fillForm(m) {
    var el = ensureEl();
    if (!el || !m) return;
    var set = function (k, v) {
      var i = el.querySelector('[data-me="' + k + '"]');
      if (i) i.value = v == null ? '' : v;
    };
    set('device', m.device);
    set('steps', m.steps || '');
    set('bed', m.bed ? hm(m.bed) : '');
    set('wake', m.wake ? hm(m.wake) : '');
    set('deep', m.deep || '');
    set('awake', m.awake || '');
    set('rest', m.rest || '');
  }

  function bind() {
    var el = ensureEl();
    if (el.dataset.bind === '1') return;
    el.dataset.bind = '1';
    el.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(
        '[data-lf-back],[data-tab],[data-me-save],[data-me-clear],[data-me-do-import]'
      ) : null;
      if (!t) return;
      var d = t.dataset;
      if (d.lfBack !== undefined) { e.preventDefault(); e.stopPropagation(); closeLife(); return; }
      if (d.tab) { e.preventDefault(); e.stopPropagation(); view = d.tab; render(); return; }
      if (d.meSave !== undefined) {
        e.preventDefault(); e.stopPropagation();
        var q = function (k) { var i = el.querySelector('[data-me="' + k + '"]'); return i ? i.value.trim() : ''; };
        var bed = parseHM(q('bed')), wake = parseHM(q('wake'));
        var total = bed && wake ? ((wake - bed + 1440) % 1440) : 0;
        if (total === 0 && bed && wake) total = 1440;
        me = {
          device: q('device'), steps: parseInt(q('steps'), 10) || 0, bed: bed, wake: wake,
          total: total, deep: parseInt(q('deep'), 10) || 0, awake: parseInt(q('awake'), 10) || 0,
          rest: parseInt(q('rest'), 10) || 0, spend: (me && me.spend) || [], ts: Date.now()
        };
        saveMe(me); toast('已保存'); render();
        return;
      }
      if (d.meDoImport !== undefined) {
        e.preventDefault(); e.stopPropagation();
        var ta = el.querySelector('[data-me-import]');
        var r = parseImport(ta ? ta.value : '');
        if (!r) { toast('没看懂这段数据，检查格式'); return; }
        me = r; saveMe(me); fillForm(me); toast('已导入'); render();
        return;
      }
      if (d.meClear !== undefined) {
        e.preventDefault(); e.stopPropagation();
        me = null;
        try { localStorage.removeItem(KEY_ME); } catch (err) {}
        render();
        return;
      }
    }, true);

    el.addEventListener('change', function (e) {
      var f = e.target;
      if (f && f.dataset && f.dataset.meName) {
        names[f.dataset.meName] = (f.value || '').trim();
        try { localStorage.setItem(KEY_NAMES, JSON.stringify(names)); } catch (err) {}
        refreshTabs();
        return;
      }
      if (!f || !f.dataset || !f.dataset.meFile) return;
      var file = f.files && f.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        var r = parseImport(rd.result);
        if (!r) { toast('这个文件没能解析出来'); return; }
        me = r; saveMe(me); fillForm(me); render();
        toast('已导入 ' + (file.name || '文件'));
      };
      rd.readAsText(file);
    }, true);
  }

  /* ===== 主屏：把「漫游」那格换成「生活」，漫游挪到第 2 页末尾 ===== */
  function addTile() {
    var grid = document.getElementById('app-grid');
    if (!grid) return false;
    if (grid.dataset.xxjLife === '1') return true;
    var pages = grid.querySelectorAll('.xxj-pg');
    if (!pages.length) return false;
    var roam = grid.querySelector('.app-tile[data-app="漫游"]');
    if (!roam) return false;

    grid.dataset.xxjLife = '1';
    roam.dataset.app = '生活';
    var ico = roam.querySelector('.app-tile-ico i');
    if (ico) ico.className = 'ph ph-heartbeat';
    var nm = roam.querySelector('.app-tile-name');
    if (nm) nm.textContent = '生活';

    var last = pages[pages.length - 1];
    if (!last.querySelector('.app-tile[data-app="漫游"]')) {
      var btn = document.createElement('button');
      btn.className = 'app-tile';
      btn.type = 'button';
      btn.setAttribute('data-app', '漫游');
      btn.innerHTML = '<span class="app-tile-ico"><i class="ph ph-footprints"></i></span>'
        + '<span class="app-tile-name">漫游</span>';
      last.appendChild(btn);
    }
    return true;
  }

  function bindTile() {
    if (document.__xxjLifeClick) return;
    document.__xxjLifeClick = true;
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('#app-grid [data-app="生活"]') : null;
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      openLife();
    }, true);
  }

  /* ===== 注入上下文：他们能看到你一天的状态 ===== */
  function lifeLine() {
    var d = new Date();
    var out = [];
    PEOPLE.forEach(function (p) {
      var g = genDay(p, d);
      out.push(personName(p) + '（' + p.device + '）今天 ' + g.steps + ' 步，静息心率 ' + g.rest
        + '，昨晚 ' + hm(g.sleep.bed) + '–' + hm(g.sleep.wake) + '（深睡 ' + g.sleep.deep + ' 分'
        + (g.sleep.late ? '，熬夜了' : '') + '）');
    });
    var m = loadMe();
    if (m && m.steps) {
      out.push('我（' + (m.device || '手环') + '）今天 ' + m.steps + ' 步'
        + (m.total ? '，昨晚 ' + hm(m.bed) + '–' + hm(m.wake) + '（深睡 ' + (m.deep || 0) + ' 分）' : '')
        + (m.rest ? '，静息心率 ' + m.rest : ''));
    }
    if (!out.length) return '';
    return '[生活] ' + out.join('；') + '。角色会注意到这些差异，可以自然提起，不要逐条念数据。';
  }

  function installInject() {
    if (window.__xxjLifeFetch) return;
    var orig = window.fetch;
    if (!orig) return;
    window.__xxjLifeFetch = true;
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (/\/chat\/completions/.test(url) && init && typeof init.body === 'string') {
          var line = lifeLine();
          if (line) {
            var body = JSON.parse(init.body);
            if (body && Array.isArray(body.messages)) {
              var has = body.messages.some(function (mg) {
                return mg && typeof mg.content === 'string' && mg.content.indexOf('[生活]') === 0;
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

  var n = 0;
  var iv = setInterval(function () {
    n++;
    if (addTile()) {
      bindTile();
      installInject();
      clearInterval(iv);
    }
    if (n > 400) clearInterval(iv);
  }, 250);
})();
