import { idDoParametro } from "@/lib/perfil";
import { getVotosDaVotacao } from "@/lib/proposicao";

// Voto de cada parlamentar numa votação (lista nominal, buscada sob demanda na página da proposição).
export async function GET(_request: Request, ctx: RouteContext<"/api/votacao/[id]/votos">) {
  const id = idDoParametro((await ctx.params).id);
  if (!id) return Response.json({ erro: "votação inválida" }, { status: 404 });
  return Response.json(await getVotosDaVotacao(id));
}
