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
  // 파이프와 환봉은 입력값을 따로 기억합니다. 환봉 값은 앞에 'b_'를 붙여 저장합니다.
  var wPre = function (s) { return s.shape === 'bar' ? 'b_' : ''; };
  var weightDef = {
    inputs: ['od', 't', 'len', 'price', 'b_od', 'b_len', 'b_price'],
    blank: function () {
      var sg0 = mats[0] ? mats[0].sg : '';
      return { shape: 'pipe', mat: 0, sg: sg0, od: '', t: '', len: '', price: '',
               b_mat: 0, b_sg: sg0, b_od: '', b_len: '', b_price: '' };
    },
    key: function (k, s) { return k === 't' ? 't' : wPre(s) + k; },
    sync: function (c, s) {
      var p = wPre(s);
      var box = $('[data-chips]', c.el);
      box.innerHTML = '';
      mats.forEach(function (m, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = m.name;
        if (s[p + 'mat'] === i) b.classList.add('on');
        b.addEventListener('click', function () { s[p + 'mat'] = i; s[p + 'sg'] = m.sg; c.sync(); });
        box.appendChild(b);
      });
      $('[data-show="pipe"]', c.el).hidden = s.shape !== 'pipe';
    },
    compute: function (c, s) {
      var p = wPre(s), pipe = s.shape === 'pipe';
      var D = n(s[p + 'od']), T = pipe ? n(s.t) : 0, L = n(s[p + 'len']), G = n(s[p + 'sg']), P = n(s[p + 'price']);
      var ready = D > 0 && L > 0 && (!pipe || T > 0);
      var w = pipe ? ((D * D - Math.pow(D - 2 * T, 2)) * 0.785 * G * L) / 1000000
                   : (D * D * 0.785 * G * L) / 1000000;
      c.out('weight', ready ? fmt(w, 3) : '—');
      c.out('amount', ready && P > 0 ? fmt(Math.round(w * P), 0) : '—');
      c.out('formula', pipe ? '중량 = (외경² − (외경−2×두께)²) × 0.785 × 비중 × 길이 ÷ 1,000,000'
                            : '중량 = 외경² × 0.785 × 비중 × 길이 ÷ 1,000,000');
      var m = mats[s[p + 'mat']], mname = m && String(m.sg) === String(s[p + 'sg']) ? m.name : '비중 ' + s[p + 'sg'];
      c.sendData = ready && w > 0 ? {
        type: pipe ? 'pipe' : 'bar',
        title: (pipe ? '파이프' : '환봉') + ' · ' + mname,
        detail: 'Ø' + s[p + 'od'] + (pipe ? ' × t' + s.t : '') + ' × L' + s[p + 'len'] + ' · 비중 ' + s[p + 'sg'] + (P > 0 ? ' · kg ' + fmt(P, 0) + '원' : ''),
        kg: w, won: P > 0 ? Math.round(w * P) : 0
      } : null;
      setSendable(c, 'weight');
    }
  };

  /* ---------------- ② 고무롤 견적 ---------------- */
  var rollBlank = { lossT: '10', lossL: '', aOD: '', aL: '', aP: '', a2OD: '', a2L: '', a2P: '', iOD: '', iC: '', iL: '', iG: '1.5', iP: '', oOD: '', oC: '', oL: '', oG: '1.5', oP: '' };
  var rollDef = {
    inputs: Object.keys(rollBlank).filter(function (k) { return k !== 'iG' && k !== 'oG'; }).concat([]),
    blank: function () { return Object.assign({}, rollBlank); },
    compute: function (c, s) {
      var down = function (x) { return Math.floor(x / 1000) * 1000; };
      var M = n(s.lossT), N = n(s.lossL);
      var area = (n(s.aOD) * 3.14 * n(s.aL)) / 100;
      var area2 = (n(s.a2OD) * 3.14 * n(s.a2L)) / 100;   // 표면적 2 (같은 식)
      var kg = function (od, core, len, g) { return ((Math.pow(n(od) + M, 2) - Math.pow(n(core), 2)) * 0.785 * n(g) * (n(len) + N)) / 1000000; };
      var iKg = n(s.iOD) && n(s.iL) ? kg(s.iOD, s.iC, s.iL, s.iG) : 0;
      var oKg = n(s.oOD) && n(s.oL) ? kg(s.oOD, s.oC, s.oL, s.oG) : 0;
      var aAmt = down(area * n(s.aP)), a2Amt = down(area2 * n(s.a2P)), iAmt = down(iKg * n(s.iP)), oAmt = down(oKg * n(s.oP));
      var q = function (x, d, u) { return x > 0 ? fmt(x, d) + ' ' + u : '—'; };
      c.out('aQty', q(area, 1, 'cm²')); c.out('aAmt', fmt(aAmt, 0));
      c.out('a2Qty', q(area2, 1, 'cm²')); c.out('a2Amt', fmt(a2Amt, 0));
      c.out('iQty', q(iKg, 3, 'kg'));   c.out('iAmt', fmt(iAmt, 0));
      c.out('oQty', q(oKg, 3, 'kg'));   c.out('oAmt', fmt(oAmt, 0));
      c.out('totalKg', fmt(iKg + oKg, 3));
      c.out('total', fmt(aAmt + a2Amt + iAmt + oAmt, 0));
      var parts = [];
      if (iKg > 0) parts.push('속감 ' + fmt(iKg, 3) + 'kg (Ø' + s.iOD + '/' + (s.iC || 0) + ' × L' + s.iL + ')');
      if (oKg > 0) parts.push('겉감 ' + fmt(oKg, 3) + 'kg (Ø' + s.oOD + '/' + (s.oC || 0) + ' × L' + s.oL + ')');
      c.sendData = iKg + oKg > 0 ? {
        type: 'rubber',
        title: '고무 · ' + (iKg > 0 && oKg > 0 ? '속감 + 겉감' : iKg > 0 ? '속감' : '겉감'),
        detail: parts.join(' + ') + ' · LOSS 두께 ' + (s.lossT || 0) + ' / 길이 ' + (s.lossL || 0),
        kg: iKg + oKg, won: iAmt + oAmt
      } : null;
      setSendable(c, 'roll');
    }
  };
  // 비중을 바꾼 칸도 '사용 중'으로 표시
  rollDef.inputs = Object.keys(rollBlank);
  var rollUsed = function (s) { return Object.keys(rollBlank).some(function (k) { return s[k] !== rollBlank[k]; }); };

  /* ---------------- ③ 홈(그루브) 가공 + 롤 그림 (확대·이동) ---------------- */
  var fig = { k: 1, cx: 175, cy: 120, last: null };
  var grooveDef = {
    inputs: ['od', 'ang', 'lines', 'blade'],
    blank: function () { return { od: '', ang: '', lines: '', blade: '', pat: 'L' }; },
    compute: function (c, s) {
      fig.last = { c: c, D: n(s.od), deg: n(s.ang), Z: n(s.lines), B: n(s.blade), pat: s.pat || 'L' };
      renderFig();
    }
  };

  /* 홈 가공 롤 그림 계산 (측면도). k = 확대 배율.
     좌표는 그림 단위(가로 350 × 세로 240)이고, 글자·눈금 크기는 1/k 로 줄여서
     확대해도 화면에서는 같은 크기로 보이게 합니다. */
  function grooveGeometry(D, deg, Z, B, k, refX) {
    k = k || 1;
    var u = 1 / k;
    var th = deg * Math.PI / 180;
    var ok = D > 0 && Z > 0 && deg > 0;
    var A = ok ? (Math.tan(th) * (D * 3.14 / 2) * 2) / Z : NaN;
    var Dg = B / Math.cos(th), E = A - Dg, C = Math.sin(Math.PI / 2 - th) * A, Cr = C - B;
    var V = ok ? (D * 3.14) / Z : NaN;
    var r1 = function (x) { return Math.round(x * 100) / 100; };
    var P = function (x, y) { return r1(x) + ' ' + r1(y); };
    var g = {
      ok: ok, A: A, Dg: Dg, E: E, C: C, Cr: Cr, V: V, drawable: ok && deg < 89, u: u,
      groove: 'M0 0', thin: false, axial: 'M0 0', axialOk: false, axialOnBody: true,
      dX: 0, dY: 0, eX: 0, eY: 0, aX: 0, aY: 0, dShow: false,
      perp: 'M0 0', perpOk: false, cLX: 0, cLY: 0, bLX: 0, bLY: 0, bShow: false,
      ang: 'M0 0', angX: 0, angY: 0,
      small: false, focusK: 1, focusX: 175, focusY: 120,
      overlap: ok && deg < 89 && (E <= 0 || Cr <= 0)
    };
    if (!g.drawable) return g;
    var t = Math.tan(th), cs = Math.cos(th), sn = Math.sin(th);

    // 몸통 높이 150 = 외경, 가로·세로 같은 축척. 둘레 각 φ의 점: y = 중심 − R·sinφ, x = 시작 + R·φ·tanθ
    var X0 = 20, X1 = 330, CY = 105, R = 75, sc = 150 / D;
    var Apx = A * sc, Dpx = Math.max(0, Dg * sc), bpx = Math.max(0, B * sc), Cpx = C * sc;
    var spread = R * (Math.PI / 2) * t;
    var cc = Math.max(32, (refX || 175) - Apx / 2);
    var kmin = Math.ceil((X0 - spread - Dpx - cc) / Apx), kmax = Math.floor((X1 + spread - cc) / Apx);
    var steps = 16 * Math.min(8, Math.ceil(k)), path = '';
    g.thin = Dpx * k < 0.8;
    var edge = function (x0, rev) {
      var p = [];
      for (var i = 0; i <= steps; i++) {
        var j = rev ? steps - i : i, ph = -Math.PI / 2 + (Math.PI * j) / steps;
        p.push(P(x0 + R * ph * t, CY - R * Math.sin(ph)));
      }
      return p;
    };
    for (var q = kmin, cnt = 0; q <= kmax && cnt < 400; q++, cnt++) {
      var xq = cc + q * Apx, L = edge(xq, false);
      path += g.thin ? 'M' + L.join(' L') + ' ' : 'M' + L.join(' L') + ' L' + edge(xq + Dpx, true).join(' L') + ' Z ';
    }
    g.groove = path || 'M0 0';

    var tk = 4 * u;
    var vt = function (x, y) { return ' M' + P(x, y - tk) + ' L' + P(x, y + tk); };
    // 축방향 치수는 모두 롤 중심선(y = CY) 위에서 잽니다: 이 높이에서는 홈이 정면을 향해 실제 크기로 보입니다.
    //   D·E : 중심선 위 (홈 왼쪽 끝 → 홈 오른쪽 끝 → 다음 홈 왼쪽 끝)
    //   A   : 중심선보다 조금 위에 따로 (홈 왼쪽 끝 → 다음 홈 왼쪽 끝, 롤 축과 나란히)
    var xa = cc, xd = cc + Dpx, xb = cc + Apx, ay = CY - 18 * u;
    if (Apx * k >= 24 && xb <= 328) {
      g.axialOk = true;
      g.axial = 'M' + P(xa, CY) + ' H' + r1(xb) + vt(xa, CY) + vt(xd, CY) + vt(xb, CY) +
                ' M' + P(xa, CY) + ' V' + r1(ay - 4 * u) + ' M' + P(xb, CY) + ' V' + r1(ay - 4 * u) +
                ' M' + P(xa, ay) + ' H' + r1(xb) + vt(xa, ay) + vt(xb, ay);
      g.dX = (xa + xd) / 2; g.dY = CY + ((Apx - Dpx) * k >= 90 ? 13 : 26) * u; g.eX = (xd + xb) / 2; g.eY = CY + 13 * u;
      g.aX = (xa + xb) / 2; g.aY = ay - 5 * u;
      g.dShow = true;
    }
    // 직각 치수 C: 롤 표면을 펼친 좌표(가로 x = 축방향, 세로 s = 둘레 길이)에서 정확히 계산한 뒤 그림으로 옮깁니다.
    //   펼친 면에서는 홈이 곧은 선 x = 시작점 + s·tanθ 이고, 홈에 수직인 방향은 (cosθ, −sinθ) 입니다.
    //   홈 왼쪽 끝(중심선, s = 0)에서 이 방향으로 C 만큼 가면 다음 홈 왼쪽 끝에 정확히 닿고,
    //   처음 날 두께만큼 간 지점은 홈 오른쪽 끝입니다. 그림의 세로 위치는 y = 중심 − R·sin(s/R).
    var prj = function (x, s) { return [x, CY - R * Math.sin(s / R)]; };
    var dirAt = function (s) { var dx = t, dy = -Math.cos(s / R), m = Math.hypot(dx, dy) || 1; return [dx / m, dy / m]; };
    var ptick = function (x, s) {
      var p = prj(x, s), d = dirAt(s);
      return ' M' + P(p[0] - d[0] * tk, p[1] - d[1] * tk) + ' L' + P(p[0] + d[0] * tk, p[1] + d[1] * tk);
    };
    var sEnd = -Cpx * sn, xEnd = cc + Cpx * cs, sB = -bpx * sn, xB = cc + bpx * cs;
    var pEnd = prj(xEnd, sEnd), pB = prj(xB, sB);
    if (Cpx * k >= 12 && xEnd <= 328 && -sEnd < R * 0.95 && pEnd[1] <= 178) {
      g.perpOk = true;
      // 치수선은 실제 측정선에서 홈 방향(아래·왼쪽)으로 비켜서 그리고, 양 끝에서 홈 가장자리를 따라 보조선을 내립니다.
      var L0 = 20 * u, Lx = L0 + 5 * u;
      var off = function (x, s, L) { return [x - L * sn, s - L * cs]; };          // 펼친 면에서 홈 방향으로 L 만큼 이동
      var line = function (a, b, n) { var o = []; for (var i2 = 0; i2 <= n; i2++) { var f2 = i2 / n, p2 = prj(a[0] + (b[0] - a[0]) * f2, a[1] + (b[1] - a[1]) * f2); o.push(P(p2[0], p2[1])); } return 'M' + o.join(' L'); };
      var A0 = [cc, 0], A1 = [xEnd, sEnd], AB = [xB, sB];
      var O0 = off(cc, 0, L0), O1 = off(xEnd, sEnd, L0), OB = off(xB, sB, L0);
      var dtick = function (o) { var p = prj(o[0], o[1]), d = dirAt(o[1]); return ' M' + P(p[0] - d[0] * tk, p[1] - d[1] * tk) + ' L' + P(p[0] + d[0] * tk, p[1] + d[1] * tk); };
      var q = 6 * u;
      var sq = ' ' + line([O0[0] + q * cs, O0[1] - q * sn], [O0[0] + q * cs + q * sn, O0[1] - q * sn + q * cs], 1) +
               ' ' + line([O0[0] + q * cs + q * sn, O0[1] - q * sn + q * cs], [O0[0] + q * sn, O0[1] + q * cs], 1);
      g.perp = line(O0, O1, 16) + ' ' + line([cc - 1.5 * u * sn, -1.5 * u * cs], off(cc, 0, Lx), 6) + ' ' + line([xEnd - 1.5 * u * sn, sEnd - 1.5 * u * cs], off(xEnd, sEnd, Lx), 6) +
               dtick(O0) + dtick(O1) + (bpx * k > 2 ? dtick(OB) : '') + sq;
      // C 글자는 치수선과 나란히(기울여서), 치수선 바깥쪽에
      var Mc = off((O0[0] + O1[0]) / 2, (O0[1] + O1[1]) / 2, 19 * u), pm = prj(Mc[0], Mc[1]);
      var q0 = prj(O0[0], O0[1]), q1 = prj(O1[0], O1[1]);
      g.cLX = pm[0]; g.cLY = pm[1]; g.cRot = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]) * 180 / Math.PI;
      g.bShow = false;
    }
    // 각도 θ: 치수와 겹치지 않게 바로 왼쪽 홈(없으면 오른쪽 다음 홈)의 중심선 위치에서 표시
    var ax0 = (Apx * k >= 70 && cc - Apx >= 26) ? cc - Apx : (cc + 2 * Apx <= 300 ? cc + 2 * Apx : cc - Apx);
    var ar = 22 * u, al = 34 * u;
    // 각도 표시는 중심선 아래쪽: 세로(원주 방향) 아래쪽 기준선과, 아래로 내려가는 홈 방향 사이
    g.ang = 'M' + P(ax0, CY) + ' V' + r1(CY + al) + ' M' + P(ax0, CY) + ' L' + P(ax0 - al * sn, CY + al * cs) +
            ' M' + P(ax0, CY + ar) + ' A' + r1(ar) + ' ' + r1(ar) + ' 0 0 1 ' + P(ax0 - ar * sn, CY + ar * cs);
    g.angX = ax0 - 4 * u - (ar + 6 * u) * Math.sin(th / 2); g.angY = CY + (ar + 10 * u) * Math.cos(th / 2) + 3 * u;

    // 지금 배율에서 읽기 어려운지, 읽기 좋은 배율은 얼마인지
    g.small = !g.axialOk || !g.perpOk || Dpx * k < 5 || (B > 0 && bpx * k < 6);
    var want = Math.max(110 / Math.max(Cpx, 0.01), 14 / Math.max(Dpx, 0.01), 1.5);
    g.focusK = Math.min(12, Math.max(1, Math.min(want, 300 / Math.max(Apx, 0.01))));
    g.focusX = cc + Math.max(Apx, Cpx * cs) * 0.45; g.focusY = CY + Cpx * sn * 0.3;
    return g;
  }

  var KMAX = 12;
  function clampView() {
    var w = 350 / fig.k, h = 240 / fig.k;
    fig.cx = Math.min(350 - w / 2, Math.max(w / 2, fig.cx));
    fig.cy = Math.min(240 - h / 2, Math.max(h / 2, fig.cy));
  }
  function renderFig() {
    var L = fig.last; if (!L) return;
    var c = L.c, v = L, k = fig.k;
    // 홈 모양: L 좌나사, R 우나사(좌나사의 좌우 대칭), S 스파이럴(가운데서 양쪽으로 반대 방향, ∧ 모양), X 격자(좌+우)
    var pat = v.pat, PATN = { L: '좌나사', R: '우나사', S: '스파이럴', X: '격자' };
    var g = grooveGeometry(v.D, v.deg, v.Z, v.B, k, pat === 'S' ? 97.5 : 175);
    var mir = pat === 'R';                       // 치수·각도도 거울처럼 뒤집어 표시
    var MT = 'matrix(-1 0 0 1 350 0)';
    var mx = function (x) { return mir ? 350 - x : x; };
    var g2 = function (x) { return g.ok && isFinite(x) ? fmt(x, 2) : '—'; };
    c.out('A', g2(g.A)); c.out('D', g2(g.Dg)); c.out('E', g2(g.E));
    c.out('C', g2(g.C)); c.out('Cr', g2(g.Cr)); c.out('V', g2(g.V));
    c.out('cVal', g2(g.C)); c.out('crVal', g2(g.Cr));

    var el = function (id) { return document.getElementById(id); };
    var set = function (id, attrs) { var e = el(id); for (var a in attrs) e.setAttribute(a, attrs[a]); };
    var txt = function (id, s) { el(id).textContent = s; };
    var r2 = function (x) { return Math.round(x * 100) / 100; };
    var degTxt = 'θ ' + fmt(v.deg, v.deg % 1 ? 1 : 0) + '°';

    clampView();
    var w = 350 / k, h = 240 / k;
    var svg = el('grvSvg');
    svg.setAttribute('viewBox', r2(fig.cx - w / 2) + ' ' + r2(fig.cy - h / 2) + ' ' + r2(w) + ' ' + r2(h));
    $$('text[data-fs]', svg).forEach(function (t) { t.setAttribute('font-size', r2(Number(t.dataset.fs) / k)); t.setAttribute('stroke-width', r2(3 / k)); });

    set('gGroove', { d: g.groove, 'stroke-width': g.thin ? 1.2 : 0 });
    set('gGroove2', { d: g.groove, 'stroke-width': g.thin ? 1.2 : 0 });
    set('gTA', { transform: mir ? MT : '' });
    set('gClipA', { 'clip-path': pat === 'S' ? 'url(#grvHalfL)' : '' });
    set('gClipB', { 'clip-path': pat === 'S' ? 'url(#grvHalfR)' : '', opacity: g.drawable && (pat === 'S' || pat === 'X') ? 1 : 0 });
    set('gMid', { opacity: g.drawable && pat === 'S' ? 1 : 0 });
    ['gAxialA', 'gAxialB', 'gPerpA', 'gPerpB', 'gAngA', 'gAngB'].forEach(function (id) { set(id, { transform: mir ? MT : '' }); });
    set('gEmpty', { opacity: g.drawable ? 0 : 1 });
    set('gAxialG', { opacity: g.axialOk ? 1 : 0 });
    set('gAxialA', { d: g.axial, opacity: g.axialOnBody ? 1 : 0 }); set('gAxialB', { d: g.axial });
    ['gD', 'gE', 'gA'].forEach(function (id) {
      var onBody = g.axialOnBody;
      set(id, onBody ? { fill: '#FFB48A', stroke: '#15181B' } : { fill: id === 'gA' ? '#C2410C' : '#17191C', stroke: 'none' });
    });
    set('gD', { x: r2(mx(g.dX)), y: r2(g.dY), opacity: g.dShow ? 1 : 0, 'text-anchor': 'middle' }); txt('gD', 'D ' + g2(g.Dg));
    set('gE', { x: r2(mx(g.eX)), y: r2(g.eY) }); txt('gE', 'E ' + g2(g.E));
    set('gA', { x: r2(mx(g.aX)), y: r2(g.aY) }); txt('gA', 'A ' + g2(g.A));
    set('gPerp', { opacity: g.perpOk ? 1 : 0 });
    set('gPerpA', { d: g.perp }); set('gPerpB', { d: g.perp });
    set('gC', { x: r2(mx(g.cLX)), y: r2(g.cLY), 'text-anchor': 'middle', transform: 'rotate(' + r2(mir ? -(g.cRot || 0) : (g.cRot || 0)) + ' ' + r2(mx(g.cLX)) + ' ' + r2(g.cLY) + ')' }); txt('gC', 'C ' + g2(g.C) + (v.B > 0 ? ' (날 ' + fmt(v.B, v.B % 1 ? 1 : 0) + ')' : ''));
    set('gB', { x: r2(mx(g.bLX)), y: r2(g.bLY), opacity: g.bShow ? 1 : 0, 'text-anchor': mir ? 'start' : 'end' }); txt('gB', '날 ' + fmt(v.B, v.B % 1 ? 1 : 0));
    set('gAngG', { opacity: g.drawable ? 1 : 0 });
    set('gAngA', { d: g.ang }); set('gAngB', { d: g.ang });
    set('gAngT', { x: r2(mir ? 350 - g.angX + 0 : g.angX), y: r2(g.angY), 'text-anchor': mir ? 'start' : 'end' }); txt('gAngT', degTxt);

    c.out('figCaption', g.drawable ? degTxt + ' · ' + v.Z + '줄 · Ø' + v.D : '');
    svg.setAttribute('aria-label', g.drawable
      ? PATN[pat] + ' 홈, 외경 ' + v.D + 'mm 롤에 ' + v.Z + '줄 ' + v.deg + '도 홈이 피치 ' + g2(g.A) + 'mm로 새겨진 그림, ' + fmt(k, 1) + '배'
      : '홈 형상 그림, 값을 입력하면 표시');
    el('grvWarn').hidden = !g.overlap;
    txt('zLevel', '×' + fmt(k, 1));
    el('zOut').disabled = k <= 1.001; el('zIn').disabled = k >= KMAX - 0.001;
    var fb = el('zFocus');
    fb.hidden = !(g.drawable && g.small && g.focusK > k * 1.2);
    fig.focus = { k: g.focusK, x: mx(g.focusX), y: g.focusY };
    svg.style.touchAction = k > 1.001 ? 'none' : 'pan-x pan-y';
  }

  function zoomAt(newK, vx, vy, sx, sy) {
    // (vx,vy) 그림 좌표가 화면 비율 (sx,sy) 위치에 그대로 머물도록 확대
    newK = Math.min(KMAX, Math.max(1, newK));
    var w = 350 / newK, h = 240 / newK;
    fig.k = newK;
    fig.cx = vx - sx * w + w / 2; fig.cy = vy - sy * h + h / 2;
    renderFig();
  }
  function toView(clientX, clientY) {
    var r = document.getElementById('grvSvg').getBoundingClientRect();
    var w = 350 / fig.k, h = 240 / fig.k;
    var sx = (clientX - r.left) / r.width, sy = (clientY - r.top) / r.height;
    return { x: fig.cx - w / 2 + sx * w, y: fig.cy - h / 2 + sy * h, sx: sx, sy: sy, rw: r.width, rh: r.height };
  }
  (function bindFigGestures() {
    var svg = document.getElementById('grvSvg');
    var pts = {}, pinch = null, pan = null, lastTap = 0, lastTapXY = null;
    var count = function () { return Object.keys(pts).length; };
    svg.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { svg.setPointerCapture(e.pointerId); } catch (er) {}
      if (count() === 2) {
        var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]];
        var mid = toView((a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: fig.k, vx: mid.x, vy: mid.y };
        pan = null;
      } else if (count() === 1 && fig.k > 1.001) {
        pan = { x: e.clientX, y: e.clientY, cx: fig.cx, cy: fig.cy };
      }
      if (fig.k > 1.001 || count() === 2) e.preventDefault();
    });
    svg.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch && count() === 2) {
        var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        var r = svg.getBoundingClientRect();
        var sx = ((a.x + b.x) / 2 - r.left) / r.width, sy = ((a.y + b.y) / 2 - r.top) / r.height;
        zoomAt(pinch.k0 * d / pinch.d0, pinch.vx, pinch.vy, sx, sy);
        e.preventDefault();
      } else if (pan) {
        var rr = svg.getBoundingClientRect();
        fig.cx = pan.cx - (e.clientX - pan.x) * (350 / fig.k) / rr.width;
        fig.cy = pan.cy - (e.clientY - pan.y) * (240 / fig.k) / rr.height;
        renderFig();
        e.preventDefault();
      }
    });
    var up = function (e) {
      var wasPinch = !!pinch;
      delete pts[e.pointerId];
      if (count() < 2) pinch = null;
      if (count() === 0) {
        var moved = pan && Math.hypot(e.clientX - pan.x, e.clientY - pan.y) > 8;
        pan = null;
        if (!wasPinch && !moved && e.type === 'pointerup') {
          var now = Date.now();
          if (now - lastTap < 320 && lastTapXY && Math.hypot(e.clientX - lastTapXY.x, e.clientY - lastTapXY.y) < 30) {
            var p = toView(e.clientX, e.clientY);
            if (fig.k > 1.2) { fig.k = 1; fig.cx = 175; fig.cy = 120; renderFig(); }
            else zoomAt(Math.max(3, (fig.focus && fig.focus.k) || 3), p.x, p.y, p.sx, p.sy);
            lastTap = 0;
          } else { lastTap = now; lastTapXY = { x: e.clientX, y: e.clientY }; }
        }
      }
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = toView(e.clientX, e.clientY);
      zoomAt(fig.k * (e.deltaY < 0 ? 1.25 : 0.8), p.x, p.y, p.sx, p.sy);
    }, { passive: false });
    var step = function (f) { zoomAt(fig.k * f, fig.cx, fig.cy, 0.5, 0.5); };
    document.getElementById('zIn').addEventListener('click', function () { step(1.6); });
    document.getElementById('zOut').addEventListener('click', function () { step(1 / 1.6); });
    document.getElementById('zFit').addEventListener('click', function () { fig.k = 1; fig.cx = 175; fig.cy = 120; renderFig(); });
    document.getElementById('zFocus').addEventListener('click', function () {
      var f = fig.focus; if (!f) return;
      fig.k = f.k; fig.cx = f.x; fig.cy = f.y; renderFig();
    });
  })();

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
    weight.slots.forEach(function (s) { ['', 'b_'].forEach(function (p) { if (s[p + 'mat'] >= mats.length) { s[p + 'mat'] = 0; s[p + 'sg'] = mats[0] ? mats[0].sg : ''; } }); });
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

  /* ---------------- ⑤ 합산 ---------------- */
  var SKEY = 'dsroll.sum';
  var sumItems = (function () { try { var v = JSON.parse(localStorage.getItem(SKEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } })();
  function saveSum() { try { localStorage.setItem(SKEY, JSON.stringify(sumItems)); } catch (e) {} }
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }
  function renderSum() {
    var list = $('#sumList'); list.innerHTML = '';
    var totKg = 0, totWon = 0;
    sumItems.forEach(function (it, i) {
      var q = Math.max(0, Number(it.qty) || 0);
      totKg += it.kg * q; totWon += it.won * q;
      var el = document.createElement('div'); el.className = 'sumitem';
      var tag = { pipe: '파이프', bar: '환봉', rubber: '고무' }[it.type] || '기타';
      el.innerHTML =
        '<div class="sumtop"><span class="sumtag t-' + it.type + '">' + tag + '</span>' +
        '<div class="sumtitle"><b></b><small></small></div>' +
        '<button type="button" class="sumdel"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg></button></div>' +
        '<div class="sumbottom"><div class="qty"><button type="button" class="qm">−</button><input inputmode="numeric"><span>개</span><button type="button" class="qp">＋</button></div>' +
        '<div class="sumval"><b></b><small></small></div></div>';
      el.querySelector('.sumtitle b').textContent = (i + 1) + '. ' + it.title;
      el.querySelector('.sumtitle small').textContent = it.detail + (it.from ? ' · ' + it.from : '');
      el.querySelector('.sumdel').setAttribute('aria-label', (i + 1) + '번 항목 삭제');
      var qi = el.querySelector('.qty input'); qi.value = it.qty; qi.setAttribute('aria-label', (i + 1) + '번 항목 수량');
      el.querySelector('.qm').setAttribute('aria-label', '수량 줄이기'); el.querySelector('.qp').setAttribute('aria-label', '수량 늘리기');
      el.querySelector('.sumval b').textContent = fmt(it.kg * q, 3) + ' kg';
      el.querySelector('.sumval small').textContent = it.won > 0 ? fmt(it.won * q, 0) + ' 원' : '금액 없음';
      var setQ = function (v) { it.qty = Math.max(1, Math.round(v) || 1); saveSum(); renderSum(); };
      el.querySelector('.qm').addEventListener('click', function () { setQ((Number(it.qty) || 1) - 1); });
      el.querySelector('.qp').addEventListener('click', function () { setQ((Number(it.qty) || 1) + 1); });
      qi.addEventListener('change', function () { setQ(Number(qi.value)); });
      el.querySelector('.sumdel').addEventListener('click', function () { sumItems.splice(i, 1); saveSum(); renderSum(); toast('항목을 지웠어요'); });
      list.appendChild(el);
    });
    $('#sumEmpty').hidden = sumItems.length > 0;
    $('#sumCount').textContent = sumItems.length + '개 항목';
    $('#sumKg').textContent = fmt(totKg, 3);
    $('#sumWon').textContent = fmt(totWon, 0);
    var badge = $('#sumBadge'); badge.hidden = !sumItems.length; badge.textContent = sumItems.length;
    $('#sumReset').disabled = !sumItems.length;
  }
  function setSendable(c, k) {
    var b = c.el.querySelector('[data-send="' + k + '"]');
    if (b) b.disabled = !c.sendData;
  }
  function sendFrom(c) {
    if (!c.sendData) { toast('먼저 값을 입력해 계산해 주세요'); return; }
    var d = c.sendData;
    sumItems.push({ type: d.type, title: d.title, detail: d.detail, kg: d.kg, won: d.won, qty: 1, from: (c.cur + 1) + '번 칸' });
    saveSum(); renderSum();
    pager.scrollTo({ left: 4 * pager.clientWidth, behavior: 'smooth' });
    toast(d.title + ' ' + fmt(d.kg, 3) + 'kg 보냈어요');
  }
  $('[data-send="weight"]').addEventListener('click', function () { sendFrom(weight); });
  $('[data-send="roll"]').addEventListener('click', function () { sendFrom(roll); });
  $('#sumReset').addEventListener('click', function () {
    if (!sumItems.length) return;
    sumItems = []; saveSum(); renderSum(); toast('합산 목록을 초기화했어요');
  });
  renderSum();
  setSendable(weight, 'weight'); setSendable(roll, 'roll');

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
    if (name === 'calc') {
      reloadWeightMats();
      if (goPage != null) {   // 첫 화면 이름표로 들어온 경우 그 계산기 장으로 바로 이동
        var gp = goPage; goPage = null;
        pager.style.scrollBehavior = 'auto';
        pager.scrollLeft = gp * pager.clientWidth;
        requestAnimationFrame(function () { pager.scrollLeft = gp * pager.clientWidth; pager.style.scrollBehavior = ''; markDot(); });
      }
      markDot();
    }
  }
  var goPage = null;
  $$('[data-goto]').forEach(function (b) {
    b.addEventListener('click', function () {
      goPage = Number(b.dataset.goto);
      if (location.hash === '#calc') route(); else location.hash = 'calc';
    });
  });
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
