import { getPresidente, ITENS_POR_PAGINA, PRESIDENTE } from "@/lib/presidente";
import { ListaFiltrada, type Filtro } from "./parlamentar/[id]/projetos";
import p from "./parlamentar/[id]/perfil.module.css";
import styles from "./plenario.module.css";

const numero = new Intl.NumberFormat("pt-BR");
const n = (x: number | undefined) => numero.format(x ?? 0);
const dia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const FILTROS_MPV: Filtro[] = [
  { id: null, titulo: "Todas" },
  { id: "lei", titulo: "Viraram lei" },
  { id: "caducou", titulo: "Perderam a validade ou revogadas" },
  { id: "rejeitado", titulo: "Rejeitadas" },
  { id: "arquivado", titulo: "Arquivadas" },
  { id: "tramitando", titulo: "Em tramitação" },
  { id: "sem", titulo: "Sem situação informada" },
];

const FILTROS_VETO: Filtro[] = [
  { id: null, titulo: "Todos" },
  { id: "deliberado", titulo: "Já analisados pelo Congresso" },
  { id: "aguardando", titulo: "Aguardando análise" },
];

const ROTULOS_VETO = { deliberado: "Analisado pelo Congresso", aguardando: "Aguardando análise" };

// Painel da aba "Presidente": o que a Presidência enviou ao Congresso no mandato atual.
export default async function PainelPresidente() {
  const dados = await getPresidente();
  const { projetos, mpv, vetos } = dados;

  return (
    <div className={styles.presidente}>
      <header className={styles.presidenteTopo}>
        <h1 className={styles.titulo}>Presidência da República</h1>
        <p className={styles.presidenteNome}>{PRESIDENTE.nome}</p>
        <p className={styles.resumo}>
          {PRESIDENTE.partido}, mandato de {dia.format(new Date(PRESIDENTE.inicio))} a{" "}
          {dia.format(new Date(PRESIDENTE.fim))}.{" "}
          <a href={PRESIDENTE.urlOficial} target="_blank" rel="noopener noreferrer">
            Página oficial
          </a>
        </p>
        <p className={styles.presidenteNota}>
          O presidente não vota no Congresso. Aqui aparece o que a Presidência enviou ao Congresso Nacional desde o
          início do mandato (projetos, medidas provisórias e vetos), com a situação oficial de cada item.
        </p>
      </header>

      <section className={p.secao}>
        <h2>Projetos enviados ao Congresso</h2>
        <p className={p.nota}>
          Projetos de lei, de lei complementar, propostas de emenda à Constituição e projetos de lei do Congresso
          (como os do orçamento) enviados pela Presidência.
        </p>
        <p className={p.desfechoResumo}>
          <strong>{n(projetos.porCategoria.lei)}</strong> viraram lei de {n(projetos.total)} enviados.{" "}
          <span>
            {n(projetos.porCategoria.tramitando)} em tramitação; {n(projetos.porCategoria.arquivado)} arquivados ou
            retirados; {n(projetos.porCategoria.rejeitado)} rejeitados.
          </span>
        </p>
        <ListaFiltrada
          endpoint="/api/presidente/projetos"
          total={projetos.total}
          porCategoria={projetos.porCategoria}
          iniciais={projetos.itens}
          porPagina={ITENS_POR_PAGINA}
        />
      </section>

      <section className={p.secao}>
        <h2>Medidas provisórias</h2>
        <p className={p.nota}>
          A medida provisória vale como lei assim que é publicada, mas precisa ser aprovada pelo Congresso em até
          120 dias. Se não for, perde a validade.
        </p>
        <p className={p.desfechoResumo}>
          <strong>{n(mpv.porCategoria.lei)}</strong> viraram lei de {n(mpv.total)} editadas.{" "}
          <span>
            {n(mpv.porCategoria.caducou)} perderam a validade ou foram revogadas; {n(mpv.porCategoria.tramitando)} em
            tramitação.
          </span>
        </p>
        <ListaFiltrada
          endpoint="/api/presidente/mpv"
          total={mpv.total}
          porCategoria={mpv.porCategoria}
          iniciais={mpv.itens}
          porPagina={ITENS_POR_PAGINA}
          filtros={FILTROS_MPV}
          rotuloGrupo="Filtrar medidas provisórias"
        />
      </section>

      <section className={p.secao}>
        <h2>Vetos</h2>
        <p className={p.nota}>
          Quando o presidente veta um projeto aprovado pelo Congresso, no todo ou em parte, o Congresso decide se
          mantém ou derruba o veto. A fonte informa se o veto já foi analisado, mas não o resultado da análise.
        </p>
        <p className={p.desfechoResumo}>
          <strong>{n(vetos.total)}</strong> vetos.{" "}
          <span>
            {n(dados.vetosTotais)} totais e {n(dados.vetosParciais)} parciais; {n(vetos.porCategoria.deliberado)} já
            analisados pelo Congresso e {n(vetos.porCategoria.aguardando)} aguardando análise.
          </span>
        </p>
        <ListaFiltrada
          endpoint="/api/presidente/vetos"
          total={vetos.total}
          porCategoria={vetos.porCategoria}
          iniciais={vetos.itens}
          porPagina={ITENS_POR_PAGINA}
          filtros={FILTROS_VETO}
          rotulos={ROTULOS_VETO}
          rotuloGrupo="Filtrar vetos"
        />
      </section>
    </div>
  );
}
