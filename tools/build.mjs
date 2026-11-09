#!/usr/bin/env node
/* Rotina clínica — build.
   Uso:  RC_SENHA=suasenha node tools/build.mjs          gera as páginas cifradas a partir de src/
         RC_SENHA=suasenha node tools/build.mjs abrir    recria src/ a partir das páginas cifradas (ex.: num clone novo)
   src/ nunca vai para o GitHub (.gitignore). A senha nunca é gravada em arquivo. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ITER = 600000;
/* página de origem → pasta de saída. Para criar uma página nova, acrescente uma linha. */
const PAGINAS = [
  { src: 'home.html',         pasta: '',              bin: 'home.bin',   titulo: 'Rotina clínica' },
  { src: 'prescricoes.html',  pasta: 'prescricoes/',  bin: 'pagina.bin', titulo: 'Prescrições no PS' },
  { src: 'ambulatorios.html', pasta: 'ambulatorios/', bin: 'pagina.bin', titulo: 'Ambulatórios' },
];

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
      writeFileSync(p('src', pg.src), html); console.log('src/' + pg.src);
    }
    catch { console.error('Senha incorreta (ou arquivo corrompido): ' + pg.pasta + pg.bin); process.exit(1); }
  }
  process.exit(0);
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
  /* ambulatórios: pré-natal e puericultura (consultas) + especialidades (temas) */
  const d = JSON.parse(le(p('src', 'ambulatorios.html')).match(/<script id="dados" type="application\/json">(.*?)<\/script>/s)[1]);
  const espDe = (b) => b === 'prenatal' ? 'prenatal' : 'puericultura';
  const blocos = d.blocos.map(b => ({ id: b.id, nome: b.nome, itens: b.consultas.map(c => ({ r: espDe(b.id) + '/' + c.id, t: c.titulo })) }));
  for (const b of d.blocos) for (const c of b.consultas)
    itens.push({ p: 'amb', r: espDe(b.id) + '/' + c.id, t: c.titulo, g: b.id === 'ia' ? 'Puericultura · introdução alimentar' : d.cadernos[espDe(b.id)].nome, k: (c.sub || '') + ' ' + (c.kicker || '') });
  const amb = Object.entries(d.cadernos).map(([id, c]) => ({ id, nome: c.nome, cor: c.cor, icone: c.icone, rico: true,
    n: d.blocos.filter(b => espDe(b.id) === id).reduce((s, b) => s + b.consultas.length, 0) }));
  for (const [id, c] of Object.entries(d.cadernos)) itens.push({ p: 'amb', r: id, t: c.nome, g: 'Ambulatório', k: c.frase || '' });
  for (const e of d.especialidades) {
    amb.push({ id: e.id, nome: e.nome, cor: e.cor, icone: e.icone, n: (e.temas || []).length });
    itens.push({ p: 'amb', r: e.id, t: e.nome, g: 'Ambulatório', k: e.frase || '' });
    for (const t of e.temas || []) itens.push({ p: 'amb', r: e.id + '/' + t.id, t: t.titulo, g: e.nome, k: (t.resumo || '') + ' ' + (t.tags || []).join(' ') });
  }
  return { itens, nRx, blocos, amb, esp: Object.values(esp).length };
}

const stub = (pg) => {
  const raiz = pg.pasta ? '../' : './';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#f5f5f7" media="(prefers-color-scheme: light)">
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

let total = 0;
for (const pg of PAGINAS) {
  const f = p('src', pg.src);
  if (!existsSync(f)) { console.warn('faltando: src/' + pg.src); continue; }
  let html = le(f);
  if (pg.src === 'home.html') html = html.replace('"__INDICE__"', () => JSON.stringify(indice()).replace(/</g, '\\u003c'));
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
