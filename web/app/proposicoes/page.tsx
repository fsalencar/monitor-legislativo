import Link from "next/link";
import { Suspense } from "react";
import { buscarProposicoes, interpretarConsulta } from "@/lib/proposicao";
import { nomeDaCasa } from "../proposicao/[id]/casas";
import p from "../parlamentar/[id]/perfil.module.css";
import styles from "../proposicao/[id]/proposicao.module.css";
import PainelProposicoes from "./PainelProposicoes";

export const metadata = { title: "Proposições" };

export default function Page(props: PageProps<"/proposicoes">) {
  return (
    <main className={`moldura ${p.pagina}`}>
      <Suspense fallback={<p className={p.carregando}>Carregando…</p>}>
        <ComBusca searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function ComBusca({ searchParams }: { searchParams: PageProps<"/proposicoes">["searchParams"] }) {
  const bruto = (await searchParams).q;
  const q = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim().slice(0, 120) ?? "";
  return <PainelProposicoes q={q} resultados={q ? <Resultados q={q} /> : null} />;
}

async function Resultados({ q }: { q: string }) {
  const consulta = interpretarConsulta(q);
  const resultados = consulta ? await buscarProposicoes(q) : [];

  if (!consulta) return <p className={p.nota}>Digite a sigla e o número ou ao menos uma palavra com 3 letras.</p>;
  if (resultados.length === 0) {
    return (
      <p className={p.nota}>
        Nenhuma proposição encontrada para “{q}”. O site traz as proposições votadas e os projetos de autoria dos
        parlamentares em exercício; confira a sigla e o ano ou tente outras palavras.
      </p>
    );
  }
  return (
    <section aria-label="Resultados da busca" className={p.secao}>
      <h2>Resultados para “{q}”</h2>
      <p className={p.nota}>
        {resultados.length === 40 ? "Os 40 primeiros resultados" : `${resultados.length} resultado${resultados.length === 1 ? "" : "s"}`}
        {consulta.tipo === "texto" && ", com todas as palavras na ementa"}; as proposições com votação nominal vêm
        primeiro.
      </p>
      <ul className={styles.resultados}>
        {resultados.map((r) => (
          <li key={r.id}>
            <Link href={`/proposicao/${r.id}`} className={styles.resultado}>
              <span className={styles.resultadoTopo}>
                <strong>{r.sigla}</strong>
                <span>{nomeDaCasa(r.casa)}</span>
                <span>
                  {r.votacoesNominais > 0
                    ? `${r.votacoesNominais} votaç${r.votacoesNominais === 1 ? "ão nominal" : "ões nominais"}`
                    : r.votacoes > 0
                      ? "só votação simbólica"
                      : "sem votação registrada"}
                </span>
              </span>
              {r.ementa && <span className={styles.resultadoEmenta}>{r.ementa}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
