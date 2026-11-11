# Rotina clínica

Material pessoal de estudo (prescrições no PS e ambulatórios, com pré-natal e puericultura), publicado no GitHub Pages.

O conteúdo fica **cifrado** (AES-256-GCM, chave derivada da senha por PBKDF2). O repositório é público, mas sem a senha os arquivos `.bin` são ilegíveis. A senha não está em nenhum arquivo.

## Estrutura

```
index.html + home.bin        página inicial
prescricoes/                 Prescrições no PS
farmacologia/                Farmacologia
questoes/                    Banco de questões
ambulatorios/                Ambulatórios: especialidades, com pastas (pré-natal, puericultura…)
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
# edite src/home.html, src/prescricoes.html, src/ambulatorios.html, src/farmacologia.html, src/questoes.html, src/calendario.html
RC_SENHA=suasenha node tools/build.mjs         # gera de novo os .bin
git add -A && git commit -m "atualiza" && git push
```

- **Ambulatórios:** o conteúdo está no bloco `<script id="dados">` de `src/ambulatorios.html`. Cada especialidade pode ter `pastas` (um assunto por pasta; Pré-natal é pasta de Ginecologia e obstetrícia, Puericultura é pasta de Pediatria). Especialidade e pasta têm duas listas, uma por método: `modelos` (modelos de consulta) e `teoria` (referencial teórico). Para um tema novo, acrescente um item numa dessas listas; a chave `modelo` mostra os tipos de seção. As consultas do pré-natal e da puericultura ficam em `blocos` e contam como modelos de consulta.
- **Ícones:** `icone` (especialidade) e `glifo` (pasta) são o desenho SVG preenchido, em 24×24; o quadrado arredondado com degradê vem de `cor`.
- **Calendário:** `src/calendario.html`. Sincroniza com a agenda "Rotina clínica" do Google pelo script `apps-script/Agenda.gs` (publicado como app da web na conta do dono). O endereço `/exec` e o token ficam na constante `GCAL` de `src/calendario.html`, que só vai para o GitHub cifrada; a cópia do script no repositório tem o token trocado por `__TOKEN__`. Sem `GCAL.url`, os eventos ficam só no navegador.
- **Temas no Google Docs:** cada tema dos Ambulatórios é um Google Doc na pasta do Drive "Site / Ambulatórios / Especialidade / (Assunto) / Referencial teórico ou Modelos de consulta". O site lê, edita e cria esses Docs pelo mesmo script (`apps-script/Ambulatorios.gs`, junto com `Agenda.gs` no mesmo projeto). Docs criados direto no Drive também aparecem (botão ↻ na página busca pastas novas). Endereço e token ficam na constante `GDRV` de `src/ambulatorios.html`, cifrada.
- **Farmacologia:** a aba Referencial teórico usa o mesmo esquema, com Docs em "Site / Farmacologia / Referencial teórico" (chamadas com `area:'farm'`). A aba Calculadoras tem 19 calculadoras (sepse, Glasgow, pneumonia, TEV, cardio, hepato, função renal, noradrenalina, dobutamina, reconstituição EV). As fontes estão em `tools/farm` fora do repositório; cada calculadora mostra a referência na própria tela.
- **Página nova:** crie `src/nome.html` e acrescente uma linha em `PAGINAS` no `tools/build.mjs`.
- **Trocar a senha:** apague `assets/sal.txt` e rode o build com a senha nova.

## Referencial teórico no Docs

Os temas de referencial teórico não ficam mais dentro de `src/ambulatorios.html`: cada um é um Google Doc em Site / Ambulatórios / Especialidade / Referencial teórico. O bloco `legado` dos dados liga os endereços antigos da busca ao nome do Doc.
