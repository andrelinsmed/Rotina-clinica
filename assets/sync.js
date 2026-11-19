/* André med — registro de mudanças para a sincronização do progresso.
   Injetado pelo build em todas as páginas. Não fala com a internet nem guarda segredo:
   só anota, para cada item de progresso que a página grava (grifos, Banco de questões,
   flashcards e questões do NCS4), o momento da mudança em "sync:t:<chave>".
   Quem envia e recebe é a página inicial (cifrada), que tem o endereço e o token do script. */
(function () {
  'use strict';
  if (window.__rcSyncReg) return; window.__rcSyncReg = true;
  var VIGIA = /^(grifos:|andremed-banco$|ncs4-q:|cx3-fc:)/;
  var S = window.Storage && Storage.prototype;
  if (!S || S.__rcSync) return;
  S.__rcSync = true;
  var set = S.setItem, rem = S.removeItem;
  function marca(st, k) {
    if (window.__rcAplicando || st !== window.localStorage || !VIGIA.test(k)) return;
    try { set.call(st, 'sync:t:' + k, String(Date.now())); } catch (e) {}
  }
  S.setItem = function (k, v) {
    var antes; try { antes = this.getItem(k); } catch (e) {}
    set.call(this, k, v);
    if (antes !== String(v)) marca(this, String(k));
  };
  S.removeItem = function (k) {
    var tinha; try { tinha = this.getItem(k) !== null; } catch (e) {}
    rem.call(this, k);
    if (tinha) marca(this, String(k));
  };
  /* página aberta dentro do site: avisa a página inicial onde o leitor está ("continuar de onde parei") */
  try {
    if (window.parent !== window && window.parent.postMessage) {
      var avisa = function () {
        var r = ''; try { r = decodeURIComponent(location.hash.slice(1)); } catch (e) { r = location.hash.slice(1); }
        window.parent.postMessage({ rcOnde: r }, '*');
      };
      window.addEventListener('hashchange', avisa);
      setTimeout(avisa, 300);
    }
  } catch (e) {}
})();
