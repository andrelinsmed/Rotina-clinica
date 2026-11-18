"""Modo escuro dos referenciais do André med.

Acrescenta (uma vez só) a cada HTML de referencial:
  - o script que segue o tema do site (localStorage 'bancos-tema' e o tema da página em volta, ao vivo);
  - o CSS escuro do padrão, com correções para as cores fixas que vieram do Google Docs.
uso: python3 escuro.py arquivo1.html [arquivo2.html ...]
"""
import sys

MARCA = '/* modo escuro André med */'

SCRIPT = """<script>/* tema: segue o botão do site, inclusive com a página aberta */
(function(){var R=document.documentElement;
function poe(esc){if(esc)R.dataset.theme='dark';else delete R.dataset.theme}
function doSite(){try{return localStorage.getItem('bancos-tema')==='escuro'}catch(e){return false}}
poe(doSite());
addEventListener('storage',function(e){if(e.key==='bancos-tema')poe(doSite())});
try{if(parent&&parent!==window){var P=parent.document.documentElement;
  new MutationObserver(function(){poe(P.dataset.theme==='dark')}).observe(P,{attributes:true,attributeFilter:['data-theme']})}}catch(e){}
})();</script>"""

CSS = MARCA + """
html[data-theme="dark"]{color-scheme:dark;
  --ink:#e7e5e4;--muted:#a8a3a0;--line:#37332f;--paper:#1d1b1a;--bg:#131211;
  --red:#ff9a8f;--salmon:#3b2220;--salmon2:#2f1c1a;--hl:#5c4d12;
  --blue:#8cb8ff;--blue2:#17243a;--orange:#ffb27a;--orange2:#33230f;
  --green:#7fd6a5;--green2:#13291e;--rose:#ff958d;--rose2:#3a1b19;
  --violet:#c9a9f3;--violet2:#251b36}
html[data-theme="dark"] body{background:var(--bg);color:var(--ink)}
html[data-theme="dark"] header.cover{background:linear-gradient(135deg,#4f0f0f,#7d2620)}
html[data-theme="dark"] h3{color:var(--red)}
html[data-theme="dark"] mark{color:#fff4c8}
html[data-theme="dark"] th,html[data-theme="dark"] td{border-color:#423c37}
html[data-theme="dark"] td.grp{background:#25221f}
html[data-theme="dark"] .fig{background:#191716}
html[data-theme="dark"] .fig svg{background:#faf8f6;border-radius:10px}
html[data-theme="dark"] .note.caso .fig{background:#191716}
html[data-theme="dark"] button.pill{background:#26231f;border-color:#4a443e;color:var(--ink)}
html[data-theme="dark"] button.pill[aria-pressed="true"]{background:#8b1a1a;border-color:#8b1a1a;color:#fff}
html[data-theme="dark"] .readout{background:#211e1c}
html[data-theme="dark"] figure.img img,html[data-theme="dark"] main img{filter:brightness(.92)}
html[data-theme="dark"] a{color:#9ec3ff}
html[data-theme="dark"] nav.toc a{color:var(--red)}
/* cores fixas herdadas do Google Docs */
html[data-theme="dark"] [style*="color:#1f1f22"],html[data-theme="dark"] [style*="color:#000000"],html[data-theme="dark"] [style*="color:#000;"]{color:var(--ink)!important}
html[data-theme="dark"] [style*="color:#1f5fa8"],html[data-theme="dark"] [style*="color:#0000ee"],html[data-theme="dark"] [style*="color:#1155cc"]{color:var(--blue)!important}
html[data-theme="dark"] [style*="color:#8b1a1a"],html[data-theme="dark"] [style*="color:#990000"],html[data-theme="dark"] [style*="color:#cc0000"],html[data-theme="dark"] [style*="color:#ff0000"]{color:var(--red)!important}
html[data-theme="dark"] [style*="background:#"],html[data-theme="dark"] [style*="background:#"] *{color:#1f1f22!important}
"""

def aplica(caminho):
    s = open(caminho, encoding='utf-8').read()
    if MARCA in s:
        print('já tinha:', caminho); return
    i = s.index('</style>')
    s = s[:i] + '\n' + CSS + s[i:]
    j = s.index('<style>')
    s = s[:j] + SCRIPT + '\n' + s[j:]
    open(caminho, 'w', encoding='utf-8').write(s)
    print('ok:', caminho)

if __name__ == '__main__':
    for c in sys.argv[1:]:
        aplica(c)
