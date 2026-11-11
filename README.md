# Rotina clínica

Material pessoal de estudo (prescrições no PS e ambulatórios, com pré-natal e puericultura), publicado no GitHub Pages.

O conteúdo fica **cifrado** (AES-256-GCM, chave derivada da senha por PBKDF2). O repositório é público, mas sem a senha os arquivos `.bin` são ilegíveis. A senha não está em nenhum arquivo.

## Estrutura

```
index.html + home.bin        página inicial
prescricoes/                 Prescrições no PS
ambulatorios/                Ambulatórios: especialidades, com pastas (pré-natal, puericultura…)
calendario/                  Calendário (eventos ficam no aparelho)
farmacologia/                Farmacologia: os fármacos das prescrições, com posologias e anotações
questoes/                    Banco de questões gerado das prescrições + questões próprias
aps/                         só redireciona links antigos para ambulatorios/
assets/                      tela de senha (porta.js, porta.css), ícone
tools/build.mjs              gera as páginas cifradas
tools/tema-novo.css          visual novo aplicado por cima de Prescrições, Ambulatórios e Calendário
tools/paginas-novas.css      base visual de Farmacologia e Banco de questões
src/                         HTML original de cada página (fora do Git)
```

Cada pasta tem um `index.html` mínimo e um `pagina.bin` com a página comprimida e cifrada.

## Editar

```bash
RC_SENHA=suasenha node tools/build.mjs abrir   # recria src/ a partir dos .bin (clone novo)
# edite src/home.html, src/prescricoes.html, src/ambulatorios.html, src/calendario.html
RC_SENHA=suasenha node tools/build.mjs         # gera de novo os .bin
git add -A && git commit -m "atualiza" && git push
```

- **Ambulatórios:** o conteúdo está no bloco `<script id="dados">` de `src/ambulatorios.html`. Cada especialidade pode ter `pastas` (um assunto por pasta; Pré-natal é pasta de Ginecologia e obstetrícia, Puericultura é pasta de Pediatria). Especialidade e pasta têm duas listas, uma por método: `modelos` (modelos de consulta) e `teoria` (referencial teórico). Para um tema novo, acrescente um item numa dessas listas; a chave `modelo` mostra os tipos de seção. As consultas do pré-natal e da puericultura ficam em `blocos` e contam como modelos de consulta.
- **Ícones:** `icone` (especialidade) e `glifo` (pasta) são o desenho SVG preenchido, em 24×24; o quadrado arredondado com degradê vem de `cor`.
- **Calendário:** `src/calendario.html`. Sincroniza com a agenda "Rotina clínica" do Google pelo script `apps-script/Agenda.gs` (publicado como app da web na conta do dono). O endereço `/exec` e o token ficam na constante `GCAL` de `src/calendario.html`, que só vai para o GitHub cifrada; a cópia do script no repositório tem o token trocado por `__TOKEN__`. Sem `GCAL.url`, os eventos ficam só no navegador.
- **Temas no Google Docs:** cada tema dos Ambulatórios é um Google Doc na pasta do Drive "Site / Ambulatórios / Especialidade / (Assunto) / Referencial teórico ou Modelos de consulta". O site lê, edita e cria esses Docs pelo mesmo script (`apps-script/Ambulatorios.gs`, junto com `Agenda.gs` no mesmo projeto). Docs criados direto no Drive também aparecem (botão ↻ na página busca pastas novas). Endereço e token ficam na constante `GDRV` de `src/ambulatorios.html`, cifrada.
- **Visual:** a home (`src/home.html`) já é escrita no visual novo. Prescrições, Ambulatórios e Calendário recebem `tools/tema-novo.css` no build, entre `<!--tema-novo-->` e `<!--/tema-novo-->`; o `abrir` tira esse bloco de novo. Mude cores e fontes nesse arquivo.
- **Farmacologia e Banco de questões:** montados no build a partir dos dados de `src/prescricoes.html` (marcador `const RX="__RX__"`). Atualizou uma prescrição, rode o build e as duas páginas acompanham. A classe de cada fármaco fica na constante `CL` de `src/farmacologia.html`. Anotações, desempenho e questões próprias ficam salvos só no aparelho.
- **Prévia sem cifra:** `RC_SENHA=... node tools/build.mjs previa /pasta` grava as páginas abertas (sem os tokens do Google) para testar localmente.
- **Página nova:** crie `src/nome.html` e acrescente uma linha em `PAGINAS` no `tools/build.mjs`.
- **Trocar a senha:** apague `assets/sal.txt` e rode o build com a senha nova.
