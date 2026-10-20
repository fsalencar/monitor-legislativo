import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getIdsEmExercicio, getPerfil, type Perfil } from "@/lib/perfil";
import styles from "./perfil.module.css";

export async function generateStaticParams() {
  const ids = await getIdsEmExercicio();
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: PageProps<"/parlamentar/[id]">) {
  const perfil = await getPerfil(Number((await params).id));
  return { title: perfil ? `${perfil.nome} | Monitor Legislativo` : "Monitor Legislativo" };
}

const CASA = {
  camara: { nome: "Câmara dos Deputados", cargo: "Deputado(a) federal", aba: "camara" },
  senado: { nome: "Senado Federal", cargo: "Senador(a)", aba: "senado" },
} as const;

// Significado dos valores de voto que não são autoexplicativos, conforme o regimento da Câmara.
const GLOSSARIO: Record<string, string> = {
  "Artigo 17": "Quem preside a sessão não vota, salvo para desempatar (Regimento Interno da Câmara, art. 17).",
  Obstrução: "O parlamentar marcou presença em obstrução, recurso regimental que não conta para o quórum da votação.",
  Abstenção: "O parlamentar registrou presença sem votar Sim nem Não.",
};

const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
const ano = (iso: string) => iso.slice(0, 4);

export default function Page(props: PageProps<"/parlamentar/[id]">) {
  return (
    <Suspense fallback={<p className={styles.carregando}>Carregando…</p>}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}

async function Conteudo({ params }: { params: PageProps<"/parlamentar/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const p = await getPerfil(id);
  if (!p) notFound();
  const casa = CASA[p.casa];

  return (
    <main className={`moldura ${styles.pagina}`}>
      <Link href={`/?casa=${casa.aba}`} className={styles.voltar}>
        Voltar ao plenário
      </Link>

      <header className={styles.cabecalho}>
        {/* Foto direto do site oficial; sem otimizador de imagens. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.foto && <img src={p.foto} alt={`Foto oficial de ${p.nome}`} width={120} height={160} />}
        <div>
          <p className={styles.cargo}>
            {casa.cargo}
            {p.emExercicio ? ", em exercício" : ""}
          </p>
          <h1>{p.nome}</h1>
          <p className={styles.partidoUf}>
            {[p.partido, p.uf].filter(Boolean).join(", ")}
          </p>
          {p.nomeCivil && p.nomeCivil.toLowerCase() !== p.nome.toLowerCase() && (
            <p className={styles.nomeCivil}>Nome civil: {p.nomeCivil}</p>
          )}
          <a href={p.urlFonte} target="_blank" rel="noopener noreferrer" className={styles.fonte}>
            Página oficial {p.casa === "senado" ? "no Senado" : "na Câmara"}
          </a>
        </div>
      </header>

      <Votos p={p} />
      <Mandatos p={p} />

      <section className={styles.secao}>
        <h2>Projetos de autoria</h2>
        <p className={styles.nota}>Em construção. Por enquanto, consulte a lista completa na página oficial.</p>
      </section>
      <section className={styles.secao}>
        <h2>Presença em sessões e afastamentos</h2>
        <p className={styles.nota}>Em construção.</p>
      </section>
    </main>
  );
}

function Votos({ p }: { p: Perfil }) {
  if (p.casa === "senado") {
    return (
      <section className={styles.secao}>
        <h2>Votos em votações nominais</h2>
        <p className={styles.nota}>As votações do Senado ainda não foram carregadas.</p>
      </section>
    );
  }
  const usados = [...new Set(p.votos.map((v) => v.voto))].filter((v) => GLOSSARIO[v]);

  return (
    <section className={styles.secao}>
      <h2>Votos em votações nominais</h2>
      <p className={styles.nota}>
        {p.totalVotos === 0
          ? "Nenhum voto nominal registrado desde fevereiro de 2023."
          : `${p.votos.length < p.totalVotos ? `Os ${p.votos.length} mais recentes de ` : ""}${p.totalVotos} votos registrados desde fevereiro de 2023. Votações simbólicas não registram voto individual e não aparecem aqui.`}
      </p>
      {p.votos.length > 0 && (
        <ol className={styles.votos}>
          {p.votos.map((v) => (
            <li key={v.votacaoId} className={styles.voto}>
              <div className={styles.votoValor} data-voto={v.voto}>
                {v.voto}
              </div>
              <div className={styles.votoCorpo}>
                <p className={styles.votoMeta}>
                  {v.dataHora && <time dateTime={v.dataHora}>{dataCurta.format(new Date(v.dataHora))}</time>}
                  {v.orgao && v.orgao !== "PLEN" && <span> · {v.orgao}</span>}
                  {v.proposicoes.map((pr) => (
                    <a key={pr.url} href={pr.url} target="_blank" rel="noopener noreferrer" className={styles.prop}>
                      {pr.sigla}
                    </a>
                  ))}
                </p>
                {v.descricao && <p className={styles.votoDescricao}>{v.descricao}</p>}
                {v.proposicoes[0]?.ementa && <p className={styles.ementa}>{v.proposicoes[0].ementa}</p>}
                <p className={styles.votoRodape}>
                  {v.partidoNoVoto && v.partidoNoVoto !== p.partido && <span>Partido na data: {v.partidoNoVoto}. </span>}
                  <a href={v.urlFonte} target="_blank" rel="noopener noreferrer">
                    Registro oficial da votação
                  </a>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {usados.length > 0 && (
        <dl className={styles.glossario}>
          {usados.map((v) => (
            <div key={v}>
              <dt>{v}</dt>
              <dd>{GLOSSARIO[v]}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Mandatos({ p }: { p: Perfil }) {
  return (
    <section className={styles.secao}>
      <h2>{p.casa === "senado" ? "Legislaturas do mandato atual" : "Legislaturas com mandato na Câmara"}</h2>
      {p.casa === "senado" && (
        <p className={styles.nota}>O histórico de mandatos anteriores no Senado ainda não foi carregado.</p>
      )}
      <div className={styles.tabelaRolagem}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th scope="col">Legislatura</th>
              <th scope="col">Período</th>
              <th scope="col">Partido</th>
              <th scope="col">UF</th>
            </tr>
          </thead>
          <tbody>
            {p.legislaturas.map((l) => (
              <tr key={l.numero}>
                <td>{l.numero}ª</td>
                <td>
                  {ano(l.inicio)} a {l.fim ? ano(l.fim) : "hoje"}
                </td>
                <td>{l.partido}</td>
                <td>{l.uf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
