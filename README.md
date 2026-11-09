# Rotina clínica

Material pessoal de estudo (APS, prescrições no PS e ambulatórios), publicado no GitHub Pages.

O conteúdo fica **cifrado** (AES-256-GCM, chave derivada da senha por PBKDF2). O repositório é público, mas sem a senha os arquivos `.bin` são ilegíveis. A senha não está em nenhum arquivo.

## Estrutura

```
index.html + home.bin        página inicial
aps/                         Caderno da APS
prescricoes/                 Prescrições no PS
ambulatorios/                Ambulatórios
assets/                      tela de senha (porta.js, porta.css), cores e fonte (base.css),
                             traçado de ECG (ecg.js), fonte Archivo (fontes/, licença OFL), ícone
tools/build.mjs              gera as páginas cifradas
src/                         HTML original de cada página (fora do Git)
```

Cada pasta tem um `index.html` mínimo e um `pagina.bin` com a página comprimida e cifrada.

## Visual

Tema claro = "papel" (traçado em papel milimetrado); tema escuro = "monitor". As cores e a fonte de todas as páginas ficam em `assets/base.css`; o build inclui esse arquivo em cada página.

## Editar

```bash
RC_SENHA=suasenha node tools/build.mjs abrir   # recria src/ a partir dos .bin (clone novo)
# edite src/home.html, src/aps.html, src/prescricoes.html, src/ambulatorios.html
RC_SENHA=suasenha node tools/build.mjs         # gera de novo os .bin
git add -A && git commit -m "atualiza" && git push
```

- **Ambulatórios:** o conteúdo está no bloco `<script id="dados">` de `src/ambulatorios.html`. Para um tema novo, acrescente um item em `temas` da especialidade (a chave `modelo` mostra todos os tipos de seção).
- **Página nova:** crie `src/nome.html` e acrescente uma linha em `PAGINAS` no `tools/build.mjs`.
- **Trocar a senha:** apague `assets/sal.txt` e rode o build com a senha nova.
