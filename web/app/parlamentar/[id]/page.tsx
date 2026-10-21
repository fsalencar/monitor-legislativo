import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Afastamentos, Autoria, PresencaSessoes } from "./atividade";
import { GastosCota } from "./gastos";
import {
  type TempoAfastado,
  getAfastamentos,
  getTempoAfastado,
  VOTOS_POR_PAGINA,
  getAutorias,
  getGastos,
  getCoberturaVotosCompleta,
  getPresenca,
  idDoParametro,
  PARAMS_DE_BUILD,
  getPerfil,
  textoCobertura,
  type Legislatura,
  type Perfil,
} from "@/lib/perfil";
import { cargo, Localizador } from "./componentes";
import { VotosLista } from "./votos";
import { ehAssembleia, SIGLA_CASA } from "@/lib/casas";
import Anuncio from "../../Anuncio";
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
  const [p, autoria, presenca, afastamentos, tempoAfastado, gastos] = await Promise.all([
    getPerfil(id),
    getAutorias(id),
    getPresenca(id),
    getAfastamentos(id),
    getTempoAfastado(id),
    getGastos(id),
  ]);
  if (!p) notFound();
  const assembleia = ehAssembleia(p.casa);
  const completa = assembleia ? false : await getCoberturaVotosCompleta(p.casa);

  return (
    <main className={`moldura ${styles.pagina}`}>
      <Link href={`/?casa=${p.casa}`} className={styles.voltar}>
        Voltar ao plenário
      </Link>

      <div className={styles.colunas}>
        <div className={styles.principal}>
          <Cabecalho p={p} />
          {p.casa === "al-sp" ? (
            <>
              <Votos
                p={p}
                cobertura="desde o início da legislatura, em março de 2023, nos relatórios oficiais de votação nominal do plenário"
              />
              <Anuncio posicao="secao" />
              <Autoria id={p.id} casa={p.casa} autorias={autoria} />
              <PresencaSessoes casa={p.casa} presenca={presenca} />
              <Afastamentos casa={p.casa} afastamentos={afastamentos} tempoMandatoAtual={tempoMandatoAtual(p, tempoAfastado)} />
            </>
          ) : assembleia ? (
            <>
              <section className={styles.secao}>
                <h2>Atividade parlamentar</h2>
                <p className={styles.nota}>
                  Votos, projetos de autoria, presença e afastamentos {SIGLA_CASA[p.casa].na} ainda não foram
                  carregados. Por enquanto, consulte a página oficial do deputado.
                </p>
              </section>
              <Anuncio posicao="secao" />
            </>
          ) : (
            <>
              <Votos p={p} cobertura={textoCobertura(completa)} />
              <Anuncio posicao="secao" />
              <Autoria id={p.id} casa={p.casa} autorias={autoria} />
              <PresencaSessoes casa={p.casa} presenca={presenca} />
              <Afastamentos casa={p.casa} afastamentos={afastamentos} tempoMandatoAtual={tempoMandatoAtual(p, tempoAfastado)} />
            </>
          )}
          <GastosCota casa={p.casa} gastos={gastos} urlFonte={p.urlFonte} />
          <Mandatos p={p} tempoAfastado={tempoAfastado} />
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
        {p.nascimento && <p className={styles.nomeCivil}>{textoNascimento(p.nascimento)}</p>}
        <a href={p.urlFonte} target="_blank" rel="noopener noreferrer" className={styles.fonte}>
          Página oficial {SIGLA_CASA[p.casa].na}
        </a>
      </div>
    </header>
  );
}

function Votos({ p, cobertura }: { p: Perfil; cobertura: string }) {
  return (
    <section className={styles.secao}>
      <h2>Votos em votações nominais</h2>
      <p className={styles.nota}>
        {p.totalVotos === 0
          ? `Nenhum voto nominal registrado ${cobertura}.`
          : `${p.totalVotos} votos registrados ${cobertura}, do mais recente ao mais antigo. Votações simbólicas não registram voto individual e não aparecem aqui.`}
      </p>
      {p.votos.length > 0 && (
        <VotosLista
          id={p.id}
          iniciais={p.votos}
          total={p.totalVotos}
          porPagina={VOTOS_POR_PAGINA}
          partidoAtual={p.partido}
        />
      )}
    </section>
  );
}

const numero = new Intl.NumberFormat("pt-BR");

function textoDias(t: TempoAfastado | undefined): string {
  if (!t || t.diasDecorridos === 0) return "—";
  return t.diasAfastado === 0
    ? "nenhum dia"
    : `${numero.format(t.diasAfastado)} de ${numero.format(t.diasDecorridos)} dias`;
}

// Soma das legislaturas do mandato atual (Câmara: a legislatura em curso; Senado: as duas do mandato).
function tempoMandatoAtual(p: Perfil, tempo: TempoAfastado[]): { diasAfastado: number; diasDecorridos: number } | null {
  const legs = p.casa === "senado"
    ? mandatoAtualSenado(p.legislaturas).map((l) => l.numero)
    : p.legislaturas.filter((l) => l.situacao === "em curso").map((l) => l.numero);
  const doMandato = tempo.filter((t) => legs.includes(t.legislatura));
  if (!doMandato.length) return null;
  return {
    diasAfastado: doMandato.reduce((a, t) => a + t.diasAfastado, 0),
    diasDecorridos: doMandato.reduce((a, t) => a + t.diasDecorridos, 0),
  };
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

function Mandatos({ p, tempoAfastado }: { p: Perfil; tempoAfastado: TempoAfastado[] }) {
  const dias = new Map(tempoAfastado.map((t) => [t.legislatura, t]));
  const senado = p.casa === "senado";
  const assembleia = ehAssembleia(p.casa);
  const doMandato = senado ? mandatoAtualSenado(p.legislaturas) : [];
  // Titular, suplente...: só quando a fonte informa (Câmara e Senado).
  const comCondicao = p.legislaturas.some((l) => l.condicao);
  // Afastamentos: Câmara, Senado e ALESP (licenças das listas de presença).
  const comTempoAfastado = !assembleia || p.casa === "al-sp";
  return (
    <section className={styles.secao}>
      <h2>{senado ? "Mandatos no Senado" : `Legislaturas com mandato ${SIGLA_CASA[p.casa].na}`}</h2>
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
        {assembleia
          ? "Legislatura é o período de 4 anos de trabalho da Assembleia; cada uma corresponde a um mandato de deputado estadual. A fonte não informa o partido de legislaturas anteriores."
          : <>
              Legislatura é o período de 4 anos de trabalho do Congresso, numerado desde 1826.{" "}
              {senado
                ? "O mandato de senador dura 8 anos e cobre duas legislaturas. A fonte não informa o partido de mandatos anteriores."
                : "Cada legislatura corresponde a um mandato de deputado."}
            </>}
      </p>
      <div className={styles.tabelaRolagem}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th scope="col">Legislatura</th>
              <th scope="col">Partido</th>
              <th scope="col">UF</th>
              {comCondicao && <th scope="col">Condição</th>}
              {comTempoAfastado && <th scope="col">Tempo afastado</th>}
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
                {comCondicao && <td>{l.condicao ?? "—"}</td>}
                {comTempoAfastado && <td>{l.situacao === "futura" ? "—" : textoDias(dias.get(l.numero))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const dataNascimento = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// "Nascimento: 12 de março de 1970, em Recife (PE)", com o que a fonte informar.
function textoNascimento(n: NonNullable<Perfil["nascimento"]>): string {
  const local = n.municipio ? `${n.municipio}${n.uf ? ` (${n.uf})` : ""}` : null;
  const data = n.data ? dataNascimento.format(new Date(n.data)) : null;
  return `Nascimento: ${[data, local && `em ${local}`].filter(Boolean).join(", ")}`;
}
