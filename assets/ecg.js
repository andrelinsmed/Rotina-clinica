/* Rotina clínica — traçado de ECG em varredura, como num monitor de beira de leito.
   rcECG(canvas, {cor, vel, bpm, modo, brilho}) → {modo(m), blip(), limpa(), pausa(bool), fim()}
   modos: 'sinusal' (ritmo regular), 'plano' (linha de base), 'ruido' (interferência que volta sozinha ao modo anterior). */
(function () {
  'use strict';
  function g(x, c, l) { var d = (x - c) / l; return Math.exp(-d * d); }
  /* um batimento: ondas P, Q, R, S e T; f em [0,1) */
  function batimento(f) {
    return 0.11 * g(f, 0.17, 0.028) - 0.09 * g(f, 0.325, 0.009) + 1.0 * g(f, 0.352, 0.011)
         - 0.21 * g(f, 0.380, 0.011) + 0.27 * g(f, 0.60, 0.052);
  }
  window.rcECG = function (cv, o) {
    o = o || {};
    var ctx = cv.getContext('2d'), dpr = 1, w = 0, h = 0;
    var vel = o.vel || 150, bpm = o.bpm || 66, modo = o.modo || 'sinusal', volta = modo;
    var x = 0, yAnt = null, fase = 0.75, t = 0, ruidoAte = 0, blips = [], parado = false, vivo = true, raf = 0, ultimo = 0;
    var calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cor = '#000';
    function leCor() { cor = (typeof o.cor === 'function' ? o.cor() : o.cor) || getComputedStyle(cv).color; }
    function mede() {
      var r = cv.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      x = 0; yAnt = null; leCor(); if (calmo) fixo();
    }
    function valor(dt) {
      var v = 0;
      if (modo === 'sinusal') { fase += dt * bpm / 60; if (fase >= 1) fase -= 1; v = batimento(fase); }
      else if (modo === 'ruido') {
        v = 0.22 * Math.sin(t * 31) + 0.16 * Math.sin(t * 47 + 1.3) + 0.10 * Math.sin(t * 73 + 0.4);
        if (t > ruidoAte) { modo = volta; fase = 0.75; }
      }
      for (var i = blips.length - 1; i >= 0; i--) {
        var d = t - blips[i]; if (d > 0.5) { blips.splice(i, 1); continue; }
        v += 0.16 * g(d, 0.12, 0.05);
      }
      return v + 0.006 * Math.sin(t * 1.7);
    }
    function y(v) { return h * 0.64 - v * h * 0.5; }
    function traco() {
      ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = cor;
      if (o.brilho && o.brilho()) { ctx.shadowColor = cor; ctx.shadowBlur = 9; } else ctx.shadowBlur = 0;
    }
    function passo(dt) {
      var andar = vel * dt, n = Math.max(1, Math.ceil(andar / 1.2)), dx = andar / n, ddt = dt / n, vao = Math.max(26, w * 0.03);
      traco();
      for (var i = 0; i < n; i++) {
        t += ddt; var ny = y(valor(ddt)), nx = x + dx;
        if (nx > w) { x = 0; nx = dx; yAnt = null; }
        ctx.clearRect(nx, 0, vao, h);
        if (nx + vao > w) ctx.clearRect(0, 0, nx + vao - w, h);
        if (yAnt !== null) { ctx.beginPath(); ctx.moveTo(x, yAnt); ctx.lineTo(nx, ny); ctx.stroke(); }
        x = nx; yAnt = ny;
      }
    }
    function fixo() {           /* movimento reduzido: traçado parado, inteiro */
      ctx.clearRect(0, 0, w, h); traco(); ctx.shadowBlur = 0; ctx.beginPath();
      var f = 0.75, passoF = (bpm / 60) / vel;
      for (var px = 0; px <= w; px += 1) { f += passoF; if (f >= 1) f -= 1; var yy = y(modo === 'plano' ? 0 : batimento(f)); px ? ctx.lineTo(px, yy) : ctx.moveTo(px, yy); }
      ctx.stroke();
    }
    function quadro(agora) {
      if (!vivo) return;
      raf = requestAnimationFrame(quadro);
      var dt = Math.min(0.05, (agora - ultimo) / 1000 || 0); ultimo = agora;
      if (parado || document.hidden || !w) return;
      passo(dt);
    }
    var ro = window.ResizeObserver ? new ResizeObserver(mede) : null;
    if (ro) ro.observe(cv); else mede();
    if (!calmo) raf = requestAnimationFrame(function (a) { ultimo = a; quadro(a); });
    return {
      modo: function (m, ms) {
        if (m === 'ruido') { volta = modo === 'ruido' ? volta : modo; ruidoAte = t + (ms || 900) / 1000; modo = 'ruido'; }
        else { modo = volta = m; if (m === 'sinusal') fase = 0.28; }
        if (calmo) fixo();
      },
      blip: function () { blips.push(t); },
      limpa: function () { leCor(); ctx.clearRect(0, 0, w, h); x = 0; yAnt = null; if (calmo) fixo(); },
      pausa: function (b) { parado = !!b; },
      fim: function () { vivo = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); }
    };
  };
})();
