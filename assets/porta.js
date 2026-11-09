/* Rotina clínica — porta de entrada.
   O conteúdo de cada página fica cifrado (AES-256-GCM) num arquivo .bin; a chave é derivada da senha
   (PBKDF2-SHA256). Sem a senha, o que está no repositório é ilegível. Este arquivo não contém a senha. */
(function () {
  'use strict';
  var SAL = 'Wj3IlisHX3hDb+nmjrKEuA==';            // público; gerado pelo build
  var ITER = 600000;
  var K_LOCAL = 'rc-chave';
  var eu = document.currentScript;
  var BIN = eu.getAttribute('data-bin');
  var RAIZ = eu.getAttribute('data-raiz') || './';
  var EMB = window.self !== window.top;

  function b64(a) { var s = ''; a = new Uint8Array(a); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function de64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function guardada() { try { return sessionStorage.getItem(K_LOCAL) || localStorage.getItem(K_LOCAL); } catch (e) { return null; } }
  function guarda(raw, lembrar) { try { sessionStorage.setItem(K_LOCAL, raw); if (lembrar) localStorage.setItem(K_LOCAL, raw); } catch (e) {} }
  function esquece() { try { sessionStorage.removeItem(K_LOCAL); localStorage.removeItem(K_LOCAL); } catch (e) {} }
  window.rcBloquear = function () { esquece(); try { (window.top || window).location.href = RAIZ; } catch (e) { location.reload(); } };

  function deriva(senha) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) { return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: de64(SAL), iterations: ITER }, k, 256); })
      .then(b64);
  }
  var pacote = null;
  function baixa() {
    if (!pacote) pacote = fetch(BIN, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('rede'); return r.arrayBuffer(); });
    return pacote;
  }
  function abre(raw) {
    return Promise.all([baixa(), crypto.subtle.importKey('raw', de64(raw), 'AES-GCM', false, ['decrypt'])]).then(function (v) {
      var buf = new Uint8Array(v[0]);
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(0, 12) }, v[1], buf.subarray(12));
    }).then(function (claro) {
      var fluxo = new Blob([claro]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Response(fluxo).text();
    });
  }
  function mostra(html) {
    document.open(); document.write(html); document.close();
  }

  /* ---------- tela de senha ---------- */
  var tela, ecg;
  function monta() {
    if (tela) return;
    document.documentElement.classList.add('rc-trancado');
    tela = document.createElement('main');
    tela.className = 'porta';
    tela.innerHTML =
      '<div class="porta-cima"><h1>Rotina<br>clínica</h1></div>' +
      '<div class="porta-faixa"><canvas aria-hidden="true"></canvas>' +
        '<p class="porta-nota" aria-hidden="true"><span>DII</span><span>25 mm/s</span></p><p class="porta-estado" aria-live="polite">Bloqueado</p></div>' +
      '<form class="porta-baixo" autocomplete="off">' +
        '<label class="porta-rot" for="porta-senha">Digite a senha para abrir</label>' +
        '<div class="porta-campo"><input id="porta-senha" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••••••" required>' +
        '<button type="submit" aria-label="Entrar"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>' +
        '<p class="porta-erro" role="alert" aria-live="assertive"></p>' +
        '<label class="porta-lembrar"><input type="checkbox" id="porta-lembrar" checked><span>Manter desbloqueado neste aparelho</span></label>' +
      '</form>';
    document.body.appendChild(tela);
    var form = tela.querySelector('form'), campo = tela.querySelector('#porta-senha'), erro = tela.querySelector('.porta-erro'), estado = tela.querySelector('.porta-estado');
    if (window.rcECG) ecg = window.rcECG(tela.querySelector('canvas'), { modo: 'plano', cor: '#a5f4f1', brilho: function () { return true; } });
    var calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    campo.addEventListener('input', function () { if (ecg) ecg.blip(); });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (form.classList.contains('ocupado') || !campo.value) return;
      form.classList.add('ocupado'); form.classList.remove('errou'); erro.textContent = '';
      var lembrar = tela.querySelector('#porta-lembrar').checked;
      deriva(campo.value).then(function (raw) {
        return abre(raw).then(function (html) {
          guarda(raw, lembrar);
          /* senha certa: o ritmo volta, dois batimentos, e a página abre */
          tela.classList.add('ritmo'); estado.textContent = 'Ritmo sinusal';
          if (ecg) ecg.modo('sinusal');
          setTimeout(function () { tela.classList.add('abrindo'); }, calmo || !ecg ? 60 : 1150);
          setTimeout(function () { if (ecg) ecg.fim(); mostra(html); }, calmo || !ecg ? 380 : 1470);
        });
      }).catch(function (e) {
        form.classList.remove('ocupado');
        void form.offsetWidth; form.classList.add('errou');
        if (ecg) ecg.modo('ruido', 650);
        erro.textContent = (e && e.message === 'rede') ? 'Não foi possível carregar. Confira a conexão.' : 'Senha incorreta.';
        campo.select();
      });
    });
    if (!EMB) setTimeout(function () { campo.focus(); }, 60);
  }

  function inicia() {
    if (!(window.crypto && crypto.subtle && window.DecompressionStream)) {
      document.body.innerHTML = '<p style="font:16px system-ui;padding:40px;max-width:520px;margin:auto">Este navegador não consegue abrir o conteúdo protegido. Atualize o navegador e acesse pelo endereço https.</p>';
      return;
    }
    var raw = guardada();
    if (raw) abre(raw).then(mostra).catch(function (e) { if (!e || e.message !== 'rede') esquece(); monta(); });
    else { baixa().catch(function () {}); monta(); }
  }
  inicia();
})();
