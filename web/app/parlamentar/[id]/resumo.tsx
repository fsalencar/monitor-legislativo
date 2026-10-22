import { SIGLA_CASA } from "@/lib/casas";
import type { Autorias, Gastos, Perfil, Presenca } from "@/lib/perfil";
import styles from "./perfil.module.css";

const numero = new Intl.NumberFormat("pt-BR");
// Valores grandes abreviados no resumo ("R$ 1,56 mi"); o valor exato fica na seção de gastos.
const reaisCurto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 2,
});
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Item = { valor: string; rotulo: string; href: string };

// Números principais do perfil, cada um levando à seção com o detalhe e a explicação.
// Só dados oficiais, sem comparação com outros parlamentares; cada item aparece só quando a fonte tem o dado.
export function Resumo({
  p,
  autoria,
  presenca,
  tempoMandatoAtual,
  gastos,
}: {
  p: Perfil;
  autoria: Autorias;
  presenca: Presenca;
  tempoMandatoAtual: { diasAfastado: number; diasDecorridos: number } | null;
  gastos: Gastos;
}) {
  const itens: Item[] = [];
  const atual = p.legislaturas.find((l) => l.situacao === "em curso");

  if (autoria.total > 0 && autoria.porDesfecho.lei === 0 && autoria.porDesfecho.aprovado > 0) {
    // A Assembleia não registra as leis no sistema: mostra o que dá para afirmar.
    itens.push({
      valor: `${numero.format(autoria.porDesfecho.aprovado)} de ${numero.format(autoria.total)}`,
      rotulo: "projetos de autoria aprovados pela Assembleia",
      href: "#projetos",
    });
  } else if (autoria.total > 0) {
    itens.push({
      valor: `${numero.format(autoria.porDesfecho.lei)} de ${numero.format(autoria.total)}`,
      rotulo: "projetos de autoria que viraram lei",
      href: "#projetos",
    });
  }
  if (p.totalVotos > 0) {
    itens.push({ valor: numero.format(p.totalVotos), rotulo: "votos em votações nominais registrados", href: "#votos" });
  }
  if (presenca.sessoes > 0) {
    itens.push({
      valor: `${numero.format(presenca.presencas)} de ${numero.format(presenca.sessoes)}`,
      rotulo: "sessões deliberativas com presença registrada",
      href: "#presenca",
    });
  }
  if (tempoMandatoAtual && p.emExercicio) {
    itens.push({
      valor: numero.format(tempoMandatoAtual.diasAfastado),
      rotulo: `${tempoMandatoAtual.diasAfastado === 1 ? "dia afastado" : "dias afastado"} no mandato atual`,
      href: "#afastamentos",
    });
  }

  if (gastos.porMes.length > 0 || gastos.anteriores.length > 0) {
    if (atual) {
      const [ano, mes] = atual.inicio.split("-").map(Number);
      const naLegislatura = gastos.porMes
        .filter((m) => m.ano * 100 + m.mes >= ano * 100 + mes)
        .reduce((s, m) => s + m.valor, 0);
      itens.push({
        valor: reaisCurto.format(naLegislatura),
        rotulo: `gastos da cota na legislatura atual (desde ${MESES[mes - 1]}/${ano})`,
        href: "#gastos-inicio",
      });
    }
    const total = gastos.porMes.reduce((s, m) => s + m.valor, 0) + gastos.anteriores.reduce((s, a) => s + a.valor, 0);
    const desde = Math.min(...gastos.anteriores.map((a) => a.ano), ...gastos.porMes.map((m) => m.ano));
    if (gastos.anteriores.length > 0) {
      itens.push({ valor: reaisCurto.format(total), rotulo: `gastos da cota ${SIGLA_CASA[p.casa].na} desde ${desde}`, href: "#gastos-inicio" });
    }
  }

  if (itens.length === 0) return null;
  return (
    <section aria-label="Resumo" className={styles.resumoPerfil}>
      <ul>
        {itens.map((i) => (
          <li key={i.rotulo}>
            <a href={i.href}>
              <strong>{i.valor}</strong>
              <span>{i.rotulo}</span>
            </a>
          </li>
        ))}
      </ul>
      <p>Números das fontes oficiais. Toque em cada um para ver o detalhe e como é contado.</p>
    </section>
  );
}
