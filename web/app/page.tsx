import { getPlenario, getUltimaAtualizacao, SEM_PARTIDO } from "@/lib/plenario";
import Plenario from "./Plenario";

// Nº de cores categóricas validadas para daltonismo; demais partidos ficam em cinza.
const SLOTS = 8;

export default async function Home() {
  const [senado, camara, atualizado] = await Promise.all([
    getPlenario("senado"),
    getPlenario("camara"),
    getUltimaAtualizacao(),
  ]);

  // Cor por partido, igual nas duas casas: os 8 maiores somando as cadeiras recebem um slot fixo.
  const total = new Map<string, number>();
  for (const p of [...senado, ...camara]) {
    if (p.partido !== SEM_PARTIDO) total.set(p.partido, (total.get(p.partido) ?? 0) + 1);
  }
  const slots = Object.fromEntries(
    [...total.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .slice(0, SLOTS)
      .map(([partido], i) => [partido, i + 1]),
  );

  const atualizadoEm = atualizado
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(atualizado))
    : null;

  return (
    <>
      <main className="moldura">
        <Plenario casas={{ senado, camara }} slots={slots} />
      </main>
      <footer className="rodape">
        <div className="moldura">
          <p>
            Fontes:{" "}
            <a href="https://dadosabertos.camara.leg.br" target="_blank" rel="noopener noreferrer">
              Dados Abertos da Câmara dos Deputados
            </a>{" "}
            e{" "}
            <a href="https://legis.senado.leg.br/dadosabertos" target="_blank" rel="noopener noreferrer">
              Dados Abertos do Senado Federal
            </a>
            .{atualizadoEm && ` Atualizado em ${atualizadoEm}.`}
          </p>
          <p>Site independente, sem vínculo com partidos, parlamentares ou governos.</p>
        </div>
      </footer>
    </>
  );
}
