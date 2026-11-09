# Rotina clínica

Material pessoal de estudo (prescrições no PS e ambulatórios, com pré-natal e puericultura), publicado no GitHub Pages.

O conteúdo fica **cifrado** (AES-256-GCM, chave derivada da senha por PBKDF2). O repositório é público, mas sem a senha os arquivos `.bin` são ilegíveis. A senha não está em nenhum arquivo.

## Estrutura

```
index.html + home.bin        página inicial
prescricoes/                 Prescrições no PS
ambulatorios/                Ambulatórios: especialidades, com pastas (pré-natal, puericultura…)
aps/                         só redireciona links antigos para ambulatorios/
assets/                      tela de senha (porta.js, porta.css), ícone
tools/build.mjs              gera as páginas cifradas
src/                         HTML original de cada página (fora do Git)
```

Cada pasta tem um `index.html` mínimo e um `pagina.bin` com a página comprimida e cifrada.

## Editar

```bash
RC_SENHA=suasenha node tools/build.mjs abrir   # recria src/ a partir dos .bin (clone novo)
# edite src/home.html, src/prescricoes.html, src/ambulatorios.html
RC_SENHA=suasenha node tools/build.mjs         # gera de novo os .bin
git add -A && git commit -m "atualiza" && git push
```

- **Ambulatórios:** o conteúdo está no bloco `<script id="dados">` de `src/ambulatorios.html`. Cada especialidade pode ter `pastas` (subpastas por assunto) e `temas`. Pré-natal é uma pasta de Ginecologia e obstetrícia e Puericultura é uma pasta de Pediatria; as consultas delas ficam em `blocos` (formato rico, com calculadoras e marcos). Para um tema novo, acrescente um item em `temas` da especialidade ou da pasta; a chave `modelo` mostra os tipos de seção simples, e os tipos ricos do pré-natal também funcionam.
- **Página nova:** crie `src/nome.html` e acrescente uma linha em `PAGINAS` no `tools/build.mjs`.
- **Trocar a senha:** apague `assets/sal.txt` e rode o build com a senha nova.
