/*
    rebar_excel.js — 엑셀 rebar 입력 → Domain.USER_REBAR_DATA → UI.reset() (철근 작도)
    · 의존: excel_reader.js (window.loadSheetData / window.extractBlockFromData), ExcelJS
    · 'type' 키워드 블록을 추출, 컬럼 순서(2줄 스키마)대로 파싱.
      trebar: type|id|code|dia|init(x,y,rot)|set|segs(len)|angs|nors|barStart|barEnd
      lrebar: type|id|dia |num|init         |nors|range   |path|ctc |ctcmax  |ctcmin
    · 셀 표기: "a=400, b=1500"(kv) / "-4700, -500, 0"(list) / set "b=E5" / barEnd "fit,0"
*/
var RebarExcel = {
  sheetInputId: 'rebarSheetName',
  fileInputId: 'rebarExcelFile',

  // ── 파일 선택 → 로드 → 주입 → 작도 ──
  load: function () {
    var fi = document.getElementById(this.fileInputId);
    if (!fi) { alert('파일 입력(rebarExcelFile) 이 없습니다.'); return; }
    var self = this;
    fi.value = '';
    fi.onchange = function () {
      var file = fi.files[0]; if (!file) return;
      var sheet = String((document.getElementById(self.sheetInputId) || {}).value || 'input').trim();
      if (typeof window.loadSheetData !== 'function') { alert('excel_reader.js 가 로드되지 않았습니다.'); return; }
      window.loadSheetData(file, sheet).then(function (data) {
        var rebar = self.parse(data);
        if (typeof Domain === 'undefined') { alert('Domain(엔진)이 로드되지 않았습니다.'); return; }
        Domain.USER_REBAR_DATA = rebar;        // 통합 입력 (우선)
        Domain.USER_TREBAR_DATA = null;
        Domain.USER_LREBAR_DATA = null;
        if (typeof UI !== 'undefined' && typeof UI.reset === 'function') UI.reset();
        var nt = rebar.filter(function (r) { return r.type === 'trebar'; }).length;
        var nl = rebar.filter(function (r) { return r.type === 'lrebar'; }).length;
        console.log('[RebarExcel] 주입:', rebar);
        alert("'" + sheet + "' 로드 완료 — 철근 " + rebar.length + "개 (T:" + nt + " / L:" + nl + ") 주입 후 작도.");
      }).catch(function (e) { alert('엑셀 로드 오류: ' + e.message); });
    };
    fi.click();
  },

  // ── 'type' 블록 → USER_REBAR_DATA 배열 ──
  parse: function (fullData) {
    if (typeof window.extractBlockFromData !== 'function') { alert('excel_reader.js 미로드'); return []; }
    var block = window.extractBlockFromData(fullData, 'type');
    if (!block || block.length < 2) { alert("시트에서 'type' 블록을 찾지 못했습니다."); return []; }

    var out = [];
    for (var r = 1; r < block.length; r++) {
      var row = block[r];
      var type = this._str(row[0]).toLowerCase();
      if (!type) continue;
      out.push(type === 'lrebar' ? this.parseLrebarRow(row) : this.parseTrebarRow(row));
    }
    return out;
  },

  // trebar: 0:type 1:id 2:code 3:dia 4:init(x,y,rot) 5:set 6:segs(len) 7:angs 8:nors 9:barStart 10:barEnd
  parseTrebarRow: function (row) {
    var o = { type: 'trebar', id: this._str(row[1]) };
    if (this._has(row[2])) o.code = Number(row[2]);
    if (this._has(row[3])) o.dia = Number(row[3]);
    var init = this._initObj(row[4], ['x', 'y', 'rot']); if (init) o.init = init;
    var segs = this._segsObj(row[6], row[5]); if (segs) o.segs = segs;
    var angs = this._angsObj(row[7]); if (angs) o.angs = angs;
    var nors = this._norsObj(row[8]); if (nors) o.nors = nors;
    var be = {}, bs = this._endRule(row[9]), bee = this._endRule(row[10]);
    if (bs) be.start = bs; if (bee) be.end = bee;
    if (Object.keys(be).length) o.barEnds = be;
    return o;
  },

  // lrebar: 0:type 1:id 2:dia 3:num 4:init 5:nors 6:range 7:path 8:ctc 9:ctcmax 10:ctcmin
  parseLrebarRow: function (row) {
    var o = { type: 'lrebar', id: this._str(row[1]), bar: {} };
    if (this._has(row[2])) o.bar.dia = Number(row[2]);
    if (this._has(row[3])) o.bar.num = Number(row[3]);
    if (this._has(row[10])) o.bar.min = Number(row[10]);   // ctcmin → 최소 간격
    var init = this._initObj(row[4], ['x', 'y', 'rot', 'grav']); if (init) o.init = init;
    var range = this._rangeObj(row[6]); if (range) o.range = range;
    var path = this._list(row[7]).map(function (s) { return s.toUpperCase(); });
    if (path.length) o.path = path;
    return o;
  },

  // ── 헬퍼 ──
  _str: function (v) { return String(v == null ? '' : v).trim(); },
  _has: function (v) { return v != null && String(v).trim() !== ''; },
  _numOrStr: function (v) { v = this._str(v); if (v === '') return undefined; return isNaN(Number(v)) ? v : Number(v); },
  _list: function (v) { return this._str(v).split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; }); },
  _kv: function (v) {                          // "a=400, b=1500" → {a:'400', b:'1500'}
    var o = {}, self = this;
    this._str(v).split(',').forEach(function (pair) {
      var m = pair.split(/[:=]/);
      if (m.length >= 2) { var k = self._str(m[0]).toLowerCase(); if (k) o[k] = self._str(m.slice(1).join('=')); }
    });
    return o;
  },
  _initObj: function (cell, keys) {
    var toks = this._list(cell); if (!toks.length) return null;
    var o = {}, self = this;
    keys.forEach(function (k, i) { if (self._has(toks[i])) o[k] = self._numOrStr(toks[i]); });
    return Object.keys(o).length ? o : null;
  },
  _segsObj: function (segsCell, setCell) {
    var kv = this._kv(segsCell), segs = {}, self = this;
    Object.keys(kv).forEach(function (k) { segs[k] = { len: self._numOrStr(kv[k]) }; });
    var setKV = this._kv(setCell);
    Object.keys(setKV).forEach(function (k) { if (!segs[k]) segs[k] = {}; segs[k].set = self._str(setKV[k]).toUpperCase(); });
    return Object.keys(segs).length ? segs : null;
  },
  _angsObj: function (cell) {
    var kv = this._kv(cell), angs = {}, self = this;
    Object.keys(kv).forEach(function (k) { angs['r' + k] = self._numOrStr(kv[k]); });   // a → ra (RA)
    return Object.keys(angs).length ? angs : null;
  },
  _norsObj: function (cell) {
    var kv = this._kv(cell), nors = {}, self = this;
    Object.keys(kv).forEach(function (k) { nors[k] = self._numOrStr(kv[k]); });
    return Object.keys(nors).length ? nors : null;
  },
  _rangeObj: function (cell) {
    var toks = this._list(cell); if (!toks.length) return null;
    var o = {};
    if (this._has(toks[0])) o.min = this._numOrStr(toks[0]);
    if (this._has(toks[1])) o.max = this._numOrStr(toks[1]);
    return Object.keys(o).length ? o : null;
  },

  _endRule: function (cell) {                  // "fit,0" → {fit:0} ; "ray,50" → {ray:50}
    var toks = this._list(cell); if (!toks.length) return null;
    var mode = this._str(toks[0]).toLowerCase(); if (!mode) return null;
    var o = {}; o[mode] = toks.length > 1 ? (Number(toks[1]) || 0) : 0; return o;
  }
};

if (typeof window !== 'undefined') window.RebarExcel = RebarExcel;
