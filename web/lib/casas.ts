// Casas legislativas (sem dependências de servidor: usado também no navegador).

// Assembleias Legislativas disponíveis (as que publicam dados abertos), por região e na ordem do seletor.
export const ASSEMBLEIAS = [
  { id: "al-sp", uf: "SP", estado: "São Paulo", sigla: "ALESP", regiao: "Sudeste" },
  { id: "al-mg", uf: "MG", estado: "Minas Gerais", sigla: "ALMG", regiao: "Sudeste" },
  { id: "al-es", uf: "ES", estado: "Espírito Santo", sigla: "ALES", regiao: "Sudeste" },
  { id: "al-pb", uf: "PB", estado: "Paraíba", sigla: "ALPB", regiao: "Nordeste" },
  { id: "al-pe", uf: "PE", estado: "Pernambuco", sigla: "ALEPE", regiao: "Nordeste" },
  { id: "al-ac", uf: "AC", estado: "Acre", sigla: "ALEAC", regiao: "Norte" },
  { id: "al-am", uf: "AM", estado: "Amazonas", sigla: "ALEAM", regiao: "Norte" },
  { id: "al-ro", uf: "RO", estado: "Rondônia", sigla: "ALE-RO", regiao: "Norte" },
  { id: "al-rr", uf: "RR", estado: "Roraima", sigla: "ALE-RR", regiao: "Norte" },
  { id: "al-to", uf: "TO", estado: "Tocantins", sigla: "ALETO", regiao: "Norte" },
] as const;

export type Assembleia = (typeof ASSEMBLEIAS)[number]["id"];
export type CasaId = "senado" | "camara" | Assembleia;

export const CASAS: CasaId[] = ["senado", "camara", ...ASSEMBLEIAS.map((a) => a.id)];

export function ehAssembleia(casa: string): casa is Assembleia {
  return ASSEMBLEIAS.some((a) => a.id === casa);
}

// Nome curto de cada casa, para textos como "Página oficial na Câmara".
export const SIGLA_CASA = {
  camara: { na: "na Câmara", nome: "Câmara dos Deputados" },
  senado: { na: "no Senado", nome: "Senado Federal" },
  ...Object.fromEntries(
    ASSEMBLEIAS.map((a) => [a.id, { na: `na ${a.sigla}`, nome: `Assembleia Legislativa ${preposicao(a.uf)} ${a.estado}` }]),
  ),
} as Record<CasaId, { na: string; nome: string }>;

// "de São Paulo", "do Acre", "da Paraíba".
function preposicao(uf: string): string {
  if (["AC", "AM", "ES", "TO", "PA", "AP", "CE", "MA", "PI", "RN", "PR", "RS", "RJ", "MT", "MS", "DF"].includes(uf)) return "do";
  if (["PB", "BA"].includes(uf)) return "da";
  return "de";
}

// Atividade carregada de cada Assembleia (o perfil mostra só o que existe; o resto é explicado).
export type Atividade = { votos: boolean; projetos: boolean; presenca: boolean; afastamentos: boolean };
const NADA: Atividade = { votos: false, projetos: false, presenca: false, afastamentos: false };
const SAPL_COMPLETO: Atividade = { votos: true, projetos: true, presenca: true, afastamentos: false };
export const ATIVIDADE: Record<Assembleia, Atividade> = {
  "al-sp": { votos: true, projetos: true, presenca: true, afastamentos: true },
  "al-am": SAPL_COMPLETO,
  "al-ro": SAPL_COMPLETO,
  "al-pb": SAPL_COMPLETO,
  "al-ac": SAPL_COMPLETO,
  // RR e TO: o SAPL não tem votos nominais nem listas de presença.
  "al-rr": { ...NADA, projetos: true },
  "al-to": { ...NADA, projetos: true },
  "al-mg": NADA,
  "al-es": NADA,
  "al-pe": NADA,
};
