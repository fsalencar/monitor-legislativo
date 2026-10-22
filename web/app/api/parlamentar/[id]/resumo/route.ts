import { getResumoCurto, idDoParametro } from "@/lib/perfil";

// Números do cartão do plenário (buscados quando a cadeira é selecionada).
export async function GET(_request: Request, ctx: RouteContext<"/api/parlamentar/[id]/resumo">) {
  const id = idDoParametro((await ctx.params).id);
  if (!id) return Response.json({ erro: "parlamentar inválido" }, { status: 404 });
  return Response.json(await getResumoCurto(id));
}
