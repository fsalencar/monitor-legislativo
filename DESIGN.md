---
name: Plenário Aberto
description: O plenário como carta do céu noturno; dados oficiais do Congresso, sem opinião.
colors:
  ceu: "#0a1021"
  indigo: "#16233d"
  indigo-2: "#1c2b49"
  linha: "#24374f"
  linha-forte: "#34496a"
  poeira: "#f2f2e9"
  nevoa: "#9aa6bd"
  nevoa-2: "#8a96ad"
  ambar: "#ffb36b"
  lanterna: "#ff5a3c"
  sem-identidade: "#6b7385"
typography:
  display:
    fontFamily: "Libre Caslon Text, Georgia, serif"
    fontSize: "clamp(2.1rem, 1.5rem + 2.6vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Libre Caslon Text, Georgia, serif"
    fontSize: "clamp(2rem, 1.4rem + 2.4vw, 3.25rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  title-nome:
    fontFamily: "Libre Caslon Text, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.15
  title:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.25
    fontFeature: "tnum"
rounded:
  sm: "4px"
  raio: "6px"
  pill: "999px"
spacing:
  2xs: "0.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ambar}"
    textColor: "{colors.ceu}"
    rounded: "{rounded.raio}"
    padding: "0.5rem 1.1rem"
    height: "2.75rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ambar}"
    rounded: "{rounded.raio}"
    padding: "0.5rem 1.1rem"
    height: "2.75rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.poeira}"
    rounded: "{rounded.raio}"
    padding: "0.55rem 1rem"
    height: "2.75rem"
  input:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.poeira}"
    rounded: "{rounded.raio}"
    padding: "0.55rem 0.8rem"
    height: "2.75rem"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.nevoa}"
    padding: "0.75rem 0.9rem 0.85rem"
  tab-selected:
    textColor: "{colors.poeira}"
  chip-encontrado:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.poeira}"
    rounded: "{rounded.pill}"
    padding: "0.35rem 0.8rem"
    height: "2.5rem"
  card:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.poeira}"
    rounded: "{rounded.raio}"
    padding: "1rem"
  voto-sim:
    backgroundColor: "{colors.poeira}"
    textColor: "{colors.ceu}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.7rem"
  voto-nao:
    backgroundColor: "transparent"
    textColor: "{colors.poeira}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.7rem"
  voto-outro:
    backgroundColor: "transparent"
    textColor: "{colors.poeira}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.7rem"
---

# Design System: Plenário Aberto

## Overview

**Creative North Star: "Atlas Celeste"**

O plenário é uma carta do céu noturno: cada cadeira é uma estrela num céu de dados oficiais, e quem você procura recebe a mira do observador. O sistema é de tema único e escuro, plano, construído com fios finos de carta (linhas de 1px) sobre um céu azul-noite, com índigo como única superfície elevada. A cor forte vem das estrelas (as cores de identidade dos partidos) e de dois sinais raros: âmbar para estado ativo e foco, vermelho-lanterna para a mira.

A densidade é de atlas de consulta: tabelas com algarismos tabulares, legendas sempre presentes, rótulos curtos. A serifa itálica nomeia as coisas (casas, parlamentares), como os nomes das constelações numa carta; todo o resto, interface e dados, fala em Atkinson Hyperlegible. A neutralidade do produto é visual: nenhuma cor de juízo (verde/vermelho) para votos, nenhum eixo esquerda/direita para partidos.

O mundo recusa o infográfico branco de portal de notícias com legenda ao lado.

**Key Characteristics:**
- Céu escuro único (`ceu`), superfície índigo, fios de carta em `linha` / `linha-forte`.
- Itálico serifado só para nomes próprios de casas e pessoas.
- Âmbar = ativo, foco, ação; lanterna = mira do observador.
- Retícula de arcos e raios finos atrás do hemiciclo.
- Identidade nunca só pela cor: legenda em tabela e lista acompanham toda cor de partido.

## Colors

Um céu noturno quase monocromático, aceso por estrelas partidárias e por dois sinais de navegação.

### Primary
- **Âmbar de Farol** (`ambar`): estado ativo e foco. Sublinhado da aba aberta, anel de foco (`outline 2px`, offset 3px), borda de campo em foco com halo de 28%, botão primário "Ver atividade", links de ação ("Página oficial", "Mostrar os outros N partidos"), item de legenda pressionado, trecho marcado da régua de seção, `::selection`, `caret-color` e `accent-color`.

### Secondary
- **Vermelho-Lanterna** (`lanterna`): a mira do observador na cadeira selecionada (plenário e mini plenário do perfil), a borda do rótulo de coordenadas que acompanha a mira, a borda do chip de resultado pressionado e a estrela da marca na barra superior.

### Neutral
- **Céu Noturno** (`ceu`): fundo de toda página, `theme-color`, texto sobre âmbar e sobre o selo "Sim", halo escuro da mira.
- **Índigo** (`indigo`): única superfície: cartão do selecionado, campos, chips, glossário, localizador, tabela rolável. Também halo da mira quando ela está sobre índigo.
- **Índigo Alto** (`indigo-2`): dica flutuante (tooltip) e hover do botão fechar.
- **Fio de Carta** (`linha`): divisores de linha, borda inferior de barra e abas, retícula do hemiciclo, cadeira apagada fora do recorte.
- **Fio Forte** (`linha-forte`): bordas de controles e cartões, cabeçalhos de tabela, sublinhado padrão de links, barra de rolagem.
- **Poeira Estelar** (`poeira`): texto primário; fundo do selo "Sim".
- **Névoa Clara** (`nevoa`): texto secundário, rótulos de campo, metadados, cabeçalhos de tabela.
- **Névoa Funda** (`nevoa-2`): placeholder, detalhe das abas, hover de bordas, borda tracejada do voto "outro".
- **Sem Identidade** (`sem-identidade`): cor de cadeira para partido sem cor definida.

### Cores de partido
Definidas em `web/lib/cores.ts` (`COR_PARTIDO`), decisão do usuário: cada partido usa a cor mais próxima da sua própria identidade visual, ajustada só para não repetir entre partidos da mesma família e para ler sobre `ceu`. São dados, não paleta de interface: aparecem só nas cadeiras, nas amostras circulares (0.7rem) da legenda e do cartão.

### Named Rules
**The Mira Rule.** O vermelho-lanterna pertence à mira do observador e ao que a acompanha (rótulo de coordenadas, resultado pressionado), mais a estrela da marca. Nunca é cor de erro, de alerta, de botão ou de voto.

**The Âmbar Rule.** Âmbar significa "ativo ou acionável agora". Não decora; se nada está ativo, focado ou clicável, não há âmbar.

**The Céu Apagado Rule.** Filtrar não esconde estrelas: as cadeiras fora do recorte perdem a cor do partido e viram `linha` a 70% de opacidade; as linhas de legenda fora do recorte caem a 40%.

## Typography

**Display Font:** Libre Caslon Text, itálico 400 (com Georgia, serif)
**Body Font:** Atkinson Hyperlegible 400/700 (com system-ui, sans-serif)

**Character:** Itálico de atlas antigo para nomes próprios, contra uma sans de alta legibilidade para tudo que é dado ou controle. Números sempre tabulares (`font-variant-numeric: tabular-nums`) em contagens, datas, tabelas e coordenadas.

### Hierarchy
- **Display** (Caslon itálico 400, clamp(2.1rem → 3.5rem), 1.02): nome do parlamentar no topo do perfil.
- **Headline** (Caslon itálico 400, clamp(2rem → 3.25rem), 1.05): nome da casa no plenário ("Câmara dos Deputados"); variante clamp(1.9rem → 2.75rem) no título da página de votos.
- **Title-nome** (Caslon itálico 400, 1.375rem, 1.15): nome no cartão do selecionado; 1rem no rótulo de coordenadas da mira.
- **Title** (Atkinson 700, 1.375rem, 1.2): títulos de seção do perfil ("Votos em votações nominais").
- **Body** (Atkinson 400, 1rem, 1.5): texto corrente, campos; descrições limitadas a 68ch.
- **Body-sm** (0.9375rem): tabelas, legenda, glossário, selos de voto, links secundários.
- **Label** (0.875rem): rótulos de campo, metadados de voto, rodapé, barra superior.
- **Caption** (0.8125rem, tabular): cabeçalhos de tabela, detalhe da aba ("513 cadeiras"), coordenadas.

### Named Rules
**The Constelação Rule.** A serifa itálica só nomeia: casas legislativas e pessoas. Nunca rótulos, botões, números ou títulos de seção.

**The Algarismo Tabular Rule.** Todo número que se compara (cadeiras, votos, datas, legislaturas) usa algarismos tabulares.

## Layout

Moldura única centrada com largura máxima de 76rem e gutter lateral `max(1rem, safe-area)`. Barra superior com altura mínima de 3.75rem e fio inferior; rodapé com fio superior e 4rem de margem acima.

Plenário: pilha em grid com gap de 1.75rem; abas com flex igual (mínimo 7.5rem, rolagem horizontal no celular); filtros numa linha flexível (campos 14–24rem). No desktop, grade `1fr | 19rem` (gap 2.5rem) com hemiciclo à esquerda e lateral (dica, cartão, legenda) à direita; abaixo de 56rem vira coluna única e o cartão desce para baixo do hemiciclo.

Perfil: grade `1fr | 17rem` (gap 3rem) com o localizador em `sticky` na lateral; abaixo de 56rem o localizador sobe para logo depois do cabeçalho, antes dos votos. Seções com até 52rem de largura e 2.75rem entre si. Lista de votos em grid `7rem | 1fr` que empilha abaixo de 34rem.

Ritmo de espaçamento observado: 0.25 / 0.5 / 0.75 / 1 / 1.5 / 2.5rem. Alvos de toque mínimos de 2.5–2.75rem.

## Elevation & Depth

Plano por padrão: a profundidade vem do contraste tonal `ceu` → `indigo` → `indigo-2` e dos fios de 1px. Uma única sombra ambiente, difusa e para baixo, aparece em objetos que pairam sobre a carta: cartão do selecionado, dica flutuante, rótulo de coordenadas e foto do perfil.

### Shadow Vocabulary
- **Sombra de carta** (`--sombra`: `0 10px 30px -12px rgb(0 0 0 / 0.6)`): cartão, tooltip, rótulo de coordenadas, foto do perfil.
- **Halo de foco** (`0 0 0 3px` âmbar a 28%): campos em foco, junto da borda âmbar.

### Named Rules
**The Uma Sombra Rule.** Existe uma sombra e ela é ambiente. Não há sombras duras, deslocadas ou em camadas.

## Shapes

Cantos discretos: `raio` (6px) em controles, cartões e foto do perfil; 4px no rótulo de coordenadas e na foto do cartão; pílula (999px) só em chips de resultado e selos de voto; círculo para cadeiras e amostras de partido. Bordas sempre de 1px (`linha` ou `linha-forte`); 1.5px nos selos de voto; tracejada para a dica de uso vazia e para o voto "outro". Setas de `select`, `<details>` e "voltar" são chevrons desenhados com bordas de 1.5px, não glifos.

**The Régua de Seção Rule.** Seções do perfil abrem com um fio `linha` de 1px e um trecho âmbar de 2.5rem à esquerda, como a escala de um atlas.

## Components

### Buttons
- **Shape:** cantos discretos (6px), altura mínima 2.75rem.
- **Primário** ("Ver atividade"): fundo `ambar`, texto `ceu`, 700; hover clareia para #ffc68c em 160ms.
- **Contorno** ("Ver todos os votos"): borda e texto `ambar`, 700; hover com âmbar a 12% no fundo.
- **Fantasma** ("Limpar"): borda `linha-forte`, texto `poeira`; hover troca borda e texto para âmbar.
- **Link de ação** ("Mostrar os outros N partidos"): texto âmbar sublinhado com âmbar a 45%.
- **Fechar:** 2.25rem, ícone SVG em `nevoa`; hover `poeira` sobre `indigo-2`.

### Chips
- **Resultado de busca:** pílula `indigo` com borda `linha-forte`, amostra do partido e meta em `nevoa`; hover borda `nevoa-2`; pressionado borda `lanterna` (eco da mira).

### Cards / Containers
- **Cartão do selecionado:** `indigo`, borda `linha-forte`, 6px, padding 1rem, sombra de carta. Foto 72×96 (4px), nome em Caslon itálico, coordenadas em lista de definição com fios `linha`.
- **Painéis informativos** (glossário, localizador, tabela rolável): `indigo`, borda `linha`, 6px, padding 1rem, sem sombra.
- **Dica vazia:** borda tracejada `linha-forte`, texto `nevoa`.

### Inputs / Fields
- **Style:** `indigo`, borda `linha-forte`, 6px, altura 2.75rem, rótulo `nevoa` 0.875rem acima. `select` sem aparência nativa, chevron SVG em `nevoa`.
- **Hover:** borda `nevoa-2`. **Focus:** borda `ambar` + halo âmbar 3px a 28%.

### Navigation
- **Barra:** marca (estrela de quatro pontas em `lanterna` + nome em 700) à esquerda, linha de propósito em `nevoa` à direita (oculta abaixo de 40rem).
- **Abas das casas:** título 700 1.0625rem + detalhe tabular 0.8125rem; inativas em `nevoa`, hover `poeira` sobre índigo a 55%; aberta em `poeira` com sublinhado âmbar de 2px sobre o fio da barra de abas.
- **Voltar:** chevron desenhado + texto `nevoa`, hover âmbar.

### Hemiciclo (componente assinatura)
Cadeiras circulares nas cores de partido sobre a **retícula**: três arcos e onze raios finos em `linha` mais a linha de base, atrás das cadeiras. A **mira** do selecionado é um círculo (2.3× o raio da cadeira) com quatro traços de marcação em cruz, traçada em `lanterna` sobre um halo escuro da cor do fundo (`ceu` no plenário, `indigo` no localizador) para se separar de cadeiras vermelhas. Entra com escala de 1.6 → 1 em 260ms `cubic-bezier(0.16, 1, 0.3, 1)`. Ao lado, o **rótulo de coordenadas** (nome em Caslon itálico + "PARTIDO, UF" tabular), sobre `ceu` a 88% com borda lanterna a 55%, troca de lado conforme a posição da cadeira.

### Legenda de partidos
Tabela, não lista de bolinhas: amostra circular, sigla, contagem tabular à direita, fios `linha`. Ordenada por número de cadeiras. Item pressionado em âmbar 700; as oito maiores visíveis, o resto atrás de "Mostrar os outros N partidos".

### Selos de voto
Sim, Não e demais valores se distinguem por forma, com o rótulo de texto sempre presente: **Sim** pílula cheia `poeira` com texto `ceu`; **Não** pílula vazada com borda sólida `poeira`; **outros** (Abstenção, Obstrução, Artigo 17) pílula com borda tracejada `nevoa-2`.

### Localizador
Mini hemiciclo no perfil: todas as cadeiras em `nevoa-2` a 35%, só a desta pessoa acesa na cor do partido e sob a mira; o painel inteiro é link de volta ao plenário com ela marcada.

## Do's and Don'ts

### Do:
- **Do** manter o tema único escuro: fundo `ceu`, superfícies `indigo`, fios de 1px `linha` / `linha-forte`.
- **Do** usar âmbar para todo estado ativo, foco (`outline 2px`, offset 3px) e ação principal.
- **Do** reservar o vermelho-lanterna para a mira e seus ecos (coordenadas, resultado pressionado) e para a estrela da marca.
- **Do** acompanhar toda cor de partido com sigla em texto (legenda em tabela, lista, cartão).
- **Do** distinguir valores de voto por forma (cheio / vazado / tracejado) com rótulo de texto.
- **Do** usar algarismos tabulares em todo número comparável.
- **Do** apagar (não esconder) o que fica fora do filtro.
- **Do** desenhar setas e ícones como SVG ou bordas, e respeitar `prefers-reduced-motion`.

### Don't:
- **Don't** usar verde/vermelho ou qualquer cor de juízo para Sim/Não.
- **Don't** usar o vermelho-lanterna para erro, alerta, botões ou destaque genérico.
- **Don't** usar a serifa itálica fora de nomes de casas e pessoas.
- **Don't** criar um tema claro nem fundos brancos de infográfico de portal.
- **Don't** ordenar partidos em eixo esquerda/direita; a ordem é por número de cadeiras.
- **Don't** adicionar sombras duras, deslocadas ou em camadas além da sombra de carta.
