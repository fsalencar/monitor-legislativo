import type { CasaId } from "@/lib/casas";
import type { Gastos } from "@/lib/perfil";
import styles from "./perfil.module.css";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Nome oficial da cota/verba em cada casa; casas sem gastos carregados não mostram a seção.
const NOME_COTA: Partial<Record<CasaId, string>> = {
  camara: "Cota para o Exercício da Atividade Parlamentar (CEAP) da Câmara",
  senado: "Cota para o Exercício da Atividade Parlamentar dos Senadores (CEAPS)",
  "al-sp": "verba de despesas de gabinete da ALESP",
};

export function temGastos(casa: CasaId): boolean {
  return Boolean(NOME_COTA[casa]);
}

export function GastosCota({ casa, gastos, urlFonte }: { casa: CasaId; gastos: Gastos; urlFonte: string }) {
  const cota = NOME_COTA[casa];
  if (!cota) return null;
  const { total, documentos, desde, ate, porAno, porCategoria, anteriores } = gastos;
  return (
    <section id="gastos" className={styles.secao}>
      <h2>Gastos da cota parlamentar</h2>
      {total === 0 ? (
        <p className={styles.nota}>Nenhum gasto registrado na {cota} desde 2023.</p>
      ) : (
        <>
          <p className={styles.desfechoResumo}>
            <strong>{reais.format(total)}</strong>{" "}
            <span>
              reembolsados de {desde && mesAno(desde)} a {ate && mesAno(ate)}, em {numero.format(documentos)}{" "}
              {documentos === 1 ? "documento" : "documentos"}.
            </span>
          </p>
          <p className={styles.nota}>
            Valores reembolsados pela {cota}, somados por mês e categoria a partir dos dados abertos oficiais.{" "}
            {casa === "al-sp"
              ? "A verba é um valor mensal para despesas do gabinete, como escritório, combustível e divulgação."
              : "A cota é um valor mensal para despesas do mandato, como escritório, passagens e divulgação; o limite varia por estado."}{" "}
            Lançamentos podem entrar com atraso. As notas de cada gasto estão na{" "}
            <a href={urlFonte} target="_blank" rel="noopener noreferrer">
              página oficial
            </a>
            .
          </p>
          <div className={styles.tabelaRolagem}>
            <table className={styles.tabela}>
              <caption className={styles.legendaGastos}>
                Por ano{anteriores.length > 0 && " (antes de 2023, só o total do ano; o detalhe está na fonte oficial)"}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col" className={styles.valor}>
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...anteriores, ...porAno].map((a) => (
                  <tr key={a.ano}>
                    <td>{a.ano}</td>
                    <td className={styles.valor}>{reais.format(a.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tabelaRolagem}>
            <table className={styles.tabela}>
              <caption className={styles.legendaGastos}>Por categoria, no período</caption>
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  <th scope="col" className={styles.valor}>
                    Valor
                  </th>
                  <th scope="col" className={styles.valor}>
                    Documentos
                  </th>
                </tr>
              </thead>
              <tbody>
                {porCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td>{primeiraMaiuscula(c.categoria)}</td>
                    <td className={styles.valor}>{reais.format(c.valor)}</td>
                    <td className={styles.valor}>{numero.format(c.documentos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function mesAno({ ano, mes }: { ano: number; mes: number }) {
  return `${MESES[mes - 1]}/${ano}`;
}

// Algumas fontes escrevem as categorias só em maiúsculas ("PASSAGEM AÉREA - SIGEPA").
function primeiraMaiuscula(s: string): string {
  if (s !== s.toUpperCase()) return s;
  const t = s.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
