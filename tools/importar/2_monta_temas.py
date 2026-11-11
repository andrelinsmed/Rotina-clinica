"""Transforma os temas extraídos dos PDFs em itens de 'teoria' do Ambulatórios e grava em src/ambulatorios.html."""
import json, re, html, unicodedata, glob, os, sys

SRC_HTML = '/home/claude/rotina-clinica/src/ambulatorios.html'
J = '/home/claude/amb_json'

def slug(t):
    t = unicodedata.normalize('NFD', t.lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:60]

def limpa(t):
    t = re.sub(r'(\w)- (\w)', r'\1-\2', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

# arquivo → (id da especialidade, nome, cor, ícone novo ou None)
I = lambda d: f"<path d='{d}'/>"
ICONES = {
 'alergia': I('M12 2c-1.7 3-5 5.6-5 9.5a5 5 0 0 0 10 0C17 7.6 13.7 5 12 2Zm-2.5 10.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm5 2a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6ZM9 19h6v3H9z'),
 'cirurgia': I('M14.6 2.6 21.4 9.4 10 20.8H3.2V14L14.6 2.6Zm0 3.2L6 14.4v3.6h3.6l8.6-8.6-3.6-3.6Z'),
 'paliativos': I('M12 21s-7.5-4.6-9.4-9.6C1.3 8 3.4 4.5 6.9 4.5c2 0 3.6 1.1 4.1 2.6.5-1.5 2.1-2.6 4.1-2.6 3.5 0 5.6 3.5 4.3 6.9C19.5 16.4 12 21 12 21Z'),
 'emergencia': I('M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3Z'),
 'geriatria': I('M12 2.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM9 10h6l1.5 5H15l-.8 6.5h-4.4L9 15H7.5L9 10Zm9.5 0H20v11.5h-1.5V10Z'),
 'hemato': I('M12 2.2S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.2 12 2.2Z'),
 'hepato': I('M3 9.5C3 6.5 6 4 10 4c3 0 5 1.4 7 1.4 2.3 0 4 1 4 3.1 0 4.5-5.5 10.5-11.5 10.5C5.4 19 3 14 3 9.5Z'),
 'infecto': I('M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-1-5h2v4h-2zM11 18h2v4h-2zM2 11h4v2H2zM18 11h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8L7 8.4zM16.6 17l1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4 7 15.6l1.4 1.4-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4L17 8.4z'),
 'mfc': I('M12 3 2.5 11h2.7v9.5h5.3v-6h3v6h5.3V11h2.7L12 3Z'),
 'uti': I('M2 12h4.2l2.3-6.5 4 13 2.6-8.5 1.4 2H22v2h-6.6l-.3-.5-2.6 8.5-4-13L7.6 14H2v-2Z'),
 'nutro': I('M15.5 3c-2 0-3 1.2-3.5 2.5C11.5 4.2 10.5 3 8.5 3c.2 1.8 1.4 3 3.5 3.2-3.8.3-7 3.3-7 7.8C5 18 8 21.5 12 21.5S19 18 19 14c0-4.5-3.2-7.5-7-7.8 2.1-.2 3.3-1.4 3.5-3.2Z'),
 'oftalmo': I('M12 5C6.5 5 2.7 9.1 1.5 12c1.2 2.9 5 7 10.5 7s9.3-4.1 10.5-7C21.3 9.1 17.5 5 12 5Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.3a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z'),
 'uro': I('M8.5 3C5.5 3 4 6 4 9.5s1.5 6 3.5 7c1 .5 1.5 1.3 1.5 2.5V21h2v-2.4c0-2 1-3 1-5.1 0-2-1.5-2.7-1.5-4.5S12 6 12 4.8C12 3.7 10.5 3 8.5 3Zm7 0c-2 0-3.5.7-3.5 1.8 0 .8.8 1.7 1 2.6M15.5 3c3 0 4.5 3 4.5 6.5s-1.5 6-3.5 7c-1 .5-1.5 1.3-1.5 2.5V21h-2v-2.4c0-1 .3-1.8.6-2.6'),
}
MAPA = {
 'Alergia_e_imunologia_': ('alergia', 'Alergia e imunologia', '#ff9500', 'Rinite, anafilaxia, urticária e reações a drogas.'),
 'Cardiologia+': ('cardio', None, None, None),
 'Cirurgia_': ('cirurgia', 'Cirurgia', '#5856d6', 'Pré e pós-operatório, feridas e cirurgia ambulatorial.'),
 'Cuidados_Paliativos_': ('paliativos', 'Cuidados paliativos', '#af52de', 'Controle de sintomas e cuidado no fim de vida.'),
 'Dermatologia': ('derma', None, None, None),
 'Emergncia': ('emergencia', 'Emergência', '#ff3b30', 'Condutas de urgência e protocolos de atendimento.'),
 'Endcrinologia_': ('endocrino', None, None, None),
 'Gastrologia': ('gastro', None, None, None),
 'Geriatria_': ('geriatria', 'Geriatria', '#a2845e', 'Avaliação funcional, demências e delirium.'),
 'Ginecologia_': ('gineco', None, None, None),
 'Obstetrcia_': ('gineco', None, None, None),
 'Hematologia': ('hemato', 'Hematologia', '#d70015', 'Anemias, hemograma e doenças do sangue.'),
 'Hepatologia': ('hepato', 'Hepatologia', '#c46b00', 'Hepatites, cirrose e insuficiência hepática.'),
 'Infectologia': ('infecto', 'Infectologia', '#34c759', 'HIV, IST, pneumonias, ITU e antibioticoterapia.'),
 'Medicina_de_Famlia_e_comunidade_': ('mfc', 'Medicina de família e comunidade', '#30b0c7', 'Cuidado longitudinal na atenção primária.'),
 'Medicina_Intensiva_': ('uti', 'Medicina intensiva', '#636366', 'Sedação, ventilação e cuidados na UTI.'),
 'Nefrologia_': ('nefro', None, None, None),
 'Neurologia': ('neuro', None, None, None),
 'Nutrologia_': ('nutro', 'Nutrologia', '#8ac926', 'Obesidade, esteatose e suporte nutricional.'),
 'Oftalmologia+E+Otorrino': ('oftalmo', 'Oftalmologia e otorrino', '#0a84ff', 'Urgências e o que o clínico precisa saber.'),
 'Pediatria': ('pedia', None, None, None),
 'Pneumologia': ('pneumo', None, None, None),
 'Psiquiatria_': ('psiq', None, None, None),
 'Reumatologia_': ('reumato', None, None, None),
 'Urologia': ('uro', 'Urologia', '#ffcc00', 'HPB, litíase, ITU e saúde masculina.'),
}
ESC = html.escape

def secoes_de(tm, arq):
    ls = tm['linhas']
    corpo = [l for l in ls if 'tabela' not in l and 'fig' not in l]
    fonte, links = '', []
    xs = sorted(l['x'] for l in corpo if not l['t'].startswith('Fonte consultada') and not re.match(r'^https?://', l['t'])) or [72]
    xmin = xs[0]
    secs, cur = [], {'titulo': '', 'itens': []}
    ult_link = -5
    def fecha():
        nonlocal cur
        if cur['itens']:
            secs.append(cur)
        cur = {'titulo': '', 'itens': []}
    for i, l in enumerate(ls):
        if 'tabela' in l:
            fecha()
            t = [[limpa(c) for c in r] for r in l['tabela'] if any(c.strip() for c in r)]
            if len(t) >= 2:
                n = max(len(r) for r in t)
                t = [r + [''] * (n - len(r)) for r in t]
                secs.append({'tipo': 'tabela', 'titulo': '', 'colunas': t[0], 'linhas': t[1:]})
            continue
        if 'fig' in l:
            cur['itens'].append(('fig', 0, (l['fig'], l.get('w', 0), l.get('h', 0))))
            continue
        t = limpa(l['t'])
        if not t:
            continue
        m = re.match(r'^Fonte(s)? consultada(s)?:?\s*(.*)', t, re.I)
        if m:
            fonte = (fonte + '; ' if fonte else '') + m.group(3); continue
        if re.match(r'^https?://', t) and ' ' not in t.strip():
            links.append(t.replace(' ', '')); ult_link = i; continue
        if links and ult_link == i - 1 and ' ' not in t and not l['bullet'] and re.match(r'^[\w./%?=&#-]+$', t):
            links[-1] += t; ult_link = i; continue
        prox = next((x for x in ls[i + 1:] if 'tabela' not in x and 'fig' not in x), None)
        heading = (l['size'] >= 14 or
                   (not l['bullet'] and l['x'] <= xmin + 3 and len(t) < 90 and (l['bold'] or (prox and prox['x'] > l['x'] + 5 and len(t) < 70))))
        if heading:
            fecha(); cur['titulo'] = t.rstrip(':'); continue
        nivel = max(0, round((l['x'] - xmin) / 21.6))
        cur['itens'].append(('li' if (l['bullet'] or re.match(r'^\d+[.)]\s', t)) else 'p', nivel, t))
    fecha()
    out = []
    for s in secs:
        if s.get('tipo') == 'tabela':
            out.append(s); continue
        out.append({'tipo': 'texto', 'titulo': s['titulo'], 'html': lista_html(s['itens'])})
    # junta seções sem título curtas à anterior
    final = []
    for s in out:
        if final and s['tipo'] == 'texto' and not s['titulo'] and final[-1]['tipo'] == 'texto':
            final[-1]['html'] += s['html']
        else:
            final.append(s)
    rod = ''
    if fonte: rod += f'<p><b>Fonte consultada:</b> {ESC(fonte)}</p>'
    if links: rod += '<ul>' + ''.join(f'<li><a href="{ESC(u)}" target="_blank" rel="noopener">{ESC(u)}</a></li>' for u in links) + '</ul>'
    rod += '<p class="nota-fonte">Resumo MED NOTES · material de uso pessoal licenciado para André Lins Carvalho.</p>'
    final.append({'tipo': 'texto', 'titulo': 'Fonte', 'html': rod})
    return final, fonte

def lista_html(itens):
    """itens: (tipo, nivel, texto) → html com listas aninhadas"""
    h, pilha = '', []      # pilha de níveis de <ul> abertos
    base = min((n for k, n, _ in itens if k == 'li'), default=0)
    for k, n, t in itens:
        if k == 'fig':
            while pilha: h += '</li></ul>'; pilha.pop()
            nome, w, hh = t
            h += f'<figure class="fig-orig"><img data-fig="{nome}" width="{w}" height="{hh}" alt="Figura do material original"></figure>'; continue
        if k == 'p' and not pilha:
            h += f'<p>{ESC(t)}</p>'; continue
        n = max(0, n - base)
        if k == 'p':   # parágrafo dentro de lista: vira item do nível atual
            k = 'li'
        if not pilha:
            h += '<ul>'; pilha.append(0); h += f'<li>{ESC(t)}'
            # níveis iniciais acima de 0 viram 0
            continue
        cur = pilha[-1]
        if n > cur:
            h += '<ul>'; pilha.append(cur + 1); h += f'<li>{ESC(t)}'
        else:
            while len(pilha) > 1 and pilha[-1] > n:
                h += '</li></ul>'; pilha.pop()
            h += f'</li><li>{ESC(t)}'
    while pilha: h += '</li></ul>'; pilha.pop()
    return h

def main():
    s = open(SRC_HTML).read()
    m = re.search(r'(<script id="dados" type="application/json">)(.*?)(</script>)', s, re.S)
    d = json.loads(m.group(2))
    esp = {e['id']: e for e in d['especialidades']}
    for e in d['especialidades']:
        e['teoria'] = [t for t in e.get('teoria', []) if not t.get('_pdf')]
        for p in e.get('pastas', []):
            p['teoria'] = [t for t in p.get('teoria', []) if not t.get('_pdf')]
    n = 0
    for f in sorted(glob.glob(J + '/*.json')):
        arq = os.path.basename(f)[:-5]
        eid, nome, cor, frase = MAPA[arq]
        if eid not in esp:
            e = {'id': eid, 'nome': nome, 'cor': cor, 'icone': ICONES[eid], 'frase': frase, 'modelos': [], 'teoria': []}
            d['especialidades'].append(e); esp[eid] = e
        e = esp[eid]
        temas = json.load(open(f))
        ids = {t['id'] for t in e['teoria']}
        for tm in temas:
            if tm['pag'] == 1:   # página de abertura (índice)
                continue
            tit = limpa(tm['titulo'])
            if not tm['linhas'] or len(re.sub(r'[^A-Za-zÀ-ÿ]', '', tit)) < 3:
                continue
            secs, fonte = secoes_de(tm, arq)
            if sum(len(x.get('html', '')) + len(json.dumps(x.get('linhas', ''))) for x in secs) < 250:
                continue
            tid = slug(tit) or 'tema'
            k = 2
            while tid in ids: tid = slug(tit) + '-' + str(k); k += 1
            ids.add(tid)
            item = {'id': tid, 'titulo': tit, 'resumo': ('Fonte: ' + fonte) if fonte else '', 'atualizado': '2026-11',
                    'tags': ['Obstetrícia'] if arq == 'Obstetrcia_' else (['Ginecologia'] if arq == 'Ginecologia_' else []),
                    'secoes': secs, '_pdf': arq}
            alvo = e
            if arq == 'Obstetrcia_' and re.search(r'pre-?natal', slug(tit)):
                alvo = next((p for p in e.get('pastas', []) if p['id'] == 'prenatal'), e)
            if arq == 'Pediatria' and 'puericultura' in slug(tit):
                alvo = next((p for p in e.get('pastas', []) if p['id'] == 'puericultura'), e)
            alvo.setdefault('teoria', []).append(item); n += 1
    novo = json.dumps(d, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    s = s[:m.start(2)] + novo + s[m.end(2):]
    open(SRC_HTML, 'w').write(s)
    print('temas', n, 'tamanho dados', len(novo) // 1024, 'KB')
    for e in d['especialidades']:
        print(f"{e['id']:11} {len(e.get('teoria', [])):3d}", [(p['id'], len(p.get('teoria', []))) for p in e.get('pastas', [])])

main()
