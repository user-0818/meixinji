/* ============================================================
   study-daily.js —— 「学习」里的每日安排（给没心机加的一层）
   · 晚饭点（默认 18:00）角色把第二天的任务布置好：你填的「每日必做」全上，随机池抽 1 条
   · 随机池里的条目被抽走后不再重复出现（做完就划掉）
   · 角色自己也会给自己布置任务，做完「拍照」上传
   · 每天不定时上传他们在学校做的卷子
   · 晚上（默认 21:30）回家检查你的完成情况，留一段点评
   数据：localStorage xxjStudyDailyV1
   挂载：index.html <head> 一行 <script src="study-daily.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'xxjStudyDailyV1';
  var SUBJ = [
    { k: 'cn', n: '语文' }, { k: 'ma', n: '数学' }, { k: 'en', n: '英语' }, { k: 'ge', n: '地理' },
    { k: 'ph', n: '物理' }, { k: 'ch', n: '化学' }, { k: 'bi', n: '生物' }
  ];
  var WHO = ['A', 'B'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function addDay(s, n) {
    var p = String(s).split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function nowHM() {
    var d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function toast(msg) {
    if (typeof window.toast === 'function') return window.toast(msg);
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:99999;'
      + 'background:rgba(20,24,32,.92);color:#e8eef7;font-size:12px;padding:9px 14px;border-radius:12px;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1600);
  }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------- 数据 ---------- */
  var D = null;

  function blank() {
    return { cfg: { plan: '18:00', check: '21:30', names: { A: '', B: '' } }, ranges: {}, plans: {} };
  }
  function cfg() {
    D.cfg = D.cfg || { plan: '18:00', check: '21:30' };
    D.cfg.names = D.cfg.names || { A: '', B: '' };
    if (!D.cfg.plan) D.cfg.plan = '18:00';
    if (!D.cfg.check) D.cfg.check = '21:30';
    return D.cfg;
  }
  /* 他们俩叫什么：用户自己在设置里填，没填就用「角色A/角色B」 */
  function nameOf(w) {
    var c = cfg().names || {};
    var n = w === 'A' ? c.A : c.B;
    return (n && String(n).trim()) || ('角色' + w);
  }
  function initialOf(w) {
    var n = nameOf(w);
    return n.slice(0, 1);
  }
  function load() {
    var d = blank();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) d = JSON.parse(raw) || d;
    } catch (e) { d = blank(); }
    d.cfg = d.cfg || { plan: '18:00', check: '21:30', names: { A: '', B: '' } };
    d.cfg.names = d.cfg.names || { A: '', B: '' };
    d.ranges = d.ranges || {};
    d.plans = d.plans || {};
    SUBJ.forEach(function (s) {
      var r = d.ranges[s.k] = d.ranges[s.k] || { must: [], pool: [] };
      r.must = Array.isArray(r.must) ? r.must : [];
      r.pool = (Array.isArray(r.pool) ? r.pool : []).map(function (x) {
        return typeof x === 'string' ? { t: x, u: false } : { t: x.t, u: !!x.u };
      });
    });
    return d;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {}
  }
  function planOf(date) {
    if (!D.plans[date]) {
      D.plans[date] = { tasks: {}, charTasks: [], mats: [], check: null, plannedAt: null };
    }
    var p = D.plans[date];
    p.tasks = p.tasks || {};
    p.charTasks = p.charTasks || [];
    p.mats = p.mats || [];
    return p;
  }
  function hasRange() {
    return SUBJ.some(function (s) {
      var r = D.ranges[s.k];
      return (r.must && r.must.length) || (r.pool && r.pool.length);
    });
  }

  /* ---------- 生成：第二天的任务 ---------- */
  function drawFromPool(k) {
    var r = D.ranges[k];
    var free = (r.pool || []).filter(function (x) { return !x.u; });
    if (!free.length) return null;
    var pick = rnd(free);
    pick.u = true;                       /* 抽走就不再重复 */
    return pick.t;
  }

  function buildPlan(date) {
    var p = planOf(date);
    if (!p.tasks || Object.keys(p.tasks).length === 0) {
      SUBJ.forEach(function (s) {
        var r = D.ranges[s.k];
        var arr = [];
        (r.must || []).forEach(function (t) { arr.push({ t: t, src: 'must', d: false }); });
        var one = drawFromPool(s.k);
        if (one) arr.push({ t: one, src: 'pool', d: false });
        if (arr.length) p.tasks[s.k] = arr;
      });
      p.plannedAt = nowHM();
    }
    save();
    return p;
  }

  /* ---------- 生成：角色自己的任务 ---------- */
  var CHAR_T = {
    cn: ['背《逍遥游》第二段', '整理一篇文言实词', '写一段 200 字随笔'],
    ma: ['错题本重做 5 题', '一张导数专项小卷', '整理三角函数公式卡'],
    en: ['背 30 个高频词', '精读一篇阅读', '抄写一篇范文句型'],
    ge: ['复盘一张等压线图', '整理区域地理笔记', '背一遍时区换算'],
    ph: ['受力分析 10 题', '整理电路实验步骤', '重做电磁感应错题'],
    ch: ['默写 20 个方程式', '整理实验现象表', '重做有机推断一道'],
    bi: ['背一遍细胞结构', '整理遗传图谱', '复习光合作用曲线']
  };
  function buildCharTasks(date) {
    var p = planOf(date);
    if (p.charTasks.length) return;
    var used = [];
    WHO.forEach(function (w) {
      var pool = SUBJ.filter(function (x) { return used.indexOf(x.k) < 0; });
      if (!pool.length) pool = SUBJ;
      var s2 = rnd(pool);
      used.push(s2.k);
      p.charTasks.push({
        who: w, subj: s2.k, t: rnd((CHAR_T[s2.k] || ['刷一张卷子'])),
        d: false, photo: null, at: null
      });
    });
    save();
  }

  /* 他们自己写完交上来：到晚上检查点就补「已完成 + 照片」 */
  var CHAR_NOTE = ['拍了一张，字有点潦草', '写完了，帮我看看对不对', '这张是重写过的', '老师批过了'];
  function markCharDone(date) {
    var p = planOf(date);
    var ch = false;
    p.charTasks.forEach(function (c) {
      if (c.d) return;
      c.d = true;
      c.at = nowHM();
      c.photo = { note: rnd(CHAR_NOTE) };
      ch = true;
    });
    if (ch) save();
  }

  /* ---------- 生成：他们上传的卷子 ---------- */
  var PAPER = {
    cn: ['文言文阅读专项', '古诗默写小测', '现代文阅读周测'],
    ma: ['导数与不等式专项', '立体几何周测', '概率统计小卷'],
    en: ['完形填空专项', '语法填空小卷', '阅读理解限时练'],
    ge: ['等压线判读小测', '区域地理周测', '时区换算练习'],
    ph: ['受力分析小卷', '电路实验报告', '电磁感应周测'],
    ch: ['方程式默写小卷', '实验现象推断', '有机推断专项'],
    bi: ['细胞结构小测', '遗传规律周测', '光合呼吸曲线']
  };
  var SCORE = ['92', '88', '85', '78', '95', '83'];

  function buildMat(date, force) {
    var p = planOf(date);
    if (p.mats.length && !force) return;
    var k = rnd(SUBJ).k;
    var s = SUBJ.filter(function (x) { return x.k === k; })[0];
    var score = rnd(SCORE);
    var wrong = String(Math.max(1, Math.round((100 - +score) / 12)));
    p.mats.push({
      subj: k, subjName: s.n,
      title: rnd(PAPER[k] || ['一张练习卷']),
      score: score, wrong: wrong,
      who: rnd(WHO),
      at: nowHM(),
      lines: ['选择题错 2，填空错 1', '最后一道大题没写完', '计算步骤有点跳', '审题慢了']
    });
    save();
  }

  /* ---------- 生成：晚上检查 ---------- */
  function stat(date) {
    var p = planOf(date);
    var total = 0, done = 0, left = [];
    SUBJ.forEach(function (s) {
      (p.tasks[s.k] || []).forEach(function (x) {
        total++; if (x.d) done++; else left.push(s.n + '·' + x.t);
      });
    });
    return { total: total, done: done, left: left };
  }

  function buildCheck(date) {
    var p = planOf(date);
    if (p.check) return;
    var st = stat(date);
    /* 他们自己的任务到家时也差不多做完了 */
    p.charTasks.forEach(function (c, i) {
      if (!c.d) {
        c.d = true; c.at = nowHM();
        c.photo = { tilt: (i % 2 ? 1 : -1), note: rnd(['写完啦', '这张有点难', '最后两题蒙的', '给你看看']) };
      }
    });
    var who = rnd(WHO);
    var msg;
    if (!st.total) {
      msg = '今天没给你排任务，明天开始就有了。早点睡。';
    } else if (st.done === st.total) {
      msg = '全做完了，' + st.total + ' 条一条没落。' + rnd(['不错，明天加一点。', '这次可以。', '继续保持。']);
    } else {
      msg = '检查了一遍，' + st.total + ' 条里做完 ' + st.done + ' 条。还差：'
        + st.left.slice(0, 3).join('、') + (st.left.length > 3 ? ' 等' : '') + '。'
        + rnd(['明早补上。', '别拖到明天晚上。', '差的不多，今晚能补就补。']);
    }
    p.check = { at: nowHM(), who: who, msg: msg, done: st.done, total: st.total };
    save();
  }

  /* ---------- 定时器：按点自动跑 ---------- */
  function duePlan() {
    /* 到点就该把「明天」排好 */
    if (nowHM() >= D.cfg.plan) {
      var tomorrow = addDay(today(), 1);
      var p = planOf(tomorrow);
      if (!p.plannedAt && hasRange()) return tomorrow;
    }
    /* 今天没有安排（比如昨晚 App 没开着），补一份 */
    var tp = planOf(today());
    if (!tp.plannedAt && hasRange()) return today;
    return null;
  }

  function tick() {
    if (!D) return;
    if (!hasRange()) return;
    var t = today();
    /* 今天还没排（第一次用 / 昨晚没开 App）→ 补一份，不然这一天是空的 */
    var tp = planOf(t);
    if (!tp.plannedAt && nowHM() >= '06:00') { buildPlan(t); buildCharTasks(t); }
    /* 到点排明天 */
    if (nowHM() >= D.cfg.plan) {
      var dm = addDay(t, 1);
      var pm = planOf(dm);
      if (!pm.plannedAt) { buildPlan(dm); buildCharTasks(dm); }
    }
    /* 每天至少一张卷子 */
    var p2 = planOf(t);
    if (!p2.mats.length && nowHM() >= '09:00') buildMat(t);
    /* 到点检查：他们先把自己那份交了，再来看我的 */
    if (nowHM() >= D.cfg.check) {
      markCharDone(t);
      var cp = planOf(t);
      if (!cp.check && cp.plannedAt) buildCheck(t);
    }
    save();
    refreshBadge();
    if (document.getElementById('xxj-st2') && document.getElementById('xxj-st2').classList.contains('open')) render();
  }

  /* ---------- 样式 ---------- */
  var CSS = [
    '.xxj-st2{position:fixed;inset:0;z-index:74;display:none;flex-direction:column;',
    'background:var(--bg-body,#0f1218);color:var(--text-main,#e6edf7);',
    'font-family:-apple-system,"PingFang SC",system-ui,sans-serif;}',
    '.xxj-st2.open{display:flex;}',
    '.xxj-st2-top{flex:none;display:flex;align-items:center;gap:10px;padding:14px 16px 6px;}',
    '.xxj-st2-back{border:0;background:transparent;color:var(--accent,#5b7fa6);font-size:12px;padding:6px 2px;cursor:pointer;}',
    '.xxj-st2-tag{margin-left:auto;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.18em;opacity:.5;}',
    '.xxj-st2-body{flex:1;min-height:0;overflow-y:auto;padding:4px 16px 28px;-webkit-overflow-scrolling:touch;}',
    '.xxj-st2-card{background:var(--bg-card,#1c212a);border:1px solid var(--line,rgba(255,255,255,.10));',
    'border-radius:18px;padding:13px 14px;margin-bottom:10px;}',
    '.xxj-st2-h{display:flex;align-items:baseline;gap:8px;margin:0 0 9px;}',
    '.xxj-st2-h b{font-size:12.5px;font-weight:500;}',
    '.xxj-st2-h span{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-sub,#6d727b);}',
    '.xxj-st2-h em{margin-left:auto;font-style:normal;font-size:10px;color:var(--text-sub,#6d727b);}',
    '.xxj-st2-sub{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-sub,#6d727b);',
    'margin:14px 0 7px;}',
    '.xxj-st2-task{display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid rgba(var(--tint-rgb,58,92,137),.12);}',
    '.xxj-st2-task:first-of-type{border-top:0;}',
    '.xxj-st2-ck{width:20px;height:20px;flex:none;border-radius:7px;border:1px solid rgba(var(--tint-rgb,58,92,137),.35);',
    'background:transparent;color:var(--accent,#5b7fa6);font-size:11px;line-height:1;cursor:pointer;padding:0;}',
    '.xxj-st2-ck.on{background:var(--accent,#5b7fa6);border-color:var(--accent,#5b7fa6);color:#fff;}',
    '.xxj-st2-t{flex:1;min-width:0;font-size:11.5px;line-height:1.4;}',
    '.xxj-st2-t em{display:inline-block;font-style:normal;font-size:8px;padding:1px 4px;border-radius:4px;margin-right:5px;',
    'background:rgba(var(--tint-rgb,58,92,137),.14);color:var(--accent,#5b7fa6);vertical-align:1px;}',
    '.xxj-st2-task.on .xxj-st2-t{opacity:.45;text-decoration:line-through;}',
    '.xxj-st2-empty{font-size:11px;color:var(--text-sub,#6d727b);opacity:.75;line-height:1.8;margin:2px 0 0;}',
    '.xxj-st2-btn{border:1px solid rgba(var(--tint-rgb,58,92,137),.22);background:rgba(var(--tint-rgb,58,92,137),.07);',
    'color:var(--accent,#5b7fa6);border-radius:10px;font-size:11px;padding:7px 11px;cursor:pointer;font-family:inherit;}',
    '.xxj-st2-row{display:flex;gap:8px;align-items:center;margin-top:10px;}',
    /* 卷子卡：白纸 + 手写感 */
    '.xxj-st2-paper{position:relative;border-radius:12px;background:#f6f4ee;color:#33302a;padding:10px 11px;',
    'box-shadow:0 3px 10px rgba(0,0,0,.18);overflow:hidden;}',
    '.xxj-st2-paper:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(180deg,',
    'rgba(120,110,95,.18) 0 1px,transparent 1px 18px);opacity:.5;}',
    '.xxj-st2-paper:after{content:"";position:absolute;inset:0;background:radial-gradient(110% 70% at 20% 0%,',
    'rgba(255,255,255,.5),transparent 60%);}',
    '.xxj-st2-pt{position:relative;z-index:2;display:flex;align-items:baseline;gap:6px;}',
    '.xxj-st2-pt b{font-size:11.5px;}',
    '.xxj-st2-pt span{font-size:8.5px;opacity:.7;}',
    '.xxj-st2-pm{position:relative;z-index:2;font-size:9px;margin-top:5px;opacity:.72;line-height:1.6;}',
    '.xxj-st2-score{position:relative;z-index:2;position:absolute;right:9px;top:9px;color:#c1474f;font-size:15px;',
    'font-family:"Space Mono",monospace;transform:rotate(-8deg);}',
    '.xxj-st2-chat{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}',
    '.xxj-st2-ava{width:22px;height:22px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:9.5px;',
    'background:rgba(var(--tint-rgb,58,92,137),.16);color:var(--accent,#5b7fa6);}',
    '.xxj-st2-bub{background:rgba(var(--tint-rgb,58,92,137),.09);border-radius:12px;border-top-left-radius:4px;',
    'padding:7px 10px;font-size:11px;line-height:1.55;max-width:82%;}',
    '.xxj-st2-tag2{font-size:8.5px;color:var(--text-sub,#6d727b);margin:0 0 3px;}',
    /* 设置：任务范围 */
    '.xxj-st2-set{display:flex;flex-direction:column;gap:12px;}',
    '.xxj-st2-sel{display:flex;gap:6px;flex-wrap:wrap;}',
    '.xxj-st2-sel button{border:1px solid rgba(var(--tint-rgb,58,92,137),.18);background:transparent;',
    'color:var(--text-sub,#6d727b);font-size:11px;padding:6px 10px;border-radius:9px;cursor:pointer;font-family:inherit;}',
    '.xxj-st2-sel button.on{background:var(--accent,#5b7fa6);border-color:var(--accent,#5b7fa6);color:#fff;}',
    '.xxj-st2-item{display:flex;align-items:center;gap:8px;font-size:11px;padding:6px 0;',
    'border-top:1px solid rgba(var(--tint-rgb,58,92,137),.12);}',
    '.xxj-st2-item i{font-style:normal;flex:1;min-width:0;}',
    '.xxj-st2-item .u{font-size:8.5px;color:var(--text-sub,#6d727b);}',
    '.xxj-st2-item del{color:var(--accent,#5b7fa6);font-size:13px;cursor:pointer;text-decoration:none;opacity:.7;}',
    '.xxj-st2-add{display:flex;gap:6px;margin-top:8px;}',
    '.xxj-st2-in{flex:1;min-width:0;border:1px solid rgba(var(--tint-rgb,58,92,137),.18);background:rgba(var(--tint-rgb,58,92,137),.05);',
    'color:var(--text-main,#17191c);border-radius:10px;font-size:11.5px;padding:8px 10px;font-family:inherit;outline:none;}',
    '.xxj-st2-photo{margin-top:8px;border-radius:10px;overflow:hidden;background:#f7f6f2;padding:8px;',
    'box-shadow:0 3px 10px rgba(0,0,0,.16);transform:rotate(-1.2deg);}',
    '.xxj-st2-photo b{font-size:10px;color:#3a3833;}',
    '.xxj-st2-photo p{font-size:9px;color:#6b6760;margin:4px 0 0;line-height:1.6;}',
    '.xxj-st2-badge{display:inline-block;min-width:7px;height:7px;border-radius:50%;background:#d08a5a;margin-left:6px;}'
  ].join('');

  function injectCss() {
    if (document.getElementById('xxj-st2-css')) return;
    var s = document.createElement('style');
    s.id = 'xxj-st2-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- 界面 ---------- */
  var view = 'day';   /* day | range */
  var rangeSub = 'cn';

  function dayHtml() {
    var d = today();
    var p = planOf(d);
    var st = stat(d);
    var html = '';

    /* 概览 */
    html += '<div class="xxj-st2-card"><div class="xxj-st2-h"><b>今天 · ' + d.slice(5).replace('-', '/')
      + '</b><span>Day</span><em>' + st.done + '/' + st.total + '</em></div>';
    if (!hasRange()) {
      html += '<p class="xxj-st2-empty">还没填任务范围。点下面的「任务范围」，把每科的「每日必做」和随机池填进去，'
        + '晚饭点我就会照着你填的布置第二天的任务。</p>';
    } else if (!p.plannedAt) {
      html += '<p class="xxj-st2-empty">今天的任务还没布置（到 ' + esc(D.cfg.plan) + ' 会自动排）。</p>';
    } else {
      html += '<p class="xxj-st2-empty">布置于 ' + esc(p.plannedAt) + ' · 完成 ' + st.done + '/' + st.total + '</p>';
    }
    html += '<div class="xxj-st2-row"><button class="xxj-st2-btn" data-st2-go="range">设置 · 任务范围</button>'
      + '<button class="xxj-st2-btn" data-st2-plan>现在排一次</button></div></div>';

    /* 我的任务 */
    html += '<div class="xxj-st2-card"><div class="xxj-st2-h"><b>我的任务</b><span>Mine</span></div>';
    var any = false;
    SUBJ.forEach(function (s) {
      var arr = p.tasks[s.k] || [];
      if (!arr.length) return;
      any = true;
      html += '<div class="xxj-st2-sub">' + s.n + '</div>';
      arr.forEach(function (x, i) {
        html += '<div class="xxj-st2-task' + (x.d ? ' on' : '') + '">'
          + '<button class="xxj-st2-ck' + (x.d ? ' on' : '') + '" data-st2-ck="' + s.k + '" data-i="' + i + '">'
          + (x.d ? '✓' : '') + '</button>'
          + '<span class="xxj-st2-t"><em>' + (x.src === 'pool' ? '随机' : '必做') + '</em>' + esc(x.t) + '</span></div>';
      });
    });
    if (!any) html += '<p class="xxj-st2-empty">今天还没有任务。</p>';
    html += '</div>';

    /* 检查 */
    if (p.check) {
      html += '<div class="xxj-st2-card"><div class="xxj-st2-h"><b>晚上检查</b><span>Check</span><em>'
        + esc(p.check.at) + '</em></div>'
        + '<div class="xxj-st2-chat"><span class="xxj-st2-ava">' + esc(initialOf(p.check.who)) + '</span>'
        + '<span class="xxj-st2-bub">' + esc(p.check.msg) + '</span></div></div>';
    }

    /* 他们的任务 */
    if (p.charTasks.length) {
      html += '<div class="xxj-st2-card"><div class="xxj-st2-h"><b>他们给自己布置的</b><span>Theirs</span></div>';
      p.charTasks.forEach(function (c) {
        var s = SUBJ.filter(function (x) { return x.k === c.subj; })[0];
        html += '<div class="xxj-st2-task' + (c.d ? ' on' : '') + '" style="flex-wrap:wrap">'
          + '<span class="xxj-st2-ava">' + esc(initialOf(c.who)) + '</span>'
          + '<span class="xxj-st2-t">' + (s ? s.n + ' · ' : '') + esc(c.t) + '</span>'
          + '<span class="u" style="font-size:9px;color:var(--text-sub)">' + (c.d ? '已完成' : '在写') + '</span>';
        if (c.d) {
          html += '<div class="xxj-st2-photo" style="width:100%"><b>他交上来的照片</b>'
            + '<p>' + esc(nameOf(c.who)) + ' 拍了一张：' + esc(c.t) + (c.photo && c.photo.note ? ' · ' + esc(c.photo.note) : '') + '</p></div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    /* 他们的卷子 */
    if (p.mats.length) {
      html += '<div class="xxj-st2-card"><div class="xxj-st2-h"><b>他们传的卷子</b><span>Papers</span><em>'
        + p.mats.length + ' 份</em></div>';
      p.mats.forEach(function (m) {
        html += '<div class="xxj-st2-paper"><span class="xxj-st2-score">' + esc(m.score) + '</span>'
          + '<div class="xxj-st2-pt"><b>' + esc(m.title) + '</b><span>' + esc(m.subjName) + ' · ' + esc(nameOf(m.who)) + ' · ' + esc(m.at) + '</span></div>'
          + '<div class="xxj-st2-pm">错 ' + esc(m.wrong) + ' 处 · ' + esc(rnd(m.lines)) + '</div></div>';
      });
      html += '</div>';
    }
    return html;
  }

  function rangeHtml() {
    var r = D.ranges[rangeSub];
    var s = SUBJ.filter(function (x) { return x.k === rangeSub; })[0];
    var html = '<div class="xxj-st2-card"><div class="xxj-st2-h"><b>任务范围 · 时间 · 名字</b><span>Settings</span></div>'
      + '<p class="xxj-st2-empty">「每日必做」每天全上；「随机池」每天抽一条，抽过的不再出现。</p>'
      + '<div class="xxj-st2-sel">' + SUBJ.map(function (x) {
        return '<button data-st2-sub="' + x.k + '"' + (x.k === rangeSub ? ' class="on"' : '') + '>' + x.n + '</button>';
      }).join('') + '</div></div>';

    html += '<div class="xxj-st2-card"><div class="xxj-st2-h"><b>' + s.n + ' · 每日必做</b><em>'
      + r.must.length + ' 条</em></div>';
    html += r.must.length ? r.must.map(function (t, i) {
      return '<div class="xxj-st2-item"><i>' + esc(t) + '</i>'
        + '<del data-st2-delmust="' + i + '">×</del></div>';
    }).join('') : '<p class="xxj-st2-empty">还没填</p>';
    html += '<div class="xxj-st2-add"><input class="xxj-st2-in" data-st2-inmust placeholder="比如：背一首古诗">'
      + '<button class="xxj-st2-btn" data-st2-addmust>＋</button></div></div>';

    html += '<div class="xxj-st2-card"><div class="xxj-st2-h"><b>' + s.n + ' · 随机池</b><em>'
      + r.pool.filter(function (x) { return !x.u; }).length + ' 条可用</em></div>';
    html += r.pool.length ? r.pool.map(function (x, i) {
      return '<div class="xxj-st2-item"><i>' + esc(x.t) + (x.u ? ' <span class="u">已抽过</span>' : '') + '</i>'
        + '<del data-st2-delpool="' + i + '">×</del></div>';
    }).join('') : '<p class="xxj-st2-empty">还没填</p>';
    html += '<div class="xxj-st2-add"><input class="xxj-st2-in" data-st2-inpool placeholder="比如：默写十个词">'
      + '<button class="xxj-st2-btn" data-st2-addpool>＋</button></div></div>';

    html += '<div class="xxj-st2-card"><div class="xxj-st2-h"><b>时间</b><span>Time</span></div>'
      + '<div class="xxj-st2-row"><span style="font-size:11px">布置</span>'
      + '<input class="xxj-st2-in" data-st2-tplan value="' + esc(D.cfg.plan) + '" placeholder="18:00" style="max-width:80px">'
      + '<span style="font-size:11px">检查</span>'
      + '<input class="xxj-st2-in" data-st2-tcheck value="' + esc(D.cfg.check) + '" placeholder="21:30" style="max-width:80px">'
      + '<button class="xxj-st2-btn" data-st2-savet>存</button></div>'
      + '<div class="xxj-st2-row"><span style="font-size:11px">名字</span>'
      + '<input class="xxj-st2-in" data-st2-na value="' + esc(cfg().names.A || '') + '" placeholder="角色A 叫什么">'
      + '<input class="xxj-st2-in" data-st2-nb value="' + esc(cfg().names.B || '') + '" placeholder="角色B 叫什么">'
      + '</div></div>';
    return html;
  }

  function render() {
    var body = document.getElementById('xxj-st2-body');
    if (!body) return;
    body.innerHTML = view === 'day' ? dayHtml() : rangeHtml();
  }

  function ensureUI() {
    var el = document.getElementById('xxj-st2');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'xxj-st2';
    el.className = 'xxj-st2';
    el.innerHTML = '<header class="xxj-st2-top">'
      + '<button class="xxj-st2-back" data-st2-back data-back>‹ 学习</button>'
      + '<span class="xxj-st2-tag">DAILY</span></header>'
      + '<div class="xxj-st2-body" id="xxj-st2-body"></div>';
    document.body.appendChild(el);
    bind();
    return el;
  }

  function open() {
    injectCss();
    ensureUI();
    D = load();
    view = 'day';
    tick();
    render();
    document.getElementById('xxj-st2').classList.add('open');
  }
  function close() {
    var el = document.getElementById('xxj-st2');
    if (el) el.classList.remove('open');
    refreshBadge();
  }
  window.xxjStudyDailyOpen = open;

  function bind() {
    var el = document.getElementById('xxj-st2');
    if (el.dataset.bind === '1') return;
    el.dataset.bind = '1';
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-st2-back]')) {
        if (view === 'range') { view = 'day'; render(); return; }
        close(); return;
      }
      var go = t.closest('[data-st2-go]');
      if (go) { view = 'range'; render(); return; }
      if (t.closest('[data-st2-plan]')) {
        if (!hasRange()) { toast('先去「任务范围」填点东西'); return; }
        buildPlan(addDay(today(), 1)); buildCharTasks(addDay(today(), 1)); buildPlan(today()); buildCharTasks(today()); buildMat(today());
        save(); render(); toast('排好了'); return;
      }
      var ck = t.closest('[data-st2-ck]');
      if (ck) {
        var k = ck.getAttribute('data-st2-ck'), i = +ck.getAttribute('data-i');
        var arr = planOf(today()).tasks[k] || [];
        if (arr[i]) { arr[i].d = !arr[i].d; save(); render(); }
        return;
      }
      var sub = t.closest('[data-st2-sub]');
      if (sub) { rangeSub = sub.getAttribute('data-st2-sub'); render(); return; }
      var am = t.closest('[data-st2-addmust]');
      if (am) {
        var im = el.querySelector('[data-st2-inmust]');
        var v = im && im.value.trim();
        if (!v) return;
        D.ranges[rangeSub].must.push(v); save(); render(); return;
      }
      var ap = t.closest('[data-st2-addpool]');
      if (ap) {
        var ip = el.querySelector('[data-st2-inpool]');
        var v2 = ip && ip.value.trim();
        if (!v2) return;
        D.ranges[rangeSub].pool.push({ t: v2, u: false }); save(); render(); return;
      }
      var dm = t.closest('[data-st2-delmust]');
      if (dm) { D.ranges[rangeSub].must.splice(+dm.getAttribute('data-st2-delmust'), 1); save(); render(); return; }
      var dp = t.closest('[data-st2-delpool]');
      if (dp) { D.ranges[rangeSub].pool.splice(+dp.getAttribute('data-st2-delpool'), 1); save(); render(); return; }
      if (t.closest('[data-st2-savet]')) {
        var tp = el.querySelector('[data-st2-tplan]'), tc = el.querySelector('[data-st2-tcheck]');
        var na = el.querySelector('[data-st2-na]'), nb = el.querySelector('[data-st2-nb]');
        if (na) cfg().names.A = na.value.trim();
        if (nb) cfg().names.B = nb.value.trim();
        var ok = function (s) { return /^\d{1,2}:\d{2}$/.test(s); };
        if (tp && ok(tp.value.trim())) D.cfg.plan = tp.value.trim();
        if (tc && ok(tc.value.trim())) D.cfg.check = tc.value.trim();
        save(); render(); toast('时间存好了'); return;
      }
    }, false);
  }

  /* ---------- 在学习 App 首页挂一个入口 ---------- */
  function refreshBadge() {
    var btn = document.getElementById('xxj-st2-entry');
    if (!btn) return;
    var p = planOf(today());
    var st = stat(today());
    var txt = st.total ? ('今日 ' + st.done + '/' + st.total) : (p.charTasks.length ? '今天有安排' : '今天还没排');
    btn.querySelector('.xxj-st2-entry-t').textContent = txt;
  }

  function mountEntry() {
    var body = document.getElementById('xxj-sd-body');
    if (!body) return false;
    if (document.getElementById('xxj-st2-entry')) { refreshBadge(); return true; }
    if (!body.querySelector('.xxj-sd-grid')) return false;  /* 只在首页挂 */
    var card = document.createElement('button');
    card.type = 'button';
    card.id = 'xxj-st2-entry';
    card.className = 'xxj-st2-card';
    card.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;text-align:left;cursor:pointer;'
      + 'font-family:inherit;color:inherit;margin:0 0 10px;';
    card.innerHTML = '<span style="flex:1"><b style="display:block;font-size:12.5px;font-weight:500">今日安排</b>'
      + '<span class="xxj-st2-entry-t" style="display:block;font-size:10px;margin-top:3px;opacity:.6">今天还没排</span></span>'
      + '<span style="font-size:15px;color:var(--accent,#5b7fa6);opacity:.7">›</span>';
    card.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(); });
    body.insertBefore(card, body.firstChild);
    refreshBadge();
    return true;
  }

  /* 学习 App 每次重渲染都会清空 body，这里盯着它 */
  function watch() {
    var host = document.getElementById('xxj-study');
    if (!host) return false;
    if (host.dataset.st2watch === '1') return true;
    host.dataset.st2watch = '1';
    new MutationObserver(function () {
      setTimeout(mountEntry, 0);
    }).observe(host, { childList: true, subtree: true });
    mountEntry();
    return true;
  }

  function boot() {
    injectCss();
    D = load();
    tick();
    watch();
    refreshBadge();
  }

  var n = 0;
  var iv = setInterval(function () {
    n++;
    watch();
    if (document.getElementById('xxj-study') && document.getElementById('xxj-st2-entry')) clearInterval(iv);
    if (n > 200) clearInterval(iv);
  }, 300);

  if (document.readyState !== 'loading') setTimeout(boot, 0);
  else document.addEventListener('DOMContentLoaded', boot);

  /* 每分钟跑一次定时逻辑；回到前台也补一次 */
  setInterval(function () { D = load(); tick(); refreshBadge(); }, 60000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { D = load(); tick(); refreshBadge(); if (document.getElementById('xxj-st2').classList.contains('open')) render(); }
  });
})();
