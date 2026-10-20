import { cacheLife } from "next/cache";
import { sql } from "./db";
import { SEM_PARTIDO, type CasaId } from "./plenario";

export type Legislatura = {
  numero: number;
  inicio: string;
  fim: string | null;
  partido: string;
  uf: string;
  emExercicio: boolean;
  situacao: "encerrada" | "em curso" | "futura";
};

export type ProposicaoVotada = {
  tipo: string;
  sigla: string;
  ementa: string | null;
  // Resumo em linguagem simples gerado por IA; sempre exibido rotulado e ao lado da ementa oficial.
  resumo: string | null;
  temas: string | null;
  situacao: string | null;
  url: string;
  urlTexto: string | null;
};

export type VotoRegistrado = {
  votacaoId: number;
  dataHora: string | null;
  descricao: string | null;
  orgao: string | null;
  aprovada: boolean | null;
  voto: string;
  partidoNoVoto: string | null;
  urlFonte: string;
  proposicoes: ProposicaoVotada[];
};

export type Perfil = {
  id: number;
  casa: CasaId;
  nome: string;
  nomeCivil: string | null;
  sexo: string | null;
  foto: string | null;
  urlFonte: string;
  partido: string | null;
  uf: string | null;
  emExercicio: boolean;
  legislaturas: Legislatura[];
  votos: VotoRegistrado[];
  totalVotos: number;
};

const LIMITE_VOTOS = 40;

// O cache components exige ao menos um parâmetro no build. Usamos um id que não existe e é
// recusado sem consultar o banco: o build não depende da conexão, e cada perfil é gerado na
// primeira visita (pela função em São Paulo, ao lado do banco) e fica em cache.
export const PARAMS_DE_BUILD = [{ id: "0" }];

export function idDoParametro(valor: string): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function getIdsEmExercicio(): Promise<number[]> {
  "use cache";
  cacheLife("hours");
  const rows = await sql<{ id: string }[]>`
    select distinct parlamentar_id as id from mandato where em_exercicio
  `;
  return rows.map((r) => Number(r.id));
}

export async function getPerfil(id: number): Promise<Perfil | null> {
  "use cache";
  cacheLife("hours");

  const [p] = await sql<
    {
      id: string;
      casa_id: CasaId;
      nome: string;
      nome_civil: string | null;
      sexo: string | null;
      url_foto: string | null;
      url_fonte: string;
    }[]
  >`select id, casa_id, nome, nome_civil, sexo, url_foto, url_fonte from parlamentar where id = ${id}`;
  if (!p) return null;

  const legs = await sql<
    {
      numero: number;
      data_inicio: Date;
      data_fim: Date | null;
      sigla_partido: string | null;
      uf: string | null;
      em_exercicio: boolean;
      situacao: Legislatura["situacao"];
    }[]
  >`
    select m.legislatura as numero, l.data_inicio, l.data_fim, m.sigla_partido, m.uf, m.em_exercicio,
           case when l.data_inicio > current_date then 'futura'
                when l.data_fim < current_date then 'encerrada'
                else 'em curso' end as situacao
    from mandato m join legislatura l on l.casa_id = m.casa_id and l.numero = m.legislatura
    where m.parlamentar_id = ${id}
    order by m.legislatura desc
  `;

  const votos = await consultarVotos(id, LIMITE_VOTOS);

  const [{ total }] = await sql<{ total: string }[]>`
    select count(*) as total from voto where parlamentar_id = ${id}
  `;

  const atual = legs.find((l) => l.em_exercicio) ?? legs[0];
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

  return {
    id: Number(p.id),
    casa: p.casa_id,
    nome: p.nome,
    nomeCivil: p.nome_civil,
    sexo: p.sexo,
    foto: p.url_foto,
    urlFonte: p.url_fonte,
    partido: atual ? (atual.sigla_partido ?? SEM_PARTIDO) : null,
    uf: atual?.uf ?? null,
    emExercicio: legs.some((l) => l.em_exercicio),
    legislaturas: legs.map((l) => ({
      numero: l.numero,
      inicio: iso(l.data_inicio)!,
      fim: iso(l.data_fim),
      partido: l.sigla_partido ?? SEM_PARTIDO,
      uf: l.uf ?? "",
      emExercicio: l.em_exercicio,
      situacao: l.situacao,
    })),
    votos,
    totalVotos: Number(total),
  };
}

// A carga histórica das votações da Câmara cobre todos os meses desde fev/2023?
// Janeiro é recesso e não entra na conta. Enquanto houver mês sem votação carregada, o texto avisa.
export async function getCoberturaVotosCompleta(): Promise<boolean> {
  "use cache";
  cacheLife("hours");
  const [{ faltando }] = await sql<{ faltando: string }[]>`
    select count(*) as faltando
    from generate_series(date '2023-02-01', date_trunc('month', current_date) - interval '1 month', interval '1 month') m
    where extract(month from m) <> 1
      and not exists (select 1 from votacao v where v.casa_id = 'camara'
                        and v.data >= m and v.data < m + interval '1 month')
  `;
  return Number(faltando) === 0;
}

export function textoCobertura(completa: boolean): string {
  return completa
    ? "desde fevereiro de 2023"
    : "até agora (o histórico desde fevereiro de 2023 ainda está sendo carregado)";
}

export type ProjetoAutoria = {
  sigla: string;
  ementa: string | null;
  resumo: string | null;
  url: string;
};

const LIMITE_AUTORIAS = 15;

// Projetos (tipos principais) em que o parlamentar é autor ou coautor, dos mais recentes aos mais antigos.
export async function getAutorias(id: number): Promise<{ total: number; projetos: ProjetoAutoria[] }> {
  "use cache";
  cacheLife("hours");
  const rows = await sql<{ sigla: string; ementa: string | null; resumo: string | null; url: string; total: string }[]>`
    select pr.sigla_tipo || ' ' || pr.numero || '/' || pr.ano as sigla, pr.ementa,
           pr.resumo_simples as resumo, pr.url_fonte as url, count(*) over () as total
    from autoria a join proposicao pr on pr.id = a.proposicao_id
    where a.parlamentar_id = ${id}
      and pr.sigla_tipo in ('PL', 'PLP', 'PEC', 'MPV', 'PLV', 'PDL', 'PDC', 'PRC', 'PLN')
    order by pr.ano desc nulls last, pr.numero desc nulls last
    limit ${LIMITE_AUTORIAS}
  `;
  return {
    total: rows.length ? Number(rows[0].total) : 0,
    projetos: rows.map(({ sigla, ementa, resumo, url }) => ({ sigla, ementa, resumo, url })),
  };
}

export type Presenca = {
  sessoes: number;
  presencas: number;
  ausenciasJustificadas: number;
  ausencias: number;
  primeiraSessao: string | null;
  // Ausências (com ou sem justificativa), da mais recente à mais antiga.
  faltas: { data: string; sessao: string; situacao: string; justificativa: string | null }[];
};

export async function getPresenca(id: number): Promise<Presenca> {
  "use cache";
  cacheLife("hours");
  const [c] = await sql<{ sessoes: string; presencas: string; justificadas: string; ausencias: string; primeira: Date | null }[]>`
    select count(*) as sessoes,
           count(*) filter (where pe.situacao = 'Presença') as presencas,
           count(*) filter (where pe.situacao = 'Ausência justificada') as justificadas,
           count(*) filter (where pe.situacao = 'Ausência') as ausencias,
           min(s.data_inicio) as primeira
    from presenca pe join sessao s on s.id = pe.sessao_id
    where pe.parlamentar_id = ${id}
  `;
  const faltas = await sql<{ data: Date; sessao: string; situacao: string; justificativa: string | null }[]>`
    select s.data_inicio as data, s.id_fonte as sessao, pe.situacao, pe.justificativa
    from presenca pe join sessao s on s.id = pe.sessao_id
    where pe.parlamentar_id = ${id} and pe.situacao <> 'Presença'
    order by s.data_inicio desc
    limit 30
  `;
  return {
    sessoes: Number(c.sessoes),
    presencas: Number(c.presencas),
    ausenciasJustificadas: Number(c.justificadas),
    ausencias: Number(c.ausencias),
    primeiraSessao: c.primeira ? c.primeira.toISOString() : null,
    faltas: faltas.map((f) => ({ ...f, data: f.data.toISOString() })),
  };
}

export type Afastamento = { inicio: string; fim: string | null; motivo: string | null; url: string };

export async function getAfastamentos(id: number): Promise<Afastamento[]> {
  "use cache";
  cacheLife("hours");
  const rows = await sql<{ data_inicio: Date; data_fim: Date | null; motivo: string | null; url_fonte: string }[]>`
    select data_inicio, data_fim, motivo, url_fonte from afastamento
    where parlamentar_id = ${id} order by data_inicio desc
  `;
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return rows.map((r) => ({ inicio: iso(r.data_inicio)!, fim: iso(r.data_fim), motivo: r.motivo, url: r.url_fonte }));
}

// Todos os votos nominais do parlamentar, do mais recente ao mais antigo.
export async function getTodosVotos(id: number): Promise<VotoRegistrado[]> {
  "use cache";
  cacheLife("hours");
  return consultarVotos(id, null);
}

async function consultarVotos(id: number, limite: number | null): Promise<VotoRegistrado[]> {
  const rows = await sql<
    {
      votacao_id: string;
      data_hora: Date | null;
      descricao: string | null;
      sigla_orgao: string | null;
      aprovacao: boolean | null;
      voto: string;
      sigla_partido: string | null;
      url_fonte: string;
      proposicoes: ProposicaoVotada[] | null;
    }[]
  >`
    select v.id as votacao_id, v.data_hora, v.descricao, v.sigla_orgao, v.aprovacao,
           vo.voto, vo.sigla_partido, v.url_fonte,
           (select json_agg(json_build_object(
                     'tipo', pr.sigla_tipo,
                     'sigla', pr.sigla_tipo || ' ' || pr.numero || '/' || pr.ano,
                     'ementa', pr.ementa, 'resumo', pr.resumo_simples, 'temas', pr.palavras_chave,
                     'situacao', pr.situacao, 'url', pr.url_fonte, 'urlTexto', pr.url_inteiro_teor)
                     order by pr.ano, pr.numero)
              from votacao_proposicao vp join proposicao pr on pr.id = vp.proposicao_id
             where vp.votacao_id = v.id) as proposicoes
    from voto vo join votacao v on v.id = vo.votacao_id
    where vo.parlamentar_id = ${id}
    order by v.data_hora desc nulls last
    limit ${limite}
  `;
  // limit null = sem limite no Postgres.
  return rows.map((v) => ({
    votacaoId: Number(v.votacao_id),
    dataHora: v.data_hora ? v.data_hora.toISOString() : null,
    descricao: v.descricao,
    orgao: v.sigla_orgao,
    aprovada: v.aprovacao,
    voto: v.voto,
    partidoNoVoto: v.sigla_partido,
    urlFonte: v.url_fonte,
    proposicoes: v.proposicoes ?? [],
  }));
}
