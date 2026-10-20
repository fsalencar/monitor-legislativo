# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Cidadão comum**, majoritariamente no celular, querendo saber quem são seus representantes e como votam. Pouca familiaridade com o processo legislativo e com jargão (PL, PEC, "Artigo 17", obstrução).
- **Jornalistas e pesquisadores**, checando votos e dados rapidamente e precisando do link para a fonte oficial para citar.

## Product Purpose
Site apartidário de transparência legislativa: mostra as cadeiras ocupadas na Câmara dos Deputados, no Senado Federal (e sessões do Congresso) e em Câmaras Municipais, quem as ocupa e o que cada parlamentar fez (mandatos, autoria, votos nominais, presença, afastamentos). Sucesso = a pessoa entende, em segundos e sem jargão, quem ocupa uma cadeira e como essa pessoa votou, e consegue chegar à fonte oficial.

## Positioning
- **Neutralidade total:** apenas dado bruto da fonte oficial, sempre com link. Sem notas, rankings, pontuações ou adjetivos.
- **Tudo num lugar só:** Câmara, Senado e (depois) Câmaras Municipais no mesmo formato.
- **Visual e simples:** o plenário em semicírculo é a porta de entrada; jargão é traduzido ou explicado.

## Operating Context
- Dados ingeridos diariamente das APIs oficiais (Câmara, Senado) para Postgres; o site nunca consulta as APIs ao vivo.
- Votações simbólicas não registram voto individual: exibir como "votação simbólica — sem registro nominal", nunca como dado faltando.
- Rótulos cuidadosos: "presença em sessões", "falta justificada", "afastamento/licença"; nunca "folga" ou "férias".
- Aba aberta ao entrar: Deputados. Ordem das abas: Vereadores, Deputados, Senadores. Vereadores está em construção (começa pela Câmara Municipal de São Paulo).

## Capabilities and Constraints
- Next.js na Vercel (região gru1), Postgres no Supabase (sa-east-1); páginas pré-renderizadas e revalidadas por hora.
- Cores de partido: cada partido usa a cor mais próxima da sua identidade visual (decisão do usuário, 20/10/2026), ajustada só para não repetir cor entre partidos e para ler sobre o fundo. Partidos ordenados por número de cadeiras, nunca em eixo esquerda/direita. Identidade nunca só pela cor: legenda e lista sempre presentes.
- Fotos vêm direto dos sites oficiais.
- Monetização futura: no máximo um bloco discreto de anúncio, nunca sobre os dados; nada de patrocínio partidário.

## Evidence on Hand
- Dados reais no banco: 513 deputados e 81 senadores em exercício; histórico de mandatos da Câmara desde 1826; votações, votos e proposições da Câmara desde fev/2023 (carga em andamento).
- Não há depoimentos, imprensa ou parceiros; não fabricar.

## Product Principles
1. A fonte oficial é a autoridade: todo dado mostrado leva ao registro original.
2. Neutro por construção: nenhuma escolha de ordem, cor ou palavra pode sugerir juízo sobre parlamentar ou partido.
3. Entendível por quem nunca acompanhou o Congresso; preciso o bastante para jornalistas.
4. Celular primeiro.

## Accessibility & Inclusion
Público amplo, incluindo baixa familiaridade digital: identidade nunca só por cor (legenda e tabela), navegação por teclado, contraste adequado, respeito a movimento reduzido.
