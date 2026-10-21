import { SIGLA_CASA, type CasaId } from "@/lib/casas";
import { PROJETOS_POR_PAGINA, type Afastamento, type Autorias, type Presenca } from "@/lib/perfil";
import { ListaFiltrada } from "./projetos";
import styles from "./perfil.module.css";

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const PRESENCA_SENADO =
  "A frequência por sessão do Senado ainda não foi carregada. Nas votações nominais acima, o registro de cada senador já indica presença, licença, missão ou ausência (veja o glossário dos votos).";

const numero = new Intl.NumberFormat("pt-BR");

export function Autoria({ id, casa, autorias }: { id: number; casa: CasaId; autorias: Autorias }) {
  const { total, porDesfecho, projetos } = autorias;
  const n = (x: number) => numero.format(x);
  return (
    <section className={styles.secao}>
      <h2>Projetos de autoria</h2>
      {total === 0 ? (
        <p className={styles.nota}>
          Nenhum projeto de autoria registrado {SIGLA_CASA[casa].na}.
        </p>
      ) : (
        <>
          <p className={styles.nota}>
            {n(total)} {total === 1 ? "projeto" : "projetos"} em que é autor ou coautor (projetos de lei, de lei
            complementar, propostas de emenda à Constituição e outros), do mais recente ao mais antigo. Use os
            filtros para ver cada grupo; a classificação segue a situação oficial de cada projeto
            {casa === "al-sp" && " (na ALESP, o andamento oficial que define o desfecho, como a publicação da lei)"}.
          </p>
          <p className={styles.desfechoResumo}>
            <strong>{n(porDesfecho.lei)}</strong> {porDesfecho.lei === 1 ? "virou lei" : "viraram lei"} de {n(total)}{" "}
            apresentados.{" "}
            <span>
              {n(porDesfecho.rejeitado)} {porDesfecho.rejeitado === 1 ? "rejeitado" : "rejeitados"};{" "}
              {porDesfecho.caducou > 0 && `${n(porDesfecho.caducou)} perderam a validade ou foram revogados; `}
              {n(porDesfecho.arquivado)} arquivados ou retirados; {n(porDesfecho.tramitando)} em tramitação
              {porDesfecho.sem > 0 && `; ${n(porDesfecho.sem)} sem situação informada pela fonte`}.
            </span>
          </p>
          <ListaFiltrada
            endpoint={`/api/parlamentar/${id}/projetos`}
            total={total}
            porCategoria={porDesfecho}
            iniciais={projetos}
            porPagina={PROJETOS_POR_PAGINA}
          />
        </>
      )}
    </section>
  );
}

export function PresencaSessoes({ casa, presenca }: { casa: CasaId; presenca: Presenca }) {
  const { sessoes, presencas, ausenciasJustificadas, ausencias, faltas } = presenca;
  return (
    <section className={styles.secao}>
      <h2>Presença em sessões deliberativas</h2>
      {casa === "senado" ? (
        <p className={styles.nota}>{PRESENCA_SENADO}</p>
      ) : sessoes === 0 ? (
        <p className={styles.nota}>Nenhuma sessão deliberativa do plenário registrada para este deputado.</p>
      ) : (
        <>
          <p className={styles.nota}>
            Registro oficial de frequência {casa === "camara" ? "da Câmara" : `da ${SIGLA_CASA[casa].na.slice(3)}`}{" "}
            {sessoes === 1 ? "na única sessão deliberativa" : `nas ${sessoes} sessões deliberativas`} do plenário
            carregada{sessoes === 1 ? "" : "s"} até agora
            {presenca.primeiraSessao && `, desde ${dataCurta.format(new Date(presenca.primeiraSessao))}`}.
            O recesso parlamentar é coletivo e não conta como ausência
            {casa === "al-sp" &&
              "; períodos de licença também não. Ausência em missão oficial (comissão de representação, CPI, audiência pública) conta como justificada, com o motivo"}
            .
          </p>
          <dl className={styles.contagem}>
            <div>
              <dt>Presença</dt>
              <dd>{presencas}</dd>
            </div>
            <div>
              <dt>Ausência justificada</dt>
              <dd>{ausenciasJustificadas}</dd>
            </div>
            <div>
              <dt>Ausência sem justificativa registrada</dt>
              <dd>{ausencias}</dd>
            </div>
          </dl>
          {faltas.length > 0 && (
            <details className={styles.detalhes}>
              <summary>Ver as ausências{faltas.length < ausencias + ausenciasJustificadas && " mais recentes"}</summary>
              <ul className={styles.faltas}>
                {faltas.map((f) => (
                  <li key={f.sessao}>
                    <time dateTime={f.data}>{dataCurta.format(new Date(f.data))}</time>
                    <span>{f.situacao}</span>
                    {f.justificativa && <span className={styles.justificativa}>{f.justificativa}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

export function Afastamentos({
  casa,
  afastamentos,
  tempoMandatoAtual,
}: {
  casa: string;
  afastamentos: Afastamento[];
  tempoMandatoAtual: { diasAfastado: number; diasDecorridos: number } | null;
}) {
  return (
    <section className={styles.secao}>
      <h2>Afastamentos e licenças</h2>
      {tempoMandatoAtual && (
        <p className={styles.desfechoResumo}>
          No mandato atual:{" "}
          <strong>
            {tempoMandatoAtual.diasAfastado === 0
              ? "nenhum dia afastado"
              : `${numero.format(tempoMandatoAtual.diasAfastado)} ${tempoMandatoAtual.diasAfastado === 1 ? "dia" : "dias"} afastado`}
          </strong>{" "}
          <span>
            de {numero.format(tempoMandatoAtual.diasDecorridos)} dias de mandato até hoje. Nos mandatos anteriores, o
            tempo afastado aparece na tabela de legislaturas abaixo.
          </span>
        </p>
      )}
      {afastamentos.length === 0 ? (
        <p className={styles.nota}>
          Nenhum afastamento ou licença registrado {casa === "senado" ? "pelo Senado" : "no histórico da Câmara"}.
        </p>
      ) : (
        <>
          <p className={styles.nota}>
            {casa === "senado"
              ? "Licenças e afastamentos registrados pelo Senado, com o tipo informado pela fonte (inclui missões oficiais de um dia)."
              : "Períodos em que deixou o exercício do mandato, com o motivo registrado pela Câmara."}
          </p>
          <ul className={styles.afastamentos}>
            {afastamentos.map((a) => (
              <li key={`${a.inicio}-${a.motivo}`}>
                <span className={styles.periodo}>
                  {!a.fim
                    ? `desde ${dia.format(new Date(a.inicio))}`
                    : a.fim === a.inicio
                      ? dia.format(new Date(a.inicio))
                      : `${dia.format(new Date(a.inicio))} a ${dia.format(new Date(a.fim))}`}
                </span>
                <span>{(a.motivo ?? "").replace(/^Saída - /, "")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
