# Handoff: Rathe Arsenal — Redesign completo

> **Provenance.** Imported verbatim on 2026-08-16 from the Claude Design project
> `04a045d9-9491-4223-bf42-e4201c7b9512` ("Redesign Rathe Arsenal"), file
> `design_handoff_rathe_arsenal/README.md`. This is the designer's source artifact and is
> kept in its original Portuguese on purpose — translating it would risk distorting the
> literal token values, geometry and copy it specifies. Project docs authored by us stay in
> English per the repo language policy; this file is an imported record, not authored docs.
>
> The prototype bundle also contains `Rathe Arsenal - Final.dc.html` (the navigable
> prototype, 11 screens), `Rathe Arsenal Redesign.dc.html` (exploration doc), `favicon.svg`,
> `support.js` (prototype runtime — explicitly not to be ported), plus `screenshots/` and
> `uploads/`. Fetch those with the `DesignSync` tool against the project id above.

## Overview

Redesign completo do Rathe Arsenal (rathe-arsenal-staging.up.railway.app), um app de acompanhamento de coleção e prontidão de decks de **Flesh and Blood**. O redesign cobre **todas as telas do produto atual**, mantendo a identidade da marca (dark premium, ouro, blackletter) mas resolvendo os problemas centrais da UI atual:

| Problema atual | Solução no redesign |
|---|---|
| Serifa de fantasia em toda label, botão e eyebrow | Uma tipografia funcional (Hanken Grotesque) para 100% da UI; serifa reservada a títulos e números |
| Decoração sem função (octógono "100%", diamantes ◆, numerais romanos I/II/III) | Removida; substituída pelo medalhão de prontidão com a arte do herói |
| Excesso de texto (3 parágrafos em Add cards, jargão "RAW/FIDELITY/EFFECTIVE READY", "View on Fabrary" duplicado) | Copy reduzida à metade; jargão vira uma linha secundária; ações não se repetem |
| Home com 2 decks flutuando em espaço vazio | Decks agrupados por estado (Ativos / Construindo / Ideias / Aposentados) em grade de deckboxes isométricas |
| Valor real do produto (o que falta, o que trocar) soterrado | "O que falta comprar" e "Trocas sugeridas" promovidos ao topo do deck detail; Swaps mostra as cartas |
| Estados vazios inúteis ("◆ All playable") | Estados populados e acionáveis |

## About the Design Files

Os arquivos deste bundle são **referências de design criadas em HTML** — protótipos que mostram a aparência e o comportamento pretendidos, **não código de produção para copiar diretamente**.

A tarefa é **recriar estes designs no ambiente já existente do codebase** (React/Next, Vue, etc.), usando os padrões, bibliotecas e convenções que o projeto já adota. O protótipo usa um runtime interno de componentes (`support.js`) que **não deve ser portado** — ele existe só para o protótipo rodar isolado no navegador.

Em particular:
- Os estilos estão **inline** no protótipo por exigência da ferramenta de prototipagem. No app real, extraia-os para o sistema de estilos do projeto (CSS Modules, Tailwind, styled-components — o que já for usado).
- A navegação entre telas é um `useState` de string. No app real, use o roteador existente.
- Os dados são mocks embutidos na classe de lógica. No app real, venham da API.

## Fidelity

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, raios, animações e copy são finais e devem ser reproduzidos fielmente. As únicas exceções conhecidas:

- **Arte das cartas e dos heróis** é representada por *placeholders* com gradiente na cor de pitch. No app real, use as imagens reais das cartas de FaB (via a mesma fonte que o app já usa hoje). Os slots já estão dimensionados para isso.
- **Textura da deckbox** é CSS puro (gradientes). Pode virar textura/imagem se houver arte disponível.

---

## Design Tokens

### Cores

```
--bg              #0b0c0f   fundo da aplicação
--surface         #14161c   cards, painéis, superfícies elevadas
--surface-2       #0e1016   sidebars, barras (levemente mais escuro que surface)
--line            rgba(255,255,255,0.07)   divisórias e bordas de card
--line-strong     rgba(255,255,255,0.12)   bordas de input/controle
--ink             #e8e6e1   texto primário
--ink-2           #c8cad2   texto secundário forte
--dim             #8b8d96   texto secundário
--dim-2           #7a7c84   labels/eyebrows
--muted           #5c5e66   ícones e texto terciário

--acc             #d0a84c   ouro da marca (acento, CTA primário, estado ativo)
--acc-hi          #f0c060   ouro claro (números, brilho)
--acc-deep        #b8863a   ouro escuro (início de gradientes de anel)
--ready           #63b678   verde (pronto/completo/aprovar)
--miss            #d0645a   vermelho (faltando/perigo)
--warn            #c8843c   âmbar (parcial, "faltam N")
--building        #4a7fc0   azul (estado "construindo")
--idea            #8f7cf0   roxo (estado "ideia")
```

### Cores de pitch (Flesh and Blood)

```
red      #c0473e
yellow   #d6a83e
blue     #4a7fc0
colorless#8a8d94
hero     #5a8f6b
weapon   #8a8d94
equipment#9c7b4a
```

### Tipografia

| Uso | Fonte | Peso | Tamanho | Extra |
|---|---|---|---|---|
| Wordmark "Rathe Arsenal", monograma R | **UnifrakturCook** | 700 | 22px (nav) / 52px (marca grande) | letter-spacing .01em |
| Títulos de página e de deck | **Newsreader** | 500 | 30–38px | letter-spacing −0.01em |
| Números-herói (prontidão) | **Newsreader** | 500 | 28–54px | line-height .9 |
| Todo o resto da UI | **Hanken Grotesque** | 400/500/600/700/800 | ver escala | — |

Escala de texto (Hanken Grotesque):
```
10.5px  badges/contadores minúsculos (uppercase, letter-spacing .06–.08em)
11px    eyebrows de seção (uppercase, .08em, cor --dim-2)
12px    metadados, legendas
13px    corpo secundário, botões pequenos
13.5px  corpo de card
14px    corpo padrão, nav, inputs
15px    subtítulo de página
17–18px títulos de card
```

### Espaçamento, raio e sombra

```
Grid base: 4px. Passos usados: 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 34, 44, 60

Raio:
  6–7px    badges, chips pequenos, faces internas
  8–9px    botões pequenos, ícones-botão
  10–11px  inputs, botões, chips de estado
  14px     cards de conteúdo
  16px     painéis grandes
  100px    pills, toggles, anéis

Sombra:
  card          0 10px 20px rgba(0,0,0,.45)
  deckbox chão  radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.6), transparent 70%)
  flutuante     0 16px 40px -12px rgba(0,0,0,.8)
  hero banner   0 40px 90px -30px rgba(0,0,0,.8)
```

---

## Screens / Views

Todas as telas ficam em `Rathe Arsenal — Final.dc.html`, navegáveis pelo seletor "TELAS" fixo no rodapé (esse seletor é **só do protótipo** — não vai para produção).

### 1. Sign in

- **Propósito**: autenticação.
- **Layout**: split 50/50, altura total. Esquerda `linear-gradient(160deg,#160f0d,#0c0a0b)` com borda direita `--line`; padding 56px 60px; flex-column. Direita centralizada verticalmente, form com `max-width:400px`.
- **Componentes**:
  - Logo no topo esquerdo: favicon 30×30 raio 7px + wordmark UnifrakturCook 22px.
  - **Deckbox isométrica 170×170** como marca (mesma do Home, `scale(.9)`, sem cartas, face frontal com R 52px em UnifrakturCook `#eecf7f`).
  - H1 Newsreader 500 38px, line-height 1.08: "De volta à armaria".
  - Parágrafo 15.5px/1.65 `--dim` claro (`#a6a8b0`), max-width 440px.
  - Rodapé: citação em itálico 13px `#6c6e76`.
  - Form: label 13px/600 `--ink-2`; input full-width, bg `rgba(255,255,255,.03)`, borda `--line-strong`, raio 10px, padding 13px 15px, 14px.
  - CTA: full-width, bg `--acc`, texto `#1a1305` 700 15px, padding 14px, raio 11px.
  - Links: "Esqueci a senha" (`--acc`) e "Sem conta? Criar".

### 2. Onboarding

- **Propósito**: 3 passos até o primeiro deck acompanhado.
- **Layout**: coluna centrada, `max-width:640px`, padding 64px 32px 80px. Sem top-nav.
- **Componentes**:
  - **Stepper**: 3 nós clicáveis. Nó = círculo 34px; ativo `bg --acc / texto #1a1305`; concluído `bg rgba(208,168,76,.2) / texto --acc`; futuro transparente com borda `rgba(255,255,255,.12)`. Label 12px/600 abaixo. Linha de 64×1px entre nós (`rgba(208,168,76,.5)` se concluída).
  - Eyebrow "PASSO N DE 3" 12px/700 uppercase `--acc`.
  - H2 Newsreader 500 36px. Parágrafo 15px/1.6 max-width 440px.
  - Painel `--surface` raio 16px padding 26px, com o conteúdo do passo:
    - **1**: input de URL do Fabrary (borda `rgba(208,168,76,.45)`) + dica.
    - **2**: duas opções em linha (Importar CSV destacado, Começar do zero neutro).
    - **3**: lista de trocas sugeridas com ✓/✕.
  - Rodapé: "Pular por agora" (texto) à esquerda; CTA ouro à direita ("Continuar" / "Ir para meus decks").
- **Copy dos passos**: 1 "Primeiro, um deck" · 2 "Agora, sua coleção" · 3 "Por fim, as trocas".
- ⚠️ Os numerais romanos **I / II / III** e os diamantes ◆ do app atual foram removidos.

### 3. Home — "Your armory"

- **Propósito**: ver todos os decks e o quão prontos estão.
- **Layout**: `max-width:1180px`, padding 36px 32px 60px.
- **Componentes**:
  - Header: H2 Newsreader 34px "Your armory" + linha de status (bolinha 7px `--ready` + "2 de 6 decks prontos para jogar").
  - **Strip de KPIs**: 3 células numa borda `--line-strong` raio 12px, divisórias verticais. Cada célula: número Newsreader 700 20px + label 10.5px uppercase `--dim-2`. Valores: 6 Decks · 87% Média (`--acc`) · 11 Faltando (`--miss`).
  - CTA "+ New deck": bg `--acc`, 700 14px, padding 13px 20px, raio 11px.
  - Barra de filtro: busca (max 300px, ícone ⌕ a 13px da esquerda) + pills de filtro. Pill ativa: `bg rgba(208,168,76,.12)`, borda `rgba(208,168,76,.3)`, texto `--acc`.
  - **Grupos por estado** — 4 seções, cada uma com header (bolinha 9px na cor do estado + nome 15px/700 + hint 13px `--dim-2` + contagem à direita), borda inferior `--line`, e grade `repeat(4, 1fr)` gap 20px.
    - Ativos · `--ready` · "Prontos para levar ao jogo"
    - Construindo · `--building` · "Em montagem, ainda ajustando"
    - Ideias · `--idea` · "Rascunhos sem lista fixa"
    - Aposentados · `#5c5e66` · "Guardados para consulta"
  - **Deckbox** (ver seção dedicada abaixo), 238px de altura, clicável → deck detail.
  - Meta sob a caixa: 11.5px centralizado — "Completo · 67/67" (verde) / "4 faltando · 63/67" (`--warn`) / "Rascunho · sem lista" (`--dim-2`).

### 4. Novo deck

- **Layout**: `max-width:940px`. Breadcrumb "← Home", H2 32px "Novo deck", subtítulo.
- **Componentes**: dois cards lado a lado (`1fr 1fr`, gap 18px), `--surface`, raio 16px, padding 26px.
  - **Importar do Fabrary** — ícone 🔗 em quadrado 36px `rgba(208,168,76,.12)`; input de URL; CTA ouro "Acompanhar deck".
  - **Começar do zero** — ícone ✎ roxo (`rgba(143,124,240,.12)`); campo de herói; select de formato; botão secundário "Começar a montar".

### 5. Deck detail

- **Propósito**: a tela mais importante — o quão pronto o deck está, o que falta e o que trocar.
- **Layout**: `max-width:1180px`, padding lateral 32px. O banner sangra até as bordas (`margin: 0 -32px`).
- **Componentes**:
  1. **Hero banner** 210px: fundo = arte do herói (gradiente); overlay `linear-gradient(180deg,rgba(0,0,0,.15),rgba(11,12,15,.96))`. Breadcrumb "← Decks" no topo esquerdo. No topo direito: chip de status (bolinha + "Ativo ▾"), botão "Editar" (borda `--acc`), botão "···". Embaixo à esquerda: eyebrow 12px uppercase `#c6a678` "CLASSIC CONSTRUCTED · LIGA LOCAL", título Newsreader 34px, nome do herói 13px. Embaixo à direita: **medalhão de prontidão 90px**.
  2. **Strip de status** (raio 12px): estado incompleto → `bg rgba(208,100,90,.08)` borda `rgba(208,100,90,.25)`, texto "Faltam 4 cartas em 3 slots — 2 trocas deixam jogável hoje.", ações "Ver trocas" + "Comprar tudo" + link "Fabrary ↗". Estado completo → verde, sem ações, texto "Coleção completa — nenhuma substituição necessária."
  3. **Linha de análise** — 3 cards `1fr 1fr 1fr` gap 14px:
     - **Prontidão**: barras Raw (`--acc`) e Fidelity (`--ready`), 5px de altura, + linha "✓ Legal em Classic Constructed".
     - **Cor de pitch**: barra empilhada 9px (61% vermelho / 12% amarelo / 27% azul) + legenda com contagens.
     - **Curva de custo**: 5 barras (0,1,2,3,4+) com valor acima e label abaixo; gradiente ouro.
  4. **Falta comprar + Trocas** (`1fr 1fr`, só quando incompleto):
     - *O que falta comprar*: linhas com barra de cor de pitch 4×30px, nome, meta, "falta ×N" (`--miss`), botão "Comprar".
     - *Trocas sugeridas*: card por troca — "de" riscado (`#c9938f`) → "para" (600), linha "Você tem ×3 · 92% confiança", botões ✓ (verde) e ✕.
  5. **Decklist**: header com toggle de visualização (Por tipo / Por custo / Lista). Grupos: Attack Actions, Defense Reactions, Non-attacks, Hero·Weapon·Equipment. Grade `repeat(6,1fr)` gap 10px. Card: thumbnail `aspect-ratio 16/10` na cor de pitch, badge "×N" no topo esquerdo, badge "falta ×N" no rodapé direito (`--miss`) quando incompleta, borda `rgba(208,100,90,.55)` nesses casos; nome 11.5px truncado a 1 linha.

### 6. Deck detail — edição

- **Layout**: `max-width:820px`. Breadcrumb volta ao deck.
- **Componentes**: painel `--surface` com Nome (input), Formato (select) e Status (4 segmentos: Ativo/Construindo/Ideia/Aposentado — ativo com `bg rgba(208,168,76,.14)` e borda `rgba(208,168,76,.4)`), Tags (chips removíveis + "+ nova tag" tracejado), Notas (textarea 88px). Ações: Salvar (ouro) / Cancelar (contorno). Abaixo, **Zona de risco** em `rgba(208,100,90,.06)`: "Aposentar deck" e "Excluir deck".

### 7. Library

- **Layout**: `max-width:1320px`, sidebar 250px + conteúdo. Sidebar com borda direita `--line`, padding 30px 22px.
- **Sidebar (todos os filtros do app atual)**:
  - Busca "Buscar coleção".
  - **Pitch** — 4 chips com bolinha colorida e borda na cor: Vermelho, Amarelo, Azul, Incolor.
  - **Facetas** em linhas com contagem: Classe 4 · Talento 1 · Set 28.
  - **Tamanho dos cards** — slider (trilha 6px, preenchida 42%, knob 16px com borda `--acc` 2px), legenda "MÉDIO" / "120px".
  - **Agrupar por** — 4 segmentos: Tipo / Pitch / Set / Lista.
  - Link "Gerenciar fontes ›".
- **Conteúdo**: H2 "Library" + stats (31 únicas · 76 cópias · R 28 / Y 18 / B 23 / — 7, cada uma na cor de pitch) + botão "+ Add cards". Grupos com header e grade `repeat(6,1fr)` gap 11px; card `aspect-ratio 5/4` com badge ×N no rodapé direito.

### 8. Fontes da biblioteca

- **Propósito**: gerenciar de onde vieram as cartas (era a página "Gerenciar fontes" do app atual).
- **Layout**: `max-width:1000px`.
- **Componentes**: header com breadcrumb "← Library", H2, parágrafo explicativo, e ações "Ver library" / "Enviar CSV". Nota informativa "ⓘ Duplicatas entre fontes são **somadas**, não sobrescritas." Contagem "4 fontes · 3 ativas" e "389 cartas somadas". Lista de fontes: badge de tipo (CSV verde / Fabrary ouro / Manual azul-lilás), nome, meta ("312 cartas · importado 12 jun"), rótulo Ativa/Inativa, **toggle** 42×24px (trilha `--acc` quando ligada; knob 18px), botão "···". Linhas inativas com `opacity .55`.

### 9. Add cards

- **Layout**: `max-width:900px`. Breadcrumb "← Library", H2 "Adicionar cartas", subtítulo "Três caminhos — escolha o que serve ao momento."
- **Componentes**: **tabs** (Manual / Importar CSV / Deck do Fabrary) em pill-group; aba ativa com `bg --acc` e texto `#1a1305`. Painel `--surface` raio 16px:
  - **Manual**: busca + lista do catálogo com thumbnail 30×42, nome, meta, "tem ×3", e steppers − / + (o + com borda ouro).
  - **CSV**: dropzone tracejada ouro (padding 38px, `bg rgba(208,168,76,.04)`), ícone ⇪ 28px, "Arraste o arquivo aqui", "ou escolha do computador · .csv até 2 MB"; rodapé com colunas esperadas (`name, set, quantity, pitch`) e link para fontes.
  - **Fabrary**: input de URL + nota "Para acompanhar a prontidão do deck, use Novo deck" + CTA "Importar cartas".
  - Rodapé: link "→ Gerenciar fontes da biblioteca".
- ⚠️ Os três parágrafos longos e os numerais I/II/III do app atual foram substituídos por tabs + uma frase por caminho.

### 10. Swaps

- **Layout**: `max-width:1180px`.
- **Componentes**: header + tabs com **contagens dinâmicas** (Pendentes N / Aplicadas N / Recusadas N) + uma linha explicativa por aba. Linhas de troca (`--surface`, raio 14px, padding 16px 20px), cada uma com:
  - Coluna fixa 150px: nome do deck (clicável → deck detail) + slot ("Attack · Red").
  - Centro: nome de saída riscado + **miniatura da carta que sai** (34×47, `opacity .5`) → seta em círculo 26px `rgba(208,168,76,.14)` → **miniatura da que entra** (34×47, borda ouro mais forte) + nome em 600.
  - Coluna 90px: "confiança" + valor em Newsreader 700 (verde ≥90%, ouro 70–89%, `--warn` abaixo).
  - Cluster de ações **variável por estado** (abaixo).
- ⚠️ O estado vazio "◆ All playable" foi substituído por estados populados e acionáveis.

#### Ciclo de vida de uma sugestão (importante — define o backend)

```
                 ┌──────────── Reverter ────────────┐
                 ▼                                  │
   engine ──> PENDENTE ──── Aprovar ─────────> APLICADA (no deck)
                 │                                  │
                 └──── Recusar (+ motivo) ──> RECUSADA (arquivada)
                                  ▲                 │
                                  └─── Restaurar ───┘
```

**Regras que a implementação precisa respeitar:**

1. **Aprovada = aplicada ao deck.** Não é um log — é um estado ativo. A troca está valendo na lista efetiva do deck (é o que faz a prontidão fechar). Ela **permanece visível** na aba "Aplicadas" indefinidamente, com a data em que passou a valer ("há 3 dias") e um botão **Reverter** que devolve a sugestão para Pendentes e desfaz a troca no deck.
2. **Recusada = arquivada, nunca deletada.** Sai da fila de pendentes e **a engine não pode voltar a sugerir a mesma troca** (senão vira ruído infinito). Fica na aba "Recusadas" com `opacity .6`, mostrando o **motivo entre aspas** e quando foi recusada, e um botão **Restaurar** (para o caso de erro de clique ou de o jogador comprar a carta original depois).
3. **Estado intermediário — o momento entre decidir e sair da página.** Ao aprovar ou recusar, a linha **não desaparece**: ela permanece no lugar com uma confirmação in-place ("Aprovada — aplicada ao deck" em verde / "Rejeitada — não será sugerida de novo") e um botão **Desfazer**. Isso evita perder a ação por clique errado. **Só ao trocar de aba ou reentrar na página** é que a linha migra para a aba correspondente. As contagens das abas atualizam na hora.
4. **Contagens são derivadas do estado real**, nunca hardcoded.

#### Feedback para a engine

Dois pontos de coleta, ambos opcionais e de baixo atrito:

- **Ao recusar** (o sinal mais valioso): abre um painel dentro da própria linha (`border-top --line`, `bg rgba(255,255,255,.02)`, padding 16px 20px) com:
  - Título "Por que essa troca não serve?" (12.5px/600) e sub "Opcional — mas é o que ensina a engine a sugerir melhor." (11.5px `--dim-2`).
  - **Chips de motivo de um clique**: `Não é equivalente` · `Não tenho essa carta` · `Muda o plano do deck` · `Prefiro comprar a original` · `Outro motivo`. Chip selecionado: `bg rgba(208,168,76,.16)`, borda `rgba(208,168,76,.45)`, texto `--acc`.
  - **Textarea opcional** ("Quer detalhar? (opcional)", 60px).
  - Ações: "Recusar troca" (`bg --miss`, texto branco) e "Cancelar".
  - O motivo escolhido é o que aparece depois entre aspas na aba Recusadas.
- **Depois de aplicada**: barra discreta no rodapé da linha — "Jogou com essa troca? Funcionou na prática?" + pills **Funcionou** / **Não rolou** (toggle, verde / vermelho quando ativos). É o sinal de resultado real, que vale mais que a confiança estimada.

**Modelo de dados sugerido:**

```
Swap {
  id, deckId, slot,
  fromCard, toCard,
  confidence,                       // estimativa da engine
  status: 'pending'|'approved'|'rejected',
  appliedAt,                        // quando virou approved
  rejectedAt, rejectionReason,      // enum + freeText
  outcome: 'worked'|'did_not_work'|null,   // feedback pós-jogo
}
```

Endpoints implícitos: `POST /swaps/:id/approve`, `POST /swaps/:id/reject {reason, note}`, `POST /swaps/:id/revert`, `POST /swaps/:id/restore`, `POST /swaps/:id/outcome {outcome}`. A engine deve consumir `rejectionReason` e `outcome` como sinais de treino, e usar a lista de recusadas como **filtro de supressão** ao gerar novas sugestões.

### 11. Conta (Settings)

- **Layout**: `max-width:720px`. H2 "Conta".
- **Componentes**: 4 painéis `--surface` raio 16px padding 24px, cada um com eyebrow 11.5px/700 uppercase `--acc`, título 18px/600 e conteúdo:
  - **Perfil** → e-mail.
  - **Aparência** → toggle Claro / Escuro.
  - **Idioma** → toggle PT / EN.
  - **Zona de risco** → `bg rgba(208,100,90,.06)` borda `rgba(208,100,90,.28)`; parágrafo sobre exclusão em 30 dias; botão "Excluir minha conta" em `--miss`.

---

## Componente-chave: Deckbox isométrica

O elemento de identidade do redesign. Uma caixa de cartas 3D em CSS puro, com as cartas **dentro** dela.

### Estrutura (ordem de empilhamento importa)

```
.deckbox                     position:relative; height:238px; cursor:pointer
├── .ib2-scene.ib2-back-scene   z-index:1   → parede de trás + sombra no chão
│   └── .ib2-box
│       └── .ib2-face.ib2-back
├── .ib2-scene.ib2-cards        z-index:2   → as 3 cartas (ficam ENTRE as paredes)
│   └── .ib2-box
│       ├── .ib2-c.ib2-c1  (vermelha)
│       ├── .ib2-c.ib2-c3  (amarela)
│       └── .ib2-c.ib2-c2  (azul)
└── .ib2-scene.ib2-front-scene  z-index:3; pointer-events:none
    └── .ib2-box
        ├── .ib2-face.ib2-left
        ├── .ib2-face.ib2-right   (a lateral dourada — dá a leitura 3D)
        └── .ib2-face.ib2-front   (arte + nome + formato + medalhão)
```

> **Regra crítica**: as três "cenas" compartilham a mesma transformação `.ib2-box`, então parecem um objeto só. A parede frontal fica em `z-index:3` e as cartas em `z-index:2` — é isso que faz as cartas parecerem **dentro** da caixa. Não achate isso numa árvore só.

### Geometria

```css
.ib2-scene  { position:absolute; inset:0; perspective:1300px; }
.ib2-box    { position:absolute; left:50%; top:56%; width:120px; height:150px;
              transform-style:preserve-3d;
              transform:translate(-50%,-50%) rotateX(-18deg) rotateY(-28deg);
              transition:transform .5s cubic-bezier(.3,1,.4,1); }
.ib2-face   { position:absolute; top:50%; left:50%; }

.ib2-front  { width:120px; height:150px; margin:-75px 0 0 -60px; transform:translateZ(24px);
              border-radius:8px; overflow:hidden;
              box-shadow: inset 0 0 0 2px rgba(238,207,127,.85); }
.ib2-back   { width:120px; height:150px; margin:-75px 0 0 -60px;
              transform:translateZ(-24px) rotateY(180deg); border-radius:8px;
              background:linear-gradient(160deg,#1c1526,#0d0913);
              box-shadow:inset 0 0 24px rgba(0,0,0,.85); }
.ib2-left   { width:48px; height:150px; margin:-75px 0 0 -24px;
              transform:translateX(-60px) rotateY(-90deg);
              background:linear-gradient(180deg,#241b30,#120c1a); }
.ib2-right  { width:48px; height:150px; margin:-75px 0 0 -24px;
              transform:translateX(60px) rotateY(90deg);
              background:linear-gradient(180deg,#9a7529,#5a4315 60%,#3a2a0c);
              box-shadow: inset 2px 0 0 rgba(240,213,133,.7),
                          inset 0 2px 0 rgba(240,213,133,.7); }

/* boca da caixa: faixa dourada no topo da face frontal */
.ib2-front::after { content:''; position:absolute; left:0; right:0; top:0; height:7px;
  background:linear-gradient(180deg, rgba(240,213,133,.95), rgba(240,213,133,.25) 70%, rgba(240,213,133,0)); }

/* sombra no chão */
.ib2-back-scene::before { content:''; position:absolute; left:50%; top:81%;
  width:200px; height:36px; transform:translate(-50%,0);
  background:radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.6), transparent 70%); }

.ib2-c { position:absolute; left:50%; top:50%; width:66px; height:148px; margin:-74px 0 0 -33px;
         border-radius:6px; overflow:hidden; border:1px solid rgba(238,207,127,.55);
         box-shadow:0 10px 20px rgba(0,0,0,.45);
         transition:transform .55s cubic-bezier(.3,1.06,.4,1); }
```

### Animação de hover (validada com o cliente — reproduza exatamente)

Em repouso as cartas espiam pela boca. No hover: a caixa se endireita levemente **e** as cartas voam alto para fora, mudando de profundidade (`translateZ`) **tarde** na animação, para que a troca de z-index não seja percebida — depois assentam num leque largo à frente da caixa.

```css
/* repouso */
.deckbox .ib2-c1 { transform: translate3d(-9px,-20px,0) rotate(-2deg); }
.deckbox .ib2-c2 { transform: translate3d(0px,-26px,0); }
.deckbox .ib2-c3 { transform: translate3d(9px,-20px,0) rotate(2deg); }

/* hover */
.deckbox:hover .ib2-box   { transform: translate(-50%,-46%) rotateX(-9deg) rotateY(-16deg); }
.deckbox:hover .ib2-cards { animation: ib2z .8s forwards; }
.deckbox:hover .ib2-c1 { animation: fly1 .8s forwards; }
.deckbox:hover .ib2-c2 { animation: fly2 .8s .04s forwards; }
.deckbox:hover .ib2-c3 { animation: fly3 .8s .08s forwards; }

/* a troca de profundidade acontece a 80% — depois do pico do overshoot */
@keyframes ib2z { 0%,79% { z-index:2; } 80%,100% { z-index:9; } }

@keyframes fly1 {
  0%   { transform: translate3d(-9px,-20px,0) rotate(-2deg);      animation-timing-function: cubic-bezier(.22,.62,.4,1); }
  52%  { transform: translate3d(-98px,-178px,50px) rotate(-16deg); animation-timing-function: cubic-bezier(.4,0,.35,1); }
  100% { transform: translate3d(-92px,-128px,66px) rotate(-15deg); }
}
@keyframes fly2 {
  0%   { transform: translate3d(0px,-26px,0);        animation-timing-function: cubic-bezier(.22,.62,.4,1); }
  52%  { transform: translate3d(0px,-198px,50px);    animation-timing-function: cubic-bezier(.4,0,.35,1); }
  100% { transform: translate3d(0px,-150px,66px); }
}
@keyframes fly3 {
  0%   { transform: translate3d(9px,-20px,0) rotate(2deg);        animation-timing-function: cubic-bezier(.22,.62,.4,1); }
  52%  { transform: translate3d(98px,-178px,50px) rotate(16deg);  animation-timing-function: cubic-bezier(.4,0,.35,1); }
  100% { transform: translate3d(92px,-128px,66px) rotate(15deg); }
}
```

Notas de implementação:
- O overshoot (keyframe 52%) é **essencial** — sem ele a mudança de profundidade fica visível e a animação parece quebrada. Foram várias iterações até este valor.
- As cartas assentam **acima e à frente**, sem cobrir o nome do deck nem o medalhão na face frontal (informação importante).
- Decks no estado **Ideia** não têm cartas dentro (são rascunhos) — omita a cena `.ib2-cards`.
- Respeite `prefers-reduced-motion`: nesse caso, mantenha só uma elevação sutil sem o voo.

### Face frontal (conteúdo)

- `background`: gradiente da arte do herói (no app real, a imagem do herói).
- Overlay: `linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,0) 22%,rgba(0,0,0,0) 55%,rgba(0,0,0,.5))`.
- Monograma R no topo (UnifrakturCook 16px `#eecf7f`).
- Nome do deck (Newsreader 12px `#f3e9dc`) + formato (7.5px uppercase `#c6a678`) na base.
- **Medalhão de prontidão** no canto superior direito (38px).
- Aposentados: `filter: grayscale(1) brightness(.8)`. Ideias: `filter: brightness(.62) saturate(.7)`.

---

## Componente-chave: Medalhão de prontidão

Substitui o octógono "100%" e a barra de progresso do app atual. Disco com a **arte do herói** ao fundo e um **anel fino** de progresso na borda.

```html
<div style="width:38px; height:38px; position:relative;">
  <!-- arte do herói -->
  <div style="position:absolute; inset:3px; border-radius:50%; background:{heroArt};"></div>
  <!-- escurecimento para o número ler -->
  <div style="position:absolute; inset:3px; border-radius:50%;
              background:radial-gradient(circle at 50% 30%, rgba(255,255,255,.14), rgba(0,0,0,.82) 78%);"></div>
  <!-- anel de progresso (só a borda, via mask) -->
  <div style="position:absolute; inset:0; border-radius:50%;
              background:conic-gradient(from -90deg, {color} 0turn {pct/100}turn,
                                        rgba(255,255,255,.12) {pct/100}turn 1turn);
              -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
                      mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));"></div>
  <!-- número -->
  <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
              font-family:Newsreader,serif; font-size:12px; font-weight:600; color:#f0e4cc;
              text-shadow:0 1px 5px rgba(0,0,0,.85);">{pct}</div>
</div>
```

**Cor do anel por prontidão**: `>= 100%` → `--ready` · `>= 85%` → `--acc` · abaixo → `--building`.

**Tamanhos**: 38px na deckbox (número 12px, sem sublabel) · 90px no hero do deck detail (número Newsreader 30px + "%" 14px + sublabel com o nome do herói em 7.5px uppercase `#c6a678`, espessura do anel 4px).

---

## Interactions & Behavior

| Interação | Comportamento |
|---|---|
| Hover na deckbox | Animação descrita acima (.8s). Cursor pointer. |
| Clique na deckbox | Navega para o deck detail daquele deck. |
| Clique no logo / "Home" | Vai para a Home. |
| Nav "Library" / "Swaps" | Navegam; o item ativo ganha `bg rgba(208,168,76,.14)` + texto `--acc`. Library fica ativo também em Fontes e Add cards; Home fica ativo em Deck, Editar e Novo deck. |
| Pill de conta | Vai para Conta (settings). |
| "Editar" no deck | Vai para a tela de edição; "Salvar"/"Cancelar" voltam ao deck. |
| Tabs (Add cards, Swaps) | Trocam o conteúdo do painel; aba ativa em ouro. |
| "Agrupar por" (Library) | Segmento ativo destacado; reordena os grupos da grade. |
| Toggle de fonte | Liga/desliga a fonte: trilha ouro↔cinza, knob troca de lado, linha vai a `opacity .55`, rótulo Ativa↔Inativa. Deve recalcular os totais da library. |
| Stepper do onboarding | Nós clicáveis; CTA avança; no passo 3 o CTA vai para a Home. |
| Transições padrão | `.2s ease` em cores/bordas de hover. Botões: escurecer/clarear 6–8%. |

## State Management

Estado do protótipo (substituir por rota + dados reais):

```
screen    'signin'|'onboarding'|'home'|'new'|'deck'|'edit'|'library'|'sources'|'add'|'swaps'|'settings'
deck      id do deck aberto
onbStep   1 | 2 | 3
addTab    'manual' | 'csv' | 'fab'
swapTab   'pend' | 'appr' | 'rej'
libGroup  'Tipo' | 'Pitch' | 'Set' | 'Lista'
off       { [sourceIndex]: boolean }   // toggles de fonte

// swaps — ciclo de vida
swapStatus       { [swapId]: 'pend'|'appr'|'rej' }   // override do estado vindo da API
justResolved     { id, action } | null   // linha resolvida nesta sessão (mostra "Desfazer")
justResolvedTab  aba em que foi resolvida (a linha só migra ao trocar de aba)
rejectingId      id da troca com o painel de motivo aberto
rejectDraft      motivo selecionado antes de confirmar
rejectReasonById { [swapId]: motivo }
feedback         { [swapId]: 'up'|'down' }   // funcionou / não rolou
```

Rotas sugeridas: `/signin`, `/onboarding`, `/` (home), `/decks/new`, `/decks/:id`, `/decks/:id/edit`, `/library`, `/library/sources`, `/library/add`, `/swaps`, `/settings`.

### Dados que a UI precisa

```
Deck        { id, name, hero, heroArtUrl, format, tags[], status,
              readiness: { pct, raw, fidelity, owned, total, legal },
              missing[], swaps[], cards[] }
Card        { id, name, pitch: 'red'|'yellow'|'blue'|'colorless',
              type, set, imageUrl, quantityInDeck, quantityOwned }
Swap        { id, deckId, slot, from: Card, to: Card, confidence, status }
Source      { id, type: 'csv'|'fabrary'|'manual', name, cardCount, importedAt, active }
```

- **Prontidão** tem três números distintos que a UI mostra separados: `pct` (efetiva, o número grande), `raw` e `fidelity` (secundários, no card "Prontidão"). Não os concatene numa string como o app atual faz.
- **Cor de pitch** conduz a cor de quase todo componente de carta — exponha o pitch em todo card DTO.

## Responsive

O protótipo é desktop (1440px). Diretrizes:
- **≥1280px**: como projetado.
- **1024–1279px**: grade da Home vai a 3 colunas; decklist e library a 4; análise do deck detail continua em 3.
- **768–1023px**: Home 2 colunas; sidebar da Library vira um drawer com botão "Filtros"; análise empilha em 1 coluna; "Falta comprar" e "Trocas" empilham.
- **<768px**: Home 1–2 colunas; nav vira bottom-tab (Home/Library/Swaps); linhas do Swaps empilham (deck, troca, ações). Alvos de toque ≥44px.

## Assets

| Asset | Origem | Observação |
|---|---|---|
| `favicon.svg` | Favicon atual do Rathe Arsenal, fornecido pelo cliente | Usado como ícone da marca em todos os cabeçalhos (30px, raio 7px) e no Sign in |
| **UnifrakturCook 700** | Google Fonts | Wordmark e monograma R — escolhida por bater com o R fraktur do favicon |
| **Newsreader 400/500/600** | Google Fonts | Títulos e números |
| **Hanken Grotesque 400–800** | Google Fonts | Toda a UI |
| Arte de cartas/heróis | **Ausente** — placeholders com gradiente | Substituir pelas imagens reais de FaB que o app já usa |

```html
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesque:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=UnifrakturCook:wght@700&display=swap" rel="stylesheet">
```

## Files

| Arquivo | O que é |
|---|---|
| `Rathe Arsenal — Final.dc.html` | **O entregável.** Protótipo navegável com todas as 11 telas. Abra no navegador e use o seletor "TELAS" no rodapé. |
| `Rathe Arsenal Redesign.dc.html` | Documento de exploração — todas as direções consideradas (variações de Home, deck detail, conceitos de animação da deckbox, medalhões de prontidão). Útil para entender *por que* o design final é assim. |
| `favicon.svg` | Ícone da marca. |
| `support.js` | Runtime do protótipo. **Não portar** — existe só para o HTML rodar isolado. |

### Ordem sugerida de implementação

1. Tokens + tipografia + shell da aplicação (top nav).
2. Medalhão de prontidão (usado em duas telas).
3. Deckbox isométrica (o componente mais delicado — reserve tempo para a animação).
4. Home.
5. Deck detail (a tela de maior valor).
6. Library + Fontes + Add cards.
7. Swaps.
8. Conta, Novo deck, Editar deck.
9. Sign in + Onboarding.
