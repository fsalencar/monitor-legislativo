import type { MetadataRoute } from "next";
import { getIdsEmExercicio } from "@/lib/perfil";
import { getIdsProposicoesVotadas } from "@/lib/proposicao";
import { SITE } from "./robots";

// Mapa do site para os buscadores: páginas fixas, parlamentares em exercício e proposições com
// votação nominal.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [parlamentares, proposicoes] = await Promise.all([getIdsEmExercicio(), getIdsProposicoesVotadas()]);
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/proposicoes`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/sobre`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/privacidade`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/doacao`, changeFrequency: "yearly", priority: 0.3 },
    ...parlamentares.map((id) => ({ url: `${SITE}/parlamentar/${id}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...proposicoes.map((id) => ({ url: `${SITE}/proposicao/${id}`, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
