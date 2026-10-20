# Monitor Legislativo — contexto do projeto

## Objetivo
Site **apartidário** de transparência legislativa. Mostra as cadeiras ocupadas na Câmara dos Deputados, no Senado Federal (e sessões do Congresso Nacional) e em Câmaras Municipais, e quem as ocupa.

### Funcionalidades
- **Plenário visual**: cadeiras ocupadas por casa legislativa (513 deputados, 81 senadores, vereadores por cidade). Clicar em uma cadeira abre o perfil do parlamentar.
- **Perfil do parlamentar**:
  - quantos mandatos já cumpriu
  - projetos de sua autoria
  - votos nas votações nominais mais recentes
  - presença em sessões deliberativas, faltas justificadas, afastamentos/licenças
- **Busca por proposição** (PL, PEC, MP etc.): mostra como cada parlamentar votou.

## Princípios (não negociáveis)
- **Neutralidade total**: mostrar apenas dado bruto da fonte oficial, sempre com link para a origem. Sem rankings, notas, adjetivos ou "pontuação" de parlamentar.
- **Rótulos cuidadosos**: parlamentar não tem férias individuais (o recesso é coletivo). Usar "presença em sessões", "falta justificada", "afastamento/licença", nunca "folga" ou "férias".
- **Votações simbólicas** não registram voto individual. Exibir isso explicitamente ("votação simbólica — sem registro nominal"), não como dado faltando.
- Nada de patrocínio de partidos, parlamentares ou entidades ligadas a eles.

## Fontes de dados
| Casa | Fonte | Observações |
|---|---|---|
| Câmara dos Deputados | API Dados Abertos v2 — https://dadosabertos.camara.leg.br/api/v2 | REST/JSON, OpenAPI documentada, sem autenticação. Deputados, mandatos, proposições, autores, votações, votos, eventos/presenças. |
| Senado Federal / Congresso | API Dados Abertos — https://legis.senado.leg.br/dadosabertos | Sem autenticação, XML/JSON, menos padronizada (exige normalização). Senadores, mandatos, afastamentos, matérias, votações nominais. Sessões conjuntas do Congresso também. |
| Câmaras Municipais | Sem API nacional | Cada município tem um sistema. Começar pela Câmara Municipal de São Paulo (tem dados abertos/API). Expandir cidade a cidade (scraping/integração). |

**Regra de arquitetura:** não consultar as APIs oficiais ao vivo no front. Fazer ingestão periódica (jobs agendados) para um banco próprio e servir o site a partir dele.

## Stack sugerida (a confirmar)
- Banco: Postgres (Supabase)
- Front/deploy: Vercel
- Jobs de ingestão: cron (Vercel Cron, Supabase scheduled functions ou GitHub Actions)

## Modelo de dados (rascunho)
Modelo unificado entre casas: `parlamentar`, `mandato`, `casa_legislativa`, `proposicao`, `autoria`, `votacao`, `voto`, `sessao`, `presenca`, `afastamento`. Guardar sempre o ID e a URL da fonte original.

## Roadmap macro
1. **Ingestão Câmara** — jobs para deputados, mandatos, proposições, votações, votos, presenças → Postgres.
2. **MVP Câmara** — plenário visual, perfil do deputado, busca por proposição com votos.
3. **Senado** — mesmo pipeline, normalizado para o modelo unificado.
4. **Congresso** — sessões conjuntas e vetos.
5. **Vereadores SP** — piloto com a Câmara Municipal de São Paulo.
6. **Expansão municipal** — capitais, uma a uma, priorizando as que têm dados abertos.
7. **Extras** — histórico entre legislaturas, gastos (cota parlamentar), alertas.

## Monetização (fase posterior)
- Google AdSense com **um bloco discreto** (rodapé/entre seções), nunca sobre os dados, sem pop-up.
  - Bloquear categorias sensíveis de política e religião no AdSense.
  - Banner de consentimento LGPD (ou só anúncios não personalizados).
  - Expectativa: RPM baixo (~R$ 2–6 por mil páginas vistas). Cobre a infra com ~30–50 mil pageviews/mês.
- **Doação remove anúncios**: Pix (Mercado Pago/Stripe) ou Apoia.se; login por magic link (Supabase); webhook marca usuário como apoiador por X meses; front deixa de renderizar o anúncio.
- Futuro: plano para jornalistas/pesquisadores (exportação CSV/API normalizada); editais de civic tech.
- Página de transparência com receitas e custos do próprio site.

## Como trabalhar comigo
- Prefiro implementação direta e iterativa a explicações longas.
- Às vezes peço rollback — mantenha commits pequenos e bem descritos.
