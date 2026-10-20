import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getIdsEmExercicio, getPerfil, type Perfil } from "@/lib/perfil";
import { cargo, ListaVotos, Localizador } from "./componentes";
import styles from "./perfil.module.css";

export async function generateStaticParams() {
  const ids = await getIdsEmExercicio();
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: PageProps<"/parlamentar/[id]">) {
  const perfil = await getPerfil(Number((await params).id));
  return { title: perfil ? `${perfil.nome} | Monitor Legislativo` : "Monitor Legislativo" };
}

const ano = (iso: string) => iso.slice(0, 4);

export default function Page(props: PageProps<"/parlamentar/[id]">) {
  return (
    <Suspense fallback={<p className={`moldura ${styles.carregando}`}>Carregando…</p>}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}

async function Conteudo({ params }: { params: PageProps<"/parlamentar/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const p = await getPerfil(id);
  if (!p) notFound();

  return (
    <main className={`moldura ${styles.pagina}`}>
      <Link href={`/?casa=${p.casa}`} className={styles.voltar}>
        Voltar ao plenário
      </Link>

      <div className={styles.colunas}>
        <div className={styles.principal}>
          <Cabecalho p={p} />
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
        </div>

        {p.emExercicio && (
          <aside className={styles.lateral}>
            <Localizador id={p.id} casa={p.casa} partido={p.partido} />
          </aside>
        )}
      </div>
    </main>
  );
}

function Cabecalho({ p }: { p: Perfil }) {
  return (
    <header className={styles.cabecalho}>
      {/* Foto direto do site oficial; sem otimizador de imagens. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.foto && <img src={p.foto} alt={`Foto oficial de ${p.nome}`} width={120} height={160} />}
      <div>
        <h1>{p.nome}</h1>
        <p className={styles.partidoUf}>
          {[p.partido, p.uf].filter(Boolean).join(", ")}
          <span>
            {", "}
            {cargo(p.casa, p.sexo)}
            {p.emExercicio ? " em exercício" : ""}
          </span>
        </p>
        {p.nomeCivil && p.nomeCivil.toLowerCase() !== p.nome.toLowerCase() && (
          <p className={styles.nomeCivil}>Nome civil: {p.nomeCivil}</p>
        )}
        <a href={p.urlFonte} target="_blank" rel="noopener noreferrer" className={styles.fonte}>
          Página oficial {p.casa === "senado" ? "no Senado" : "na Câmara"}
        </a>
      </div>
    </header>
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
  const truncado = p.votos.length < p.totalVotos;
  return (
    <section className={styles.secao}>
      <h2>Votos em votações nominais</h2>
      <p className={styles.nota}>
        {p.totalVotos === 0
          ? "Nenhum voto nominal registrado desde fevereiro de 2023."
          : `${truncado ? `Os ${p.votos.length} mais recentes de ` : ""}${p.totalVotos} votos registrados desde fevereiro de 2023. Votações simbólicas não registram voto individual e não aparecem aqui.`}
      </p>
      {p.votos.length > 0 && <ListaVotos votos={p.votos} partidoAtual={p.partido} />}
      {truncado && (
        <Link href={`/parlamentar/${p.id}/votos`} className={styles.todos}>
          Ver todos os {p.totalVotos} votos
        </Link>
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
