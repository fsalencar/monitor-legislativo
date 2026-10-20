import { cacheLife } from "next/cache";
import { sql } from "./db";
import { DESFECHO_SQL, type Desfecho } from "./perfil";

// Presidente em exercício. Não há API oficial com estes dados: atualizar a cada novo mandato.
// Pela EC 111/2021, a posse passa a ser em 5 de janeiro a partir de 2027.
export const PRESIDENTE = {
  nome: "Luiz Inácio Lula da Silva",
  partido: "PT",
  inicio: "2023-01-01",
  fim: "2027-01-05",
  urlOficial: "https://www.gov.br/planalto/pt-br",
  // Retrato oficial (Palácio do Planalto), via Wikimedia Commons, licença CC BY 2.0: exige crédito.
  foto: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Foto_oficial_do_Presidente_da_Rep%C3%BAblica_Luiz_In%C3%A1cio_Lula_da_Silva_%28cropped%29.jpg/500px-Foto_oficial_do_Presidente_da_Rep%C3%BAblica_Luiz_In%C3%A1cio_Lula_da_Silva_%28cropped%29.jpg",
  creditoFoto: "Ricardo Stuckert/PR (CC BY 2.0)",
  urlFoto: "https://commons.wikimedia.org/wiki/File:Foto_oficial_do_Presidente_da_Rep%C3%BAblica_Luiz_In%C3%A1cio_Lula_da_Silva_(cropped).jpg",
};

// Autores com que a Câmara e o Senado registram a Presidência da República.
const AUTORES = ["Poder Executivo", "Presidência da República"];

export type Grupo = "projetos" | "mpv" | "vetos";
export const GRUPOS: Grupo[] = ["projetos", "mpv", "vetos"];

const TIPOS: Record<Grupo, string[]> = {
  projetos: ["PL", "PLP", "PEC", "PLN"],
  mpv: ["MPV"],
  vetos: ["VET"],
};

// Vetos: a fonte informa se o Congresso já deliberou, mas não se o veto foi mantido ou derrubado.
const CATEGORIA_VETO_SQL = sql`
  case
    when pr.situacao ilike any (array['veto deliberado%', 'tramitação encerrada%', 'prejudicad%', 'transformad%'])
      then 'deliberado'
    else 'aguardando'
  end`;

// Cada tipo vem de uma só fonte, para não contar o mesmo item duas vezes: PL, PLP e PEC começam na
// Câmara; MPV, VET e PLN tramitam no Congresso Nacional (a Câmara também registra alguns deles).
const FONTE_SQL = sql`
  and case when pr.sigla_tipo in ('PL', 'PLP', 'PEC') then pr.casa_id = 'camara' else pr.casa_id = 'congresso' end`;

export type ItemPresidencia = {
  sigla: string;
  ementa: string | null;
  resumo: string | null;
  situacao: string | null;
  desfecho: string;
  url: string;
};

export type GrupoPresidencia = { total: number; porCategoria: Record<string, number>; itens: ItemPresidencia[] };

export type DadosPresidente = Record<Grupo, GrupoPresidencia> & { vetosTotais: number; vetosParciais: number };

export const ITENS_POR_PAGINA = 15;

function categoria(grupo: Grupo) {
  return grupo === "vetos" ? CATEGORIA_VETO_SQL : DESFECHO_SQL;
}

async function consultar(grupo: Grupo, cat: string | null, inicio: number, quantos: number | null) {
  return sql<ItemPresidencia[]>`
    select sigla, ementa, resumo, situacao, desfecho, url from (
      select distinct on (pr.id)
             pr.sigla_tipo || ' ' || pr.numero || '/' || pr.ano as sigla, pr.ementa, pr.resumo_simples as resumo,
             pr.situacao, ${categoria(grupo)} as desfecho, pr.url_fonte as url,
             coalesce(pr.data_apresentacao, make_date(pr.ano, 1, 1)) as data, pr.numero, pr.id
      from proposicao pr join autoria a on a.proposicao_id = pr.id
      where a.nome_autor = any(${AUTORES}) and pr.sigla_tipo = any(${TIPOS[grupo]})
        and coalesce(pr.data_apresentacao, make_date(pr.ano, 1, 1)) between ${PRESIDENTE.inicio}::date and ${PRESIDENTE.fim}::date
        ${FONTE_SQL}
      order by pr.id
    ) x
    where ${cat}::text is null or x.desfecho = ${cat}
    order by x.data desc, x.numero desc, x.id desc
    limit ${quantos} offset ${inicio}
  `;
}

async function contar(grupo: Grupo): Promise<Record<string, number>> {
  const rows = await sql<{ desfecho: string; n: string }[]>`
    select ${categoria(grupo)} as desfecho, count(distinct pr.id) as n
    from proposicao pr join autoria a on a.proposicao_id = pr.id
    where a.nome_autor = any(${AUTORES}) and pr.sigla_tipo = any(${TIPOS[grupo]})
      and coalesce(pr.data_apresentacao, make_date(pr.ano, 1, 1)) between ${PRESIDENTE.inicio}::date and ${PRESIDENTE.fim}::date
        ${FONTE_SQL}
    group by 1
  `;
  return Object.fromEntries(rows.map((r) => [r.desfecho, Number(r.n)]));
}

export async function getPresidente(): Promise<DadosPresidente> {
  "use cache";
  cacheLife("hours");
  const grupos = await Promise.all(
    GRUPOS.map(async (g) => {
      const porCategoria = await contar(g);
      return [
        g,
        {
          total: Object.values(porCategoria).reduce((a, b) => a + b, 0),
          porCategoria,
          itens: [...(await consultar(g, null, 0, ITENS_POR_PAGINA))],
        },
      ] as const;
    }),
  );
  const [tipos] = await sql<{ totais: string; parciais: string }[]>`
    select count(distinct pr.id) filter (where pr.ementa ilike 'veto total%') as totais,
           count(distinct pr.id) filter (where pr.ementa ilike 'veto parcial%') as parciais
    from proposicao pr join autoria a on a.proposicao_id = pr.id
    where a.nome_autor = any(${AUTORES}) and pr.sigla_tipo = 'VET'
      and coalesce(pr.data_apresentacao, make_date(pr.ano, 1, 1)) between ${PRESIDENTE.inicio}::date and ${PRESIDENTE.fim}::date
        ${FONTE_SQL}
  `;
  return {
    ...(Object.fromEntries(grupos) as Record<Grupo, GrupoPresidencia>),
    vetosTotais: Number(tipos.totais),
    vetosParciais: Number(tipos.parciais),
  };
}

export async function getItensPresidencia(grupo: Grupo, cat: string | null, inicio: number, quantos: number | null) {
  "use cache";
  cacheLife("hours");
  return [...(await consultar(grupo, cat, inicio, quantos))];
}

export type { Desfecho };
