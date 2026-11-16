# André med

Material pessoal de estudo (prescrições no PS, ambulatórios, NCS4 e banco de questões), publicado no GitHub Pages.

O conteúdo fica **cifrado** (AES-256-GCM, chave derivada da senha por PBKDF2). O repositório é público, mas sem a senha os arquivos `.bin` são ilegíveis. A senha não está em nenhum arquivo.

## Estrutura

```
index.html + home.bin        página inicial
prescricoes/                 Prescrições no PS
ncs4/                        NCS4: TBL, MedLab, Morfologia e Tutoria; cada SP com referencial, flashcards e questões
ncs4/ref-*/                  referenciais teóricos do NCS4 (uma página cifrada cada)
questoes/                    Banco de questões: Destrava PBL + Inspirali + simulados, com temas unificados
ambulatorios/                Ambulatórios: especialidades, com pastas (pré-natal, puericultura…)
ambulatorios/ref/<slug>/     referenciais teóricos dos Ambulatórios
calendario/                  Calendário (eventos ficam no aparelho)
aps/                         só redireciona links antigos para ambulatorios/
assets/                      tela de senha (porta.js, porta.css), ícone
tools/build.mjs              gera as páginas cifradas
src/                         HTML original de cada página (fora do Git)
```

Cada pasta tem um `index.html` mínimo e um `pagina.bin` com a página comprimida e cifrada.

## Editar

```bash
RC_SENHA=suasenha node tools/build.mjs abrir   # recria src/ a partir dos .bin (clone novo)
# edite src/home.html, src/prescricoes.html, src/ambulatorios.html, src/ncs4.html, src/questoes.html, src/calendario.html
RC_SENHA=suasenha node tools/build.mjs         # gera de novo os .bin
git add -A && git commit -m "atualiza" && git push
```

- **Ambulatórios:** o conteúdo está no bloco `<script id="dados">` de `src/ambulatorios.html`. Cada especialidade pode ter `pastas` (um assunto por pasta; Pré-natal é pasta de Ginecologia e obstetrícia, Puericultura é pasta de Pediatria). Especialidade e pasta têm duas listas, uma por método: `modelos` (modelos de consulta) e `teoria` (referencial teórico). Para um tema novo, acrescente um item numa dessas listas; a chave `modelo` mostra os tipos de seção. As consultas do pré-natal e da puericultura ficam em `blocos` e contam como modelos de consulta.
- **Ícones:** `icone` (especialidade) e `glifo` (pasta) são o desenho SVG preenchido, em 24×24; o quadrado arredondado com degradê vem de `cor`.
- **Calendário:** `src/calendario.html`. Sincroniza com a agenda "Rotina clínica" do Google pelo script `apps-script/Agenda.gs` (publicado como app da web na conta do dono). O endereço `/exec` e o token ficam na constante `GCAL` de `src/calendario.html`, que só vai para o GitHub cifrada; a cópia do script no repositório tem o token trocado por `__TOKEN__`. Sem `GCAL.url`, os eventos ficam só no navegador.
- **Referenciais teóricos:** são páginas HTML no padrão de escrita (ver `PADRAO-DE-ESCRITA.md`), cada uma cifrada à parte e aberta dentro da tela. Não há mais Google Docs nem PDFs. Nos Ambulatórios o índice fica em `AMBREF` (`src/ambulatorios.html`); no NCS4, em `refs` de cada SP (`CONTEUDO`, `src/ncs4.html`).
- **NCS4:** `src/ncs4.html` é gerado por `tools/ncs4/monta.py` (fora do repositório), que embute SPs, flashcards e as questões de cada SP.
- **Banco de questões:** `src/questoes.html` é gerado por `tools/banco/monta_pagina.py` a partir de `banco.json` (fora do repositório). Os 36 temas unificados reúnem o mesmo assunto em todos os bancos; o filtro por SP traz as questões da SP mais as de qualquer banco com os mesmos temas. Abre direto filtrado por endereço: `questoes/#sp=3.1&b=destrava,inspirali`.
- **Agenda × questões:** num evento do tipo "Estudo em casa", o campo "Questões da SP" grava na observação a etiqueta `[Questões: SP 3.1 · Destrava PBL + Inspirali]`; o selo do evento abre o Banco já filtrado.
- **Página nova:** crie `src/nome.html` e acrescente uma linha em `PAGINAS` no `tools/build.mjs`.
- **Trocar a senha:** apague `assets/sal.txt` e rode o build com a senha nova.
