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
  proposicoes: { sigla: string; ementa: string | null; url: string }[];
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
    { numero: number; data_inicio: Date; data_fim: Date | null; sigla_partido: string | null; uf: string | null; em_exercicio: boolean }[]
  >`
    select m.legislatura as numero, l.data_inicio, l.data_fim, m.sigla_partido, m.uf, m.em_exercicio
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
      proposicoes: { sigla: string; ementa: string | null; url: string }[] | null;
    }[]
  >`
    select v.id as votacao_id, v.data_hora, v.descricao, v.sigla_orgao, v.aprovacao,
           vo.voto, vo.sigla_partido, v.url_fonte,
           (select json_agg(json_build_object(
                     'sigla', pr.sigla_tipo || ' ' || pr.numero || '/' || pr.ano,
                     'ementa', pr.ementa, 'url', pr.url_fonte) order by pr.ano, pr.numero)
              from votacao_proposicao vp join proposicao pr on pr.id = vp.proposicao_id
             where vp.votacao_id = v.id) as proposicoes
    from voto vo join votacao v on v.id = vo.votacao_id
    where vo.parlamentar_id = ${id}
    order by v.data_hora desc nulls last
    ${limite === null ? sql`` : sql`limit ${limite}`}
  `;
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
