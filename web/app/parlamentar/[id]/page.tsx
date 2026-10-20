import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Afastamentos, Autoria, PresencaSessoes } from "./atividade";
import {
  getAfastamentos,
  getAutorias,
  getCoberturaVotosCompleta,
  getPresenca,
  idDoParametro,
  PARAMS_DE_BUILD,
  getPerfil,
  textoCobertura,
  type Legislatura,
  type Perfil,
} from "@/lib/perfil";
import { cargo, ListaVotos, Localizador } from "./componentes";
import styles from "./perfil.module.css";

export function generateStaticParams() {
  return PARAMS_DE_BUILD;
}

export async function generateMetadata({ params }: PageProps<"/parlamentar/[id]">) {
  const id = idDoParametro((await params).id);
  const perfil = id ? await getPerfil(id) : null;
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
  const id = idDoParametro((await params).id);
  if (!id) notFound();
  const [p, autoria, presenca, afastamentos] = await Promise.all([
    getPerfil(id),
    getAutorias(id),
    getPresenca(id),
    getAfastamentos(id),
  ]);
  if (!p) notFound();
  const completa = await getCoberturaVotosCompleta(p.casa);

  return (
    <main className={`moldura ${styles.pagina}`}>
      <Link href={`/?casa=${p.casa}`} className={styles.voltar}>
        Voltar ao plenário
      </Link>

      <div className={styles.colunas}>
        <div className={styles.principal}>
          <Cabecalho p={p} />
          <Votos p={p} cobertura={textoCobertura(completa)} />
          <Autoria casa={p.casa} total={autoria.total} projetos={autoria.projetos} />
          <PresencaSessoes casa={p.casa} presenca={presenca} />
          <Afastamentos casa={p.casa} afastamentos={afastamentos} />
          <Mandatos p={p} />
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

function Votos({ p, cobertura }: { p: Perfil; cobertura: string }) {
  const truncado = p.votos.length < p.totalVotos;
  return (
    <section className={styles.secao}>
      <h2>Votos em votações nominais</h2>
      <p className={styles.nota}>
        {p.totalVotos === 0
          ? `Nenhum voto nominal registrado ${cobertura}.`
          : `${truncado ? `Os ${p.votos.length} mais recentes de ` : ""}${p.totalVotos} votos registrados ${cobertura}. Votações simbólicas não registram voto individual e não aparecem aqui.`}
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

const INICIO: Record<Legislatura["situacao"], string> = {
  encerrada: "iniciada em",
  "em curso": "iniciada em",
  futura: "começa em",
};

// Mandato atual de senador: a legislatura em curso e a outra do mesmo mandato de 8 anos. Se a
// legislatura seguinte já está registrada, o mandato é (atual, seguinte); senão, (anterior, atual).
function mandatoAtualSenado(legs: Legislatura[]): Legislatura[] {
  const atual = legs.find((l) => l.situacao === "em curso");
  if (!atual) return [];
  const seguinte = legs.find((l) => l.numero === atual.numero + 1);
  const anterior = legs.find((l) => l.numero === atual.numero - 1);
  const par = seguinte ? [atual, seguinte] : anterior ? [anterior, atual] : [atual];
  return par.sort((a, b) => a.numero - b.numero);
}

function Mandatos({ p }: { p: Perfil }) {
  const senado = p.casa === "senado";
  const doMandato = senado ? mandatoAtualSenado(p.legislaturas) : [];
  return (
    <section className={styles.secao}>
      <h2>{senado ? "Mandatos no Senado" : "Legislaturas com mandato na Câmara"}</h2>
      {doMandato.length > 0 && (
        <p className={styles.mandatoSenado}>
          Mandato atual: {ano(doMandato[0].inicio)} a {ano(doMandato[doMandato.length - 1].fim ?? doMandato[0].inicio)}
          <span>
            {" "}
            (8 anos, {doMandato.map((l) => `${l.numero}ª`).join(" e ")} legislaturas)
          </span>
        </p>
      )}
      <p className={styles.nota}>
        Legislatura é o período de 4 anos de trabalho do Congresso, numerado desde 1826.{" "}
        {senado
          ? "O mandato de senador dura 8 anos e cobre duas legislaturas. A fonte não informa o partido de mandatos anteriores."
          : "Cada legislatura corresponde a um mandato de deputado."}
      </p>
      <div className={styles.tabelaRolagem}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th scope="col">Legislatura</th>
              <th scope="col">Partido</th>
              <th scope="col">UF</th>
            </tr>
          </thead>
          <tbody>
            {p.legislaturas.map((l) => (
              <tr key={l.numero}>
                <td>
                  <strong>{l.numero}ª</strong>, {INICIO[l.situacao]} {ano(l.inicio)}
                  {l.situacao !== "encerrada" && <span className={styles.situacao}> {l.situacao}</span>}
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
