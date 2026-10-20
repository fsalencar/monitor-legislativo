// Casas legislativas (sem dependências de servidor: usado também no navegador).

export type CasaId = "senado" | "camara" | "al-sp" | "al-mg";
export type Assembleia = "al-sp" | "al-mg";

export function ehAssembleia(casa: CasaId): casa is Assembleia {
  return casa === "al-sp" || casa === "al-mg";
}

// Nome curto de cada casa, para textos como "Página oficial na Câmara".
export const SIGLA_CASA: Record<CasaId, { na: string; nome: string }> = {
  camara: { na: "na Câmara", nome: "Câmara dos Deputados" },
  senado: { na: "no Senado", nome: "Senado Federal" },
  "al-sp": { na: "na ALESP", nome: "Assembleia Legislativa de São Paulo" },
  "al-mg": { na: "na ALMG", nome: "Assembleia Legislativa de Minas Gerais" },
};
