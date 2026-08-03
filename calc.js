/*
    calc.js — 수식/변수 평가기 (프런트 전용, 엔진 무관)
    · clsCalc(PHP) 의 "변수 순차 등록 → 이후 수식이 앞 변수를 참조" 개념을 JS로.
    · new Function 기반이라 모든 Math 함수를 그대로 지원.
    · 삼각함수는 라디안(표준). 도(degree)가 필요하면 sind/cosd/tand 사용.
      log = 상용로그(log10), ln = 자연로그. ^ = 거듭제곱(= **), @ = 곱(= *).
    · window.Calc.eval(expr, scope) / window.Calc.buildScope([{name,expr}...])
*/
(function () {
  var PRE =
    "var PI=Math.PI,E=Math.E,pi=Math.PI,e=Math.E;" +
    "var sin=Math.sin,cos=Math.cos,tan=Math.tan,asin=Math.asin,acos=Math.acos,atan=Math.atan,atan2=Math.atan2;" +
    "var sinh=Math.sinh,cosh=Math.cosh,tanh=Math.tanh;" +
    "var sqrt=Math.sqrt,cbrt=Math.cbrt,exp=Math.exp,abs=Math.abs,pow=Math.pow,hypot=Math.hypot,sign=Math.sign;" +
    "var floor=Math.floor,ceil=Math.ceil,round=Math.round,trunc=Math.trunc,min=Math.min,max=Math.max;" +
    "var ln=Math.log,log=Math.log10,log10=Math.log10,log2=Math.log2;" +
    "var d2r=Math.PI/180,r2d=180/Math.PI;" +
    "function sind(x){return Math.sin(x*d2r);}function cosd(x){return Math.cos(x*d2r);}function tand(x){return Math.tan(x*d2r);}" +
    "function asind(x){return Math.asin(x)*r2d;}function acosd(x){return Math.acos(x)*r2d;}function atand(x){return Math.atan(x)*r2d;}" +
    "function atan2d(y,x){return Math.atan2(y,x)*r2d;}function deg(x){return x*r2d;}function rad(x){return x*d2r;}";

  var IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

  var Calc = {
    // 단일 수식 평가 → { value:Number, error:String|null }
    eval: function (expr, scope) {
      scope = scope || {};
      var s = String(expr == null ? '' : expr).trim();
      if (s === '') return { value: NaN, error: 'empty value' };
      if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return { value: Number(s), error: null };  // 순수 숫자
      var body = s.replace(/\*\*/g, '^').replace(/\^/g, '**').replace(/@/g, '*');   // ^ → ** (기존 ** 보존)
      var names = [], vals = [];
      for (var k in scope) {
        if (Object.prototype.hasOwnProperty.call(scope, k) && IDENT.test(k)) { names.push(k); vals.push(scope[k]); }
      }
      try {
        var fn = Function.apply(null, names.concat([PRE + 'return (' + body + ');']));
        var v = fn.apply(null, vals);
        if (typeof v !== 'number' || !isFinite(v)) return { value: NaN, error: 'result is not a number' };
        return { value: v, error: null };
      } catch (e) { return { value: NaN, error: (e && e.message) || 'formula error' }; }
    },

    // 숫자만 반환 (오류/NaN 이면 fallback)
    num: function (expr, scope, fallback) {
      var r = this.eval(expr, scope);
      return (r.error == null) ? r.value : (fallback == null ? NaN : fallback);
    },

    // 변수 목록을 입력 순서대로 평가 → { scope:{name:value}, errors:[{name,msg}] }
    buildScope: function (varList) {
      var scope = {}, errors = [];
      (varList || []).forEach(function (v) {
        if (!v || v.name == null || String(v.name).trim() === '') return;
        var name = String(v.name).trim();
        if (!IDENT.test(name)) { errors.push({ name: name, msg: 'invalid variable name' }); return; }
        var r = Calc.eval(v.expr, scope);
        if (r.error) { errors.push({ name: name, msg: r.error }); scope[name] = NaN; }
        else scope[name] = r.value;
      });
      return { scope: scope, errors: errors };
    }
  };

  if (typeof window !== 'undefined') window.Calc = Calc;
  if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
})();
