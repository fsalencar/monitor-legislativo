import { DESFECHOS, getProjetosPagina, idDoParametro, type Desfecho } from "@/lib/perfil";

// Projetos de autoria: ?desfecho=lei|rejeitado|arquivado|tramitando|sem (opcional)&inicio=N&quantos=15|todos.
export async function GET(request: Request, ctx: RouteContext<"/api/parlamentar/[id]/projetos">) {
  const id = idDoParametro((await ctx.params).id);
  if (!id) return Response.json({ erro: "parlamentar inválido" }, { status: 404 });
  const busca = new URL(request.url).searchParams;
  const pedido = busca.get("desfecho");
  const desfecho = DESFECHOS.includes(pedido as Desfecho) ? (pedido as Desfecho) : null;
  const inicio = Math.max(0, Number(busca.get("inicio")) || 0);
  const q = busca.get("quantos");
  const quantos = q === "todos" ? null : Math.min(Math.max(1, Number(q) || 15), 100);
  return Response.json(await getProjetosPagina(id, desfecho, inicio, quantos));
}
