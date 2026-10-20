import { cacheLife } from "next/cache";
import { sql } from "./db";

export type CasaId = "senado" | "camara";

export type Parlamentar = {
  id: number;
  nome: string;
  partido: string;
  uf: string;
  foto: string | null;
  urlFonte: string;
  // Câmara: legislaturas em que exerceu (histórico completo). Senado: histórico ainda não ingerido.
  mandatos: number | null;
};

export const SEM_PARTIDO = "Sem partido";

export async function getPlenario(casa: CasaId): Promise<Parlamentar[]> {
  "use cache";
  cacheLife("hours");

  const rows = await sql<
    {
      id: string;
      nome: string;
      sigla_partido: string | null;
      uf: string | null;
      url_foto: string | null;
      url_fonte: string;
      mandatos: string;
    }[]
  >`
    select p.id, p.nome, m.sigla_partido, m.uf, p.url_foto, p.url_fonte,
           (select count(*) from mandato x where x.parlamentar_id = p.id) as mandatos
    from mandato m
    join parlamentar p on p.id = m.parlamentar_id
    where m.casa_id = ${casa} and m.em_exercicio
    order by p.nome
  `;

  return rows.map((r) => ({
    id: Number(r.id),
    nome: r.nome,
    partido: normalizaPartido(r.sigla_partido),
    uf: r.uf ?? "",
    foto: r.url_foto,
    urlFonte: r.url_fonte,
    mandatos: casa === "camara" ? Number(r.mandatos) : null,
  }));
}

function normalizaPartido(sigla: string | null): string {
  if (!sigla || /^s\.?\s*\/?\s*partido$/i.test(sigla)) return SEM_PARTIDO;
  return sigla;
}

export async function getUltimaAtualizacao(): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  const [r] = await sql<{ quando: Date | null }[]>`
    select max(finalizado_em) as quando from ingestao_execucao where ok
  `;
  return r?.quando ? r.quando.toISOString() : null;
}
