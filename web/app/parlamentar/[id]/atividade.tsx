import type { Afastamento, Presenca, ProjetoAutoria } from "@/lib/perfil";
import styles from "./perfil.module.css";

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const mesAno = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });

const SO_CAMARA = "Ainda não carregado para o Senado.";

export function Autoria({ casa, total, projetos }: { casa: string; total: number; projetos: ProjetoAutoria[] }) {
  return (
    <section className={styles.secao}>
      <h2>Projetos de autoria</h2>
      {casa === "senado" ? (
        <p className={styles.nota}>{SO_CAMARA}</p>
      ) : total === 0 ? (
        <p className={styles.nota}>Nenhum projeto de autoria registrado na Câmara.</p>
      ) : (
        <>
          <p className={styles.nota}>
            {total} {total === 1 ? "projeto" : "projetos"} em que é autor ou coautor (projetos de lei, de lei
            complementar, propostas de emenda à Constituição e outros), do mais recente ao mais antigo.
            {total > projetos.length && ` Aqui aparecem os ${projetos.length} mais recentes.`}
          </p>
          <ul className={styles.projetos}>
            {projetos.map((pr) => (
              <li key={pr.url}>
                <a href={pr.url} target="_blank" rel="noopener noreferrer" className={styles.prop}>
                  {pr.sigla}
                </a>
                {pr.resumo ? (
                  <>
                    <p className={styles.resumo}>{pr.resumo}</p>
                    <p className={styles.rotuloIa}>Resumo gerado por IA a partir da ementa oficial: {pr.ementa}</p>
                  </>
                ) : (
                  pr.ementa && <p className={styles.ementa}>{pr.ementa}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function PresencaSessoes({ casa, presenca }: { casa: string; presenca: Presenca }) {
  const { sessoes, presencas, ausenciasJustificadas, ausencias, faltas } = presenca;
  return (
    <section className={styles.secao}>
      <h2>Presença em sessões deliberativas</h2>
      {casa === "senado" ? (
        <p className={styles.nota}>{SO_CAMARA}</p>
      ) : sessoes === 0 ? (
        <p className={styles.nota}>Nenhuma sessão deliberativa do plenário registrada para este deputado.</p>
      ) : (
        <>
          <p className={styles.nota}>
            Registro oficial de frequência da Câmara{" "}
            {sessoes === 1 ? "na única sessão deliberativa" : `nas ${sessoes} sessões deliberativas`} do plenário
            carregada{sessoes === 1 ? "" : "s"} até agora
            {presenca.primeiraSessao && `, desde ${dataCurta.format(new Date(presenca.primeiraSessao))}`}.
            O recesso parlamentar é coletivo e não conta como ausência.
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

export function Afastamentos({ casa, afastamentos }: { casa: string; afastamentos: Afastamento[] }) {
  return (
    <section className={styles.secao}>
      <h2>Afastamentos e licenças</h2>
      {casa === "senado" ? (
        <p className={styles.nota}>{SO_CAMARA}</p>
      ) : afastamentos.length === 0 ? (
        <p className={styles.nota}>Nenhum afastamento ou licença registrado no histórico da Câmara.</p>
      ) : (
        <>
          <p className={styles.nota}>
            Períodos em que deixou o exercício do mandato, com o motivo registrado pela Câmara.
          </p>
          <ul className={styles.afastamentos}>
            {afastamentos.map((a) => (
              <li key={`${a.inicio}-${a.motivo}`}>
                <span className={styles.periodo}>
                  {mesAno.format(new Date(a.inicio))} a {a.fim ? mesAno.format(new Date(a.fim)) : "hoje"}
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
