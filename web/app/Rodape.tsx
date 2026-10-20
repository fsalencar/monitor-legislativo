import Link from "next/link";
import { getUltimaAtualizacao } from "@/lib/plenario";

export default async function Rodape() {
  const atualizado = await getUltimaAtualizacao();
  const atualizadoEm = atualizado
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(atualizado))
    : null;

  return (
    <footer className="rodape">
      <div className="moldura">
        <p className="rodapeApoio">
          <Link href="/doacao">Ajude o projeto: faça sua contribuição</Link>
        </p>
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
        <nav className="rodapeLinks" aria-label="Sobre o site">
          <Link href="/sobre">Sobre o projeto</Link>
          <Link href="/privacidade">Política de privacidade</Link>
          <Link href="/doacao">Contribuir</Link>
        </nav>
      </div>
    </footer>
  );
}
