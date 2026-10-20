import { getVotosPagina, idDoParametro } from "@/lib/perfil";

// Próximos votos de um parlamentar: ?inicio=N&quantos=10 (ou quantos=todos).
export async function GET(request: Request, ctx: RouteContext<"/api/parlamentar/[id]/votos">) {
  const id = idDoParametro((await ctx.params).id);
  const busca = new URL(request.url).searchParams;
  const inicio = Math.max(0, Number(busca.get("inicio")) || 0);
  const pedido = busca.get("quantos");
  const quantos = pedido === "todos" ? null : Math.min(Math.max(1, Number(pedido) || 10), 100);
  if (!id) return Response.json({ erro: "parlamentar inválido" }, { status: 404 });
  return Response.json(await getVotosPagina(id, inicio, quantos));
}
