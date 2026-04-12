---
date: 2026-04-08
topic: fab-library-manager
focus: Web app para gerenciar coleção de Flesh and Blood, sugerir decks construíveis dentro da coleção + estoque de lojas locais, validar deck do Fabrary. Começar em Pelotas/BR, expandir BR e internacional. Desafio central: lojas brasileiras não expõem APIs públicas.
---

# Ideation: Flesh and Blood Library Manager (BR-first)

## Codebase Context

**Greenfield.** Nenhum código existente. Grounding vem do domínio e da pesquisa pontual sobre o ecossistema:

- **Jogo**: Flesh and Blood (LSS). Decks construídos em torno de Heróis; formatos Classic Constructed, Blitz, Draft. Cartas têm qualidades (NM/LP/MP/HP), raridades (Common → Fabled/Marvel), pitch values (red/yellow/blue), classes, talents, keywords (Go Again, Dominate, Crush, Reprise, etc.). Estrutura altamente regular, favorável a modelos baseados em regras.
- **Ecossistema existente**:
  - **FaBDB.net** — DB comunitário com API pública (fonte candidata para seed do catálogo).
  - **Fabrary.net** — deckbuilder popular, exporta URLs compartilháveis de decks (fluxo crítico de import).
  - **fabtcg.com** — site oficial LSS.
- **Desafio central — estoque de lojas**: Lojas brasileiras de TCG não expõem APIs. Pesquisa na loja de referência (Cúpula DT — Pelotas, https://www.cupuladt.com.br) revelou:
  - Plataforma: **Sbrauble** (e-commerce customizado BR-focado em TCG). Várias lojas BR de TCG rodam em Sbrauble → um scraper vertical para essa plataforma destrava um lote inicial de lojas.
  - URLs previsíveis: `?view=ecom/itens&tcg=8` (tcg=8 = Flesh and Blood).
  - Estoque exibido inline ("2 unid" por SKU).
  - Sem feed estruturado, sitemap ou schema markup.
- **Contexto BR**: Mercado pequeno, comunidade próxima, Pix/Mercado Pago/Correios como trilhos padrão, cartas em Português existem (camada de alias de nomes necessária).
- **Princípio transversal**: O problema *não* é catálogo de cartas (resolvido por FaBDB) nem deckbuilder (resolvido por Fabrary). O problema é **ligar coleção pessoal ↔ estoque local ↔ decks desejados** em mercados sem API.

## Ranked Ideas

### 1. Pelotas-first playbook com Cúpula DT como parceira-âncora
**Descrição:** Estratégia de go-to-market conservadora. Fechar parceria formal com Cúpula DT: ela entra como loja oficial beta, ganha dashboard gratuito (demanda reprimida, cards mais buscados, players interessados por set), e vira referência para onboardar a próxima loja. Validar ~3 meses na comunidade local antes de replicar cidade a cidade.
**Rationale:** Permissão explícita para ingerir dados, evita atrito legal/ético de scraping, cria caso de uso vivo, reduz risco de construir algo que ninguém quer. Pelotas é pequena o suficiente para medir engajamento real e grande o suficiente para ter massa mínima de jogadores.
**Downsides:** Escala lenta; dependência de uma loja; dinâmica pode não representar cidades maiores (SP/POA).
**Confidence:** 90%
**Complexity:** Baixa (negociação > código)
**Status:** Não explorada

### 2. Catálogo hidratado via FaBDB/Fabrary API + camada PT-BR
**Descrição:** Seedar catálogo de cartas a partir de APIs comunitárias abertas (FaBDB), aplicar delta updates em lançamentos de sets, e construir apenas uma camada fina por cima: aliases PT-BR, cross-references oficiais, metadados de mercado local. Não reconstruir o que já existe.
**Rationale:** Evita 6 meses de trabalho comoditizado; libera 100% do esforço para o diferencial (estoque local + matching + substituições). Princípio de alavancagem puro. Eleva-se de "alavanca de esforço" para **dependência de primeira ordem** porque o motor de substituição (#4) depende de dados estruturados limpos.
**Downsides:** Depende da saúde das APIs externas; ToS/downtime de FaBDB vira dívida técnica; necessário espelho local como fallback.
**Confidence:** 92%
**Complexity:** Baixa
**Status:** Não explorada

### 3. Fabrary-to-Reality: import + completability + cheapest path (3 caminhos)
**Descrição:** O fluxo principal do produto. Usuário cola URL de um deck do Fabrary → o app responde em um dos três caminhos:
- **Path A (verde):** Deck montável com coleção + lojas rastreadas → lista de compras ordenada por preço/proximidade.
- **Path B (amarelo):** Faltam N cartas → oferece substituições de alto score (ver #4) e gera deck modificado + lista de compras reduzida.
- **Path C (laranja):** Deck exato inviável no BR agora → "versão mais próxima que você consegue jogar hoje" com score global de fidelidade vs. original.
**Rationale:** Único fluxo que conecta os três pilares (coleção, loja, deck desejado) em uma experiência de segundos. É o killer demo para apresentar em eventos e comunidades. Transforma uma consulta binária em um gradiente, reduzindo drasticamente frustração quando a cobertura de estoque é baixa.
**Downsides:** Qualidade depende de (a) estoque atualizado e (b) qualidade do motor de substituição. Pode decepcionar se cobertura de lojas for muito baixa.
**Confidence:** 88%
**Complexity:** Média-Alta
**Status:** **Explored** (em brainstorm em 2026-04-08)

### 4. Motor de Substituição Inteligente (Deck Adapter)
**Descrição:** Quando uma carta necessária não está disponível (nem na coleção, nem nas lojas rastreadas), sugere alternativas funcionais de duas fontes: (A) cartas que o usuário já possui com papel análogo, (B) cartas em estoque em lojas próximas que podem substituir. Cada sugestão vem com score de proximidade e justificativa legível. Baseline é regra ponderada (match de classe, talent, card type, pitch, power/defense, keywords compartilhadas, sensibilidade ao archetype do deck). Futuro: camada comunitária de pares validados + camada LLM para casos ambíguos.
**Rationale:** Lacuna real no ecossistema (Fabrary, FaBDB, lojas BR não fazem). Faz o app útil mesmo com estoque baixo (cenário inevitável no início). Sinergia profunda com #2, #3, #8. Gera loop de retenção ("com os novos lançamentos da Cúpula DT, sua versão do Briar subiu de 78% → 89% de proximidade ao meta"). Defensável.
**Downsides:** Qualidade subjetiva — sugestões ruins custam mais que boas rendem; em FaB, cartas estruturalmente idênticas podem jogar diferente por sinergias implícitas; exige archetype-awareness; dívida de conteúdo que melhora com comunidade (chicken-and-egg leve).
**Mitigações:** Começar conservador (só sugestões de score >80%); tiers explícitos (tier 1 quase idêntica, tier 3 aproximação); feedback humano alimenta o modelo.
**Confidence:** 83%
**Complexity:** Média-Alta
**Status:** **Explored** (em brainstorm em 2026-04-08)

### 5. Scraper vertical para Sbrauble como primeira alavanca de cobertura
**Descrição:** Scraper polido e educado (respeitando robots.txt, rate-limited, identificado) para a plataforma Sbrauble. Como várias lojas BR de TCG rodam em Sbrauble, um único scraper desbloqueia um lote inicial de inventário sem negociar uma-a-uma. URL pattern previsível (`?view=ecom/itens&tcg=8`), estoque inline.
**Rationale:** Alavancagem técnica real — uma engenharia compartilhada por N lojas. Já validado via Cúpula DT que os dados estão acessíveis. Camada 2 do pipeline de dados (ver #7).
**Downsides:** Atrito legal/relacional se feito sem permissão; cada plataforma distinta (Sbrauble, Nuvemshop, Tray, Loja Integrada) exige engenharia separada; dados ficam stale entre execuções.
**Confidence:** 85%
**Complexity:** Média
**Status:** Não explorada

### 6. Modelo B2B2C: LGS ganha dashboard grátis em troca de feed de estoque
**Descrição:** Inverter a equação de custo/benefício. Em vez de "por favor nos dê seu inventário", oferecer valor tangível à loja: dashboard de demanda (cards mais buscados pelos clientes), heatmap de sets com maior interesse, lead gen de jogadores da região. Loja aceita porque ganha inteligência de mercado que não tinha.
**Rationale:** Resolve aquisição de dados na raiz — com consentimento — e cria lock-in. Complementa #5 (scraper) como caminho preferencial (camada 1 do pipeline #7). Cúpula DT é piloto perfeito para validar se o valor percebido compensa o esforço de upload.
**Downsides:** Requer ação ativa da loja (upload/export/plugin); muitas LGS têm operação familiar com baixa sofisticação digital; valor do dashboard precisa ser real, não teatro.
**Confidence:** 75%
**Complexity:** Média
**Status:** Não explorada

### 7. Pipeline híbrido de estoque: parceiro → scraper → correção de usuário
**Descrição:** Arquitetura em 3 camadas para dados de estoque:
- **Camada 1** — lojas parceiras com feed direto (fresh, confiável).
- **Camada 2** — scrapers semanais para Sbrauble e similares (semi-fresh).
- **Camada 3** — usuários que visitam a loja reportam divergência (correction layer).

UI explicita a camada e o timestamp ("atualizado há 2h — parceiro oficial" vs "atualizado há 6 dias — coleta automática").
**Rationale:** Honestidade sobre confiabilidade é feature, não bug. Evita "dados errados geram má experiência". Permite começar só com scraping e migrar lojas para camada 1 ao longo do tempo. Escala graciosamente de MVP a produção.
**Downsides:** Complexidade de UX (mostrar incerteza sem assustar); moderação de reports de usuário; reconciliação entre camadas conflitantes.
**Confidence:** 82%
**Complexity:** Alta
**Status:** Não explorada

### 8. Hero-centric library view com deck readiness meter
**Descrição:** Em vez de lista de cartas, coleção organizada por progressão em torno de cada Herói: "Briar: 73% de um deck competitivo — faltam Awakening, Forged for War, 2x Embermaw Scorcher." Gamifica a coleção e transforma "tenho X cartas" em "posso jogar Y deck". Internamente, usa o motor de substituição (#4) para mostrar a versão jogável com o que o usuário tem.
**Rationale:** Aproveita estrutura nativa do jogo (FaB é Hero-centric); transforma entrada de dados chata em progressão viciante; gera retenção distinta de qualquer outra ferramenta.
**Downsides:** Requer definir "deck padrão por Hero" (que muda com meta); pode ficar desatualizado; complexidade de UI não trivial; exige curadoria editorial de listas-alvo por Hero.
**Confidence:** 80%
**Complexity:** Média
**Status:** Não explorada

## Rejection Summary

| # | Ideia | Motivo rejeitado |
|---|---|---|
| 1 | Scanner OCR de cartas | Custo alto, precisão baixa em PT, adiar pós-PMF |
| 2 | Entrada manual + autocomplete | Baseline obrigatório, não diferencial |
| 3 | Alertas de wishlist standalone | Feature embutida em #3/#7, não ideia estratégica |
| 4 | Diretório de lojas (sem estoque) | Pouco valor isolado; absorvido em #5/#6 |
| 5 | Tradução PT-BR de nomes | Requisito de localização, não ideia |
| 6 | Qualidade/condição/foil tracking | Table-stakes de library manager, não diferencial |
| 7 | Histórico de valor da coleção | Depende de dados de preço que ainda não temos; prematuro |
| 8 | Extensão de navegador para clipar preços | Adoção baixa, cobre mesmo nicho do scraper pior |
| 9 | Marketplace P2P entre jogadores | Chicken-and-egg fatal sem massa crítica |
| 10 | Bot de Discord | Canal de distribuição, não proposta de valor central |
| 11 | Modo dia de torneio | Nicho; pode ser view derivada de #3 depois |
| 12 | Modo offline | Detalhe técnico, não ideia estratégica |
| 13 | CSV import/export | Utilidade, não diferencial |
| 14 | Seed via FaBDB (isolado) | Absorvido em #2 com escopo mais claro |
| 15 | Híbrido genérico de estoque | Concretizado em #7 |

## Session Log

- **2026-04-08**: Ideação inicial. 23 candidatos brutos gerados em 6 frames (pain/friction, missing capability, inversion, assumption-breaking, leverage, edge cases) + 3 sínteses cross-cutting. Após crítica adversarial, 7 sobreviventes iniciais. Refinamento solicitado pelo usuário adicionou o **Motor de Substituição Inteligente** como 8ª sobrevivente — ideia com alta sinergia com #3 e #2. Ranking ajustado para refletir ordem de dependência no MVP. Status marcado `Explored` em #3 e #4; seguindo para `ce:brainstorm` em ambas (serão brainstormadas juntas por dependência funcional).
