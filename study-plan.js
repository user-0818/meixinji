/* ============================================================
   study-plan.js —— 学习 App 的「布置 · 抽选 · 试卷 · 检查」扩展
   依赖：app-grid.js 已渲染 #xxj-sd-body（学习 App 首页）
   挂载：index.html <head> 一行 <script src="study-plan.js"></script>
   数据：localStorage 'xxjPlanV1'，只存本机
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'xxjPlanV1';
  var LIFE_NAMES = 'xxjLife.Names';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function minuteOf(d) { return d.getHours() * 60 + d.getMinutes(); }
  function shiftDay(k, n) {
    var p = k.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return dayKey(d);
  }
  function mdLabel(k) {
    var p = k.split('-');
    return (+p[1]) + '月' + (+p[2]) + '日';
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
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
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }

  /* ---------- 角色 ---------- */
  var CHARS = [
    { k: 'wsh', tag: '角色 A', subs: ['物理', '化学', '生物', '数学'] },
    { k: 'whd', tag: '角色 B', subs: ['地理', '数学', '物理', '英语'] }
  ];
  function charName(k) {
    var n = {};
    try { n = JSON.parse(localStorage.getItem(LIFE_NAMES) || '{}') || {}; } catch (e) {}
    var p = CHARS.filter(function (x) { return x.k === k; })[0];
    return (n[k] || '').trim() || (p ? p.tag : '他');
  }

  /* ---------- 状态 ---------- */
  var P = null;

  function blank() {
    return {
      pool: { must: [], draw: [] },
      assigns: {},      /* 目标日期 -> {givenAt, items:[{id,txt,type,state}]} */
      chars: {},        /* 日期 -> { wsh:[...], whd:[...] } */
      papers: [],       /* 上传的卷子 */
      reviews: {},      /* 日期 -> {at, pct, done, total, comment, by} */
      seen: {}
    };
  }
  function load() {
    var d = blank();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var o = JSON.parse(raw) || {};
        d.pool.must = (o.pool && o.pool.must) || [];
        d.pool.draw = ((o.pool && o.pool.draw) || []).map(function (x) {
          return typeof x === 'string' ? { t: x, st: 'idle' } : { t: String(x.t), st: x.st || 'idle' };
        });
        d.assigns = o.assigns || {};
        d.chars = o.chars || {};
        d.papers = o.papers || [];
        d.reviews = o.reviews || {};
        d.seen = o.seen || {};
      }
    } catch (e) {}
    return d;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {}
  }

  /* ---------- 生成：布置明天的任务（晚饭时间 17:30 起） ---------- */
  var GIVE_MIN = 17 * 60 + 30;

  function makeAssign(target, now) {
    var r = rng(hash('assign#' + target));
    var items = [];
    P.pool.must.forEach(function (t, i) {
      items.push({ id: 'm' + i + '_' + hash(t), txt: t, type: 'must', state: 'todo' });
    });
    /* 随机池：抽一项还没抽过的 */
    var cand = P.pool.draw.filter(function (x) { return x.st === 'idle'; });
    if (cand.length) {
      var d = pick(r, cand);
      d.st = 'drawn';
      items.push({ id: 'd' + hash(d.t), txt: d.t, type: 'draw', state: 'todo' });
    }
    /* 他俩偶尔再加一条自己的要求 */
    var extra = [
      '错题本上补两道今天错的题',
      '把明天的课本提前过一遍',
      '英语听力 10 分钟',
      '背 20 个单词，明早抽查',
      '物理错题重做一遍',
      '把今天那道压轴题再算一遍'
    ];
    if (r() < 0.6 && items.length < 6) {
      items.push({ id: 'x' + hash(target), txt: pick(r, extra), type: 'extra', state: 'todo' });
    }
    if (!items.length) return false;
    P.assigns[target] = { givenAt: now.getTime(), items: items, by: 'wsh' };
    return true;
  }

  function ensureAssign(now) {
    var target = shiftDay(dayKey(now), 1);
    if (P.assigns[target]) return;
    if (minuteOf(now) < GIVE_MIN) return;
    makeAssign(target, now);
  }

  /* 第一次用：今天也补一份，别一进去是空的 */
  function seedToday(now) {
    if (P.seen && P.seen.init) return;
    P.seen = P.seen || {};
    P.seen.init = true;
    var today = dayKey(now);
    if (!P.assigns[today]) makeAssign(today, now);
  }

  /* ---------- 生成：他们自己的任务 + 试卷（当天，按时间出现） ---------- */
  function ensureDay(now) {
    var today = dayKey(now);
    if (!P.chars[today]) {
      var r = rng(hash('chars#' + today));
      var wk = now.getDay();
      var school = wk >= 1 && wk <= 6;
      var set = {};
      CHARS.forEach(function (c, ci) {
        var rr = rng(hash('chartask#' + today + c.k));
        var list = [];
        var cnt = school ? ri(rr, 2, 3) : ri(rr, 1, 2);
        var pool = [
          '做 {s} 卷子 第 {n} 套',
          '{s} 错题重做 {n} 道',
          '{s} 课本第 {n} 章过一遍',
          '{s} 小测卷订正',
          '{s} 背诵任务'
        ];
        for (var i = 0; i < cnt; i++) {
          var tpl = pool[(i + ci) % pool.length];
          var txt = tpl.replace('{s}', pick(rr, c.subs)).replace('{n}', String(ri(rr, 1, 4)));
          var doneMin = 18 * 60 + ri(rr, 10, 150);
          list.push({
            id: c.k + i + hash(today + i + c.k),
            txt: txt,
            doneMin: doneMin,
            paperId: null
          });
        }
        set[c.k] = { items: list, checked: false };
      });
      P.chars[today] = set;
    }
    /* 他们做完的 → 生成一张"拍的"卷子 */
    var todaySet = P.chars[today];
    var nowM = minuteOf(now);
    CHARS.forEach(function (c) {
      todaySet[c.k].items.forEach(function (it) {
        if (!it.paperId && nowM >= it.doneMin) {
          var pid = 'p' + hash(it.id);
          if (!P.papers.some(function (x) { return x.id === pid; })) {
            P.papers.push(makePaper(c, today, it, pid, now));
          }
          it.paperId = pid;
        }
      });
    });
    /* 每天都有试卷：放学前后的额外上传 */
    var extraTimes = [16 * 60 + 40, 19 * 60 + 10, 21 * 60 + 20];
    var rex = rng(hash('papers#' + today));
    var extraCnt = 1 + (rex() < 0.45 ? 1 : 0);
    for (var e = 0; e < extraCnt; e++) {
      var tm = extraTimes[e % extraTimes.length];
      if (nowM < tm) continue;
      var pid2 = 'e' + hash(today + '#' + e);
      if (P.papers.some(function (x) { return x.id === pid2; })) continue;
      var ch = CHARS[e % 2];
      P.papers.push(makePaper(ch, today, { txt: '' }, pid2, now, tm));
    }
  }

  function makePaper(c, date, item, pid, now, forceMin) {
    var r = rng(hash('paper#' + pid));
    var subj = pick(r, c.subs);
    c.subs.forEach(function (x) { if (item && item.txt && item.txt.indexOf(x) >= 0) subj = x; });
    var kinds = ['周测卷', '课堂小测', '模拟卷', '错题重做', '单元检测'];
    var title = subj + '·' + pick(r, kinds);
    var wrong = ri(r, 0, 2);
    var score = wrong === 0 ? ri(r, 94, 99) : Math.max(78, 100 - wrong * ri(r, 3, 6));
    var tm = forceMin != null ? forceMin : (item.doneMin || minuteOf(now));
    return {
      id: pid, owner: c.k, subj: subj, title: title, score: score,
      date: date, time: pad(Math.floor(tm / 60)) + ':' + pad(tm % 60),
      fromTask: item.txt || '',
      wrong: wrong,
      note: pick(r, ['最后一题差点', '选择错了两道', '大题过程写得比上次清楚', '没检查就交了'])
    };
  }

  /* ---------- 晚间检查（21:50 放学后） ---------- */
  var CHECK_MIN = 21 * 60 + 50;

  function ensureReview(now) {
    var today = dayKey(now);
    if (P.reviews[today]) return;
    if (minuteOf(now) < CHECK_MIN) return;
    var a = P.assigns[today];
    if (!a) return;
    var total = a.items.length;
    var done = a.items.filter(function (x) { return x.state === 'done'; }).length;
    var pct = total ? Math.round(done / total * 100) : 100;
    var by = now.getMinutes() % 2 ? 'whd' : 'wsh';
    P.reviews[today] = {
      at: now.getTime(), done: done, total: total, pct: pct, by: by,
      comment: commentFor(pct, done, total, rng(hash('rev#' + today)))
    };
  }

  function commentFor(pct, done, total, r) {
    if (total === 0) return '今天没给你派任务。';
    if (pct === 100) return pick(r, ['都做完了，今天挺利索', '一条没落，明天继续保持', '可以，这次没拖']);
    if (pct >= 60) {
      return '还差 ' + (total - done) + ' 条没动，明天补上';
    }
    if (pct > 0) return pick(r, ['才做完 ' + done + ' 条，剩下的明天补', '今天有点松啊，明天早点开始']);
    return '一条都没动？明天我不提醒了。';
  }

  /* ---------- 数据查询 ---------- */
  function todayAssign() { return P.assigns[dayKey(new Date())] || null; }
  function tomorrowAssign() { return P.assigns[shiftDay(dayKey(new Date()), 1)] || null; }

  function paperOf(id) {
    return P.papers.filter(function (x) { return x.id === id; })[0] || null;
  }
  function papersToday() {
    var today = dayKey(new Date());
    return P.papers.filter(function (x) { return x.date === today; }).slice().reverse();
  }

  /* ---------- 样式 ---------- */
  var CSS = [
    '.xxj-pn{margin-bottom:10px;}',
    '.xxj-pn-card{background:rgba(38,43,52,.9);border:1px solid rgba(255,255,255,.10);border-radius:18px;padding:12px 12px 10px;}',
    '.xxj-pn-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;}',
    '.xxj-pn-lab{font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.62;}',
    '.xxj-pn-meta{font-size:10px;font-family:ui-monospace,monospace;opacity:.55;}',
    '.xxj-pn-item{display:flex;align-items:center;gap:9px;font-size:12.5px;padding:7px 8px;border-radius:12px;background:rgba(255,255,255,.05);margin-bottom:6px;}',
    '.xxj-pn-item.done .xxj-pn-t{opacity:.4;text-decoration:line-through;}',
    '.xxj-pn-ck{width:18px;height:18px;flex:none;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:transparent;color:#dfe9f5;font-size:10px;line-height:1;padding:0;cursor:pointer;}',
    '.xxj-pn-item.done .xxj-pn-ck{background:#5b7fa6;border-color:#5b7fa6;}',
    '.xxj-pn-t{flex:1;min-width:0;word-break:break-word;}',
    '.xxj-pn-tag{flex:none;font-size:9px;padding:2px 6px;border-radius:999px;border:1px solid rgba(255,255,255,.16);opacity:.7;}',
    '.xxj-pn-tag.draw{color:#e2c08a;border-color:rgba(226,167,111,.5);}',
    '.xxj-pn-tag.must{color:#9fc4e8;border-color:rgba(143,192,234,.45);}',
    '.xxj-pn-tag.extra{color:#c6b7e8;border-color:rgba(170,150,220,.45);}',
    '.xxj-pn-empty{font-size:11px;opacity:.42;margin:2px 0 6px;}',
    '.xxj-pn-row{display:flex;align-items:center;gap:8px;font-size:11.5px;padding:6px 0;border-top:1px dashed rgba(255,255,255,.09);}',
    '.xxj-pn-row:first-child{border-top:0;}',
    '.xxj-pn-who{flex:none;width:46px;font-size:10.5px;opacity:.6;}',
    '.xxj-pn-row > span{flex:1;min-width:0;word-break:break-word;}',
    '.xxj-pn-row > .xxj-pn-who{flex:none;width:46px;}',
    '.xxj-pn-row > .xxj-pn-st{flex:none;}',
    '.xxj-pn-row > .xxj-pn-thumb{flex:none;}',
    '.xxj-pn-st{flex:none;font-size:10px;opacity:.55;}',
    '.xxj-pn-thumb{flex:none;width:34px;height:44px;border-radius:6px;cursor:pointer;position:relative;overflow:hidden;background:#f3ecdc;border:1px solid rgba(255,255,255,.18);}',
    '.xxj-pn-thumb b{position:absolute;right:2px;top:2px;font-size:8px;color:#c8564a;font-family:Georgia,serif;}',
    '.xxj-pn-thumb i{position:absolute;left:3px;right:3px;top:12px;height:1px;background:rgba(60,50,40,.25);box-shadow:0 5px 0 rgba(60,50,40,.2),0 10px 0 rgba(60,50,40,.16);}',
    '.xxj-pn-btn{flex:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.10);color:#e6eef7;border-radius:10px;font-size:11px;padding:7px 11px;cursor:pointer;}',
    '.xxj-pn-input{flex:1;min-width:0;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#dfe9f5;font-size:12px;padding:8px 10px;outline:none;}',
    '.xxj-pn-add{display:flex;gap:8px;margin-top:8px;}',
    '.xxj-pn-pool-t{font-size:11px;opacity:.6;margin:12px 0 6px;}',
    '.xxj-pn-chip{display:inline-flex;align-items:center;gap:6px;margin:0 6px 6px 0;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.10);font-size:11.5px;}',
    '.xxj-pn-chip.used{opacity:.45;}',
    '.xxj-pn-chip.used span{text-decoration:line-through;}',
    '.xxj-pn-chip button{border:0;background:transparent;color:rgba(220,232,245,.55);font-size:12px;cursor:pointer;padding:0;}',
    '.xxj-pn-note{font-size:11px;line-height:1.7;opacity:.72;margin:0;padding-left:9px;border-left:2px solid rgba(255,255,255,.14);}',
    '.xxj-pn-ov{position:fixed;inset:0;z-index:80;display:none;background:rgba(6,8,12,.62);backdrop-filter:blur(6px);}',
    '.xxj-pn-ov.open{display:flex;align-items:flex-end;}',
    '.xxj-pn-sheet{width:100%;max-height:88vh;overflow-y:auto;background:#0f1218;border-radius:20px 20px 0 0;padding:14px 16px 26px;}',
    '.xxj-pn-sheet-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}',
    '.xxj-pn-sheet-t{font-size:10px;letter-spacing:.16em;opacity:.55;text-transform:uppercase;}',
    '.xxj-pn-x{border:0;background:transparent;color:#9fb6cf;font-size:18px;cursor:pointer;padding:0 4px;}',
    /* 试卷（纸面） */
    '.xxj-paper{background:#f6f1e4;color:#2c2620;border-radius:12px;padding:18px 16px 22px;font-family:Georgia,"Songti SC",serif;box-shadow:0 8px 24px rgba(0,0,0,.35);position:relative;overflow:hidden;}',
    '.xxj-paper:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(180deg,transparent 0 26px,rgba(60,50,40,.09) 26px 27px);pointer-events:none;}',
    '.xxj-paper-h{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid rgba(44,38,32,.5);padding-bottom:7px;}',
    '.xxj-paper-h h4{margin:0;font-size:17px;letter-spacing:.04em;}',
    '.xxj-paper-h span{font-size:10px;opacity:.6;}',
    '.xxj-paper-score{position:absolute;right:14px;top:52px;width:56px;height:56px;border:2.5px solid #c0492f;border-radius:50%;color:#c0492f;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-11deg);opacity:.9;}',
    '.xxj-paper-score b{font-size:22px;line-height:1;}',
    '.xxj-paper-score i{font-size:8px;font-style:normal;letter-spacing:.1em;}',
    '.xxj-paper-b{position:relative;margin-top:12px;font-size:12px;line-height:1.9;}',
    '.xxj-paper-b p{margin:0 0 6px;}',
    '.xxj-paper-b .wr{color:#c0492f;text-decoration:underline wavy rgba(192,73,47,.6);}',
    '.xxj-paper-b .mk{color:#c0492f;font-size:13px;}',
    '.xxj-paper-f{margin-top:14px;border-top:1px dashed rgba(44,38,32,.35);padding-top:8px;font-size:10.5px;opacity:.62;font-family:-apple-system,system-ui,sans-serif;}',
    '.xxj-paper-foot{display:flex;justify-content:space-between;margin-top:10px;font-size:10px;opacity:.5;font-family:-apple-system,system-ui,sans-serif;}',
    'body:not(.dark) .xxj-pn-card{background:#fff;border-color:rgba(20,30,45,.10);}',
    'body:not(.dark) .xxj-pn-sheet{background:#f4f6fa;}',
    'body:not(.dark) .xxj-pn-item,body:not(.dark) .xxj-pn-chip{background:rgba(20,30,45,.05);border-color:rgba(20,30,45,.10);}',
    'body:not(.dark) .xxj-pn-input{background:#f1f4f8;border-color:rgba(20,30,45,.14);color:#20242c;}',
    'body:not(.dark) .xxj-pn-btn{background:#eef2f7;border-color:rgba(20,30,45,.12);color:#2a3442;}'
  ].join('');

  function injectCss() {
    if (document.getElementById('xxj-plan-css')) return;
    var s = document.createElement('style');
    s.id = 'xxj-plan-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- 视图 ---------- */
  function myTaskCard(now) {
    var a = todayAssign();
    var nowM = minuteOf(now);
    if (!a) {
      return '<div class="xxj-pn"><div class="xxj-pn-card">'
        + '<div class="xxj-pn-head"><span class="xxj-pn-lab">我的任务</span><span class="xxj-pn-meta">今晚 ' + pad(Math.floor(GIVE_MIN / 60)) + ':' + pad(GIVE_MIN % 60) + ' 布置</span></div>'
        + '<p class="xxj-pn-empty">今天的任务还没布置，' + (nowM >= GIVE_MIN ? '他们一会儿会来' : '晚饭时间他们会派给你') + '。</p>'
        + '</div></div>';
    }
    var done = a.items.filter(function (x) { return x.state === 'done'; }).length;
    return '<div class="xxj-pn"><div class="xxj-pn-card">'
      + '<div class="xxj-pn-head"><span class="xxj-pn-lab">我的任务</span><span class="xxj-pn-meta">' + done + '/' + a.items.length + '</span></div>'
      + a.items.map(function (x, i) {
        var tg = x.type === 'must' ? '必做' : (x.type === 'draw' ? '抽到' : '加练');
        return '<div class="xxj-pn-item ' + (x.state === 'done' ? 'done' : '') + '">'
          + '<button type="button" class="xxj-pn-ck" data-pn-ck="' + i + '">' + (x.state === 'done' ? '✓' : '') + '</button>'
          + '<span class="xxj-pn-t">' + esc(x.txt) + '</span>'
          + '<span class="xxj-pn-tag ' + x.type + '">' + tg + '</span></div>';
      }).join('')
      + '</div></div>';
  }

  function reviewCard(now) {
    var today = dayKey(now);
    var rv = P.reviews[today];
    if (!rv) return '';
    return '<div class="xxj-pn"><div class="xxj-pn-card">'
      + '<div class="xxj-pn-head"><span class="xxj-pn-lab">今晚的检查</span><span class="xxj-pn-meta">' + rv.done + '/' + rv.total + '</span></div>'
      + '<p class="xxj-pn-note">' + esc(rv.comment) + '</p>'
      + '<div class="xxj-paper-foot" style="margin-top:8px"><span>' + esc(charName(rv.by)) + '看过你的本子</span><span>' + (rv.pct === 100 ? '全部完成' : rv.pct + '%') + '</span></div>'
      + '</div></div>';
  }

  function tomorrowCard(now) {
    var b = tomorrowAssign();
    if (!b) return '';
    if (minuteOf(now) < GIVE_MIN) return '';
    var target = shiftDay(dayKey(now), 1);
    return '<div class="xxj-pn"><div class="xxj-pn-card">'
      + '<div class="xxj-pn-head"><span class="xxj-pn-lab">明天 · 他们布置的</span><span class="xxj-pn-meta">' + mdLabel(target) + '</span></div>'
      + b.items.map(function (x) {
        var tg = x.type === 'must' ? '必做' : (x.type === 'draw' ? '抽到' : '加练');
        return '<div class="xxj-pn-item"><span class="xxj-pn-t">' + esc(x.txt) + '</span>'
          + '<span class="xxj-pn-tag ' + x.type + '">' + tg + '</span></div>';
      }).join('')
      + '</div></div>';
  }

  function charCard(now) {
    var today = dayKey(now);
    var set = P.chars[today];
    if (!set) return '';
    var nowM = minuteOf(now);
    var rows = [];
    CHARS.forEach(function (c) {
      var g = set[c.k];
      if (!g) return;
      g.items.forEach(function (it) {
        var fin = nowM >= it.doneMin;
        var pp = it.paperId ? paperOf(it.paperId) : null;
        rows.push('<div class="xxj-pn-row">'
          + '<span class="xxj-pn-who">' + esc(charName(c.k)) + '</span>'
          + '<span>' + esc(it.txt) + '</span>'
          + (pp
            ? '<span class="xxj-pn-thumb" data-pn-paper="' + esc(pp.id) + '" title="看试卷"><b>' + pp.score + '</b><i></i></span>'
            : '<span class="xxj-pn-st">' + (fin ? '刚做完' : '在写') + '</span>')
          + '</div>');
      });
    });
    return '<div class="xxj-pn"><div class="xxj-pn-card">'
      + '<div class="xxj-pn-head"><span class="xxj-pn-lab">他们自己的</span><span class="xxj-pn-meta">' + rows.length + ' 项</span></div>'
      + (rows.length ? rows.join('') : '<p class="xxj-pn-empty">今天没布置</p>')
      + '</div></div>';
  }

  function paperCard(now) {
    /* 只列"随手拍的"（任务产出的卷子在《他们自己的》那一栏里点缩略图看） */
    var list = papersToday().filter(function (x) { return !x.fromTask; });
    var head = '<div class="xxj-pn-head"><span class="xxj-pn-lab">随手拍的卷子</span><span class="xxj-pn-meta">' + list.length + ' 张</span></div>';
    if (!list.length) {
      return '<div class="xxj-pn"><div class="xxj-pn-card">' + head + '<p class="xxj-pn-empty">今天还没上传，一般放学到晚自习之间会有。</p></div></div>';
    }
    return '<div class="xxj-pn"><div class="xxj-pn-card">' + head
      + list.slice(0, 4).map(function (p, i) {
        return '<div class="xxj-pn-row">'
          + '<span class="xxj-pn-who">' + esc(charName(p.owner)) + '</span>'
          + '<span class="xxj-pn-thumb" data-pn-paper="' + esc(p.id) + '"><b>' + p.score + '</b><i></i></span>'
          + '<span>' + esc(p.title) + '<br><span style="font-size:9.5px;opacity:.5">' + esc(p.time) + ' · 错 ' + p.wrong + ' 处</span></span>'
          + '<span class="xxj-pn-st">看</span></div>';
      }).join('')
      + '</div></div>';
  }

  function poolView() {
    var must = P.pool.must;
    var draw = P.pool.draw;
    return '<section class="xxj-pn">'
      + '<div class="xxj-pn-card">'
      + '<div class="xxj-pn-head"><span class="xxj-pn-lab">任务池 · 我自己填</span><button type="button" class="xxj-pn-btn" data-pn-back>‹ 返回</button></div>'
      + '<p class="xxj-pn-empty">必做的每天都会出现；随机的每天只抽一条，做完划掉，不会再抽到。</p>'
      + '<p class="xxj-pn-pool-t">每日必做 · ' + must.length + '</p>'
      + (must.length ? must.map(function (t, i) {
        return '<span class="xxj-pn-chip"><span>' + esc(t) + '</span><button type="button" data-pn-delmust="' + i + '">×</button></span>';
      }).join('') : '<p class="xxj-pn-empty">还没填</p>')
      + '<div class="xxj-pn-add"><input class="xxj-pn-input" data-pn-newmust placeholder="例如：错题本 3 页">'
      + '<button type="button" class="xxj-pn-btn" data-pn-addmust>添加</button></div>'
      + '<p class="xxj-pn-pool-t">随机池 · ' + draw.filter(function (x) { return x.st === 'idle'; }).length + ' 条待抽</p>'
      + (draw.length ? draw.map(function (x, i) {
        return '<span class="xxj-pn-chip ' + (x.st === 'used' ? 'used' : '') + '"><span>' + esc(x.t) + '</span>'
          + (x.st === 'used' ? '<em style="font-size:9px;opacity:.6">已做</em>' : (x.st === 'drawn' ? '<em style="font-size:9px;opacity:.6">已抽到</em>' : ''))
          + '<button type="button" data-pn-deldraw="' + i + '">×</button></span>';
      }).join('') : '<p class="xxj-pn-empty">还没填</p>')
      + '<div class="xxj-pn-add"><input class="xxj-pn-input" data-pn-newdraw placeholder="例如：背一首古诗">'
      + '<button type="button" class="xxj-pn-btn" data-pn-adddraw>添加</button></div>'
      + '<div class="xxj-pn-add"><button type="button" class="xxj-pn-btn" data-pn-reset>随机池恢复未抽</button></div>'
      + '</div></section>';
  }

  function sectionHtml(now) {
    if (view === 'pool') return poolView();
    var today = dayKey(now);
    var set = P.chars[today];
    var nowM = minuteOf(now);
    /* 还没到晚饭：只显示"他们昨晚布置给我的" */
    return myTaskCard(now) + reviewCard(now)
      + (nowM >= GIVE_MIN ? tomorrowCard(now) : '')
      + charCard(now) + paperCard(now)
      + '<div class="xxj-pn"><div class="xxj-pn-card" style="display:flex;align-items:center;gap:10px">'
      + '<span class="xxj-pn-lab" style="flex:1">任务池设置</span>'
      + '<button type="button" class="xxj-pn-btn" data-pn-pool>编辑必做 / 随机</button></div></div>';
  }

  /* ---------- 挂载到学习 App 首页 ---------- */
  var view = null;
  var HOST = null;

  function mount() {
    var body = document.getElementById('xxj-sd-body');
    if (!body) return;
    var host = body.querySelector('[data-pn-host]');
    /* 首页才有 .xxj-sd-grid；科目页把它摘掉 */
    var isHome = !!body.querySelector('.xxj-sd-grid');
    if (!isHome) { if (host) host.remove(); return; }
    if (host) {
      if (body.firstChild !== host) body.insertBefore(host, body.firstChild);
      return;                      /* 已挂好，不再写 innerHTML，避免观察器自激 */
    }
    host = document.createElement('div');
    host.setAttribute('data-pn-host', '1');
    host.innerHTML = sectionHtml(new Date());
    body.insertBefore(host, body.firstChild);
  }

  function refresh() {
    var host = document.querySelector('[data-pn-host]');
    if (host) host.innerHTML = sectionHtml(new Date());
  }

  var QA = [
    { s: ['数学'], q: '1. 已知 f(x)=x²−4x+3，求其在 [0,3] 上的最值。', a: '解：f(x)=(x−2)²−1，最小 −1，最大 3', e: '' },
    { s: ['数学'], q: '2. 求过点 (1,2) 且与直线 2x−y+1=0 平行的直线方程。', a: '解：斜率 2，得 y−2=2(x−1)，即 2x−y=0', e: '最后化成一般式时符号写反' },
    { s: ['化学', '生物'], q: '3. 常温下 0.1 mol/L CH₃COOH 溶液中 c(H⁺) 约为多少？', a: '解：c(H⁺)=√(Ka·c)≈1.3×10⁻³ mol/L', e: '' },
    { s: ['物理'], q: '4. 物体在 θ=30° 的斜面上下滑（μ=0.2），求加速度。', a: '解：a=g(sinθ−μcosθ)≈3.2 m/s²', e: '漏了摩擦力方向，符号弄反' },
    { s: ['地理'], q: '5. 简述季风环流对本地降水的影响。（8 分）', a: '答：夏季东南季风带来水汽，降水集中；冬季西北季风干冷少雨。', e: '' },
    { s: ['语文', '英语'], q: '6. 概括作者对"故乡"的情感变化。（6 分）', a: '答：由怀念到疏离，最后又回到认同。', e: '' }
  ];

  function openPaper(id) {
    var p = paperOf(id);
    if (!p) return;
    var name = charName(p.owner);
    var r = rng(hash('qset#' + p.id));
    var cand = QA.filter(function (x) { return x.s.indexOf(p.subj) >= 0; });
    if (!cand.length) cand = QA;
    var n = Math.min(cand.length, 2 + (p.wrong > 0 ? 1 : 0));
    var chosen = [];
    var pool = cand.slice();
    for (var i = 0; i < n && pool.length; i++) {
      chosen.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    }
    chosen.sort(function (a, b) { return parseInt(a.q, 10) - parseInt(b.q, 10); });
    var body = '';
    var wrongLeft = Math.min(p.wrong, chosen.length - 1);
    chosen.forEach(function (x) {
      var bad = wrongLeft > 0 && x.e;
      if (bad) wrongLeft--;
      body += '<p>' + x.q + '</p>'
        + '<p><span class="' + (bad ? 'wr' : '') + '">' + x.a + '</span> '
        + '<span class="mk">' + (bad ? '✗ −' + ri(r, 2, 5) : '✓') + '</span></p>'
        + (bad ? '<p style="font-size:10.5px;opacity:.7;margin-left:2px">— ' + x.e + '</p>' : '');
    });
    var ov = document.getElementById('xxj-pn-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'xxj-pn-ov';
      ov.className = 'xxj-pn-ov';
      document.body.appendChild(ov);
    }
    ov.innerHTML = '<div class="xxj-pn-sheet">'
      + '<div class="xxj-pn-sheet-top"><span class="xxj-pn-sheet-t">' + esc(name) + ' 拍的</span>'
      + '<button type="button" class="xxj-pn-x" data-pn-close>×</button></div>'
      + '<div class="xxj-paper">'
      + '<div class="xxj-paper-h"><h4>' + esc(p.title) + '</h4><span>' + esc(mdLabel(p.date)) + '</span></div>'
      + '<div class="xxj-paper-score"><b>' + p.score + '</b><i>SCORE</i></div>'
      + '<div class="xxj-paper-b">' + body + '</div>'
      + '<div class="xxj-paper-f">' + esc(p.fromTask ? '任务：' + p.fromTask : '随手拍的，课上做的') + '　·　' + esc(p.note) + '</div>'
      + '<div class="xxj-paper-foot"><span>错 ' + p.wrong + ' 处</span><span>' + esc(p.time) + ' 上传</span></div>'
      + '</div></div>';
    ov.classList.add('open');
  }

  function bind() {
    if (document.__xxjPlanBind) return;
    document.__xxjPlanBind = true;
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(
        '[data-pn-ck],[data-pn-paper],[data-pn-close],[data-pn-pool],[data-pn-back],[data-pn-addmust],[data-pn-adddraw],[data-pn-delmust],[data-pn-deldraw],[data-pn-reset]'
      ) : null;
      if (!t) return;
      var d = t.dataset;
      var now = new Date();

      if (d.pnClose !== undefined) { e.preventDefault(); document.getElementById('xxj-pn-ov').classList.remove('open'); return; }
      if (d.pnPaper) { e.preventDefault(); e.stopPropagation(); openPaper(d.pnPaper); return; }
      if (d.pnPool !== undefined) { e.preventDefault(); e.stopPropagation(); view = 'pool'; rerenderStudy(); return; }
      if (d.pnBack !== undefined) { e.preventDefault(); e.stopPropagation(); view = null; rerenderStudy(); return; }

      if (d.pnCk !== undefined) {
        e.preventDefault(); e.stopPropagation();
        var a = todayAssign();
        if (!a) return;
        var it = a.items[parseInt(d.pnCk, 10)];
        if (!it) return;
        it.state = it.state === 'done' ? 'todo' : 'done';
        /* 抽到的那条做完 → 永久划掉，不再抽 */
        if (it.state === 'done' && it.type === 'draw') {
          P.pool.draw.forEach(function (x) { if (x.t === it.txt) x.st = 'used'; });
        }
        save(); refresh(); return;
      }
      if (d.pnAddmust !== undefined) {
        e.preventDefault();
        var inp = document.querySelector('[data-pn-newmust]');
        var v = (inp && inp.value || '').trim();
        if (!v) return;
        P.pool.must.push(v); save(); rerenderStudy(); return;
      }
      if (d.pnAdddraw !== undefined) {
        e.preventDefault();
        var inp2 = document.querySelector('[data-pn-newdraw]');
        var v2 = (inp2 && inp2.value || '').trim();
        if (!v2) return;
        P.pool.draw.push({ t: v2, st: 'idle' }); save(); rerenderStudy(); return;
      }
      if (d.pnDelmust !== undefined) {
        e.preventDefault();
        P.pool.must.splice(parseInt(d.pnDelmust, 10), 1); save(); rerenderStudy(); return;
      }
      if (d.pnDeldraw !== undefined) {
        e.preventDefault();
        P.pool.draw.splice(parseInt(d.pnDeldraw, 10), 1); save(); rerenderStudy(); return;
      }
      if (d.pnReset !== undefined) {
        e.preventDefault();
        P.pool.draw.forEach(function (x) { x.st = 'idle'; }); save(); rerenderStudy(); return;
      }
    }, true);
  }

  /* 让学习 App 重渲染（触发它自己的 renderStudy） */
  function rerenderStudy() {
    var host = document.querySelector('[data-pn-host]');
    if (host) host.innerHTML = sectionHtml(new Date());
    else mount();
  }

  function pump() {
    var now = new Date();
    var before = JSON.stringify([P.assigns, P.chars, P.papers, P.reviews]);
    ensureAssign(now); ensureDay(now); ensureReview(now);
    if (before !== JSON.stringify([P.assigns, P.chars, P.papers, P.reviews])) save();
    mount();
  }

  function start() {
    injectCss();
    P = load();
    bind();
    seedToday(new Date());
    pump();
    var ob = new MutationObserver(function () {
      if (document.__xxjPlanBusy) return;
      document.__xxjPlanBusy = true;
      setTimeout(function () {
        document.__xxjPlanBusy = false;
        pump();
      }, 0);
    });
    ob.observe(document.body, { childList: true, subtree: true });
    setInterval(function () {
      var st = document.getElementById('xxj-study');
      if (st && st.classList.contains('open')) pump();
    }, 60000);
  }

  var waits = 0;
  var iv = setInterval(function () {
    waits++;
    if (document.getElementById('xxj-sd-body')) {
      clearInterval(iv);
      start();
    }
    if (waits > 200) clearInterval(iv);
  }, 300);
})();
