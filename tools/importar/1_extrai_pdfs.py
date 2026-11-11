"""Converte os PDFs (Notion → PDF) dos ambulatórios em temas estruturados (JSON)."""
import pdfplumber, json, re, sys, os, html, statistics, hashlib, io
from multiprocessing import Pool

SRC = '/mnt/user-data/uploads/ambulatorios'
OUT = '/home/claude/amb_json'
os.makedirs(OUT, exist_ok=True)

def linhas_da_pagina(pg):
    ws = pg.extract_words(extra_attrs=['size', 'fontname'], keep_blank_chars=False, use_text_flow=True)
    # tabelas (só as com bordas)
    tabs = []
    try:
        for t in pg.find_tables():
            dados = t.extract()
            if dados and len(dados) >= 2 and max(len(r) for r in dados) >= 2:
                tabs.append((t.bbox, dados))
    except Exception:
        pass
    def em_tab(w):
        for (x0, top, x1, bot), _ in tabs:
            if w['x0'] >= x0 - 1 and w['x1'] <= x1 + 1 and w['top'] >= top - 1 and w['bottom'] <= bot + 1:
                return True
        return False
    ls = []
    for w in ws:
        if em_tab(w):
            continue
        for l in ls:
            if abs(l['top'] - w['top']) < 2.5 and abs(l['size'] - w['size']) < 3:
                l['ws'].append(w); break
        else:
            ls.append({'top': w['top'], 'size': w['size'], 'ws': [w]})
    marcas = [(c['x0'], c['top'], c['x1'], c['bottom']) for c in pg.curves] + \
             [(r['x0'], r['top'], r['x1'], r['bottom']) for r in pg.rects if r['width'] < 12 and r['height'] < 12]
    out = []
    for l in ls:
        l['ws'].sort(key=lambda w: w['x0'])
        x0 = l['ws'][0]['x0']
        txt = ' '.join(w['text'] for w in l['ws'])
        bold = all('Bold' in w['fontname'] or 'Semi' in w['fontname'] for w in l['ws'])
        bullet = any(mx1 <= x0 + 1 and mx0 >= x0 - 26 and abs(((mt + mb) / 2) - (l['top'] + l['size'] * 0.55)) < l['size'] * 0.7 for mx0, mt, mx1, mb in marcas)
        out.append({'top': l['top'], 'x': round(x0, 1), 'size': round(l['size'], 1), 'bold': bold, 'bullet': bullet, 't': txt, 'pg': pg.page_number})
    for im in pg.images:
        if (im['x1'] - im['x0']) * (im['bottom'] - im['top']) >= 150 * 150:
            nome, w, h = salva_fig(pg, im)
            if nome:
                out.append({'top': im['top'], 'x': im['x0'], 'size': 12, 'fig': nome, 'w': w, 'h': h, 'pg': pg.page_number})
    out.sort(key=lambda l: l['top'])
    for (x0, top, x1, bot), dados in tabs:
        out.append({'top': top, 'x': x0, 'size': 12, 'tabela': [[(c or '').replace('\n', ' ').strip() for c in r] for r in dados], 'pg': pg.page_number})
    out.sort(key=lambda l: l['top'])
    return out, len(pg.images)

FIG = '/home/claude/rotina-clinica/src/fig'
os.makedirs(FIG, exist_ok=True)
def salva_fig(pg, im):
    try:
        bb = (max(0, im['x0']), max(0, im['top']), min(pg.width, im['x1']), min(pg.height, im['bottom']))
        if bb[2] - bb[0] < 20 or bb[3] - bb[1] < 20: return None, 0, 0
        img = pg.crop(bb).to_image(resolution=130).original.convert('RGB')
        if img.width > 900: img = img.resize((900, round(img.height * 900 / img.width)))
        b = io.BytesIO(); img.save(b, 'JPEG', quality=72, optimize=True, progressive=True); b = b.getvalue()
        nome = hashlib.sha1(b).hexdigest()[:14]
        with open(os.path.join(FIG, nome + '.jpg'), 'wb') as f: f.write(b)
        return nome, img.width, img.height
    except Exception as e:
        return None, 0, 0

LIXO = re.compile(r'^(Licensed to |Termos e condi)')

def processa(arq):
    pdf = pdfplumber.open(os.path.join(SRC, arq))
    temas, cur, n_img = [], None, 0
    for pg in pdf.pages:
        ls, ni = linhas_da_pagina(pg)
        for l in ls:
            if 'tabela' in l or 'fig' in l:
                if cur is not None:
                    cur['linhas'].append(l)
                continue
            t = l['t'].strip()
            if not t or LIXO.match(t) or l['size'] < 8.5:
                continue
            if l['size'] >= 20:            # título de página do Notion = tema
                if not re.search(r'[A-Za-zÀ-ÿ0-9]', t):
                    continue
                if cur and not cur['linhas'] and cur['pag'] == pg.page_number:
                    if cur['titulo'] != t: cur['titulo'] += ' ' + t
                    continue
                cur = {'titulo': t, 'linhas': [], 'imgs': 0, 'pag': pg.page_number}
                temas.append(cur)
                continue
            if cur is None:
                continue
            cur['linhas'].append(l)
        if cur is not None:
            cur['imgs'] += ni
    # junta linhas quebradas (mesmo x, sem marcador, espaço pequeno, mesma página)
    for tm in temas:
        out = []
        for l in tm['linhas']:
            p = out[-1] if out else None
            if (p and not any(k in l or k in p for k in ('tabela', 'fig')) and not l['bullet'] and abs(l['x'] - p['x']) < 2 and l['pg'] == p['pg']
                    and 0 < l['top'] - p['top'] < l['size'] * 1.75 and abs(l['size'] - p['size']) < 1 and not (l['bold'] and not p['bold'])):
                p['t'] += ' ' + l['t']; p['top'] = l['top']
            elif (p and not any(k in l or k in p for k in ('tabela', 'fig')) and not l['bullet'] and not l['bold'] and abs(l['x'] - p['x']) < 2 and l['pg'] != p['pg']
                    and abs(l['size'] - p['size']) < 1 and not re.match(r'^\d+[.)]\s', l['t']) and not re.search(r'[.:!?]$', p['t'])):
                p['t'] += ' ' + l['t']; p['top'] = l['top']; p['pg'] = l['pg']
            else:
                out.append(dict(l))
        tm['linhas'] = out
    return arq, temas, len(pdf.pages)

if __name__ == '__main__':
    arqs = sorted(a for a in os.listdir(SRC) if a.endswith('.pdf') and not a.startswith('Notion'))
    if len(sys.argv) > 1:
        arqs = [a for a in arqs if any(k in a for k in sys.argv[1:])]
    with Pool(8) as p:
        for arq, temas, npg in p.imap_unordered(processa, arqs):
            json.dump(temas, open(os.path.join(OUT, arq[:-4] + '.json'), 'w'), ensure_ascii=False)
            print(f'{npg:4d} pág  {len(temas):3d} temas  {arq}', flush=True)
