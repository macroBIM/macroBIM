/*
    bim_draw_test_core.js — SHARED 2D drawing core (window.RWSVG).

    Promoted to the canonical rendering core for all retaining-wall-style SVG
    drawings. Consumers: the Konva-based section TEST builds (lifting lug /
    I-beam / box1cell) AND the Pier input elevation (bim_pier_test.js).
    Any module that expresses its geometry through the KonvaViewer-style
    primitive API (addLine/addArc/addDimLinear) renders here with one uniform
    look (dims, fonts, zoom/pan), so styling lives in one place.

    Backward-compatible: existing consumers are unaffected by this promotion.

    Provides window.RWSVG with:
      - MockViewer: records addLine/addArc/addCircle/addDimLinear/addDimRadius
        calls (same API as KonvaViewer) into L / A / DL / DR arrays, so a
        production fdraw_*_2d view body can be reused verbatim.
      - renderSVG(rec, W, H): renders the recorded primitives as a self-contained
        SVG in the retaining-wall look (white grid, ink outline, blue dims,
        dashed hidden lines). Per-primitive colours are mapped from the Konva
        palette; dims may carry an optional variable label ("H=300").
      - attachZoomPan / matchHeight / setActive helpers.
      - mountView(cfg): generic renderView driving one section's plot host.

    Loaded on demand by layout_body_test.js only.
*/
(function () {
  "use strict";

  var INK = '#182430', DIM = '#2563eb', HID = '#94a3b8', CEN = '#e5484d', ACC = '#16a34a', FNT = '#c2ccd8';

  function mapColor(col) {
    if (!col || col === 'cyan') return INK;
    if (col === 'red') return CEN;
    if (col === '#00ff00' || col === 'green' || col === 'lime') return ACC;
    return col;
  }

  // ---- recorder with the KonvaViewer drawing API ----
  function MockViewer() { this.L = []; this.A = []; this.DL = []; this.DR = []; this.TX = []; this._lay = {}; }
  MockViewer.prototype.addLayer = function (name, color, type, w) { this._lay[name] = { color: color, type: type }; };
  MockViewer.prototype._c = function (name) { return this._lay[name] || {}; };
  function _layName(t) { return t === 'hidden' ? 'hidden' : (t === 'faint' ? 'faint' : 'solid'); }
  MockViewer.prototype.addLine = function (v, x1, y1, x2, y2, name) { var l = this._c(name); this.L.push({ x1: x1, y1: y1, x2: x2, y2: y2, lay: _layName(l.type), col: l.color }); };
  MockViewer.prototype.addCircle = function (v, x, y, r, name) { var l = this._c(name); this.A.push({ x: x, y: y, r: r, a1: 0, a2: 360, lay: (l.type === 'hidden' ? 'hidden' : 'solid'), col: l.color }); };
  MockViewer.prototype.addArc = function (v, x, y, r, a1, a2, name) { var l = this._c(name); this.A.push({ x: x, y: y, r: r, a1: a1, a2: a2, lay: (l.type === 'hidden' ? 'hidden' : 'solid'), col: l.color }); };
  MockViewer.prototype.addDimLinear = function (v, x1, y1, x2, y2, gap, label, opts) { this.DL.push({ x1: x1, y1: y1, x2: x2, y2: y2, gap: gap, t: label || '', la: (opts && opts.la) || 0, lp: (opts && opts.lp) || 0 }); };
  MockViewer.prototype.addDimRadius = function (v, x, y, r, ang, label, opts) { this.DR.push({ x: x, y: y, r: r, ang: ang, t: label || '', lt: (opts && opts.lt != null) ? opts.lt : 0.5, lx: (opts && opts.lx != null) ? opts.lx : null, ly: (opts && opts.ly != null) ? opts.ly : null }); };
  MockViewer.prototype.addText = function (v, x, y, str, rot) { this.TX.push({ x: x, y: y, t: str || '', rot: rot || 0 }); };
  MockViewer.prototype.addArrowLine = function (v, x1, y1, x2, y2) { this.AR = this.AR || []; this.AR.push({ x1: x1, y1: y1, x2: x2, y2: y2 }); };
  MockViewer.prototype.render = function () { /* no-op: rendered externally via renderSVG */ };

  // ---- SVG rendering (retaining-wall look) ----
  function renderSVG(rec, W, Hpx) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function acc(x, y) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    function arcSpan(a) { var a2 = a.a2; if (a2 <= a.a1) a2 += 360; return a2; }
    rec.L.forEach(function (l) { acc(l.x1, l.y1); acc(l.x2, l.y2); });
    rec.A.forEach(function (a) { acc(a.x - a.r, a.y - a.r); acc(a.x + a.r, a.y + a.r); });
    rec.DL.forEach(function (d) {
      var len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) || 1, nx = -(d.y2 - d.y1) / len, ny = (d.x2 - d.x1) / len;
      acc(d.x1, d.y1); acc(d.x2, d.y2);
      acc(d.x1 + nx * d.gap, d.y1 + ny * d.gap); acc(d.x2 + nx * d.gap, d.y2 + ny * d.gap);
    });
    rec.DR.forEach(function (d) { acc(d.x, d.y); var rr = d.ang * Math.PI / 180; acc(d.x + d.r * Math.cos(rr), d.y + d.r * Math.sin(rr)); });
    (rec.TX || []).forEach(function (t) { acc(t.x, t.y); });
    (rec.AR || []).forEach(function (a) { acc(a.x1, a.y1); acc(a.x2, a.y2); });
    if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; }

    var padL = 46, padR = 30, padT = 30, padB = 30;
    var bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    var s = Math.min((W - padL - padR) / bw, (Hpx - padT - padB) / bh);
    var cW = W, cH = Hpx;
    var ox = (cW - bw * s) / 2 - minX * s;
    var oy = (cH - bh * s) / 2 + maxY * s;
    function SX(x) { return ox + x * s; }
    function SY(y) { return oy - y * s; }
    function f(n) { return Math.round(n * 100) / 100; }

    var e = [];
    function line(x1, y1, x2, y2, col, w, dash) { e.push('<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'); }
    function poly(pts, col, w, dash) { e.push('<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'); }
    function arrow(x, y, ux, uy, col) { var a = 7, bx = x - a * ux, by = y - a * uy, px = -uy * a * 0.34, py = ux * a * 0.34; e.push('<polygon points="' + f(x) + ',' + f(y) + ' ' + f(bx + px) + ',' + f(by + py) + ' ' + f(bx - px) + ',' + f(by - py) + '" fill="' + col + '"/>'); }
    function text(x, y, str, col, rot) { e.push('<text x="' + f(x) + '" y="' + f(y) + '" fill="' + col + '" font-size="11.5" font-family="ui-monospace,Menlo,Consolas,monospace" text-anchor="middle" dominant-baseline="middle"' + (rot ? ' transform="rotate(' + f(rot) + ' ' + f(x) + ' ' + f(y) + ')"' : '') + '>' + str + '</text>'); }
    function num(v) { return String(Math.round(v)); }

    rec.L.forEach(function (l) {
      if (l.lay === 'hidden') line(SX(l.x1), SY(l.y1), SX(l.x2), SY(l.y2), HID, 1, '6 3');
      else if (l.lay === 'faint') line(SX(l.x1), SY(l.y1), SX(l.x2), SY(l.y2), FNT, 0.7);
      else line(SX(l.x1), SY(l.y1), SX(l.x2), SY(l.y2), mapColor(l.col), 1.8);
    });
    rec.A.forEach(function (a) {
      var pts = [], a1 = a.a1, a2 = arcSpan(a), span = a2 - a1, n = Math.max(14, Math.ceil(span / 6));
      for (var i = 0; i <= n; i++) { var t = (a1 + (a2 - a1) * i / n) * Math.PI / 180; pts.push(f(SX(a.x + a.r * Math.cos(t))) + ',' + f(SY(a.y + a.r * Math.sin(t)))); }
      if (a.lay === 'hidden') poly(pts.join(' '), HID, 1, '6 3');
      else if (a.lay === 'faint') poly(pts.join(' '), FNT, 0.7);
      else poly(pts.join(' '), mapColor(a.col), 1.8);
    });
    rec.DL.forEach(function (d) {
      var len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1); if (len === 0) return;
      var nx = -(d.y2 - d.y1) / len, ny = (d.x2 - d.x1) / len;
      var p1x = d.x1 + nx * d.gap, p1y = d.y1 + ny * d.gap, p2x = d.x2 + nx * d.gap, p2y = d.y2 + ny * d.gap;
      var s1x = SX(p1x), s1y = SY(p1y), s2x = SX(p2x), s2y = SY(p2y);
      var dl = Math.hypot(s2x - s1x, s2y - s1y) || 1, ux = (s2x - s1x) / dl, uy = (s2y - s1y) / dl;
      line(s1x, s1y, s2x, s2y, DIM, 1);
      arrow(s1x, s1y, -ux, -uy, DIM); arrow(s2x, s2y, ux, uy, DIM);
      line(SX(d.x1), SY(d.y1), s1x, s1y, DIM, 0.6, '2 2');
      line(SX(d.x2), SY(d.y2), s2x, s2y, DIM, 0.6, '2 2');
      var ang = Math.atan2(s2y - s1y, s2x - s1x) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
      var sgn = d.gap >= 0 ? 1 : -1, gdx = nx * sgn, gdy = -ny * sgn, gm = Math.hypot(gdx, gdy) || 1;
      var la = d.la || 0, lp = d.lp || 0;   // label offset: la along the dim line, lp perpendicular (px)
      var mx = (s1x + s2x) / 2 + gdx / gm * (12 + lp) + ux * la, my = (s1y + s2y) / 2 + gdy / gm * (12 + lp) + uy * la;
      text(mx, my, (d.t ? d.t + '=' : '') + num(len), DIM, ang);
    });
    rec.DR.forEach(function (d) {
      var rr = d.ang * Math.PI / 180, tx = SX(d.x), ty = SY(d.y), px = SX(d.x + d.r * Math.cos(rr)), py = SY(d.y + d.r * Math.sin(rr));
      var dl = Math.hypot(px - tx, py - ty) || 1;
      // lx/ly: 라벨을 임의의 빈 공간(모델좌표)에 두고 아크 접점까지 지시선을 끗는 모드
      if (d.lx != null && d.ly != null) {
        var qx = SX(d.lx), qy = SY(d.ly);
        var ql = Math.hypot(px - qx, py - qy) || 1;
        line(qx, qy, px, py, DIM, 0.9, '4 3');
        arrow(px, py, (px - qx) / ql, (py - qy) / ql, DIM);
        var la = Math.atan2(py - qy, px - qx) * 180 / Math.PI; if (la > 90 || la < -90) la += 180;
        var pxn = -(py - qy) / ql, pyn = (px - qx) / ql;      // 지시선 수직 방향
        if (pyn > 0) { pxn = -pxn; pyn = -pyn; }               // 라벨은 선 위쪽으로
        text(qx + pxn * 9, qy + pyn * 9, (d.t ? d.t : 'R') + num(d.r), DIM, la);
        return;
      }
      // lt: label position along centre->arc (0=centre, 0.5=midpoint(default), 1=arc point;
      //     <0 = beyond the centre, >1 = beyond the arc). Leader stretches to reach the label.
      var lt = (d.lt != null) ? d.lt : 0.5, t0 = Math.min(0, lt), t1 = Math.max(1, lt);
      line(tx + (px - tx) * t0, ty + (py - ty) * t0, tx + (px - tx) * t1, ty + (py - ty) * t1, DIM, 0.9, '4 3');
      arrow(px, py, (px - tx) / dl, (py - ty) / dl, DIM);
      var ang = Math.atan2(py - ty, px - tx) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
      text(tx + (px - tx) * lt, ty + (py - ty) * lt - 7, (d.t ? d.t : 'R') + num(d.r), DIM, ang);
    });
    (rec.TX || []).forEach(function (t) { text(SX(t.x), SY(t.y), t.t, DIM, t.rot); });
    (rec.AR || []).forEach(function (a) {
      var x1 = SX(a.x1), y1 = SY(a.y1), x2 = SX(a.x2), y2 = SY(a.y2);
      var dl = Math.hypot(x2 - x1, y2 - y1) || 1;
      line(x1, y1, x2, y2, DIM, 1.6);
      arrow(x2, y2, (x2 - x1) / dl, (y2 - y1) / dl, DIM);
    });

    var bg = 'background:#fff;';   // 그리드 제거 — 흰 배경만
    return '<svg width="' + cW + '" height="' + cH + '" viewBox="0 0 ' + cW + ' ' + cH + '" style="display:block;' + bg + '">' + e.join('') + '</svg>';
  }

  function setActive(barId, view) {
    var bar = document.getElementById(barId);
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('[data-sview]'), function (b) {
      var on = b.getAttribute('data-sview') === view;
      b.style.background = on ? '#2563eb' : '#eef2f6';
      b.style.color = on ? '#fff' : '#475569';
      b.style.borderColor = on ? '#2563eb' : '#cbd5e1';
    });
  }

  function matchHeight() {
    var cards = document.querySelectorAll('.hs-card');
    if (cards.length > 1) {
      var rightH = cards[1].getBoundingClientRect().height;
      var lhd = cards[0].querySelector('.hs-hd');
      var t = rightH - (lhd ? lhd.getBoundingClientRect().height : 40) - 1;
      if (t > 220) return Math.round(t);
    }
    return 480;
  }

  function attachZoomPan(svg) {
    var vb = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
    var cur = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    var w0 = vb[2] || 1;                       // initial view width (fit-to-content)
    var MINW = w0 * 0.35, MAXW = w0 * 2.2;     // zoom-in ≈ 2.9×, zoom-out ≈ 0.45× — bounded
    function apply() { svg.setAttribute('viewBox', cur.x + ' ' + cur.y + ' ' + cur.w + ' ' + cur.h); }
    svg.style.cursor = 'grab'; svg.style.touchAction = 'none';
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = svg.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      var mx = cur.x + fx * cur.w, my = cur.y + fy * cur.h;
      var newW = Math.max(MINW, Math.min(MAXW, cur.w * (e.deltaY < 0 ? 0.9 : 1.1)));
      var k = newW / cur.w; if (k === 1) return;   // at a limit — ignore
      cur.w *= k; cur.h *= k; cur.x = mx - fx * cur.w; cur.y = my - fy * cur.h; apply();
    }, { passive: false });
    var drag = false, lx = 0, ly = 0;
    svg.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; ly = e.clientY; svg.style.cursor = 'grabbing'; try { svg.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var r = svg.getBoundingClientRect();
      cur.x -= (e.clientX - lx) / r.width * cur.w; cur.y -= (e.clientY - ly) / r.height * cur.h;
      lx = e.clientX; ly = e.clientY; apply();
    });
    function end(e) { drag = false; svg.style.cursor = 'grab'; if (e && e.pointerId != null) { try { svg.releasePointerCapture(e.pointerId); } catch (_) {} } }
    svg.addEventListener('pointerup', end); svg.addEventListener('pointerleave', end);
  }

  // 3D loader (shared): renderFn name resolved lazily, host div id, module url
  function render3d(hostId, renderFnName, mod3dUrl, args) {
    function G(n) { try { return (0, eval)(n); } catch (e) { return undefined; } }
    function go() { var fn = G(renderFnName); if (typeof fn === 'function') fn.apply(null, [hostId].concat(args)); }
    if (typeof G(renderFnName) === 'function' && typeof THREE !== 'undefined') { go(); return; }
    var host = document.getElementById(hostId);
    if (host) host.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
    var urls = [];
    if (typeof THREE === 'undefined') {
      urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    if (typeof G(renderFnName) !== 'function') urls.push(mod3dUrl);
    (function next(i) {
      if (i >= urls.length) { go(); return; }
      var sc = document.createElement('script'); sc.src = urls[i];
      sc.onload = function () { next(i + 1); }; sc.onerror = function () { next(i + 1); };
      document.head.appendChild(sc);
    })(0);
  }

  // generic renderView: cfg = { host, bar, view3dId, render3dName, mod3d, get3dArgs, drawView, aspect }
  //   drawView(view, rec) fills rec (a MockViewer); returns nothing.
  //   aspect (optional): width/height ratio for the pane (e.g. 16/9); default matches the input card.
  function mountView(cfg) {
    var host = document.getElementById(cfg.host);
    if (!host) return;
    var view = cfg.view || 'front';
    host.innerHTML = '';
    setActive(cfg.bar, view);
    host.style.width = '100%';
    var Hpx = cfg.aspect ? Math.max(220, Math.round((host.clientWidth || 600) / cfg.aspect)) : matchHeight();
    host.style.cssText = 'width:100%;height:' + Hpx + 'px;';
    if (view === '3d') {
      var d3 = document.createElement('div');
      d3.id = cfg.view3dId;
      d3.style.cssText = 'width:100%;height:' + Hpx + 'px;background:#1a1a2e;';
      host.appendChild(d3);
      render3d(cfg.view3dId, cfg.render3dName, cfg.mod3d, cfg.get3dArgs ? cfg.get3dArgs() : []);
    } else {
      var W = host.clientWidth || 600;
      var rec = new MockViewer();
      cfg.drawView(view, rec);
      host.innerHTML = renderSVG(rec, W, Hpx);
      var svg = host.querySelector('svg');
      if (svg) attachZoomPan(svg);
    }
  }

  window.RWSVG = {
    MockViewer: MockViewer, renderSVG: renderSVG, setActive: setActive,
    matchHeight: matchHeight, attachZoomPan: attachZoomPan, render3d: render3d, mountView: mountView
  };
})();
