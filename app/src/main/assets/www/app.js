/* 동서산업롤 계산기 — 엑셀(계산기.xlsx) 수식을 그대로 옮긴 앱 로직 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var n = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(x) ? x : 0; };
  var fmt = function (x, d) { return x.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var f2 = function (x) { return isFinite(x) ? fmt(x, 2) : '—'; };
  var SLOTS = 5;

  /* ---------------- 재질 · 비중 저장 ---------------- */
  var MKEY = 'dsroll.materials';
  var DEF_MATS = [
    { name: 'SUS304', sg: '7.93' }, { name: 'STKM13A', sg: '7.85' }, { name: 'AL6061', sg: '2.73' },
    { name: 'CFRP', sg: '1.7' }, { name: '고무', sg: '1.5' }
  ];
  function copyMats(l) { return l.map(function (m) { return { name: String(m.name), sg: String(m.sg) }; }); }
  function loadMats() {
    try { var v = JSON.parse(localStorage.getItem(MKEY)); if (Array.isArray(v) && v.length) return copyMats(v); } catch (e) {}
    return copyMats(DEF_MATS);
  }
  function saveMats(l) {
    try { localStorage.setItem(MKEY, JSON.stringify(l)); return true; } catch (e) { return false; }
  }
  var mats = loadMats();

  /* ---------------- 공통 계산기 틀 (1~5번 칸) ---------------- */
  function Calc(el, def) {
    var self = this;
    this.el = el; this.def = def; this.cur = 0;
    this.slots = [];
    for (var i = 0; i < SLOTS; i++) this.slots.push(def.blank());

    var bar = $('.slots', el);
    this.slotBtns = [];
    for (var j = 0; j < SLOTS; j++) {
      (function (idx) {
        var b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', (idx + 1) + '번 계산');
        b.textContent = String(idx + 1);
        b.addEventListener('click', function () { self.cur = idx; self.sync(); });
        bar.appendChild(b); self.slotBtns.push(b);
      })(j);
    }
    $('.clear', el).addEventListener('click', function () {
      self.slots[self.cur] = def.blank(); self.sync();
    });
    $$('[data-k]', el).forEach(function (inp) {
      inp.addEventListener('input', function () {
        self.slots[self.cur][self.key(inp.dataset.k)] = inp.value;
        self.refresh();
      });
    });
    $$('[data-set]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var kv = b.dataset.set.split('=');
        self.slots[self.cur][kv[0]] = kv[1];
        self.sync();
      });
    });
    if (def.init) def.init(this);
    this.sync();
  }
  Calc.prototype.slot = function () { return this.slots[this.cur]; };
  Calc.prototype.key = function (k) { return this.def.key ? this.def.key(k, this.slot()) : k; };
  Calc.prototype.out = function (name, text) {
    $$('[data-o="' + name + '"]', this.el).forEach(function (o) { o.textContent = text; });
  };
  Calc.prototype.sync = function () {
    var s = this.slot(), self = this;
    $$('[data-set]', this.el).forEach(function (b) {
      var kv = b.dataset.set.split('=');
      b.classList.toggle('on', String(s[kv[0]]) === kv[1]);
    });
    if (this.def.sync) this.def.sync(this, s);
    $$('[data-k]', this.el).forEach(function (inp) {
      var v = s[self.key(inp.dataset.k)];
      inp.value = v == null ? '' : v;
    });
    this.refresh();
  };
  Calc.prototype.refresh = function () {
    var s = this.slot(), self = this, inputs = this.def.inputs;
    this.slotBtns.forEach(function (b, i) {
      b.classList.toggle('on', i === self.cur);
      b.setAttribute('aria-selected', i === self.cur ? 'true' : 'false');
      var used = inputs.some(function (k) { return self.slots[i][k] !== ''; });
      var dot = b.querySelector('i');
      if (used && !dot) { b.appendChild(document.createElement('i')); }
      if (!used && dot) { dot.remove(); }
    });
    this.out('slot', (this.cur + 1) + '번');
    this.def.compute(this, s);
  };

  /* ---------------- ① 실중량 ---------------- */
  var weightDef = {
    inputs: ['od', 't', 'len', 'price'],
    blank: function () { return { shape: 'pipe', mat: 0, sg: mats[0] ? mats[0].sg : '', od: '', t: '', len: '', price: '' }; },
    sync: function (c, s) {
      var box = $('[data-chips]', c.el);
      box.innerHTML = '';
      mats.forEach(function (m, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = m.name;
        if (s.mat === i) b.classList.add('on');
        b.addEventListener('click', function () { s.mat = i; s.sg = m.sg; c.sync(); });
        box.appendChild(b);
      });
      $('[data-show="pipe"]', c.el).hidden = s.shape !== 'pipe';
    },
    compute: function (c, s) {
      var D = n(s.od), T = n(s.t), L = n(s.len), G = n(s.sg), P = n(s.price);
      var pipe = s.shape === 'pipe';
      var ready = D > 0 && L > 0 && (!pipe || T > 0);
      var w = pipe ? ((D * D - Math.pow(D - 2 * T, 2)) * 0.785 * G * L) / 1000000
                   : (D * D * 0.785 * G * L) / 1000000;
      c.out('weight', ready ? fmt(w, 3) : '—');
      c.out('amount', ready && P > 0 ? fmt(Math.round(w * P), 0) : '—');
      c.out('formula', pipe ? '중량 = (외경² − (외경−2×두께)²) × 0.785 × 비중 × 길이 ÷ 1,000,000'
                            : '중량 = 외경² × 0.785 × 비중 × 길이 ÷ 1,000,000');
    }
  };

  /* ---------------- ② 고무롤 견적 ---------------- */
  var rollBlank = { lossT: '10', lossL: '', aOD: '', aL: '', aP: '', iOD: '', iC: '', iL: '', iG: '1.5', iP: '', oOD: '', oC: '', oL: '', oG: '1.5', oP: '' };
  var rollDef = {
    inputs: Object.keys(rollBlank).filter(function (k) { return k !== 'iG' && k !== 'oG'; }).concat([]),
    blank: function () { return Object.assign({}, rollBlank); },
    compute: function (c, s) {
      var down = function (x) { return Math.floor(x / 1000) * 1000; };
      var M = n(s.lossT), N = n(s.lossL);
      var area = (n(s.aOD) * 3.14 * n(s.aL)) / 100;
      var kg = function (od, core, len, g) { return ((Math.pow(n(od) + M, 2) - Math.pow(n(core), 2)) * 0.785 * n(g) * (n(len) + N)) / 1000000; };
      var iKg = n(s.iOD) && n(s.iL) ? kg(s.iOD, s.iC, s.iL, s.iG) : 0;
      var oKg = n(s.oOD) && n(s.oL) ? kg(s.oOD, s.oC, s.oL, s.oG) : 0;
      var aAmt = down(area * n(s.aP)), iAmt = down(iKg * n(s.iP)), oAmt = down(oKg * n(s.oP));
      var q = function (x, d, u) { return x > 0 ? fmt(x, d) + ' ' + u : '—'; };
      c.out('aQty', q(area, 1, 'cm²')); c.out('aAmt', fmt(aAmt, 0));
      c.out('iQty', q(iKg, 3, 'kg'));   c.out('iAmt', fmt(iAmt, 0));
      c.out('oQty', q(oKg, 3, 'kg'));   c.out('oAmt', fmt(oAmt, 0));
      c.out('totalKg', fmt(iKg + oKg, 3));
      c.out('total', fmt(aAmt + iAmt + oAmt, 0));
    }
  };
  // 비중을 바꾼 칸도 '사용 중'으로 표시
  rollDef.inputs = Object.keys(rollBlank);
  var rollUsed = function (s) { return Object.keys(rollBlank).some(function (k) { return s[k] !== rollBlank[k]; }); };

  /* ---------------- ③ 홈(그루브) 가공 + 롤 그림 ---------------- */
  var grooveDef = {
    inputs: ['od', 'ang', 'lines', 'blade'],
    blank: function () { return { od: '', ang: '', lines: '', blade: '' }; },
    compute: function (c, s) {
      var D = n(s.od), deg = n(s.ang), th = deg * Math.PI / 180, Z = n(s.lines), B = n(s.blade);
      var ok = D > 0 && Z > 0 && deg > 0;
      var g2 = function (x) { return ok && isFinite(x) ? fmt(x, 2) : '—'; };
      var A = ok ? (Math.tan(th) * (D * 3.14 / 2) * 2) / Z : NaN;
      var Dg = B / Math.cos(th);
      var E = A - Dg;
      var C = Math.sin(Math.PI / 2 - th) * A;
      var Cr = C - B;
      var V = ok ? (D * 3.14) / Z : NaN;
      c.out('A', g2(A)); c.out('D', g2(Dg)); c.out('E', g2(E));
      c.out('C', g2(C)); c.out('Cr', g2(Cr)); c.out('V', g2(V));
      c.out('cVal', g2(C)); c.out('crVal', g2(Cr));
      drawGroove(c, ok && deg < 89, { D: D, deg: deg, th: th, Z: Z, B: B, A: A, Dg: Dg, E: E, C: C, g2: g2 });
    }
  };

  function drawGroove(c, drawable, v) {
    var X0 = 20, X1 = 330, CY = 105, R = 75, sc = 150 / (v.D || 1);
    var r1 = function (x) { return Math.round(x * 10) / 10; };
    var groove = '', guide = '', dim = '', perp = '', dimOk = false, perpOk = false, stroke = 0;
    var aX = 0, dX = 0, eX = 0, cLX = 0, cLY = 0, bLX = 0, bLY = -20;
    if (drawable) {
      var t = Math.tan(v.th);
      var Apx = v.A * sc, Dpx = Math.max(0, v.Dg * sc);
      var spread = R * (Math.PI / 2) * t;
      var cc = Math.max(32, 175 - Apx / 2);
      var kmin = Math.ceil((X0 - spread - Dpx - cc) / Apx);
      var kmax = Math.floor((X1 + spread - cc) / Apx);
      var steps = 16;
      var edge = function (x0, rev) {
        var p = [];
        for (var i = 0; i <= steps; i++) {
          var j = rev ? steps - i : i;
          var ph = -Math.PI / 2 + (Math.PI * j) / steps;
          p.push(r1(x0 + R * ph * t) + ' ' + r1(CY - R * Math.sin(ph)));
        }
        return p;
      };
      var thin = Dpx < 0.8;
      stroke = thin ? 1.2 : 0;
      for (var k = kmin, cnt = 0; k <= kmax && cnt < 400; k++, cnt++) {
        var xk = cc + k * Apx;
        var Lp = edge(xk, false);
        if (thin) groove += 'M' + Lp.join(' L') + ' ';
        else groove += 'M' + Lp.join(' L') + ' L' + edge(xk + Dpx, true).join(' L') + ' Z ';
      }
      if (Apx >= 24 && cc + Apx <= 326) {
        dimOk = true;
        var xa = r1(cc), xd = r1(cc + Dpx), xb = r1(cc + Apx);
        guide = 'M' + xa + ' ' + CY + ' V214 M' + xd + ' ' + CY + ' V202 M' + xb + ' ' + CY + ' V214';
        dim = 'M' + xa + ' 200 H' + xb + ' M' + xa + ' 196 V204 M' + xd + ' 196 V204 M' + xb + ' 196 V204' +
              ' M' + xa + ' 226 H' + xb + ' M' + xa + ' 222 V230 M' + xb + ' 222 V230';
        aX = r1((xa + xb) / 2); dX = r1((xa + xd) / 2); eX = r1((xd + xb) / 2);
      }
      // 직각 치수: 홈에 수직으로 다음 홈까지 (C), 그중 날 폭만큼이 홈
      var cs = Math.cos(v.th), sn = Math.sin(v.th);
      var Cpx = v.C * sc, bpx = Math.max(0, v.B * sc);
      var x0 = cc, y0 = CY, x2 = x0 + Cpx * cs, y2 = y0 + Cpx * sn;
      if (Cpx >= 18 && x2 <= 326 && y2 <= 176) {
        perpOk = true;
        var x1 = x0 + bpx * cs, y1 = y0 + bpx * sn;
        var gx = sn * 4, gy = -cs * 4;
        var tick = function (x, y) { return ' M' + r1(x - gx) + ' ' + r1(y - gy) + ' L' + r1(x + gx) + ' ' + r1(y + gy); };
        perp = 'M' + r1(x0) + ' ' + r1(y0) + ' L' + r1(x2) + ' ' + r1(y2) + tick(x0, y0) + tick(x2, y2) + (bpx > 2 ? tick(x1, y1) : '');
        cLX = r1((x1 + x2) / 2 + sn * 11); cLY = r1((y1 + y2) / 2 - cs * 11 + 3);
        if (bpx > 6) { bLX = r1((x0 + x1) / 2 - sn * 10); bLY = r1((y0 + y1) / 2 + cs * 10 + 3); }
      }
    }
    var set = function (id, attrs) { var e = document.getElementById(id); for (var a in attrs) e.setAttribute(a, attrs[a]); };
    set('gGroove', { d: groove || 'M0 0', 'stroke-width': stroke });
    set('gEmpty', { opacity: drawable ? 0 : 1 });
    set('gDims', { opacity: dimOk ? 1 : 0 });
    set('gGuide', { d: guide || 'M0 0' });
    set('gDim', { d: dim || 'M0 0' });
    set('gA', { x: aX }); set('gD', { x: dX }); set('gE', { x: eX });
    document.getElementById('gA').textContent = 'A ' + v.g2(v.A);
    document.getElementById('gE').textContent = 'E ' + v.g2(v.E);
    set('gPerp', { opacity: perpOk ? 1 : 0 });
    set('gPerpA', { d: perp || 'M0 0' }); set('gPerpB', { d: perp || 'M0 0' });
    set('gC', { x: cLX, y: cLY }); set('gB', { x: bLX, y: bLY });
    c.out('figCaption', drawable ? 'θ ' + v.deg + '° · ' + v.Z + '줄 · Ø' + v.D : '');
    document.getElementById('grvSvg').setAttribute('aria-label', drawable
      ? '외경 ' + v.D + 'mm 롤에 ' + v.Z + '줄 ' + v.deg + '도 홈이 피치 ' + v.g2(v.A) + 'mm로 새겨진 그림'
      : '홈 형상 그림, 값을 입력하면 표시');
  }

  /* ---------------- ④ 간편 계산 ---------------- */
  var quickDef = {
    inputs: ['rOD', 'rSpeed', 'rRpm', 'pOD', 'pT', 'pID'],
    blank: function () { return { rMode: 'a', rOD: '', rSpeed: '', rRpm: '', pMode: 'a', pOD: '', pT: '', pID: '' }; },
    key: function (k, s) {
      if (k === 'rIn') return s.rMode === 'a' ? 'rSpeed' : 'rRpm';
      if (k === 'pIn') return s.pMode === 'a' ? 'pT' : 'pID';
      return k;
    },
    compute: function (c, s) {
      var ra = s.rMode === 'a', pa = s.pMode === 'a';
      var D = n(s.rOD), rIn = n(ra ? s.rSpeed : s.rRpm);
      var rOut = D > 0 && rIn > 0 ? (ra ? (rIn * 1000) / (D * 3.14) : (D * 3.14 * rIn) / 1000) : NaN;
      var P = n(s.pOD), pIn = n(pa ? s.pT : s.pID);
      var pOut = P > 0 && pIn > 0 ? (pa ? P - 2 * pIn : (P - pIn) / 2) : NaN;
      c.out('rInLabel', ra ? '생산속도' : 'RPM'); c.out('rInUnit', ra ? 'm/분' : 'rpm');
      c.out('rOutLabel', ra ? 'RPM' : '생산속도'); c.out('rOutUnit', ra ? 'rpm' : 'm/분');
      c.out('rOut', f2(rOut));
      c.out('pInLabel', pa ? '두께' : '내경'); c.out('pOutLabel', pa ? '내경' : '두께');
      c.out('pOut', f2(pOut));
    }
  };

  /* ---------------- 계산기 생성 ---------------- */
  var weight = new Calc($('#p-weight'), weightDef);
  var roll = new Calc($('#p-roll'), rollDef);
  // 고무롤: 비중(기본 1.5)만 있는 칸은 비어 있는 것으로 표시
  roll.refresh = (function (orig) {
    return function () {
      orig.call(this);
      var self = this;
      this.slotBtns.forEach(function (b, i) {
        var used = rollUsed(self.slots[i]), dot = b.querySelector('i');
        if (used && !dot) b.appendChild(document.createElement('i'));
        if (!used && dot) dot.remove();
      });
    };
  })(roll.refresh);
  roll.refresh();
  new Calc($('#p-groove'), grooveDef);
  new Calc($('#p-quick'), quickDef);

  function reloadWeightMats() {
    mats = loadMats();
    weight.slots.forEach(function (s) { if (s.mat >= mats.length) { s.mat = 0; s.sg = mats[0] ? mats[0].sg : ''; } });
    weight.sync();
  }

  /* ---------------- 넘기기(페이저) ---------------- */
  var pager = $('#pager'), dots = $$('.dots button');
  function markDot() {
    var p = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
    dots.forEach(function (d, i) { d.classList.toggle('on', i === p); d.setAttribute('aria-current', i === p ? 'page' : 'false'); });
  }
  pager.addEventListener('scroll', markDot, { passive: true });
  dots.forEach(function (d) {
    d.addEventListener('click', function () {
      var i = Number(d.dataset.page);
      pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' });
    });
  });
  window.addEventListener('resize', function () {
    var p = dots.findIndex(function (d) { return d.classList.contains('on'); });
    pager.scrollLeft = Math.max(0, p) * pager.clientWidth;
  });

  /* ---------------- 재질 관리 화면 ---------------- */
  var draft = [], dirty = false;
  var listEl = $('#matList'), statusEl = $('#matStatus');
  function setStatus(msg, warn) { statusEl.textContent = msg; statusEl.classList.toggle('warn', !!warn); }
  function touch() { dirty = true; setStatus('저장하지 않은 변경사항이 있어요', true); }
  function renderMats() {
    listEl.innerHTML = '';
    draft.forEach(function (m, i) {
      var row = document.createElement('div'); row.className = 'mat-row';
      var nm = document.createElement('input');
      nm.value = m.name; nm.placeholder = '재질명'; nm.setAttribute('aria-label', (i + 1) + '번 재질명');
      nm.addEventListener('input', function () { m.name = nm.value; touch(); });
      var sg = document.createElement('input');
      sg.className = 'sg'; sg.value = m.sg; sg.placeholder = '0.00'; sg.inputMode = 'decimal';
      sg.setAttribute('aria-label', (i + 1) + '번 비중');
      sg.addEventListener('input', function () { m.sg = sg.value; touch(); });
      var del = document.createElement('button');
      del.type = 'button'; del.setAttribute('aria-label', (m.name || '재질') + ' 삭제');
      del.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>';
      del.addEventListener('click', function () { draft.splice(i, 1); renderMats(); touch(); });
      row.appendChild(nm); row.appendChild(sg); row.appendChild(del);
      listEl.appendChild(row);
    });
  }
  function openMats() {
    draft = copyMats(loadMats()); dirty = false;
    renderMats(); setStatus('재질 ' + draft.length + '개');
  }
  $('#matAdd').addEventListener('click', function () {
    draft.push({ name: '', sg: '' }); renderMats(); touch();
    var ins = $$('input', listEl); if (ins.length) ins[ins.length - 2].focus();
  });
  $('#matDefault').addEventListener('click', function () { draft = copyMats(DEF_MATS); renderMats(); touch(); });
  $('#matSave').addEventListener('click', function () {
    var clean = draft.filter(function (m) { return String(m.name).trim() !== '' && isFinite(parseFloat(m.sg)); })
                     .map(function (m) { return { name: String(m.name).trim(), sg: String(parseFloat(m.sg)) }; });
    if (!clean.length) { setStatus('재질을 하나 이상 입력해 주세요', true); return; }
    var ok = saveMats(clean);
    draft = copyMats(clean); dirty = false; renderMats();
    setStatus(ok ? '저장되었습니다' : '저장하지 못했어요', !ok);
    reloadWeightMats();
  });

  /* ---------------- 화면 이동 (안드로이드 뒤로가기 지원) ---------------- */
  var screens = { '': $('#scr-splash'), calc: $('#scr-calc'), materials: $('#scr-materials') };
  function route() {
    var name = location.hash.replace('#', '');
    if (!screens[name]) name = '';
    Object.keys(screens).forEach(function (k) { screens[k].classList.toggle('active', k === name); });
    if (name === 'materials') openMats();
    if (name === 'calc') { reloadWeightMats(); markDot(); }
  }
  window.addEventListener('hashchange', route);
  $$('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { location.hash = b.dataset.go; });
  });
  $$('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (history.length > 1 && location.hash) history.back(); else location.hash = '';
    });
  });
  route();
  markDot();
})();
