// Cor de cada partido: a mais próxima da identidade visual do próprio partido
// (referência: módulos "Political party" da Wikipédia em inglês), ajustada para
// não repetir cor entre partidos da mesma família e para ler sobre o fundo escuro.
// Partido sem cor aqui aparece no cinza neutro.
export const COR_PARTIDO: Record<string, string> = {
  // Azuis
  PL: "#1f6fd1",
  PSDB: "#5470f0",
  REPUBLICANOS: "#35a2e8",
  "UNIÃO": "#6fd6f7",
  PP: "#8aa3dc",
  DC: "#3d84ad",
  // Vermelhos
  PT: "#e20e28",
  PSOL: "#ff7a59",
  PCdoB: "#b8323a",
  PDT: "#d0346b",
  // Amarelos e laranjas
  PSB: "#ffd60a",
  PSD: "#ffa500",
  NOVO: "#f3701b",
  SOLIDARIEDADE: "#c98a45",
  // Verdes
  MDB: "#30914d",
  PODE: "#4fd14f",
  PV: "#a3d14a",
  PRD: "#6fae86",
  REDE: "#3aa595",
  AVANTE: "#12bfbf",
  "MISSÃO": "#d9e26a",
  // Outros
  CIDADANIA: "#ec008c",
};

export const COR_SEM_IDENTIDADE = "#6b7385";

export function corDoPartido(sigla: string): string {
  return COR_PARTIDO[sigla] ?? COR_SEM_IDENTIDADE;
}
