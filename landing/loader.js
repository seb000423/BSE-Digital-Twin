/*!
 * BSE Loader — anime.js v4 기반 로딩 모션
 * 사용법:
 *   1) anime.js 로드: https://cdn.jsdelivr.net/npm/animejs@4.5.0/dist/bundles/anime.umd.min.js
 *   2) 그 다음 이 파일(loader.js) 로드
 *
 *   BSELoader.show('build')        // 'boot' | 'build' | 'monitor'
 *   BSELoader.progress(40)         // 실제 진행률을 알 때 (0~100), 모르면 생략 → 자동으로 90%까지 천천히 증가
 *   BSELoader.tasks([{ id, ko, en, weight }])   // 진짜 진행률: 할 일 목록을 주면 끝난 일의 무게 합으로 %를 계산하고,
 *   BSELoader.done('three')                       //   아직 안 끝난 첫 일의 이름이 "지금 무엇을 받는 중"으로 표시됨
 *   await BSELoader.hide()         // 100% 채우고 사라짐
 *   await BSELoader.run(promise, 'monitor')   // show → promise 끝나면 hide
 *
 * 첫 페이지 로딩: 자동으로 'boot' 모드가 뜨고 window load 때 사라짐.
 *   끄려면 <script src="loader.js" data-boot="false"></script>
 * 링크/버튼 자동 연결: <a href="/build" data-loader="build">Build</a>
 */
(function () {
  'use strict';
  var A = window.anime;
  if (!A) { console.warn('[BSELoader] anime.js가 먼저 로드되어야 합니다.'); return; }

  var thisScript = document.currentScript;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TEXT = {
    ko: {
      boot:    { label: 'BSE : Digital Twin', steps: ['구성 로딩 중'] },
      build:   { label: 'Build', steps: ['구성 로딩 중', '에셋 로딩 중'] },
      monitor: { label: 'Monitor', steps: ['구성 로딩 중', '데이터 로딩 중'] }
    },
    en: {
      boot:    { label: 'BSE : Digital Twin', steps: ['Loading setup'] },
      build:   { label: 'Build', steps: ['Loading setup', 'Loading assets'] },
      monitor: { label: 'Monitor', steps: ['Loading setup', 'Loading data'] }
    }
  };

  function lang() {
    var on = document.querySelector('[data-lang].on, [data-lang][aria-pressed="true"]');
    var l = on ? on.getAttribute('data-lang') : (document.documentElement.lang || 'ko');
    return l.slice(0, 2) === 'en' ? 'en' : 'ko';
  }

  /* ---------- 스타일 (사이트의 남색 청사진 색을 그대로 씀) ---------- */
  var CSS = [
    '.bse-loader{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;',
    'background-color:var(--background,#0f2a45);',
    'background-image:radial-gradient(ellipse 60% 55% at 50% 50%,var(--glow,#1f4e7a),transparent),',
    'linear-gradient(rgba(207,228,245,.06) 1px,transparent 1px),',
    'linear-gradient(90deg,rgba(207,228,245,.06) 1px,transparent 1px);background-size:auto,24px 24px,24px 24px;',
    'color:var(--foreground,#eef5fb);font-family:var(--font-sans,system-ui,sans-serif);opacity:0}',
    '.bse-loader[hidden]{display:none}',
    '.bse-loader__inner{display:flex;flex-direction:column;align-items:center;gap:18px}',
    '.bse-loader svg{width:168px;height:auto;overflow:visible;margin-bottom:6px}',
    '.bse-loader .links{color:var(--foreground,#eef5fb);opacity:.5}',
    /* 고리 안을 지나가는 빛 — 다른 고리 밑으로 지날 때는 가려져서 "통과"하는 게 보임 */
    '.bse-loader .orbit{fill:none;stroke:var(--line,#cfe4f5);stroke-linecap:round;stroke-linejoin:round}',
    '.bse-loader .runs{filter:drop-shadow(0 0 2px var(--line,#cfe4f5))}',
    '.bse-loader.is-static .runs{display:none}',
    '.bse-loader.is-static .links{opacity:1}',
    '.bse-loader .core{color:var(--foreground,#eef5fb)}',
    '.bse-loader .vx{transform-box:fill-box;transform-origin:center}',
    '.bse-loader .ring{fill:none;stroke:var(--line,#cfe4f5);stroke-width:.8;transform-box:fill-box;transform-origin:center;opacity:0}',
    /* 한 줄: 내 페이지 — 작업 내용 — % */
    '.bse-loader__meta{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;font-size:12px;font-variant-numeric:tabular-nums}',
    '.bse-loader__label{font-weight:600;letter-spacing:.04em;white-space:nowrap}',
    '.bse-loader__sep{width:16px;height:1px;background:currentColor;opacity:.35;flex:none}',
    '.bse-loader__pct{font-weight:600;letter-spacing:.04em;min-width:3.5ch;text-align:right}',
    '.bse-loader__step{color:var(--muted-foreground,#a3b9cd);height:1.4em;line-height:1.4em;overflow:hidden;white-space:nowrap}',
    '.bse-loader__step span{display:block}',
    'html.bse-loading,html.bse-loading body{overflow:hidden}'
  ].join('');

  /* ---------- 로고: 보로메오 삼각형 (헤더 로고와 같은 치수) ----------
     둥근 삼각형 고리 3개(테두리 선)가 서로 엮여 있음: 고리 0은 2 밑, 1은 0 밑, 2는 1 밑.
     로딩 중에는 고리들이 바깥으로 벌어진 "펼친" 상태(OPEN)가 되고,
     각 고리 안을 빛줄기가 따라 돌며 다른 고리 밑을 통과함.
     빛줄기가 고리의 바깥 꼭짓점을 지날 때 가운데 B·S·E 중 그 고리의 원이 퐁당 퍼짐. */
  var R = 26, CR = 4, W = 6, GAP = 1.8, HOLLOW = 1.4;  // 삼각형 크기, 모서리 둥글기, 띠 두께, 교차 틈, 테두리 두께
  var CLOSED = 12, OPEN = 17;                           // 가운데에서 고리까지 거리: 로고 상태 / 펼친 상태
  var CX = 50, CY = 53;
  var OVER = [2, 0, 1];                                  // 고리 i 위로 지나가는 고리
  var CORE = { x: 50, y: 55, rad: 10.5, r: 4.5 };       // 가운데 B·S·E 삼각형
  var LETTERS = ['B', 'E', 'S'];                         // 고리 0 위, 1 오른쪽 아래, 2 왼쪽 아래
  var PHASE = [0, 1 / 3, 2 / 3];                         // 빛줄기 위치: B → S → E 순서로 꼭짓점을 지남
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 'bsl' + Math.random().toString(36).slice(2, 7);

  function f(v) { return Math.round(v * 100) / 100; }
  function dir(k) { var a = (-90 + 120 * k) * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; }

  // 꼭짓점 k에서 시작해 시계 방향으로 도는 둥근 삼각형 (가운데 0,0 기준)
  function ringPath(k, close) {
    var t = CR * Math.sqrt(3), pts = [], s = [], i;
    for (i = 0; i < 3; i++) { var u = dir(k + i); pts.push([R * u[0], R * u[1]]); }
    for (i = 0; i < 3; i++) {
      var p = pts[i], a = pts[(i + 2) % 3], b = pts[(i + 1) % 3];
      var la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      s.push([[p[0] + (a[0] - p[0]) / la * t, p[1] + (a[1] - p[1]) / la * t],
              [p[0] + (b[0] - p[0]) / lb * t, p[1] + (b[1] - p[1]) / lb * t]]);
    }
    // 꼭짓점 k의 모서리 호 한가운데서 시작 → 빛줄기 머리가 0일 때 정확히 바깥 꼭짓점
    var mid = [pts[0][0] * (1 - CR / R), pts[0][1] * (1 - CR / R)];
    var d = 'M' + f(mid[0]) + ' ' + f(mid[1]) + ' A' + CR + ' ' + CR + ' 0 0 1 ' + f(s[0][1][0]) + ' ' + f(s[0][1][1]);
    for (i = 1; i <= 3; i++) {
      var q = s[i % 3];
      d += ' L' + f(q[0][0]) + ' ' + f(q[0][1]);
      d += ' A' + CR + ' ' + CR + ' 0 0 1 ' + f(i === 3 ? mid[0] : q[1][0]) + ' ' + f(i === 3 ? mid[1] : q[1][1]);
    }
    return close ? d + ' Z' : d;
  }

  function corePts(r) {
    return [0, 1, 2].map(function (k) { var u = dir(k); return [CORE.x + r * u[0], CORE.y + r * u[1]]; });
  }
  var cut = corePts(CORE.rad + CORE.r + 1.5).map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join(' ');
  var vx = corePts(CORE.rad);

  function use(k, attrs) { return '<use href="#' + uid + 'p' + k + '" data-ring="' + k + '" fill="none" ' + attrs + '/>'; }
  var clear = '<polygon points="' + cut + '" fill="#000" stroke="#000" stroke-width="3" stroke-linejoin="round"/>';
  var area = 'x="0" y="0" width="100" height="100"';

  var SVG = '<svg viewBox="6 2 88 82" aria-hidden="true"><defs>';
  for (var k = 0; k < 3; k++) {
    SVG += '<path id="' + uid + 'p' + k + '" d="' + ringPath(k, true) + '"/>';
  }
  for (k = 0; k < 3; k++) {
    var over = use(OVER[k], 'stroke="#000" stroke-width="' + (W + 2 * GAP) + '"');
    // 띠: 테두리만 남기고, 위로 지나가는 고리와 가운데 자리는 비움
    SVG += '<mask id="' + uid + 'b' + k + '" maskUnits="userSpaceOnUse" ' + area + '>' +
           use(k, 'stroke="#fff" stroke-width="' + W + '"') +
           use(k, 'stroke="#000" stroke-width="' + f(W - 2 * HOLLOW) + '"') + over + clear + '</mask>';
    // 빛줄기: 위로 지나가는 고리 밑에서는 가려짐
    SVG += '<mask id="' + uid + 's' + k + '" maskUnits="userSpaceOnUse" ' + area + '>' +
           '<rect ' + area + ' fill="#fff"/>' + over + clear + '</mask>';
  }
  SVG += '<mask id="' + uid + 'l" maskUnits="userSpaceOnUse" ' + area + '><rect ' + area + ' fill="#fff"/>' +
         '<g font-family="Arial, Helvetica, sans-serif" font-size="5.5" font-weight="800" text-anchor="middle">' +
         vx.map(function (p, i) { return '<text x="' + f(p[0]) + '" y="' + f(p[1]) + '" dy="0.36em">' + LETTERS[i] + '</text>'; }).join('') +
         '</g></mask></defs>';
  SVG += '<g class="links">';
  for (k = 0; k < 3; k++) SVG += '<rect ' + area + ' fill="currentColor" mask="url(#' + uid + 'b' + k + ')"/>';
  SVG += '</g><g class="runs">';
  var open = [0, 1, 2].map(function (k) { return ringPath(k, false); });
  for (k = 0; k < 3; k++) {
    SVG += '<g mask="url(#' + uid + 's' + k + ')"><g data-ring="' + k + '">';
    // 같은 경로 3개: 지금 위치 + 시작점을 넘어가는 앞뒤 조각 → 끊김 없는 루프
    for (var c = 0; c < 3; c++) SVG += '<path class="orbit" stroke-width="' + f(W - 2 * HOLLOW) + '" d="' + open[k] + '"/>';
    SVG += '</g></g>';
  }
  SVG += '</g><g class="core">' +
         vx.map(function (p) { return '<circle class="ring" cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + CORE.r + '"/>'; }).join('') +
         '<g mask="url(#' + uid + 'l)" fill="currentColor">' +
         '<polygon points="' + vx.map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join(' ') + '" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>' +
         vx.map(function (p) { return '<g class="vx"><circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + CORE.r + '"/></g>'; }).join('') +
         '</g></g></svg>';

  /* ---------- 상태 ---------- */
  var el, svgTl, spreadAnim, raf, mode = 'boot';
  var shown = 0, target = 0, auto = true, stepIdx = -1, visible = false, hidePromise = null;
  var taskList = null;                                 // 진짜 진행률: [{id, ko, en, weight, done}]
  var stepText = '';                                   // 지금 표시 중인 문구
  var spread = { d: CLOSED };

  function build() {
    if (el) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    el = document.createElement('div');
    el.className = 'bse-loader';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.hidden = true;
    el.innerHTML =
      '<div class="bse-loader__inner">' +
        SVG +
        '<div class="bse-loader__meta">' +
          '<span class="bse-loader__label"></span><span class="bse-loader__sep"></span>' +
          '<span class="bse-loader__step"><span></span></span><span class="bse-loader__sep"></span>' +
          '<span class="bse-loader__pct">0%</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    placeRings();
  }

  // 고리 3개를 가운데에서 spread.d 만큼 바깥으로 옮김 (띠, 마스크, 빛줄기 모두 함께)
  function placeRings() {
    var nodes = el.querySelectorAll('[data-ring]');
    for (var i = 0; i < nodes.length; i++) {
      var k = +nodes[i].getAttribute('data-ring'), u = dir(k);
      nodes[i].setAttribute('transform', 'translate(' + f(CX + spread.d * u[0]) + ' ' + f(CY + spread.d * u[1]) + ')');
    }
  }

  function spreadTo(d, duration, ease) {
    if (spreadAnim) spreadAnim.pause();
    if (reduce) { spread.d = d; placeRings(); return Promise.resolve(); }
    spreadAnim = A.animate(spread, { d: d, duration: duration, ease: ease, onUpdate: placeRings });
    return spreadAnim;
  }

  function makeTimeline() {
    var T = 3000;                              // 빛줄기가 고리를 한 바퀴 도는 시간(ms)
    var runs = el.querySelectorAll('.runs g[data-ring]');
    var dots = el.querySelectorAll('.vx');
    var rings = el.querySelectorAll('.core .ring');
    var L = runs[0].querySelector('.orbit').getTotalLength();
    var seg = 30;                              // 빛줄기 길이

    var tl = A.createTimeline({ loop: true });
    for (var k = 0; k < 3; k++) {
      var paths = runs[k].querySelectorAll('.orbit');
      A.utils.set(paths, { strokeDasharray: seg + ' ' + (L * 4) });
      var base = seg - L * PHASE[k];
      for (var c = 0; c < 3; c++) {
        var o = base + (c - 1) * L;            // 머리 위치가 x+L, x, x-L 인 조각 3개
        tl.add(paths[c], { strokeDashoffset: [o, o - L], duration: T, ease: 'linear' }, 0);
      }
      // 머리가 바깥 꼭짓점을 지나는 순간, 이 고리의 원(B/E/S)이 퐁당
      var at = T * ((1 - PHASE[k]) % 1);
      tl.add(rings[k], { scale: [1, 2.1], opacity: [0.7, 0], duration: 800, ease: 'outQuad' }, at)
        .add(dots[k], { scale: [1, 1.15, 1], duration: 380, ease: 'outQuad' }, at);
    }
    return tl;
  }

  function setStep(i) {
    var steps = TEXT[lang()][mode].steps;
    setStepText(steps[Math.min(i, steps.length - 1)]);
  }

  function setStepText(txt) {
    if (txt === stepText) return;
    stepText = txt;
    var span = el.querySelector('.bse-loader__step span');
    if (reduce || !span.textContent) { span.textContent = txt; return; }
    A.animate(span, { y: [0, -8], opacity: [1, 0], duration: 160, ease: 'inQuad' }).then(function () {
      span.textContent = txt;
      A.animate(span, { y: [8, 0], opacity: [0, 1], duration: 220, ease: 'outQuad' });
    });
  }

  // 할 일 목록 → 끝난 무게 / 전체 무게. 아직 안 끝난 첫 일이 "지금 받는 중"
  function taskProgress() {
    var total = 0, got = 0, current = null;
    for (var i = 0; i < taskList.length; i++) {
      var t = taskList[i];
      total += t.weight; if (t.done) got += t.weight; else { got += t.weight * (t.part || 0); if (!current) current = t; }
    }
    return { pct: total ? got / total * 100 : 0, current: current };
  }

  function tick() {
    if (taskList) {
      var tp = taskProgress();
      target = Math.max(target, tp.pct);
      if (tp.current) setStepText(tp.current[lang()] || tp.current.ko);
    } else if (auto && target < 90) target += (90 - target) * 0.006;   // 모를 땐 천천히 90%까지
    shown += (target - shown) * (target >= 100 ? 0.18 : 0.08);
    if (target - shown < 0.3) shown = target;
    el.querySelector('.bse-loader__pct').textContent = Math.round(shown) + '%';
    if (!taskList) setStep(shown < 50 ? 0 : 1);
    raf = requestAnimationFrame(tick);
  }

  /* ---------- 공개 API ---------- */
  function show(m) {
    build();
    mode = TEXT.ko[m] ? m : 'boot';
    shown = 0; target = 0; auto = true; stepIdx = -1; hidePromise = null; stepText = ''; taskList = null;
    el.querySelector('.bse-loader__label').textContent = TEXT[lang()][mode].label;
    el.querySelector('.bse-loader__step span').textContent = '';
    el.querySelector('.bse-loader__inner').style.opacity = '';
    el.querySelector('.bse-loader__inner').style.transform = '';
    el.hidden = false;
    document.documentElement.classList.add('bse-loading');

    if (!visible) {
      visible = true;
      A.animate(el, { opacity: [0, 1], duration: reduce ? 0 : 220, ease: 'outQuad' });
      if (svgTl) svgTl.revert();
      if (reduce) {
        el.classList.add('is-static');   // 움직임 줄이기: 닫힌 로고만 정지 상태로 표시
        spread.d = CLOSED; placeRings();
      } else {
        spread.d = CLOSED; placeRings();
        spreadTo(OPEN, 900, 'outBack(1.4)');   // 로고가 펼쳐짐
        svgTl = makeTimeline();
      }
      cancelAnimationFrame(raf);
      tick();
    }
    return api;
  }

  function progress(p) {
    auto = false;
    target = Math.max(target, Math.min(100, +p || 0));
    return api;
  }

  function tasks(list) {
    auto = false;
    taskList = list.map(function (t) { return { id: t.id, ko: t.ko, en: t.en || t.ko, weight: t.weight || 1, done: !!t.done, part: 0 }; });
    return api;
  }

  function done(id) {
    if (!taskList) return api;
    for (var i = 0; i < taskList.length; i++) if (taskList[i].id === id) taskList[i].done = true;
    return api;
  }

  function part(id, fraction) {           // 한 일의 일부만 끝났을 때 (받은 바이트 / 전체 바이트)
    if (!taskList) return api;
    for (var i = 0; i < taskList.length; i++) if (taskList[i].id === id) taskList[i].part = Math.max(taskList[i].part || 0, Math.min(1, fraction || 0));
    return api;
  }

  function hide() {
    if (!visible) return Promise.resolve();
    if (hidePromise) return hidePromise;
    auto = false; target = 100;
    if (taskList) {                       // 꾸민 문구("마무리 중" 등) 없이, 마지막 진짜 일의 이름이 그대로 남음
      for (var i = 0; i < taskList.length; i++) taskList[i].done = true;
      setStepText(taskList[taskList.length - 1][lang()] || taskList[taskList.length - 1].ko);
    }
    hidePromise = new Promise(function (res) {
      (function wait() { shown >= 99.5 ? res() : requestAnimationFrame(wait); })();
    }).then(function () {
      return spreadTo(CLOSED, 520, 'inOutQuad');   // 다시 로고 모양으로 접힘
    }).then(function () {
      return new Promise(function (r) { setTimeout(r, reduce ? 0 : 160); });
    }).then(function () {
      return A.animate(el.querySelector('.bse-loader__inner'), {
        opacity: 0, y: -10, duration: reduce ? 0 : 280, ease: 'inQuad'
      });
    }).then(function () {
      return A.animate(el, { opacity: 0, duration: reduce ? 0 : 320, ease: 'outQuad' });
    }).then(function () {
      cancelAnimationFrame(raf);
      if (svgTl) { svgTl.revert(); svgTl = null; }
      el.hidden = true; visible = false;
      document.documentElement.classList.remove('bse-loading');
    });
    return hidePromise;
  }

  function run(task, m, minMs) {
    show(m);
    var p = typeof task === 'function' ? task() : task;
    var min = new Promise(function (r) { setTimeout(r, minMs == null ? 900 : minMs); });
    return Promise.all([p, min]).then(
      function (v) { return hide().then(function () { return v[0]; }); },
      function (e) { return hide().then(function () { throw e; }); }
    );
  }

  var api = { show: show, progress: progress, tasks: tasks, done: done, part: part, hide: hide, run: run };
  window.BSELoader = api;

  /* ---------- 첫 로딩 ---------- */
  var boot = !(thisScript && thisScript.getAttribute('data-boot') === 'false');
  // <body>가 생기는 즉시 (DOMContentLoaded는 모듈 스크립트(bg.js → three.js)가 다 받아진 뒤에야 오므로 너무 늦음)
  function onReady(fn) {
    if (document.body) { fn(); return; }
    var mo = new MutationObserver(function () { if (document.body) { mo.disconnect(); fn(); } });
    mo.observe(document.documentElement, { childList: true });
    document.addEventListener('DOMContentLoaded', function () { mo.disconnect(); if (document.body) fn(); }, { once: true });
  }

  /* 첫 로딩의 진짜 할 일: 이 페이지가 실제로 받는 파일들만 ("마무리 중" 같은 꾸민 단계 없음). 파일이 도착하면(Resource Timing) 그 일이 끝난 것으로 표시 */
  var BOOT_TASKS = [
    // 화면 문구는 세 가지뿐 (구성 / 에셋 / 시뮬). 어떤 파일·라이브러리를 쓰는지는 화면에 적지 않음
    { id: 'style', ko: '구성 로딩 중', en: 'Loading setup', weight: 5, match: /style\.css/ },
    { id: 'font',  ko: '구성 로딩 중', en: 'Loading setup', weight: 10, match: /pretendard/i },
    { id: 'motion', ko: '에셋 로딩 중', en: 'Loading assets', weight: 10, match: /anime\.esm/ },
    { id: 'three', ko: '에셋 로딩 중', en: 'Loading assets', weight: 45, match: /three\.module/,
      url: 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js' },   // index.html의 importmap과 같은 주소여야 함
    { id: 'scene', ko: '시뮬 로딩 중', en: 'Loading simulation', weight: 30 }
  ];
  function watchResources() {
    function seen(name) {
      for (var i = 0; i < BOOT_TASKS.length; i++) if (BOOT_TASKS[i].match && BOOT_TASKS[i].match.test(name)) done(BOOT_TASKS[i].id);
    }
    try {
      var had = performance.getEntriesByType('resource');
      for (var i = 0; i < had.length; i++) seen(had[i].name);
      new PerformanceObserver(function (list) {
        var es = list.getEntries();
        for (var j = 0; j < es.length; j++) seen(es[j].name);
      }).observe({ type: 'resource', buffered: true });
    } catch (e) { /* 지원 안 하면 load 때 한 번에 끝남 */ }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { done('font'); });
    // 큰 파일은 바이트 단위로: 같은 주소를 미리 받으면서 받은 양을 %에 반영 (받은 파일은 브라우저 캐시에 남아 bg.js의 import가 그대로 씀)
    for (var k = 0; k < BOOT_TASKS.length; k++) (function (t) {
      if (!t.url || !window.fetch || !window.ReadableStream) return;
      fetch(t.url).then(function (res) {
        var total = +res.headers.get('content-length') || 0, got = 0, reader = res.body.getReader();
        return (function read() {
          return reader.read().then(function (r) {
            if (r.done) { done(t.id); return; }
            got += r.value.length; if (total) part(t.id, got / total);
            return read();
          });
        })();
      }).catch(function () { /* 실패하면 Resource Timing으로 도착만 확인 */ });
    })(BOOT_TASKS[k]);
    window.addEventListener('bse:scene-ready', function () { done('scene'); }, { once: true });
    window.addEventListener('bse:scene-failed', function () { done('scene'); }, { once: true });
  }

  if (boot && document.readyState !== 'complete') {
    var booted = false;
    onReady(function () { if (booted) return; booted = true; show('boot'); tasks(BOOT_TASKS); watchResources(); });
    // 너무 빨리 끝나도 펼쳐진 로고가 한 번은 보이도록 최소 1.2초
    var minBoot = new Promise(function (r) { setTimeout(r, reduce ? 0 : 1200); });
    window.addEventListener('load', function () { minBoot.then(hide); }, { once: true });
  }

  /* ---------- data-loader 자동 연결 ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-loader]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var href = a.getAttribute('href');
    show(a.getAttribute('data-loader'));
    if (href && href.charAt(0) !== '#') {
      e.preventDefault();
      setTimeout(function () { location.href = href; }, reduce ? 0 : 700);
    }
  });

  // 뒤로가기(bfcache)로 돌아왔을 때 로더가 남아있지 않게
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && el) { cancelAnimationFrame(raf); el.hidden = true; visible = false; document.documentElement.classList.remove('bse-loading'); }
  });
})();
