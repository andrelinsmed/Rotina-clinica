/**
 * Rotina clínica · Ambulatórios no Google Drive.
 *
 * Cada tema do site é um Google Doc dentro da pasta "Site" do Drive, na mesma ordem do site:
 *   Site / Ambulatórios / Cardiologia / Referencial teórico / Insuficiência cardíaca
 *   Site / Ambulatórios / Ginecologia e obstetrícia / Pré-natal / Modelos de consulta / …
 * Um Doc solto direto na pasta da especialidade (ou do assunto) conta como referencial teórico.
 *
 * Rode uma vez pelo editor a função "configurarAmbulatorios": ela cria as pastas e pede a autorização do Drive.
 * A conta que publica o script precisa poder editar a pasta "Site".
 */
const PASTA_SITE = '1KOHQohjTC7couMwxfBcLs1WFCRDmx9i-';
const AMB_RAIZ = 'Ambulatórios';
const AMB_METODOS = { teoria: 'Referencial teórico', modelos: 'Modelos de consulta' };
/* especialidades e assuntos (pastas) que o site já mostra; pastas novas criadas no Drive também aparecem */
const AMB_ESTRUTURA = [
  ['clinica', 'Clínica médica'], ['cardio', 'Cardiologia'], ['endocrino', 'Endocrinologia'], ['pneumo', 'Pneumologia'],
  ['gastro', 'Gastroenterologia'], ['nefro', 'Nefrologia'], ['reumato', 'Reumatologia'], ['neuro', 'Neurologia'],
  ['psiq', 'Psiquiatria'], ['derma', 'Dermatologia'],
  ['gineco', 'Ginecologia e obstetrícia', [['prenatal', 'Pré-natal']]],
  ['pedia', 'Pediatria', [['puericultura', 'Puericultura']]],
  ['alergia', 'Alergia e imunologia'], ['cirurgia', 'Cirurgia'], ['paliativos', 'Cuidados paliativos'], ['emergencia', 'Emergência'],
  ['geriatria', 'Geriatria'], ['hemato', 'Hematologia'], ['hepato', 'Hepatologia'], ['infecto', 'Infectologia'],
  ['uti', 'Medicina intensiva'], ['mfc', 'Medicina de família e comunidade'], ['nutro', 'Nutrologia'],
  ['oftalmo', 'Oftalmologia e otorrino'], ['uro', 'Urologia']
];
const MIME_DOC = 'application/vnd.google-apps.document';
const MIME_PASTA = 'application/vnd.google-apps.folder';

/* Rode pelo editor: cria Ambulatórios, as especialidades, os assuntos e as pastas dos dois métodos. */
function configurarAmbulatorios() {
  const mapa = mapearAmb_(true);
  Logger.log('Pronto: %s especialidades em "%s".', mapa.esp.length, AMB_RAIZ);
}

/* chamado pelo doPost do Agenda.gs */
function ambulatorios_(req) {
  if (req.acao === 'amb_arvore') return { ok: true, arvore: arvoreAmb_(req.completo) };
  if (req.acao === 'amb_ler') return Object.assign({ ok: true }, lerDoc_(req.id));
  if (req.acao === 'amb_salvar') return salvarDoc_(req);
  if (req.acao === 'amb_criar') return criarDoc_(req);
  if (req.acao === 'amb_excluir') { docDoSite_(req.id).setTrashed(true); limpaCacheArvore_(); return { ok: true }; }
  return { ok: false, erro: 'ação desconhecida' };
}

/* ---------- estrutura de pastas ---------- */
function pastaFilha_(pai, nome, criar) {
  const it = pai.getFoldersByName(nome);
  if (it.hasNext()) return it.next();
  return criar ? pai.createFolder(nome) : null;
}
function metodosDe_(pasta, criar) {
  const m = {};
  Object.keys(AMB_METODOS).forEach(function (k) { const f = pastaFilha_(pasta, AMB_METODOS[k], criar); if (f) m[k] = f.getId(); });
  return m;
}
/* percorre o Drive e guarda os ids das pastas (assim a leitura dos temas é uma consulta só) */
function mapearAmb_(criar) {
  const raiz = pastaFilha_(DriveApp.getFolderById(PASTA_SITE), AMB_RAIZ, true);
  const conhecidas = {};
  AMB_ESTRUTURA.forEach(function (e) {
    conhecidas[e[1]] = e;
    if (criar) {
      const f = pastaFilha_(raiz, e[1], true);
      metodosDe_(f, true);
      (e[2] || []).forEach(function (p) { metodosDe_(pastaFilha_(f, p[1], true), true); });
    }
  });
  const mapa = { raiz: raiz.getId(), esp: [] };
  const nomesMetodo = Object.keys(AMB_METODOS).map(function (k) { return AMB_METODOS[k]; });
  const it = raiz.getFolders();
  while (it.hasNext()) {
    const f = it.next(), nome = f.getName(), def = conhecidas[nome];
    const e = { id: def ? def[0] : 'drive-' + f.getId().slice(0, 10), nome: nome, pasta: f.getId(), metodos: metodosDe_(f, criar), pastas: [] };
    const sub = f.getFolders();
    while (sub.hasNext()) {
      const s = sub.next(), sn = s.getName();
      if (nomesMetodo.indexOf(sn) >= 0) continue;
      const pdef = def && (def[2] || []).filter(function (p) { return p[1] === sn; })[0];
      e.pastas.push({ id: pdef ? pdef[0] : 'drive-' + s.getId().slice(0, 10), nome: sn, pasta: s.getId(), metodos: metodosDe_(s, criar) });
    }
    mapa.esp.push(e);
  }
  PropertiesService.getScriptProperties().setProperty('AMB_MAPA', JSON.stringify(mapa));
  limpaCacheArvore_();
  return mapa;
}
function mapaAmb_() {
  const v = PropertiesService.getScriptProperties().getProperty('AMB_MAPA');
  return v ? JSON.parse(v) : mapearAmb_(true);
}

/* ---------- árvore: pastas + Docs, numa consulta só ao Drive ---------- */
function arvoreAmb_(completo) {
  const cache = CacheService.getScriptCache();
  if (!completo) { const c = cache.get('AMB_ARVORE'); if (c) return JSON.parse(c); }
  const mapa = completo ? mapearAmb_(false) : mapaAmb_();
  const onde = {};   // id da pasta → [nó, método]
  const nos = [];
  mapa.esp.forEach(function (e) {
    [e].concat(e.pastas).forEach(function (n) {
      n.docs = { teoria: [], modelos: [] };
      onde[n.pasta] = [n, 'teoria'];
      Object.keys(n.metodos).forEach(function (k) { onde[n.metodos[k]] = [n, k]; });
      nos.push(n);
    });
  });
  const ids = Object.keys(onde);
  /* o Google limita o tamanho do endereço da consulta: 10 pastas por vez */
  for (let i = 0; i < ids.length; i += 10) {
    const q = "mimeType='" + MIME_DOC + "' and trashed=false and (" + ids.slice(i, i + 10).map(function (id) { return "'" + id + "' in parents"; }).join(' or ') + ')';
    let token = '';
    do {
      const r = drive_('get', 'https://www.googleapis.com/drive/v3/files?pageSize=1000&orderBy=name&fields=nextPageToken,files(id,name,parents,modifiedTime)&q=' + encodeURIComponent(q) + (token ? '&pageToken=' + token : ''));
      (r.files || []).forEach(function (f) {
        const o = onde[(f.parents || [])[0]];
        if (o) o[0].docs[o[1]].push({ id: f.id, nome: f.name, mod: f.modifiedTime });
      });
      token = r.nextPageToken || '';
    } while (token);
  }
  const arv = mapa.esp.map(function (e) {
    return { id: e.id, nome: e.nome, metodos: e.metodos, docs: e.docs,
             pastas: e.pastas.map(function (p) { return { id: p.id, nome: p.nome, metodos: p.metodos, docs: p.docs }; }) };
  });
  try { cache.put('AMB_ARVORE', JSON.stringify(arv), 300); } catch (err) {}
  return arv;
}
function limpaCacheArvore_() { try { CacheService.getScriptCache().remove('AMB_ARVORE'); } catch (err) {} }

/* ---------- Docs ---------- */
/* só aceita Docs que estejam dentro de "Site / Ambulatórios" */
function docDoSite_(id) {
  if (!/^[\w-]{20,}$/.test(String(id || ''))) throw new Error('documento inválido');
  const f = DriveApp.getFileById(id);
  if (f.getMimeType() !== MIME_DOC) throw new Error('não é um Google Doc');
  const raiz = mapaAmb_().raiz;
  let pais = f.getParents(), n = 0;
  while (pais.hasNext() && n < 8) {
    let p = pais.next();
    for (let d = 0; d < 6 && p; d++) {
      if (p.getId() === raiz) return f;
      const pp = p.getParents(); p = pp.hasNext() ? pp.next() : null;
    }
    n++;
  }
  throw new Error('documento fora da pasta Ambulatórios');
}
function lerDoc_(id) {
  const f = docDoSite_(id);
  const html = drive_('get', 'https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=text%2Fhtml', null, null, true);
  return { id: id, nome: f.getName(), mod: f.getLastUpdated().toISOString(), html: html };
}
function salvarDoc_(req) {
  const f = docDoSite_(req.id);
  if (req.base && !req.forcar && f.getLastUpdated().getTime() > new Date(req.base).getTime() + 2000)
    return { ok: false, conflito: true, mod: f.getLastUpdated().toISOString(), erro: 'o Doc mudou no Google depois que você abriu' };
  drive_('patch', 'https://www.googleapis.com/upload/drive/v3/files/' + req.id + '?uploadType=media', paginaHtml_(req.html), 'text/html; charset=UTF-8');
  if (req.nome && req.nome.trim() && req.nome.trim() !== f.getName()) f.setName(req.nome.trim().slice(0, 200));
  limpaCacheArvore_();
  const g = DriveApp.getFileById(req.id);
  return { ok: true, id: req.id, nome: g.getName(), mod: g.getLastUpdated().toISOString() };
}
function criarDoc_(req) {
  const ids = {};
  mapaAmb_().esp.forEach(function (e) { [e].concat(e.pastas).forEach(function (n) { Object.keys(n.metodos).forEach(function (k) { ids[n.metodos[k]] = 1; }); }); });
  if (!ids[req.pasta]) throw new Error('pasta inválida');
  const nome = String(req.nome || '').trim().slice(0, 200);
  if (!nome) throw new Error('o tema precisa de um nome');
  const fim = 'rc' + Utilities.getUuid().replace(/-/g, '');
  const meta = JSON.stringify({ name: nome, mimeType: MIME_DOC, parents: [req.pasta] });
  const corpo = '--' + fim + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + fim +
                '\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n' + paginaHtml_(req.html || '<p></p>') + '\r\n--' + fim + '--';
  const r = drive_('post', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', corpo, 'multipart/related; boundary=' + fim);
  limpaCacheArvore_();
  return { ok: true, id: r.id, nome: r.name, mod: r.modifiedTime };
}
function paginaHtml_(html) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + String(html || '') + '</body></html>';
}
/* Drive REST com o token do próprio script (o DriveApp acima já pede a permissão do Drive) */
function drive_(metodo, url, corpo, tipo, texto) {
  const op = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (corpo != null) { op.payload = Utilities.newBlob(corpo, tipo || 'application/json').getBytes(); op.contentType = tipo || 'application/json'; }
  const r = UrlFetchApp.fetch(url, op), cod = r.getResponseCode(), txt = r.getContentText('UTF-8');
  if (cod >= 300) throw new Error('Drive ' + cod + ': ' + txt.slice(0, 160));
  return texto ? txt : JSON.parse(txt || '{}');
}
