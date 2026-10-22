import { cacheDados } from "./cache";
import type { CasaId } from "./casas";
import { sql } from "./db";

// Casas cujas proposições aparecem na busca. "congresso": MPV, PLN e vetos (sessões conjuntas).
export type CasaProposicao = CasaId | "congresso";

export type ResultadoBusca = {
  id: number;
  casa: CasaProposicao;
  sigla: string;
  ementa: string | null;
  situacao: string | null;
  votacoesNominais: number;
  votacoes: number;
};

const MAX_RESULTADOS = 40;

// "PL 2338/2023", "pec 45/19", "PL2338" -> tipo, número e ano (opcional).
const SIGLA =
  /^\s*([a-z]{2,6})\.?\s*(?:n[º°o.]*\s*)?(\d{1,5})(?:\s*[/-]\s*(\d{2}|\d{4}))?\s*$/i;

export type ConsultaInterpretada =
  | { tipo: "sigla"; sigla: string; numero: number; ano: number | null }
  | { tipo: "texto"; termos: string[] }
  | null;

export function interpretarConsulta(q: string): ConsultaInterpretada {
  const m = q.match(SIGLA);
  if (m) {
    const ano = m[3]
      ? Number(
          m[3].length === 2
            ? Number(m[3]) > 50
              ? `19${m[3]}`
              : `20${m[3]}`
            : m[3],
        )
      : null;
    return {
      tipo: "sigla",
      sigla: m[1].toUpperCase(),
      numero: Number(m[2]),
      ano,
    };
  }
  // Só letras e números: os termos viram uma consulta de texto ("termo:*" = começo de palavra).
  const termos = q
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length >= 3)
    .slice(0, 6);
  return termos.length ? { tipo: "texto", termos } : null;
}

// Proposições pela sigla ou por palavras da ementa (todas as palavras, sem diferenciar acentos).
// As que tiveram votação nominal vêm primeiro; depois, as mais recentes.
export async function buscarProposicoes(q: string): Promise<ResultadoBusca[]> {
  "use cache";
  cacheDados();
  const c = interpretarConsulta(q);
  if (!c) return [];
  const filtro =
    c.tipo === "sigla"
      ? sql`pr.sigla_tipo = ${c.sigla} and pr.numero = ${c.numero} and (${c.ano}::int is null or pr.ano = ${c.ano})`
      : // Índice de texto (migração 0010): todas as palavras, cada uma também como começo de palavra.
        sql`to_tsvector('simple', sem_acento(pr.ementa))
            @@ to_tsquery('simple', sem_acento(${c.termos.map((t) => `${t}:*`).join(" & ")}))`;
  const rows = await sql<
    {
      id: string;
      casa_id: CasaProposicao;
      sigla: string;
      ementa: string | null;
      situacao: string | null;
      nominais: string;
      total: string;
    }[]
  >`
    select pr.id, pr.casa_id, pr.sigla_tipo || ' ' || pr.numero || '/' || pr.ano as sigla, pr.ementa, pr.situacao,
           count(v.id) filter (where v.tipo in ('nominal', 'secreta')) as nominais, count(v.id) as total
    from proposicao pr
    left join votacao_proposicao vp on vp.proposicao_id = pr.id
    left join votacao v on v.id = vp.votacao_id
    where ${filtro}
    group by pr.id
    order by count(v.id) filter (where v.tipo in ('nominal', 'secreta')) > 0 desc, pr.ano desc nulls last,
             pr.numero desc nulls last
    limit ${MAX_RESULTADOS}
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    casa: r.casa_id,
    sigla: r.sigla,
    ementa: r.ementa,
    situacao: r.situacao,
    votacoesNominais: Number(r.nominais),
    votacoes: Number(r.total),
  }));
}

export type Placar = { voto: string; n: number }[];

export type VotacaoDaProposicao = {
  id: number;
  dataHora: string | null;
  descricao: string | null;
  orgao: string | null;
  tipo: "nominal" | "simbolica" | "secreta";
  aprovada: boolean | null;
  urlFonte: string;
  placar: Placar;
  // Por partido na data do voto: { partido, total, votos: { Sim: 10, Não: 3, ... } }.
  porPartido: {
    partido: string;
    total: number;
    votos: Record<string, number>;
  }[];
};

export type Proposicao = {
  id: number;
  casa: CasaProposicao;
  sigla: string;
  tipo: string;
  ementa: string | null;
  resumo: string | null;
  temas: string | null;
  situacao: string | null;
  apresentacao: string | null;
  url: string;
  urlTexto: string | null;
  autores: { nome: string; parlamentarId: number | null }[];
  totalAutores: number;
  votacoes: VotacaoDaProposicao[];
};

const MAX_AUTORES = 40;

export async function getProposicao(id: number): Promise<Proposicao | null> {
  "use cache";
  cacheDados();
  const [p] = await sql<
    {
      id: string;
      casa_id: CasaProposicao;
      sigla: string;
      sigla_tipo: string;
      ementa: string | null;
      resumo_simples: string | null;
      palavras_chave: string | null;
      situacao: string | null;
      data_apresentacao: Date | null;
      url_fonte: string;
      url_inteiro_teor: string | null;
    }[]
  >`
    select id, casa_id, sigla_tipo || ' ' || numero || '/' || ano as sigla, sigla_tipo, ementa, resumo_simples,
           palavras_chave, situacao, data_apresentacao, url_fonte, url_inteiro_teor
    from proposicao where id = ${id}
  `;
  if (!p) return null;

  const autores = await sql<
    { nome_autor: string; parlamentar_id: string | null; total: string }[]
  >`
    select nome_autor, parlamentar_id, count(*) over () as total
    from autoria where proposicao_id = ${id}
    order by ordem nulls last, nome_autor
    limit ${MAX_AUTORES}
  `;

  const votacoes = await sql<
    {
      id: string;
      data_hora: Date | null;
      descricao: string | null;
      sigla_orgao: string | null;
      tipo: VotacaoDaProposicao["tipo"];
      aprovacao: boolean | null;
      url_fonte: string;
      placar: Placar | null;
      por_partido: VotacaoDaProposicao["porPartido"] | null;
    }[]
  >`
    select v.id, v.data_hora, v.descricao, v.sigla_orgao, v.tipo, v.aprovacao, v.url_fonte,
           (select json_agg(json_build_object('voto', x.voto, 'n', x.n) order by x.n desc)
              from (select voto, count(*)::int as n from voto where votacao_id = v.id group by voto) x) as placar,
           (select json_agg(json_build_object('partido', y.partido, 'total', y.total, 'votos', y.votos)
                            order by y.total desc, y.partido)
              from (select coalesce(sigla_partido, 'Sem partido') as partido, sum(n)::int as total,
                           json_object_agg(voto, n) as votos
                      from (select sigla_partido, voto, count(*)::int as n from voto
                             where votacao_id = v.id group by 1, 2) z
                     group by 1) y) as por_partido
    from votacao_proposicao vp join votacao v on v.id = vp.votacao_id
    where vp.proposicao_id = ${id}
    order by v.data_hora desc nulls last, v.id desc
  `;

  return {
    id: Number(p.id),
    casa: p.casa_id,
    sigla: p.sigla,
    tipo: p.sigla_tipo,
    ementa: p.ementa,
    resumo: p.resumo_simples,
    temas: p.palavras_chave,
    situacao: p.situacao,
    apresentacao: p.data_apresentacao
      ? p.data_apresentacao.toISOString().slice(0, 10)
      : null,
    url: p.url_fonte,
    urlTexto: p.url_inteiro_teor,
    autores: autores.map((a) => ({
      nome: a.nome_autor,
      parlamentarId: a.parlamentar_id ? Number(a.parlamentar_id) : null,
    })),
    totalAutores: autores.length ? Number(autores[0].total) : 0,
    votacoes: votacoes.map((v) => ({
      id: Number(v.id),
      dataHora: v.data_hora ? v.data_hora.toISOString() : null,
      descricao: v.descricao,
      orgao: v.sigla_orgao,
      tipo: v.tipo,
      aprovada: v.aprovacao,
      urlFonte: v.url_fonte,
      placar: v.placar ?? [],
      porPartido: v.por_partido ?? [],
    })),
  };
}

export type VotoNominal = {
  parlamentarId: number;
  nome: string;
  partido: string | null;
  uf: string | null;
  voto: string;
};

// Voto de cada parlamentar numa votação, com partido e UF na data do voto.
export async function getVotosDaVotacao(
  votacaoId: number,
): Promise<VotoNominal[]> {
  "use cache";
  cacheDados();
  const rows = await sql<
    {
      parlamentar_id: string;
      nome: string;
      sigla_partido: string | null;
      uf: string | null;
      voto: string;
    }[]
  >`
    select vo.parlamentar_id, p.nome, vo.sigla_partido, vo.uf, vo.voto
    from voto vo join parlamentar p on p.id = vo.parlamentar_id
    where vo.votacao_id = ${votacaoId}
    order by p.nome
  `;
  return rows.map((r) => ({
    parlamentarId: Number(r.parlamentar_id),
    nome: r.nome,
    partido: r.sigla_partido,
    uf: r.uf,
    voto: r.voto,
  }));
}

// Tipos que são o projeto em si (requerimentos, pareceres e emendas são etapas da tramitação).
// Inclui as siglas de projetos usadas pelas Assembleias do SAPL (PLO, PRL, PRE, PLG...).
const TIPOS_PRINCIPAIS = [
  "PL",
  "VET",
  "PLS",
  "PLP",
  "PLC",
  "PEC",
  "MPV",
  "PLV",
  "PDL",
  "PDC",
  "PDS",
  "PRC",
  "PRS",
  "PR",
  "PLN",
  "PLO",
  "PRL",
  "PRE",
  "PLG",
  "PLCG",
  "PLCC",
  "PLCV",
  "PLTJ",
  "PLTC",
  "PLMP",
  "PLDP",
  "PLCDP",
  "PLCTJ",
  "PLCMP",
  "PC",
];
const VOTADAS_POR_CASA = 15;

export type ProposicaoVotadaRecente = {
  id: number;
  casa: CasaProposicao;
  sigla: string;
  ementa: string | null;
  dataHora: string | null;
  aprovada: boolean | null;
  secreta: boolean;
  sim: number;
  nao: number;
  votacoesNominais: number;
};

// Últimas proposições (projetos em si) com votação nominal, até VOTADAS_POR_CASA por casa, com o
// resultado e o placar da votação nominal mais recente.
export async function getVotadasRecentes(): Promise<ProposicaoVotadaRecente[]> {
  "use cache";
  cacheDados();
  const rows = await sql<
    {
      id: string;
      casa_id: CasaProposicao;
      sigla: string;
      ementa: string | null;
      data_hora: Date | null;
      aprovacao: boolean | null;
      tipo: string;
      sim: number;
      nao: number;
      nominais: number;
    }[]
  >`
    select * from (
      select x.*, row_number() over (partition by x.casa_id order by x.data_hora desc nulls last) as pos
      from (
        select pr.id, pr.casa_id, pr.sigla_tipo || ' ' || pr.numero || '/' || pr.ano as sigla, pr.ementa,
               v.id as votacao_id, v.data_hora, v.aprovacao, v.tipo,
               count(*) over (partition by pr.id) as nominais,
               row_number() over (partition by pr.id order by v.data_hora desc nulls last, v.id desc) as rn
        from votacao_proposicao vp
        join votacao v on v.id = vp.votacao_id
        join proposicao pr on pr.id = vp.proposicao_id
        where v.tipo in ('nominal', 'secreta') and pr.sigla_tipo = any(${TIPOS_PRINCIPAIS})
      ) x
      where x.rn = 1
    ) y
    cross join lateral (
      select count(*) filter (where voto = 'Sim')::int as sim, count(*) filter (where voto = 'Não')::int as nao
      from voto where votacao_id = y.votacao_id
    ) placar
    where y.pos <= ${VOTADAS_POR_CASA}
    order by y.data_hora desc nulls last
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    casa: r.casa_id,
    sigla: r.sigla,
    ementa: r.ementa,
    dataHora: r.data_hora ? r.data_hora.toISOString() : null,
    aprovada: r.aprovacao,
    secreta: r.tipo === "secreta",
    sim: r.sim,
    nao: r.nao,
    votacoesNominais: Number(r.nominais),
  }));
}

// Proposições com votação nominal (para o mapa do site).
export async function getIdsProposicoesVotadas(): Promise<number[]> {
  "use cache";
  cacheDados();
  const rows = await sql<{ id: string }[]>`
    select distinct vp.proposicao_id as id
    from votacao_proposicao vp join votacao v on v.id = vp.votacao_id
    where v.tipo in ('nominal', 'secreta')
  `;
  return rows.map((r) => Number(r.id));
}
