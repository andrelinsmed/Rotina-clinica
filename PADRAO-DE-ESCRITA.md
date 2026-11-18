# Padrão de escrita: referencial teórico

Todo referencial do André med (NCS4 e Ambulatórios) é **uma página HTML autocontida**, no mesmo estilo do referencial da Tutoria 3.1. Não há mais Google Docs: o HTML que o Claude gera (com esquemas interativos, tabelas e figuras) vai direto para o site, cifrado como as outras páginas.

## Como pedir um referencial novo

Mande ao Claude o tema e o lugar onde ele entra, por exemplo:

> Referencial da SP 3.2 de Tutoria do NCS4, no padrão de escrita do André med.

ou

> Referencial de "Hipertensão na APS" em Ambulatórios › Cardiologia, no padrão de escrita do André med.

Se o HTML já estiver pronto (um artefato do Claude, por exemplo), basta mandar o link ou o arquivo e dizer onde ele entra. O Claude converte o arquivo para o padrão (capa vermelha, sumário, seções numeradas — igual ao TBL 3.1), sem perder texto nem esquemas, gera os flashcards a partir dele quando for do NCS4 e publica.

## Estrutura da página

```
header.cover          capa
  p.kick              rótulo pequeno (ex.: "NCS4 · TBL · SP 3.1")
  h1                  título
  p                   subtítulo de uma linha
  div.obj             objetivos: <b>Objetivos</b> + lista
nav.toc               sumário (montado a partir dos h1.q)
section.blk           uma seção por pergunta ou objetivo
  h1.q                título da seção (entra no sumário)
  h2, h3              subtítulos
  p, ul.b, ul.c       texto e listas (b = marcador, c = checklist)
  table + caption     tabelas comparativas
  .fig + .cap         figura ou esquema, com legenda
  .note / .alert      caixa de destaque / caixa de alerta
  mark                destaque de frase-chave
.refs                 referências no fim
```

### Esquemas interativos

Ficam dentro de `.fig`, em SVG ou HTML com script próprio:

- `.ctrls` com `button.pill` (`aria-pressed="true"` no ativo) para alternar estados;
- `.slider-row` com `label`, `input[type=range]` e `output` para variáveis contínuas;
- `.readout` para o valor calculado;
- `.hit` para áreas clicáveis no SVG.

Tudo fica no mesmo arquivo: nada de bibliotecas externas. O estado dos esquemas (aba ativa, posição do
controle deslizante) não é guardado; o que o leitor produz, sim — ver marca-texto abaixo.

### Marca-texto e tema

- Barra flutuante no canto inferior esquerdo, com duas cores (amarelo e laranja), borracha e apagar tudo.
  Funciona com caneta, dedo ou seleção comum; a rolagem vertical com o dedo continua livre.
- Dentro do NCS4 o iframe é esticado até a altura do conteúdo, então quem rola é a página do site e
  `position:fixed` não funciona: a barra detecta que está embutida e segue a rolagem do pai por
  `frameElement.getBoundingClientRect()`. Pelo mesmo motivo, a barra de navegação própria da página
  fica oculta quando embutida. Não use `requestAnimationFrame` para esse acompanhamento — ele é
  suspenso quando o iframe sai da tela e o reposicionamento trava.
- Os grifos ficam salvos em `localStorage`, por página, na chave `grifos:<título>`. Junto vai uma
  assinatura do texto: se a página for republicada com o texto alterado, os grifos antigos são
  descartados em vez de aparecerem fora de lugar.
- As posições são contadas sobre os nós de texto da página, ignorando SVG, controles e tudo que estiver
  marcado com a classe `din` — use `din` em qualquer bloco preenchido por script (legendas que mudam
  conforme a aba, grades de texto, leituras calculadas), senão os grifos saem do lugar.
- A página **não** tem alternador de tema próprio: ela segue o tema do site, lido de
  `document.documentElement.dataset.theme` do documento que a embute e de `localStorage.bancos-tema`,
  e reage enquanto está aberta.

### Regras de redação

- Uma seção por pergunta de aprendizagem ou objetivo, com resposta direta no primeiro parágrafo.
- Tabelas para comparar (fármacos, diagnósticos diferenciais, critérios); esquemas para mecanismos e fluxos.
- `.alert` só para o que muda conduta ou é erro grave; `.note` para pérolas e macetes.
- Referências reais no fim (diretrizes, livros-texto, artigos), sem inventar.
- Imagens em WebP com no máximo 1400 px de largura, embutidas no próprio HTML.

## Onde cada coisa mora (para quem mantém o site)

| Arquivo | Para quê |
|---|---|
| `tools/padrao/modelo.html` | esqueleto com os marcadores `{{KICKER}}`, `{{TITULO}}`, `{{SUBTITULO}}`, `{{ROTULO_OBJ}}`, `{{OBJETIVOS}}`, `{{SUMARIO}}`, `{{SECOES}}`, `{{CSS}}` |
| `tools/padrao/referencial.css` | o CSS do padrão |
| `tools/padrao/doc_para_padrao.py` | converte um HTML exportado do Google Docs para o padrão: `python3 doc_para_padrao.py entrada.html saida.html "KICKER" "Título" "Subtítulo"` |
| `tools/padrao/fcref_para_padrao.py` | converte um artefato do Claude no formato `.fcref` (como o referencial do TBL 3.2) para o padrão, mantendo texto, tabelas e esquemas SVG; quadros de aula, literatura e correlação clínica viram `.note`, `.note.lit` e `.note.caso`. Mesmos argumentos do anterior |

Para publicar um referencial:

1. Salve o HTML em `src/` (ex.: `src/ncs4-ref-tutoria-32.html`).
2. Acrescente a linha em `PAGINAS` no `tools/build.mjs` (ex.: pasta `ncs4/ref-tutoria-32/`).
3. Ligue-o à tela:
   - **NCS4:** em `refs` da SP, dentro de `CONTEUDO` (`src/ncs4.html`), com `titulo` e `src: 'ref-tutoria-32/index.html'`;
   - **Ambulatórios:** em `AMBREF` (`src/ambulatorios.html`), na chave `especialidade/pasta`, lista `teoria` (ou `modelos`), com `slug`, `titulo` e `sub`. O arquivo vai para `ambulatorios/ref/<slug>/`.
4. Rode `RC_SENHA=… node tools/build.mjs`, depois commit e push em `main` e `gh-pages`.
