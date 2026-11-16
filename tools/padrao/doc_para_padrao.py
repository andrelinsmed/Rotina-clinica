"""Converte o HTML exportado de um Google Doc para o padrão de referencial do André med.
uso: python3 doc_para_padrao.py entrada.html saida.html "KICKER" "Título" "Subtítulo"
"""
import sys, re, io, base64, html
from bs4 import BeautifulSoup, NavigableString
from PIL import Image

ENT, SAI, KICKER, TITULO, SUB = sys.argv[1:6]
P = '/home/claude/tools/padrao/'
soup = BeautifulSoup(open(ENT, encoding='utf-8').read(), 'html.parser')
body = soup.body

def estilo(tag):
    d = {}
    for par in (tag.get('style') or '').split(';'):
        if ':' in par:
            k, v = par.split(':', 1); d[k.strip().lower()] = v.strip().lower()
    return d

NEUTRO = {'#000000', '#000', 'black', 'inherit', '#1f1f1f', '#222222', '#333333'}
BRANCO = {'#ffffff', '#fff', 'white', 'transparent', 'none', ''}

def img_webp(src):
    m = re.match(r'data:image/[a-z+]+;base64,(.*)', src or '', re.S)
    if not m: return None
    try:
        im = Image.open(io.BytesIO(base64.b64decode(m.group(1))))
        if im.mode in ('P', 'LA'): im = im.convert('RGBA')
        if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGB')
        if im.width > 1400: im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, 'WEBP', quality=80, method=6)
        return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    except Exception as e:
        print('imagem ignorada:', e); return None

def inline(node):
    """texto com <b>, <i>, <mark>, cor e links"""
    out = []
    for c in node.children:
        if isinstance(c, NavigableString):
            out.append(html.escape(str(c), quote=False)); continue
        if c.name == 'br': out.append('<br>'); continue
        if c.name == 'img':
            w = img_webp(c.get('src'));
            if w: out.append(f'<img src="{w}" alt="">')
            continue
        t = inline(c)
        if not t.strip(): out.append(t); continue
        if c.name == 'a' and c.get('href', '').startswith('http'):
            href = re.sub(r'^https://www\.google\.com/url\?q=([^&]+).*$', lambda m: html.unescape(m.group(1)), c['href'])
            t = f'<a href="{html.escape(href)}" target="_blank" rel="noopener">{t}</a>'
        st = estilo(c)
        if st.get('font-weight') in ('700', 'bold') or c.name in ('b', 'strong'): t = f'<b>{t}</b>'
        if st.get('font-style') == 'italic' or c.name in ('i', 'em'): t = f'<i>{t}</i>'
        bg = st.get('background-color', '')
        if bg not in BRANCO: t = f'<mark style="background:{bg}">{t}</mark>'
        cor = st.get('color', '')
        if cor and cor not in NEUTRO and re.match(r'#[0-9a-f]{3,6}$', cor): t = f'<span style="color:{cor}">{t}</span>'
        if st.get('vertical-align') == 'super': t = f'<sup>{t}</sup>'
        if st.get('vertical-align') == 'sub': t = f'<sub>{t}</sub>'
        out.append(t)
    s = ''.join(out)
    s = re.sub(r'</b>(\s*)<b>', r'\1', s); s = re.sub(r'</i>(\s*)<i>', r'\1', s)
    return s

def tudo_negrito(p):
    txt = p.get_text(' ', strip=True)
    if not txt: return False
    spans = [s for s in p.find_all('span') if s.get_text(strip=True)]
    return spans and all(estilo(s).get('font-weight') in ('700', 'bold') for s in spans)

secoes = []          # [titulo, [html]]
atual = None
objetivos = []
modo_obj = False
def emite(h):
    global atual
    if atual is None:
        atual = ['Introdução', []]; secoes.append(atual)
    atual[1].append(h)

for el in body.find_all(recursive=False):
    nome = el.name
    txt = el.get_text(' ', strip=True)
    if nome in ('h1', 'h2'):
        if not txt: continue
        modo_obj = False
        atual = [txt, []]; secoes.append(atual); continue
    if nome in ('h3', 'h4'):
        if not txt: continue
        modo_obj = False
        emite(f'<{"h2" if nome == "h3" else "h3"}>{inline(el)}</{"h2" if nome == "h3" else "h3"}>'); continue
    if nome == 'p':
        imgs = el.find_all('img')
        if imgs and not txt:
            for im in imgs:
                w = img_webp(im.get('src'))
                if w: emite(f'<figure class="img"><img src="{w}" alt=""></figure>')
            continue
        if not txt: continue
        if re.match(r'(figura|fonte|imagem)\b', txt, re.I) and atual and atual[1] and atual[1][-1].startswith('<figure class="img">') and '<figcaption>' not in atual[1][-1]:
            atual[1][-1] = atual[1][-1].replace('</figure>', f'<figcaption>{inline(el)}</figcaption></figure>'); continue
        if tudo_negrito(el) and len(txt) < 110:
            if re.match(r'objetivos? de aprendizagem', txt, re.I) and not secoes[1:]:
                modo_obj = True; continue
            emite(f'<h3>{html.escape(txt)}</h3>'); continue
        if modo_obj and len(secoes) <= 1:
            objetivos.append(re.sub(r'^\s*\d+\.\s*', '', inline(el))); continue
        al = estilo(el).get('text-align', '')
        emite(f'<p class="ni" style="text-align:center">{inline(el)}</p>' if al == 'center' else f'<p>{inline(el)}</p>'); continue
    if nome in ('ul', 'ol'):
        itens = ''.join(f'<li>{inline(li)}</li>' for li in el.find_all('li', recursive=False) if li.get_text(strip=True))
        if modo_obj and len(secoes) <= 1:
            objetivos += [inline(li) for li in el.find_all('li', recursive=False) if li.get_text(strip=True)]; continue
        if itens: emite(f'<ul class="b">{itens}</ul>' if nome == 'ul' else f'<ol class="n">{itens}</ol>'); continue
    if nome == 'table':
        linhas = el.find_all('tr')
        h = ['<table>']
        for i, tr in enumerate(linhas):
            cel = tr.find_all(['td', 'th'])
            tag = 'th' if i == 0 else 'td'
            h.append('<tr>' + ''.join(f'<{tag}>{"".join(inline(p) + ("<br>" if j < len(c.find_all("p")) - 1 else "") for j, p in enumerate(c.find_all("p"))) or inline(c)}</{tag}>' for c in cel) + '</tr>')
        h.append('</table>'); emite(''.join(h)); continue
    if nome == 'hr': continue
    if txt: emite(f'<p>{inline(el)}</p>')

# remove seções vazias e monta
secoes = [s for s in secoes if s[1]]
sumario = ''.join(f'<li><a href="#s{i+1}">{html.escape(t)}</a></li>' for i, (t, _) in enumerate(secoes))
html_sec = '\n'.join(f'<section class="blk" id="s{i+1}"><h1 class="q">{html.escape(t)}</h1>\n' + '\n'.join(c) + '\n</section>' for i, (t, c) in enumerate(secoes))
obj = '<ol class="n" style="margin:4px 0 0">' + ''.join(f'<li>{o}</li>' for o in objetivos) + '</ol>' if objetivos else ''
mod = open(P + 'modelo.html', encoding='utf-8').read()
out = (mod.replace('{{CSS}}', open(P + 'referencial.css', encoding='utf-8').read())
          .replace('{{KICKER}}', html.escape(KICKER)).replace('{{TITULO}}', html.escape(TITULO))
          .replace('{{SUBTITULO}}', html.escape(SUB)).replace('{{ROTULO_OBJ}}', 'Objetivos de aprendizagem' if objetivos else '')
          .replace('{{OBJETIVOS}}', obj).replace('{{SUMARIO}}', sumario).replace('{{SECOES}}', html_sec))
if not objetivos: out = out.replace('<div class="obj"><b></b></div>', '')
open(SAI, 'w', encoding='utf-8').write(out)
print('seções', len(secoes), '| objetivos', len(objetivos), '| tamanho', len(out))
