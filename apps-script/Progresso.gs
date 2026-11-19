/**
 * André med · progresso de estudo por perfil (cada pessoa com nome + PIN).
 * Cada perfil é um arquivo JSON na pasta "André med · progresso" do Drive desta conta, com o PIN
 * guardado embaralhado (SHA-256 com sal) e os itens de progresso do site (grifos, respostas do
 * Banco de questões, flashcards e questões do NCS4).
 *
 * prog_criar  { perfil, pin }        → cria o perfil (nome livre; o identificador sai do nome)
 * prog_entrar { perfil, pin }        → confere nome + PIN
 * prog_puxar  { perfil, pin, desde } → itens alterados depois de "desde" (milissegundos do servidor)
 * prog_enviar { perfil, pin, itens } → grava cada item { v, t } se for mais novo que o guardado
 * Esqueceu o PIN? Apague o arquivo da pessoa na pasta do Drive; ela cria o perfil de novo.
 */
const PROG_PASTA = 'André med · progresso';

function progresso_(req) {
  try {
    if (req.acao === 'prog_criar') return progCriar_(req);
    const a = progAutentica_(req);
    if (req.acao === 'prog_entrar') return { ok: true, perfil: a.id, nome: a.d.nome };
    if (req.acao === 'prog_puxar') {
      const desde = Number(req.desde) || 0, itens = {};
      Object.keys(a.d.itens || {}).forEach(function (k) {
        const it = a.d.itens[k];
        if (it.st > desde) itens[k] = { v: it.v, t: it.t };
      });
      return { ok: true, agora: Date.now(), itens: itens };
    }
    if (req.acao === 'prog_enviar') {
      const trava = LockService.getScriptLock();
      trava.waitLock(20000);
      try {
        const d = progLe_(a.arq), agora = Date.now(), aceitos = [];   /* relê dentro da trava */
        d.itens = d.itens || {};
        Object.keys(req.itens || {}).forEach(function (k) {
          const it = req.itens[k], velho = d.itens[k];
          if (!it || typeof it.t !== 'number' || k.length > 200) return;
          if (velho && velho.t > it.t) return;                        /* o servidor já tem algo mais novo */
          d.itens[k] = { v: it.v === null || it.v === undefined ? null : String(it.v), t: it.t, st: agora };
          aceitos.push(k);
        });
        if (aceitos.length) a.arq.setContent(JSON.stringify(d));
        return { ok: true, agora: agora, aceitos: aceitos };
      } finally { trava.releaseLock(); }
    }
    return { ok: false, erro: 'ação desconhecida' };
  } catch (e) {
    return { ok: false, erro: String(e.message || e), codigo: e.codigo || '' };
  }
}

function progErro_(msg, codigo) { const e = new Error(msg); e.codigo = codigo; return e; }
function progId_(nome) {
  return String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}
function progPin_(pin) {
  pin = String(pin || '');
  if (!/^\d{4,6}$/.test(pin)) throw progErro_('O PIN precisa ter de 4 a 6 números.', 'pin-formato');
  return pin;
}
function progHash_(sal, pin) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '|' + pin, Utilities.Charset.UTF_8));
}
function progPasta_() {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('PROG_PASTA');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const raiz = DriveApp.getRootFolder(), it = raiz.getFoldersByName(PROG_PASTA);
  const p = it.hasNext() ? it.next() : raiz.createFolder(PROG_PASTA);
  props.setProperty('PROG_PASTA', p.getId());
  return p;
}
function progArq_(id) {
  const it = progPasta_().getFilesByName(id + '.json');
  return it.hasNext() ? it.next() : null;
}
function progLe_(arq) { return JSON.parse(arq.getBlob().getDataAsString('UTF-8')); }

function progCriar_(req) {
  const nome = String(req.perfil || '').trim().slice(0, 40), id = progId_(nome), pin = progPin_(req.pin);
  if (id.length < 2) throw progErro_('Escreva um nome com pelo menos 2 letras.', 'nome');
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    if (progArq_(id)) throw progErro_('Já existe um perfil com esse nome. Use "Entrar" ou escolha outro nome.', 'existe');
    const sal = Utilities.getUuid();
    progPasta_().createFile(id + '.json', JSON.stringify({ perfil: id, nome: nome, sal: sal, h: progHash_(sal, pin), criado: Date.now(), itens: {} }), 'application/json');
    return { ok: true, perfil: id, nome: nome };
  } finally { trava.releaseLock(); }
}

/* confere nome + PIN; 8 erros seguidos bloqueiam o perfil por 15 minutos */
function progAutentica_(req) {
  const id = progId_(req.perfil), pin = progPin_(req.pin);
  if (!id) throw progErro_('Perfil inválido.', 'nome');
  const cache = CacheService.getScriptCache(), kf = 'prog-falhas:' + id, falhas = Number(cache.get(kf)) || 0;
  if (falhas >= 8) throw progErro_('Muitas tentativas com PIN errado. Espere 15 minutos.', 'bloqueado');
  const arq = progArq_(id);
  if (!arq) throw progErro_('Não existe perfil com esse nome. Confira ou crie um perfil.', 'nao-existe');
  const d = progLe_(arq);
  if (d.h !== progHash_(d.sal, pin)) { cache.put(kf, String(falhas + 1), 900); throw progErro_('PIN errado.', 'pin'); }
  if (falhas) cache.remove(kf);
  return { id: id, arq: arq, d: d };
}
