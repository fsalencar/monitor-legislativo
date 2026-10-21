import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GLOSSARIO } from "@/lib/glossario";
import { idDoParametro, PARAMS_DE_BUILD } from "@/lib/perfil";
import { getProposicao, type Proposicao, type VotacaoDaProposicao } from "@/lib/proposicao";
import Anuncio from "../../Anuncio";
import p from "../../parlamentar/[id]/perfil.module.css";
import { nomeDaCasa } from "./casas";
import styles from "./proposicao.module.css";
import { VotosNominais } from "./VotosNominais";

export function generateStaticParams() {
  return PARAMS_DE_BUILD;
}

export async function generateMetadata({ params }: PageProps<"/proposicao/[id]">) {
  const id = idDoParametro((await params).id);
  const pr = id ? await getProposicao(id) : null;
  return { title: pr ? `${pr.sigla} | Monitor Legislativo` : "Monitor Legislativo" };
}

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const dia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function Page(props: PageProps<"/proposicao/[id]">) {
  return (
    <Suspense fallback={<p className={`moldura ${p.carregando}`}>Carregando…</p>}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}

async function Conteudo({ params }: { params: PageProps<"/proposicao/[id]">["params"] }) {
  const id = idDoParametro((await params).id);
  if (!id) notFound();
  const pr = await getProposicao(id);
  if (!pr) notFound();
  const nominais = pr.votacoes.filter((v) => v.tipo !== "simbolica").length;

  return (
    <main className={`moldura ${p.pagina}`}>
      <Link href="/proposicoes" className={p.voltar}>
        Buscar proposições
      </Link>
      <Ficha pr={pr} />
      <Autores pr={pr} />
      <Anuncio posicao="secao" />
      <section className={p.secao}>
        <h2>Votações</h2>
        {pr.votacoes.length === 0 ? (
          <p className={p.nota}>Nenhuma votação desta proposição registrada nos dados carregados.</p>
        ) : (
          <>
            <p className={p.nota}>
              {pr.votacoes.length} {pr.votacoes.length === 1 ? "votação" : "votações"} que tratam desta proposição (do
              projeto em si, de requerimentos, emendas e destaques), da mais recente à mais antiga;{" "}
              {nominais === 0 ? "nenhuma" : nominais} com registro de quem votou. Votações simbólicas não registram o
              voto de cada parlamentar.
            </p>
            <ol className={styles.votacoes}>
              {pr.votacoes.map((v) => (
                <Votacao key={v.id} v={v} />
              ))}
            </ol>
            <Glossario votacoes={pr.votacoes} />
          </>
        )}
      </section>
    </main>
  );
}

function Ficha({ pr }: { pr: Proposicao }) {
  const temas = pr.temas
    ?.split(/[,;]/)
    .map((t) => t.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 8);
  return (
    <header className={styles.topo}>
      <h1 className={styles.titulo}>{pr.sigla}</h1>
      <p className={styles.casa}>
        {nomeDaCasa(pr.casa)}
        {pr.apresentacao && <> · apresentada em {dia.format(new Date(pr.apresentacao))}</>}
      </p>
      <div className={p.sobre}>
        {pr.resumo && (
          <>
            <p className={p.resumo}>{pr.resumo}</p>
            <p className={p.rotuloIa}>Resumo em linguagem simples, gerado por IA a partir da ementa oficial abaixo.</p>
          </>
        )}
        {pr.ementa && (
          <p className={pr.resumo ? p.ementaOficial : styles.ementa}>
            {pr.resumo && <span>Ementa oficial: </span>}
            {pr.ementa}
          </p>
        )}
        <dl className={p.fichaProjeto}>
          {temas && temas.length > 0 && (
            <div>
              <dt>Temas</dt>
              <dd>{temas.join(", ")}</dd>
            </div>
          )}
          {pr.situacao && (
            <div>
              <dt>Situação atual</dt>
              <dd>{pr.situacao}</dd>
            </div>
          )}
          <div>
            <dt>Fonte</dt>
            <dd>
              <a href={pr.url} target="_blank" rel="noopener noreferrer">
                Página oficial
              </a>
              {pr.urlTexto && (
                <>
                  {" · "}
                  <a href={pr.urlTexto} target="_blank" rel="noopener noreferrer">
                    Texto integral
                  </a>
                </>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

function Autores({ pr }: { pr: Proposicao }) {
  if (pr.totalAutores === 0) return null;
  return (
    <section className={p.secao}>
      <h2>Autoria</h2>
      <ul className={styles.autores}>
        {pr.autores.map((a) => (
          <li key={a.nome}>
            {a.parlamentarId ? <Link href={`/parlamentar/${a.parlamentarId}`}>{a.nome}</Link> : a.nome}
          </li>
        ))}
      </ul>
      {pr.totalAutores > pr.autores.length && (
        <p className={p.nota}>
          E mais {pr.totalAutores - pr.autores.length} coautores; a lista completa está na página oficial.
        </p>
      )}
    </section>
  );
}

const RESULTADO = (v: VotacaoDaProposicao) =>
  v.aprovada === true ? "Aprovado" : v.aprovada === false ? "Rejeitado" : null;

function Votacao({ v }: { v: VotacaoDaProposicao }) {
  const resultado = RESULTADO(v);
  // Colunas da tabela por partido: os valores de voto desta votação, na ordem do placar.
  const colunas = v.placar.map((x) => x.voto);
  return (
    <li className={styles.votacao}>
      <p className={p.votoMeta}>
        {v.dataHora && <time dateTime={v.dataHora}>{dataCurta.format(new Date(v.dataHora))}</time>}
        {v.orgao && <span>{v.orgao === "PLEN" ? "Plenário" : v.orgao}</span>}
        {resultado && <span className={styles.resultadoVotacao}>{resultado}</span>}
      </p>
      {v.descricao && <p className={p.votoDescricao}>{v.descricao}</p>}

      {v.tipo === "simbolica" ? (
        <p className={styles.simbolica}>Votação simbólica — sem registro nominal.</p>
      ) : (
        <>
          <ul className={styles.placar} aria-label="Placar">
            {v.placar.map((x) => (
              <li key={x.voto} data-voto={x.voto}>
                <strong>{x.n}</strong> {x.voto}
              </li>
            ))}
          </ul>
          {v.tipo === "secreta" && (
            <p className={styles.simbolica}>Votação secreta: o Senado registra só quem votou, não o voto.</p>
          )}
          {v.porPartido.length > 0 && (
            <details className={styles.detalhe}>
              <summary>Votos por partido</summary>
              <div className={p.tabelaRolagem}>
                <table className={p.tabela}>
                  <caption className={styles.legendaTabela}>Partido do parlamentar na data da votação.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Partido</th>
                      {colunas.map((c) => (
                        <th key={c} scope="col">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {v.porPartido.map((pp) => (
                      <tr key={pp.partido}>
                        <th scope="row">{pp.partido}</th>
                        {colunas.map((c) => (
                          <td key={c}>{pp.votos[c] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <VotosNominais votacaoId={v.id} />
        </>
      )}
      <p className={p.votoRodape}>
        <a href={v.urlFonte} target="_blank" rel="noopener noreferrer">
          Registro oficial da votação
        </a>
      </p>
    </li>
  );
}

function Glossario({ votacoes }: { votacoes: VotacaoDaProposicao[] }) {
  const usados = [...new Set(votacoes.flatMap((v) => v.placar.map((x) => x.voto)))].filter((v) => GLOSSARIO[v]);
  if (!usados.length) return null;
  return (
    <dl className={p.glossario}>
      {usados.map((v) => (
        <div key={v}>
          <dt>{v}</dt>
          <dd>{GLOSSARIO[v]}</dd>
        </div>
      ))}
    </dl>
  );
}
