import { SIGLA_CASA, type CasaId } from "@/lib/casas";
import type { CasaProposicao } from "@/lib/proposicao";

export function nomeDaCasa(casa: CasaProposicao): string {
  return casa === "congresso" ? "Congresso Nacional" : SIGLA_CASA[casa as CasaId].nome;
}
