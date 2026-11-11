#!/usr/bin/env node
/* Rotina clínica — build.
   Uso:  RC_SENHA=suasenha node tools/build.mjs          gera as páginas cifradas a partir de src/
         RC_SENHA=suasenha node tools/build.mjs abrir    recria src/ a partir das páginas cifradas (ex.: num clone novo)
   src/ nunca vai para o GitHub (.gitignore). A senha nunca é gravada em arquivo. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ITER = 600000;
/* página de origem → pasta de saída. Para criar uma página nova, acrescente uma linha. */
const PAGINAS = [
  { src: 'home.html',         pasta: '',              bin: 'home.bin',   titulo: 'Rotina clínica' },
  { src: 'prescricoes.html',  pasta: 'prescricoes/',  bin: 'pagina.bin', titulo: 'Prescrições no PS' },
  { src: 'ambulatorios.html', pasta: 'ambulatorios/', bin: 'pagina.bin', titulo: 'Ambulatórios' },
  { src: 'calendario.html',   pasta: 'calendario/',   bin: 'pagina.bin', titulo: 'Calendário' },
  { src: 'farmacologia.html', pasta: 'farmacologia/', bin: 'pagina.bin', titulo: 'Farmacologia' },
  { src: 'questoes.html',     pasta: 'questoes/',     bin: 'pagina.bin', titulo: 'Banco de questões' },
];
/* páginas antigas que recebem o visual novo por cima (tools/tema-novo.css); as outras já nascem nele */
const COM_TEMA = new Set(['prescricoes.html', 'ambulatorios.html', 'calendario.html']);
const NOVAS = new Set(['farmacologia.html', 'questoes.html']); /* recebem tools/paginas-novas.css */

/* ---------- visual novo: bloco injetado no <head> (sai de novo no "abrir") ---------- */
const tiraTema = (h) => h.replace(/<!--tema-novo-->[\s\S]*?<!--\/tema-novo-->\n?/g, '');
const poeTema = (h, css = 'tema-novo.css') => tiraTema(h).replace('</head>', () =>
  '<!--tema-novo--><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700&display=swap">' +
  '<style id="tema-novo">' + readFileSync(join(RAIZ, 'tools', css), 'utf8') + '</style><!--/tema-novo-->\n</head>');

const senha = process.env.RC_SENHA;
if (!senha) { console.error('Defina a senha: RC_SENHA=... node tools/build.mjs'); process.exit(1); }
const p = (...a) => join(RAIZ, ...a);
const le = (f) => readFileSync(f, 'utf8');

/* sal: fica em assets/sal.txt (público). Trocar a senha = apagar esse arquivo e rodar o build. */
const fSal = p('assets', 'sal.txt');
if (!existsSync(fSal)) writeFileSync(fSal, randomBytes(16).toString('base64') + '\n');
const sal = le(fSal).trim();
const chave = pbkdf2Sync(senha, Buffer.from(sal, 'base64'), ITER, 32, 'sha256');

function cifra(texto) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', chave, iv);
  const corpo = Buffer.concat([c.update(gzipSync(Buffer.from(texto, 'utf8'), { level: 9 })), c.final()]);
  return Buffer.concat([iv, corpo, c.getAuthTag()]);
}
function decifra(buf) {
  const d = createDecipheriv('aes-256-gcm', chave, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(buf.length - 16));
  return gunzipSync(Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()])).toString('utf8');
}

if (process.argv[2] === 'abrir') {
  mkdirSync(p('src'), { recursive: true });
  for (const pg of PAGINAS) {
    const f = p(pg.pasta, pg.bin);
    if (!existsSync(f)) continue;
    try {
      let html = decifra(readFileSync(f));
      /* a home leva o índice embutido: volta a ser o marcador para o build preencher de novo */
      if (pg.src === 'home.html') html = html.replace(/const IDX=\{.*?\};\n/s, () => 'const IDX="__INDICE__";\n');
      html = tiraTema(html).replace(/const RX=(?!"__RX__").*?;\n/s, () => 'const RX="__RX__";\n');
      writeFileSync(p('src', pg.src), html); console.log('src/' + pg.src);
    }
    catch { console.error('Senha incorreta (ou arquivo corrompido): ' + pg.pasta + pg.bin); process.exit(1); }
  }
  process.exit(0);
}

/* ---------- dados das prescrições (para Farmacologia e Banco de questões) ---------- */
let _rx = null;
function dadosRx() {
  if (_rx) return _rx;
  const s = le(p('src', 'prescricoes.html'));
  const a = s.indexOf('const I=(n,q,p'), d = s.indexOf('const D=[', a), e = s.indexOf('\n];', d) + 3;
  const { D, SPEC } = vm.runInNewContext(s.slice(a, e) + ';({D,SPEC})', {});
  const opc = (l) => (l || []).map(o => ({ s: o.s || '', t: o.t || '', itens: o.items.map(i => ({ n: i.n, q: i.q, p: i.p, v: i.v })) }));
  _rx = D.map(c => ({ id: c.id, n: c.n, sp: c.sp, spn: SPEC[c.sp] || c.sp, cid: c.cid || [], single: opc(c.single), combo: opc(c.combo), orient: c.orient || [] }));
  return _rx;
}
const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/* nome do fármaco sem dose: "Amoxicilina + clavulanato de potássio 875 mg" → "Amoxicilina + clavulanato" */
function farmaco(nome) {
  let b = nome.split(/\s(?=[\d(])/)[0].trim(), a;
  do { a = b; b = b.replace(/\s+(creme vaginal|gel vaginal|pomada oftálmica|colírio|xampu|suspensão|gotas|xarope|comprimidos?|creme|pomada|loção|gel|solução|spray|nasal|sódico|de potássio)$/i, '').trim(); } while (a !== b);
  b = b.replace(/\s+de potássio/i, '');
  return { id: semAcento(b).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), nome: b };
}
function dadosFarm() {
  const m = {};
  for (const c of dadosRx()) for (const o of c.single.concat(c.combo)) for (const i of o.itens) {
    const f = farmaco(i.n);
    if (!f.id) continue;
    const g = m[f.id] || (m[f.id] = { id: f.id, nome: f.nome, apres: new Set(), usos: [] });
    g.apres.add(i.n);
    if (!g.usos.some(u => u.c === c.id && u.p === i.p)) g.usos.push({ c: c.id, cn: c.n, sp: c.spn, s: o.s, n: i.n, p: i.p, v: i.v });
  }
  return Object.values(m).map(g => ({ ...g, apres: [...g.apres] })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}

/* ---------- índice de busca da home (montado a partir das outras páginas) ---------- */
function indice() {
  const itens = [], esp = {};
  const rx = le(p('src', 'prescricoes.html'));
  const specs = rx.match(/const SPECS=(\[\[.*?\]\]);/s);
  if (specs) for (const [k, v] of Function('return ' + specs[1])()) esp[k] = v;
  for (const m of rx.matchAll(/\{id:'([^']+)',n:'((?:[^'\\]|\\.)*)',sp:'([^']+)'[^\n]*?cid:\[([^\]]*)\],k:'((?:[^'\\]|\\.)*)'/g))
    itens.push({ p: 'presc', r: m[1], t: m[2].replace(/\\'/g, "'"), g: esp[m[3]] || m[3], c: m[4].replace(/'/g, '').replace(/,/g, ' '), k: m[5] });
  const nRx = itens.length;
  /* ambulatórios: especialidade → pastas (pré-natal, puericultura…) → consultas; e temas da especialidade */
  const d = JSON.parse(le(p('src', 'ambulatorios.html')).match(/<script id="dados" type="application\/json">(.*?)<\/script>/s)[1]);
  const onde = {};
  for (const e of d.especialidades) for (const pa of e.pastas || []) for (const b of pa.blocos || []) onde[b] = [e, pa];
  const rotaB = (b, id) => onde[b] ? onde[b][0].id + '/' + onde[b][1].id + '/' + id : id;
  const blocos = d.blocos.filter(b => onde[b.id]).map(b => ({ id: b.id, nome: b.nome, itens: b.consultas.map(c => ({ r: rotaB(b.id, c.id), t: c.titulo })) }));
  for (const b of d.blocos) for (const c of b.consultas) if (onde[b.id])
    itens.push({ p: 'amb', r: rotaB(b.id, c.id), t: c.titulo, g: onde[b.id][0].nome + ' · ' + onde[b.id][1].nome, k: (c.sub || '') + ' ' + (c.kicker || '') + ' ' + b.nome });
  const amb = [];
  for (const e of d.especialidades) {
    /* cada especialidade e cada pasta tem dois métodos: modelos de consulta e referencial teórico */
    const pastas = e.pastas || [];
    const doMetodo = (o) => [['Modelo de consulta', o.modelos || []], ['Referencial teórico', (o.teoria || []).concat(o.temas || [])]];
    const soltos = (o) => doMetodo(o).reduce((s, [, l]) => s + l.length, 0);
    const n = soltos(e) + pastas.reduce((s, pa) => s + soltos(pa) + (pa.blocos || []).reduce((x, b) => x + (d.blocos.find(y => y.id === b) || { consultas: [] }).consultas.length, 0), 0);
    amb.push({ id: e.id, nome: e.nome, cor: e.cor, icone: e.icone, n, sub: pastas.map(pa => pa.nome).join(', ') });
    itens.push({ p: 'amb', r: e.id, t: e.nome, g: 'Ambulatório', k: (e.frase || '') + ' ' + pastas.map(pa => pa.nome).join(' ') });
    for (const pa of pastas) {
      itens.push({ p: 'amb', r: e.id + '/' + pa.id, t: pa.nome, g: e.nome + ' · pasta', k: pa.frase || '' });
      for (const [met, lista] of doMetodo(pa)) for (const tm of lista)
        itens.push({ p: 'amb', r: e.id + '/' + pa.id + '/' + tm.id, t: tm.titulo, g: e.nome + ' · ' + pa.nome + ' · ' + met, k: (tm.resumo || '') + ' ' + (tm.tags || []).join(' ') });
    }
    for (const [met, lista] of doMetodo(e)) for (const tm of lista)
      itens.push({ p: 'amb', r: e.id + '/' + tm.id, t: tm.titulo, g: e.nome + ' · ' + met, k: (tm.resumo || '') + ' ' + (tm.tags || []).join(' ') });
  }
  const farm = dadosFarm();
  for (const f of farm) itens.push({ p: 'farm', r: f.id, t: f.nome, g: 'Farmacologia · ' + f.usos.length + (f.usos.length > 1 ? ' usos' : ' uso'), k: f.usos.map(u => u.cn).join(' ') });
  return { itens, nRx, blocos, amb, esp: Object.values(esp).length, nFarm: farm.length };
}

const stub = (pg) => {
  const raiz = pg.pasta ? '../' : './';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#efeef1" media="(prefers-color-scheme: light)">
<title>${pg.titulo}</title>
<link rel="icon" href="${raiz}assets/icone.svg" type="image/svg+xml">
<script>try{if(localStorage.getItem('bancos-tema')==='escuro')document.documentElement.dataset.theme='dark'}catch(e){}</script>
<link rel="stylesheet" href="${raiz}assets/porta.css">
</head>
<body>
<noscript><p style="font:16px system-ui;padding:40px">Ative o JavaScript para abrir este material.</p></noscript>
<script src="${raiz}assets/porta.js" data-bin="${pg.bin}" data-raiz="${raiz}"></script>
</body>
</html>
`;
};

/* porta.js: injeta o sal e o tipo de teclado */
const fPorta = p('assets', 'porta.js');
let porta = le(fPorta).replace(/var SAL = '[^']*';/, `var SAL = '${sal}';`);
porta = porta.replace(/inputmode="[a-z]*"/, `inputmode="${/^\d+$/.test(senha) ? 'numeric' : 'text'}"`);
writeFileSync(fPorta, porta);

function montar(pg, html) {
  if (pg.src === 'home.html') html = html.replace('"__INDICE__"', () => JSON.stringify(indice()).replace(/</g, '\\u003c'));
  if (html.includes('"__RX__"')) html = html.replace('"__RX__"', () => JSON.stringify(pg.src === 'farmacologia.html' ? { farm: dadosFarm() } : dadosRx()).replace(/</g, '\\u003c'));
  return COM_TEMA.has(pg.src) ? poeTema(html) : NOVAS.has(pg.src) ? poeTema(html, 'paginas-novas.css') : tiraTema(html);
}
const PREVIA = process.argv[2] === 'previa' ? (process.argv[3] || join(RAIZ, '..', 'previa')) : null;

let total = 0;
for (const pg of PAGINAS) {
  const f = p('src', pg.src);
  if (!existsSync(f)) { console.warn('faltando: src/' + pg.src); continue; }
  let html = montar(pg, le(f));
  if (PREVIA) { /* prévia sem cifra, sem os endereços e tokens do Google */
    const dst = join(PREVIA, pg.pasta); mkdirSync(dst, { recursive: true });
    writeFileSync(join(dst, 'index.html'), html.replace(/const (GCAL|GDRV)=\{[^}]*\}/g, "const $1={url:'',token:''}").replace(/src:'(\w+)\/'/g, "src:'$1/index.html'"));
    console.log('prévia: ' + (pg.pasta || '/')); continue;
  }
  if (pg.pasta) mkdirSync(p(pg.pasta), { recursive: true });
  /* só regrava o .bin se o conteúdo mudou (o IV aleatório mudaria o arquivo a cada build) */
  const fBin = p(pg.pasta, pg.bin);
  let bin = null;
  if (existsSync(fBin)) { try { const atual = readFileSync(fBin); if (decifra(atual) === html) bin = atual; } catch {} }
  if (!bin) {
    bin = cifra(html);
    if (decifra(bin) !== html) throw new Error('falha na verificação de ' + pg.src);
    writeFileSync(fBin, bin);
  }
  writeFileSync(p(pg.pasta, 'index.html'), stub(pg));
  total += bin.length;
  console.log(`${(pg.pasta || '/').padEnd(15)} ${(Buffer.byteLength(html) / 1024).toFixed(0).padStart(4)} KB → ${(bin.length / 1024).toFixed(0).padStart(3)} KB`);
}
console.log(`total cifrado: ${(total / 1024).toFixed(0)} KB`);
