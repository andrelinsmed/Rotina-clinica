/**
 * André med · sincronização do progresso de estudo entre aparelhos.
 * Guarda, nas propriedades deste script, cada item de progresso do site (grifos, respostas do
 * Banco de questões, flashcards e questões do NCS4). Não usa Drive nem pede permissão nova.
 *
 * prog_puxar  { desde }  → itens alterados no servidor depois de "desde" (milissegundos do servidor)
 * prog_enviar { itens }  → grava cada item { v, t } se for mais novo que o que está guardado
 *   v = texto guardado no aparelho (null = apagado); t = quando o aparelho mudou o item
 * Cada valor é partido em pedaços, porque uma propriedade aceita no máximo 9 KB.
 */
const PROG_META = 'P|', PROG_PEDACO = 'P#', PROG_TAM = 3000;

function progresso_(req) {
  if (req.acao === 'prog_puxar') {
    const tudo = progLeTudo_(), desde = Number(req.desde) || 0, itens = {};
    Object.keys(tudo).forEach(function (k) {
      if (tudo[k].st > desde) itens[k] = { v: tudo[k].v, t: tudo[k].t };
    });
    return { ok: true, agora: Date.now(), itens: itens, uso: progUso_() };
  }
  if (req.acao === 'prog_enviar') {
    const trava = LockService.getScriptLock();
    trava.waitLock(20000);
    try {
      const props = PropertiesService.getScriptProperties(), tudo = progLeTudo_(), agora = Date.now(), aceitos = [];
      Object.keys(req.itens || {}).forEach(function (k) {
        const it = req.itens[k], velho = tudo[k];
        if (!it || typeof it.t !== 'number') return;
        if (velho && velho.t > it.t) return;                  /* o servidor já tem algo mais novo */
        progGrava_(props, k, it.v === null || it.v === undefined ? null : String(it.v), it.t, agora, velho ? velho.n : 0);
        aceitos.push(k);
      });
      return { ok: true, agora: agora, aceitos: aceitos, uso: progUso_() };
    } finally { trava.releaseLock(); }
  }
  return { ok: false, erro: 'ação desconhecida' };
}

function progLeTudo_() {
  const todas = PropertiesService.getScriptProperties().getProperties(), out = {};
  Object.keys(todas).forEach(function (nome) {
    if (nome.indexOf(PROG_META) !== 0) return;
    const k = nome.slice(PROG_META.length);
    let m; try { m = JSON.parse(todas[nome]); } catch (e) { return; }
    let v = '';
    for (let i = 0; i < m.n; i++) v += todas[PROG_PEDACO + i + '|' + k] || '';
    out[k] = { v: m.del ? null : v, t: m.t, st: m.st, n: m.n };
  });
  return out;
}

function progGrava_(props, k, v, t, st, nVelho) {
  const pedacos = [];
  if (v !== null) for (let i = 0; i < v.length; i += PROG_TAM) pedacos.push(v.slice(i, i + PROG_TAM));
  const lote = {};
  pedacos.forEach(function (p, i) { lote[PROG_PEDACO + i + '|' + k] = p; });
  lote[PROG_META + k] = JSON.stringify({ t: t, st: st, n: pedacos.length, del: v === null ? 1 : 0 });
  props.setProperties(lote);
  for (let i = pedacos.length; i < (nVelho || 0); i++) props.deleteProperty(PROG_PEDACO + i + '|' + k);
}

/* quanto da cota de 500 KB das propriedades já foi usado (para o site avisar com antecedência) */
function progUso_() {
  const todas = PropertiesService.getScriptProperties().getProperties();
  let b = 0;
  Object.keys(todas).forEach(function (n) { b += n.length + String(todas[n]).length * 1.3; });
  return Math.round(b / 1024);
}
