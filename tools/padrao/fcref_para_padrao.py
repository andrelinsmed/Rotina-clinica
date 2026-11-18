"""Converte um referencial no formato .fcref (artefato do Claude) para o padrão de escrita do André med.

uso: python3 fcref_para_padrao.py entrada.html saida.html "KICKER" "Título" "Subtítulo"
Mantém texto, tabelas e esquemas SVG; troca a moldura (capa, sumário, seções) e os quadros
(raciocínio da aula, complemento da literatura, correlações clínicas) pelas classes do padrão.
"""
import sys, re, html
from bs4 import BeautifulSoup, NavigableString

D = '/home/claude/tools/padrao/'
ent, sai, KICK, TIT, SUB = sys.argv[1:6]
src = open(ent, encoding='utf-8').read()
sp = BeautifulSoup(src, 'html.parser')
art = sp.select_one('article.fcref')
wrap = art.select_one('.fcref__wrap')

# variáveis de cor usadas pelos SVG (versão clara do .fcref)
css_fc = src[src.find('.fcref{'):]
css_fc = css_fc[:css_fc.find('}')]
vars_fc = ';'.join(re.findall(r'(--fc-[a-z0-9-]+:[^;]+)', css_fc))

EXTRA = """
/* ---- acréscimos para referenciais vindos do formato .fcref ---- */
:root{%s}
.fig svg{display:block;width:100%%;height:auto}
.fig .s-t{font-family:Arial,Helvetica,sans-serif;fill:var(--fc-ink);font-size:13px}
.fig .s-sm{font-size:11.5px;fill:var(--fc-ink-soft)}
.fig .s-xs{font-size:10.5px;fill:var(--fc-muted)}
.fig .s-b{font-weight:700}
.fig .s-ttl{font-size:13.5px;font-weight:700;fill:var(--fc-ink)}
.fig .s-mid{text-anchor:middle}
.fig .s-end{text-anchor:end}
.fig .s-i{font-style:italic}
.note.lit{background:var(--violet2);border-left-color:var(--violet)}
.note.lit b.rot{color:var(--violet)}
.note.caso{background:var(--orange2);border-left-color:var(--orange)}
.note.caso>b.rot{color:var(--orange);display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}
.note.caso>p.tit{font-weight:bold;font-size:16px;margin-bottom:8px}
.note.caso p.tag b{color:var(--ink)}
.note.caso .fig{background:#fff}
.tabela{overflow-x:auto;-webkit-overflow-scrolling:touch}
header.cover p.meta{font-size:12.5px;color:rgba(255,255,255,.78);margin:12px 0 0}
@media(max-width:700px){.fig .rol{overflow-x:auto;-webkit-overflow-scrolling:touch}.fig .rol svg{min-width:640px}}
""" % vars_fc

def interno(el):
    return ''.join(str(c) for c in el.contents).strip()

def tag_para_html(p, dentro_caso=False):
    """p.fc-tag (aula/literatura) → quadro do padrão."""
    rot = p.select_one('.fcref__tag')
    r = rot.get_text(strip=True) if rot else ''
    if rot: rot.extract()
    corpo = interno(p)
    if dentro_caso:
        return f'<p class="tag"><b>{html.escape(r)}.</b> {corpo}</p>'
    cls = 'note lit' if 'fc-tag-lit' in p.get('class', []) else 'note'
    return f'<div class="{cls}"><p><b class="rot">{html.escape(r)}.</b> {corpo}</p></div>'

def fig_para_html(f):
    svg = f.find('svg'); cap = f.find('figcaption')
    return f'<div class="fig"><div class="rol">{svg}</div>' + (f'<div class="cap">{interno(cap)}</div>' if cap else '') + '</div>'

def bloco(el, dentro_caso=False):
    if isinstance(el, NavigableString):
        return '' if not el.strip() else html.escape(str(el))
    c = el.get('class', [])
    if el.name == 'figure':
        return fig_para_html(el)
    if el.name == 'p' and 'fc-tag' in c:
        return tag_para_html(el, dentro_caso)
    if el.name == 'div' and 'fcref__tablewrap' in c:
        return f'<div class="tabela">{interno(el)}</div>'
    if el.name == 'div' and 'fcref__caso' in c:
        lab = el.select_one('.fcref__box-label'); tit = el.select_one('.fcref__caso-title')
        partes = [f'<b class="rot">{lab.get_text(strip=True)}</b>' if lab else '',
                  f'<p class="tit">{interno(tit)}</p>' if tit else '']
        for x in el.children:
            if x in (lab, tit): continue
            partes.append(bloco(x, True))
        return '<div class="note caso">' + ''.join(partes) + '</div>'
    if el.name == 'div' and 'fcref__box' in c:
        lab = el.select_one('.fcref__box-label')
        partes = [f'<p><b>{lab.get_text(strip=True)}.</b></p>' if lab else '']
        for x in el.children:
            if x is lab: continue
            partes.append(bloco(x, dentro_caso))
        return '<div class="note">' + ''.join(partes) + '</div>'
    if el.name == 'h3':
        return f'<h2>{interno(el)}</h2>'
    if el.name == 'h4':
        return f'<h3>{interno(el)}</h3>'
    if el.name == 'ul' and not c:
        el['class'] = ['b']
    if el.name == 'ol' and not c:
        el['class'] = ['n']
    return str(el)

# objetivos: lista logo após o h3 "Objetivos de aprendizagem"
obj_html = ''
for h in wrap.find_all('h3'):
    if 'objetivo' in h.get_text().lower():
        lst = h.find_next_sibling(['ul', 'ol'])
        if lst:
            obj_html = '<ol class="n" style="margin:4px 0 0">' + ''.join(f'<li>{interno(li)}</li>' for li in lst.find_all('li', recursive=False)) + '</ol>'
            lst.extract()
        h.extract()
        break

meta = art.select_one('.fcref__meta')
meta_html = ' · '.join(s.get_text(strip=True) for s in meta.find_all('span')) if meta else ''

secoes = []; atual = None; antes = []
for el in list(wrap.children):
    if getattr(el, 'name', None) == 'nav':
        continue
    if getattr(el, 'name', None) == 'h2' and (el.get('id') or '').startswith('fc-s'):
        num = el.select_one('.fcref__num')
        if num: num.extract()
        atual = [el.get_text(strip=True), []]; secoes.append(atual)
        continue
    alvo = atual[1] if atual else antes
    if getattr(el, 'name', None) == 'div' and 'fcref__refs' in el.get('class', []):
        alvo.append(f'<div class="refs">{interno(el)}</div>')
    elif getattr(el, 'name', None) == 'p' and 'fcref__footnote' in el.get('class', []):
        alvo.append(f'<p class="closing">{interno(el)}</p>')
    else:
        b = bloco(el)
        if b.strip(): alvo.append(b)

# o que vem antes da 1ª seção (o quadro "Como ler") abre a seção 1
if antes and secoes:
    secoes[0][1] = antes + secoes[0][1]

sumario = ''.join(f'<li><a href="#s{i+1}">{html.escape(t)}</a></li>' for i, (t, _) in enumerate(secoes))
html_sec = '\n'.join(f'<section class="blk" id="s{i+1}"><h1 class="q">{html.escape(t)}</h1>\n' + '\n'.join(c) + '\n</section>'
                     for i, (t, c) in enumerate(secoes))

css = open(D + 'referencial.css', encoding='utf-8').read() + EXTRA
out = (open(D + 'modelo.html', encoding='utf-8').read()
       .replace('{{CSS}}', css).replace('{{KICKER}}', html.escape(KICK)).replace('{{TITULO}}', html.escape(TIT))
       .replace('{{SUBTITULO}}', html.escape(SUB)).replace('{{ROTULO_OBJ}}', 'Objetivos de aprendizagem')
       .replace('{{OBJETIVOS}}', obj_html).replace('{{SUMARIO}}', sumario).replace('{{SECOES}}', html_sec))
if meta_html:
    out = out.replace('</div>\n</header>', f'</div>\n  <p class="meta">{html.escape(meta_html)}</p>\n</header>', 1)
open(sai, 'w', encoding='utf-8').write(out)
print('seções', len(secoes), '| figuras', out.count('class="fig"'), '| quadros', out.count('class="note'), '| tabelas', out.count('<table'), '| bytes', len(out))
