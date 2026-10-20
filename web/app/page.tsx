import { getPlenario, getUltimaAtualizacao } from "@/lib/plenario";
import Plenario from "./Plenario";

export default async function Home() {
  const [senado, camara, atualizado] = await Promise.all([
    getPlenario("senado"),
    getPlenario("camara"),
    getUltimaAtualizacao(),
  ]);

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
        <Plenario casas={{ senado, camara }} />
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
