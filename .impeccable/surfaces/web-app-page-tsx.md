---
version: 1
slug: "web-app-page-tsx"
primary_target: "web/app/page.tsx"
related_targets: ["web/app/parlamentar/[id]/page.tsx"]
---

# Plenário e perfil do parlamentar

Escopo: home (plenário com abas Vereadores / Deputados / Senadores, Deputados aberta) e /parlamentar/[id]. Modo: Operate.
Público: cidadão no celular; jornalistas checando votos com link oficial.
Tarefa: achar quem ocupa uma cadeira (busca, partido) e ver como votou.

## Direction contract

THESIS: O plenário é uma carta celeste: cada cadeira é uma estrela num céu de dados oficiais, e quem você procura recebe a mira do observador. Recusa o infográfico branco de portal de notícias com legenda ao lado.

OWN-WORLD: Fundo céu-noturno #0a1021, superfícies índigo #16233d, linhas de carta #24374f, texto poeira-estelar #f2f2e9, secundário névoa clara #9aa6bd, âmbar #ffb36b para estado ativo e foco, vermelho-lanterna #ff5a3c só na mira da cadeira selecionada. Serifa itálica (Libre Caslon Text) nomeia casas e parlamentares; Atkinson Hyperlegible para UI e dados, algarismos tabulares. Retícula de arcos e raios finos atrás do hemiciclo.

STORY: O visitante vê o céu do plenário inteiro, filtra e o céu se apaga deixando acesas só as estrelas do recorte, toca uma estrela e lê quem é, abre a atividade e vê os votos com link para o registro oficial.

FIRST VIEWPORT: Barra superior com marca à esquerda; abas padrão (Vereadores, Deputados, Senadores) com sublinhado âmbar; título itálico da casa e contagem tabular; busca e partido numa linha; hemiciclo ocupando a largura com retícula; no desktop, legenda em tabela à direita; cartão do selecionado com mira e coordenadas (partido, UF).

FORM: Atlas Celeste (desafiante escolhido), fundido com o hemiciclo; seed:5ec981ac0d3151ab. Assinatura: mira vermelha com cruz de marcação na cadeira selecionada e rótulo de coordenadas ao lado.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
