import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { buscarProposicoes, interpretarConsulta } from "@/lib/proposicao";
import { nomeDaCasa } from "../proposicao/[id]/casas";
import p from "../parlamentar/[id]/perfil.module.css";
import styles from "../proposicao/[id]/proposicao.module.css";

export const metadata = { title: "Buscar proposições | Monitor Legislativo" };

export default function Page(props: PageProps<"/proposicoes">) {
  return (
    <main className={`moldura ${p.pagina}`}>
      <header className={styles.topo}>
        <h1 className={styles.titulo}>Proposições</h1>
        <p className={p.nota}>
          Busque um projeto pela sigla e número (ex.: PL 2338/2023, PEC 45/2019) ou por palavras da ementa. Na página
          de cada proposição aparecem a ficha oficial, os autores e todas as votações, com o voto de cada parlamentar
          nas votações nominais.
        </p>
      </header>
      <Suspense fallback={<Busca q="" />}>
        <Resultados searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

function Busca({ q }: { q: string }) {
  return (
    <Form action="/proposicoes" className={styles.busca} role="search">
      <label htmlFor="q">Sigla e número, ou palavras da ementa</label>
      <div>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Ex.: PL 2338/2023" autoComplete="off" />
        <button type="submit">Buscar</button>
      </div>
    </Form>
  );
}

async function Resultados({ searchParams }: { searchParams: PageProps<"/proposicoes">["searchParams"] }) {
  const bruto = (await searchParams).q;
  const q = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim().slice(0, 120) ?? "";
  const consulta = q ? interpretarConsulta(q) : null;
  const resultados = consulta ? await buscarProposicoes(q) : [];

  return (
    <>
      <Busca q={q} />
      {q && !consulta && <p className={p.nota}>Digite a sigla e o número ou ao menos uma palavra com 3 letras.</p>}
      {consulta && resultados.length === 0 && (
        <p className={p.nota}>
          Nenhuma proposição encontrada para “{q}”. O site traz as proposições votadas e os projetos de autoria dos
          parlamentares em exercício; confira a sigla e o ano ou tente outras palavras.
        </p>
      )}
      {resultados.length > 0 && (
        <section aria-label="Resultados" className={p.secao}>
          <p className={p.nota}>
            {resultados.length === 40 ? "Os 40 primeiros resultados" : `${resultados.length} resultado${resultados.length === 1 ? "" : "s"}`}
            {consulta?.tipo === "texto" && ", com todas as palavras na ementa"}; as proposições com votação nominal vêm
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
      )}
    </>
  );
}
