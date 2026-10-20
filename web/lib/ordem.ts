import type { Parlamentar } from "./plenario";

// Sem partido e partido não informado pela fonte vão por último.
const POR_ULTIMO = new Set(["Sem partido", "Partido não informado"]);

export type ContagemPartido = { sigla: string; cadeiras: number };

// Partidos do maior para o menor; empate em ordem alfabética; "Sem partido" por último.
export function contarPartidos(parlamentares: Parlamentar[]): ContagemPartido[] {
  const cont = new Map<string, number>();
  for (const p of parlamentares) cont.set(p.partido, (cont.get(p.partido) ?? 0) + 1);
  return [...cont.entries()]
    .map(([sigla, cadeiras]) => ({ sigla, cadeiras }))
    .sort(
      (a, b) =>
        Number(POR_ULTIMO.has(a.sigla)) - Number(POR_ULTIMO.has(b.sigla)) ||
        b.cadeiras - a.cadeiras ||
        a.sigla.localeCompare(b.sigla, "pt-BR"),
    );
}

// Ordem das cadeiras no hemiciclo: blocos de partido nessa ordem, nomes em ordem alfabética.
export function ordenarCadeiras(parlamentares: Parlamentar[], partidos: ContagemPartido[]): Parlamentar[] {
  const ordem = new Map(partidos.map((p, i) => [p.sigla, i]));
  return [...parlamentares].sort(
    (a, b) => ordem.get(a.partido)! - ordem.get(b.partido)! || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
