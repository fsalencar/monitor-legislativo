import Form from "next/form";
import type { ReactNode } from "react";
import { getVotadasRecentes } from "@/lib/proposicao";
import Anuncio from "../Anuncio";
import p from "../parlamentar/[id]/perfil.module.css";
import styles from "../proposicao/[id]/proposicao.module.css";
import { VotadasRecentes } from "./VotadasRecentes";

// Painel de proposições: busca em destaque e as votadas recentemente. Usado na aba "Proposições"
// da página inicial e na página /proposicoes (que encaixa os resultados da busca em `resultados`).
export default async function PainelProposicoes({ q = "", resultados }: { q?: string; resultados?: ReactNode }) {
  const votadas = await getVotadasRecentes();
  return (
    <div className={styles.painel}>
      <header className={styles.topo}>
        <h1 className={styles.titulo}>Proposições</h1>
        <p className={p.nota}>
          Projetos de lei, propostas de emenda à Constituição, medidas provisórias e outros. Busque pela sigla e
          número ou por palavras da ementa; na página de cada proposição estão a ficha oficial, os autores e todas as
          votações, com o voto de cada parlamentar nas votações nominais.
        </p>
      </header>
      <Busca q={q} />
      {resultados}
      <section className={p.secao}>
        <h2>Votadas recentemente</h2>
        <p className={p.nota}>
          Proposições que passaram por votação nominal (com registro do voto de cada parlamentar), da mais recente para
          a mais antiga. O resultado e o placar são os da última votação nominal, que pode ser do projeto, de uma
          emenda ou de um destaque.
        </p>
        <VotadasRecentes itens={votadas} />
      </section>
      {/* No fim do painel: entre a busca e a lista, no celular, o anúncio escondia a lista. */}
      <Anuncio posicao="secao" />
    </div>
  );
}

export function Busca({ q }: { q: string }) {
  return (
    <Form action="/proposicoes" className={styles.busca} role="search">
      <label htmlFor="q">Buscar proposição</label>
      <div>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="PL 2338/2023 ou um tema"
          autoComplete="off"
        />
        <button type="submit">Buscar</button>
      </div>
    </Form>
  );
}
