/* André med — marca-texto dos referenciais teóricos.
   Injetado pelo build em toda página de referencial (ver tools/build.mjs).
   Barra flutuante com duas cores, borracha e apagar tudo.
   Cada tipo de toque tem um papel só:
     caneta  → grifa (a rolagem é bloqueada só para a caneta; o dedo continua rolando);
     dedo    → rola; para grifar com o dedo, segure para selecionar e toque na cor;
     mouse   → arraste para grifar, ou selecione e clique na cor.
   O traço encaixa em palavras inteiras e mostra uma prévia própria (sem acionar a seleção do sistema).
   Os grifos ficam salvos em localStorage, por página, com assinatura do texto: se a página for
   republicada com o texto alterado, os grifos antigos são descartados em vez de aparecerem fora
   de lugar. Nenhuma biblioteca externa. */
(function () {
  'use strict';
  if (window.__grifos) return; window.__grifos = true;

  /* ---------- onde grifar ---------- */
  var alvo = document.querySelector('.wrap') || document.querySelector('main') || document.body;
  if (!alvo) return;
  var CHAVE = 'grifos:' + location.pathname;

  /* blocos que o script da própria página reescreve: ficam fora da contagem de posições,
     senão os grifos saem do lugar quando o leitor troca a aba de um esquema */
  var FORA = ['ctl', 'ctrls', 'sl', 'slider-row', 'readout', 'din', 'hlwrap', 'hlbar'];
  var TAGS = { script: 1, style: 1, svg: 1, button: 1, input: 1, output: 1, nav: 1, select: 1, textarea: 1 };

  /* ---------- estilo ---------- */
  var css = document.createElement('style');
  css.textContent = [
    'mark.uh{padding:0 1px;border-radius:2px;color:inherit}',
    'mark.uh.y{background:linear-gradient(transparent 8%,rgba(255,214,10,.55) 8%,rgba(255,214,10,.55) 92%,transparent 92%)}',
    'mark.uh.o{background:linear-gradient(transparent 8%,rgba(255,149,0,.52) 8%,rgba(255,149,0,.52) 92%,transparent 92%)}',
    '.gf-escuro mark.uh.y{background:linear-gradient(transparent 8%,rgba(255,214,10,.32) 8%,rgba(255,214,10,.32) 92%,transparent 92%)}',
    '.gf-escuro mark.uh.o{background:linear-gradient(transparent 8%,rgba(255,149,0,.32) 8%,rgba(255,149,0,.32) 92%,transparent 92%)}',
    'body.nohl mark.uh{background:none!important}',
    'body.gf-ativo{cursor:crosshair}',
    'body.gf-ativo ::selection{background:rgba(255,214,10,.45)}',
    'body.gf-ativo.gf-laranja ::selection{background:rgba(255,149,0,.45)}',
    'body.gf-apagar{cursor:cell}',
    'body.gf-tracando{-webkit-user-select:none;user-select:none}',
    '.gf-camada{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147482000}',
    '.gf-p{position:absolute;border-radius:2px;mix-blend-mode:multiply}',
    '.gf-p.y{background:rgba(255,214,10,.5)}.gf-p.o{background:rgba(255,149,0,.48)}',
    '.gf-p.x{background:rgba(120,120,128,.28);mix-blend-mode:normal}',
    '.gf-escuro .gf-p{mix-blend-mode:normal}',
    '.gf-escuro .gf-p.y{background:rgba(255,214,10,.3)}.gf-escuro .gf-p.o{background:rgba(255,149,0,.3)}',
    'body.gf-emb .top{display:none}',
    '.hlwrap{position:fixed;left:18px;bottom:18px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-start;gap:10px}',
    '.hlwrap.emb{position:absolute;bottom:auto}',
    '.hlbar{display:flex;align-items:center;gap:8px;padding:8px;border-radius:999px;' +
      'background:rgba(255,255,255,.86);border:1px solid #dcd7d2;' +
      'box-shadow:0 1px 2px rgba(0,0,0,.05),0 10px 30px rgba(0,0,0,.14);' +
      '-webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%)}',
    '.gf-escuro .hlbar{background:rgba(29,29,31,.86);border-color:#3a3a3c;box-shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.6)}',
    '.hlbar button{width:38px;height:38px;border-radius:50%;border:1.5px solid #dcd7d2;background:#fff;color:#1f1f22;' +
      'cursor:pointer;display:grid;place-items:center;padding:0;transition:.18s;font:inherit}',
    '.gf-escuro .hlbar button{background:#1d1d1f;border-color:#3a3a3c;color:#f5f5f7}',
    '.hlbar button:hover{transform:translateY(-1px)}',
    '.hlbar button[aria-pressed="true"]{border-color:#1f1f22;box-shadow:0 0 0 3px rgba(31,31,34,.14)}',
    '.gf-escuro .hlbar button[aria-pressed="true"]{border-color:#f5f5f7;box-shadow:0 0 0 3px rgba(245,245,247,.2)}',
    '.hlbar .sw{width:20px;height:20px;border-radius:50%}',
    '.hlbar .sw.y{background:#ffd60a}.hlbar .sw.o{background:#ff9500}',
    '.hlbar svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
    '.hlbar .lab{font:700 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
      'letter-spacing:.1em;text-transform:uppercase;color:#6b6b72;padding:0 6px 0 8px;white-space:nowrap}',
    '.gf-escuro .hlbar .lab{color:#a1a1a6}',
    '.hltip{max-width:264px;font:400 13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
      'background:#fff;color:#6b6b72;border:1px solid #dcd7d2;border-radius:14px;padding:11px 14px;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.14);display:none}',
    '.gf-escuro .hltip{background:#1d1d1f;color:#a1a1a6;border-color:#3a3a3c}',
    '.hltip.on{display:block}.hltip b{color:#1f1f22}.gf-escuro .hltip b{color:#f5f5f7}',
    '@media (max-width:760px){.hlwrap{left:10px;bottom:10px}.hltip{max-width:min(264px,78vw)}}',
    '@media print{.hlwrap{display:none}}'
  ].join('\n');
  document.head.appendChild(css);

  function tema() {
    var escuro = document.documentElement.dataset.theme === 'dark';
    if (!escuro) {
      try { escuro = localStorage.getItem('bancos-tema') === 'escuro'; } catch (e) {}
    }
    if (!escuro && !document.documentElement.dataset.theme) {
      try { escuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
    }
    document.documentElement.classList.toggle('gf-escuro', !!escuro);
  }
  tema();
  setInterval(tema, 700);

  /* ---------- nós de texto, posições ---------- */
  var cL = null, cMap = null, cPre = null;
  var cTxt = null;
  function invalida() { cL = null; cMap = null; cPre = null; cTxt = null; }
  function varre() {
    var out = [], w = document.createTreeWalker(alvo, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        while (p && p !== alvo) {
          var t = (p.tagName || '').toLowerCase();
          if (TAGS[t]) return NodeFilter.FILTER_REJECT;
          if (p.classList) {
            for (var i = 0; i < FORA.length; i++) if (p.classList.contains(FORA[i])) return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = w.nextNode())) out.push(n);
    return out;
  }
  function monta() {
    cL = varre(); cMap = new Map(); cPre = new Array(cL.length);
    var p = 0;
    for (var i = 0; i < cL.length; i++) { cMap.set(cL[i], i); cPre[i] = p; p += cL[i].nodeValue.length; }
  }
  function nos() { if (!cL) monta(); return cL; }
  function desloc(no, off) {
    if (!cMap) monta();
    var i = cMap.get(no);
    return (i === undefined) ? -1 : cPre[i] + off;
  }

  var marcas = [];
  function pinta(ini, fim, cor) {
    if (fim <= ini) return;
    var lista = nos(), p = 0, tarefas = [];
    for (var i = 0; i < lista.length; i++) {
      var n = lista[i], L = n.nodeValue.length, a = p, b = p + L; p = b;
      if (b <= ini || a >= fim) continue;
      tarefas.push({ n: n, de: Math.max(0, ini - a), ate: Math.min(L, fim - a) });
    }
    tarefas.forEach(function (t) {
      var n = t.n;
      if (t.ate < n.nodeValue.length) n.splitText(t.ate);
      if (t.de > 0) n = n.splitText(t.de);
      var m = document.createElement('mark');
      m.className = 'uh ' + cor;
      n.parentNode.insertBefore(m, n);
      m.appendChild(n);
    });
    invalida();
  }
  function limpaDOM() {
    [].slice.call(alvo.querySelectorAll('mark.uh')).forEach(function (m) {
      var pai = m.parentNode;
      while (m.firstChild) pai.insertBefore(m.firstChild, m);
      pai.removeChild(m);
      pai.normalize();
    });
    invalida();
  }
  function redesenha() {
    limpaDOM();
    marcas.slice().sort(function (a, b) { return a.s - b.s; }).forEach(function (g) { pinta(g.s, g.e, g.c); });
  }

  /* ---------- guardar ---------- */
  function assinatura() {
    var lista = nos(), n = 0, ini = '', fim = '';
    for (var i = 0; i < lista.length; i++) n += lista[i].nodeValue.length;
    if (lista.length) { ini = lista[0].nodeValue.slice(0, 80); fim = lista[lista.length - 1].nodeValue.slice(-80); }
    var h = 0, t = ini + '|' + fim;
    for (var j = 0; j < t.length; j++) { h = ((h << 5) - h + t.charCodeAt(j)) | 0; }
    return n + ':' + h;
  }
  function salva() {
    try {
      if (!marcas.length) localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, JSON.stringify({ v: 1, sig: assinatura(), m: marcas }));
    } catch (e) {}
  }
  function carrega() {
    var bruto = null;
    try { bruto = localStorage.getItem(CHAVE); } catch (e) { return; }
    if (!bruto) return;
    var d = null; try { d = JSON.parse(bruto); } catch (e) { return; }
    if (!d || !d.m || !d.m.length) return;
    if (d.sig !== assinatura()) {
      try { localStorage.removeItem(CHAVE); } catch (e) {}
      setTimeout(function () { mostraDica('<b>O texto desta página foi atualizado.</b> Os grifos anteriores foram descartados para não ficarem fora de lugar.'); }, 700);
      return;
    }
    marcas = d.m; redesenha();
  }
  function guarda(ini, fim, cor) {
    if (fim <= ini) return;
    marcas = marcas.filter(function (g) { return g.e <= ini || g.s >= fim || g.c !== cor; })
                   .concat([{ s: ini, e: fim, c: cor }]);
    redesenha(); salva();
  }
  function apagaEm(ini, fim) {
    var novas = [];
    marcas.forEach(function (g) {
      if (g.e <= ini || g.s >= fim) { novas.push(g); return; }
      if (g.s < ini) novas.push({ s: g.s, e: ini, c: g.c });
      if (g.e > fim) novas.push({ s: fim, e: g.e, c: g.c });
    });
    marcas = novas; redesenha(); salva();
  }

  /* ---------- traço ---------- */
  var modo = null, tr = null;
  var LETRA = (function () { try { return new RegExp('[\\p{L}\\p{N}]', 'u'); } catch (e) { return /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/; } })();
  function texto() { if (cTxt === null) cTxt = nos().map(function (n) { return n.nodeValue; }).join(''); return cTxt; }
  /* encaixa o trecho em palavras inteiras e tira espaços das pontas */
  function encaixa(a, b) {
    var t = texto();
    if (a > b) { var x = a; a = b; b = x; }
    while (a < b && /\s/.test(t.charAt(a))) a++;
    while (b > a && /\s/.test(t.charAt(b - 1))) b--;
    while (a > 0 && LETRA.test(t.charAt(a - 1))) a--;
    while (b < t.length && LETRA.test(t.charAt(b))) b++;
    return [a, b];
  }
  /* posição absoluta → nó de texto + deslocamento */
  function ponto(pos) {
    var lista = nos(); if (!cPre) monta();
    for (var i = lista.length - 1; i >= 0; i--) if (cPre[i] <= pos) return [lista[i], Math.min(pos - cPre[i], lista[i].nodeValue.length)];
    return lista.length ? [lista[0], 0] : null;
  }
  function faixa(a, b) {
    var p = ponto(a), q = ponto(b); if (!p || !q) return null;
    var r = document.createRange();
    try { r.setStart(p[0], p[1]); r.setEnd(q[0], q[1]); } catch (e) { return null; }
    return r;
  }
  function caret(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y); if (!p) return null;
      var r = document.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true); return r;
    }
    return null;
  }
  /* posição do texto sob o ponto; no início do traço exige que o ponto esteja de fato sobre a linha */
  function posEm(x, y, estrito) {
    var r = caret(x, y); if (!r || r.startContainer.nodeType !== 3) return -1;
    if (estrito) {
      var q = r.getBoundingClientRect();
      if (q && q.height > 0 && (y < q.top - 14 || y > q.bottom + 14)) return -1;
    }
    return desloc(r.startContainer, r.startOffset);
  }
  var camada = document.createElement('div');
  camada.className = 'gf-camada';
  document.body.appendChild(camada);
  function previa(a, b) {
    camada.innerHTML = '';
    if (b <= a) return;
    var r = faixa(a, b); if (!r) return;
    var sx = window.scrollX || 0, sy = window.scrollY || 0, cls = 'gf-p ' + (modo === 'apagar' ? 'x' : modo), html = '';
    [].forEach.call(r.getClientRects(), function (q) {
      if (q.width < 1 || q.height < 1) return;
      html += '<div class="' + cls + '" style="left:' + (q.left + sx) + 'px;top:' + (q.top + sy) + 'px;width:' + q.width + 'px;height:' + q.height + 'px"></div>';
    });
    camada.innerHTML = html;
  }
  function interativo(el) { return el && el.closest && el.closest('button,a,input,select,textarea,label,summary,.hlwrap,.ctrls,.ctl,.sl,.slider-row'); }

  /* caneta da Apple: bloqueia a rolagem só para ela (o dedo continua rolando) */
  function segura(e) {
    if (!modo || interativo(e.target)) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].touchType === 'stylus') { e.preventDefault(); return; }
    }
  }
  document.addEventListener('touchstart', segura, { passive: false });
  document.addEventListener('touchmove', segura, { passive: false });

  function fim(e, cancelado) {
    if (!tr || (e && e.pointerId !== tr.id)) return;
    var t = tr; tr = null;
    camada.innerHTML = '';
    document.body.classList.remove('gf-tracando');
    try { alvo.releasePointerCapture(t.id); } catch (err) {}
    if (cancelado) return;
    if (!t.moveu) {
      if (t.tipo !== 'pen') return;                       /* clique de mouse sem arrastar não grifa */
      if (modo === 'apagar') {                            /* toque da caneta num grifo apaga o grifo inteiro */
        var g = marcas.filter(function (m) { return m.s <= t.ini && t.ini < m.e; })[0];
        if (g) apagaEm(g.s, g.e);
        return;
      }
    }
    var ab = encaixa(t.ini, t.ult);
    if (ab[1] <= ab[0]) return;
    if (modo === 'apagar') apagaEm(ab[0], ab[1]); else if (modo) guarda(ab[0], ab[1], modo);
  }
  alvo.addEventListener('pointerdown', function (e) {
    if (!modo || tr) return;
    if (e.pointerType === 'touch') return;                /* dedo: só rola (ou seleciona com toque longo) */
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (interativo(e.target)) return;
    var p = posEm(e.clientX, e.clientY, true); if (p < 0) return;
    tr = { id: e.pointerId, tipo: e.pointerType, ini: p, ult: p, x: e.clientX, y: e.clientY, moveu: false };
    try { alvo.setPointerCapture(e.pointerId); } catch (err) {}
    document.body.classList.add('gf-tracando');
    var s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges();
    e.preventDefault();
    if (e.pointerType === 'pen') { var ab = encaixa(p, p); previa(ab[0], ab[1]); }
  });
  alvo.addEventListener('pointermove', function (e) {
    if (!tr || e.pointerId !== tr.id) return;
    e.preventDefault();
    var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    var ev = evs.length ? evs[evs.length - 1] : e;
    if (!tr.moveu && Math.abs(ev.clientX - tr.x) + Math.abs(ev.clientY - tr.y) > 5) tr.moveu = true;
    var p = posEm(ev.clientX, ev.clientY, false);
    if (p >= 0) tr.ult = p;
    var ab = encaixa(tr.ini, tr.ult); previa(ab[0], ab[1]);
  }, { passive: false });
  alvo.addEventListener('pointerup', function (e) { fim(e, false); });
  alvo.addEventListener('pointercancel', function (e) { fim(e, true); });
  window.addEventListener('blur', function () { if (tr) fim({ pointerId: tr.id }, true); });

  /* seleção feita com o dedo (toque longo) ou com o mouse: aplicada ao tocar na cor.
     Guarda a última seleção porque, no iPhone/iPad, tocar no botão pode desfazê-la antes do clique. */
  var ultSel = null;
  document.addEventListener('selectionchange', function () {
    var s = window.getSelection && window.getSelection();
    if (!s || !s.rangeCount || s.isCollapsed) { if (ultSel && !ultSel.fim) ultSel.fim = Date.now(); return; }
    var r = s.getRangeAt(0);
    if (!alvo.contains(r.commonAncestorContainer)) return;
    var a = desloc(r.startContainer, r.startOffset), b = desloc(r.endContainer, r.endOffset);
    if (a < 0 || b < 0) return;
    ultSel = { a: Math.min(a, b), b: Math.max(a, b), fim: 0 };
  });
  function daSelecao(cor) {
    if (!ultSel || (ultSel.fim && Date.now() - ultSel.fim > 900)) return false;
    var t = texto(), a = ultSel.a, b = ultSel.b;
    while (a < b && /\s/.test(t.charAt(a))) a++;
    while (b > a && /\s/.test(t.charAt(b - 1))) b--;
    ultSel = null;
    var s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges();
    if (b <= a) return false;
    if (cor === 'apagar') apagaEm(a, b); else guarda(a, b, cor);
    return true;
  }

  /* ---------- barra ---------- */
  var caixa = document.createElement('div');
  caixa.className = 'hlwrap';
  var dica = document.createElement('div');
  dica.className = 'hltip';
  var barra = document.createElement('div');
  barra.className = 'hlbar';
  barra.innerHTML =
    '<span class="lab">Marca-texto</span>' +
    '<button type="button" data-m="y" aria-pressed="false" title="Marca-texto amarelo" aria-label="Marca-texto amarelo"><span class="sw y"></span></button>' +
    '<button type="button" data-m="o" aria-pressed="false" title="Marca-texto laranja" aria-label="Marca-texto laranja"><span class="sw o"></span></button>' +
    '<button type="button" data-m="apagar" aria-pressed="false" title="Apagar grifos" aria-label="Apagar grifos"><svg viewBox="0 0 24 24"><path d="M8 19h12M5.5 15.5 11 10l5 5-4 4H8l-2.5-3.5Z"/><path d="M11 10l4-4 5 5-4 4"/></svg></button>' +
    '<button type="button" data-m="tudo" title="Apagar todos os grifos" aria-label="Apagar todos os grifos"><svg viewBox="0 0 24 24"><path d="M6 7h12M10 7V5h4v2M8 7l.8 12h6.4L16 7"/></svg></button>';
  caixa.appendChild(dica); caixa.appendChild(barra);
  document.body.appendChild(caixa);

  var tDica;
  function mostraDica(txt) {
    dica.innerHTML = txt; dica.classList.add('on');
    clearTimeout(tDica); tDica = setTimeout(function () { dica.classList.remove('on'); }, 4600);
  }
  function aplica(m) {
    modo = (modo === m) ? null : m;
    [].forEach.call(barra.querySelectorAll('button[data-m]'), function (b) {
      if (b.dataset.m !== 'tudo') b.setAttribute('aria-pressed', String(b.dataset.m === modo));
    });
    document.body.classList.toggle('gf-ativo', modo === 'y' || modo === 'o');
    document.body.classList.toggle('gf-laranja', modo === 'o');
    document.body.classList.toggle('gf-apagar', modo === 'apagar');
    if (modo === 'y' || modo === 'o') mostraDica('<b>Marca-texto ativo.</b> <b>Caneta:</b> risque o texto (um toque grifa a palavra). <b>Dedo:</b> rola a página; para grifar, segure sobre o texto, ajuste a seleção e toque na cor. <b>Mouse:</b> arraste. Toque de novo no círculo para desligar.');
    if (modo === 'apagar') mostraDica('<b>Borracha ativa.</b> Risque com a caneta (ou toque num grifo para apagá-lo inteiro). Com o dedo, selecione o trecho e toque na borracha.');
  }
  barra.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-m]'); if (!b) return;
    var m = b.dataset.m;
    if (m === 'tudo') {
      if (!marcas.length) { mostraDica('Não há grifos nesta página.'); return; }
      marcas = []; redesenha(); salva(); mostraDica('Todos os grifos desta página foram apagados.');
      return;
    }
    if (daSelecao(m)) return;
    aplica(m);
  });

  /* ---------- dentro do site o iframe é esticado: a barra segue a rolagem do pai ----------
     Sem requestAnimationFrame: ele é suspenso quando o iframe sai da tela e o acompanhamento trava. */
  var emb = (function () { try { return window.parent !== window && !!window.frameElement; } catch (e) { return false; } })();
  if (emb) {
    document.body.classList.add('gf-emb');
    caixa.classList.add('emb');
    var ultimoTopo = -1;
    var recoloca = function () {
      try {
        var fe = window.frameElement; if (!fe) return;
        var r = fe.getBoundingClientRect();
        var vh = window.parent.innerHeight || 0, alt = caixa.offsetHeight || 56;
        var topo = Math.max(12, -r.top + 12);
        var base = Math.min(fe.clientHeight, vh - r.top) - alt - 18;
        var y = Math.round(Math.max(topo, base));
        if (y !== ultimoTopo) { ultimoTopo = y; caixa.style.top = y + 'px'; }
      } catch (e) {}
    };
    try {
      window.parent.addEventListener('scroll', recoloca, { passive: true });
      window.parent.addEventListener('resize', recoloca);
    } catch (e) {}
    window.addEventListener('resize', recoloca);
    setInterval(recoloca, 400);
    recoloca();
  }

  carrega();
})();
