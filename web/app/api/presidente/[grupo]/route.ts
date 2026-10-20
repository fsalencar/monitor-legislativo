import { getItensPresidencia, GRUPOS, type Grupo } from "@/lib/presidente";

// Itens da Presidência: /api/presidente/{projetos|mpv|vetos}?desfecho=...&inicio=N&quantos=15|todos.
export async function GET(request: Request, ctx: RouteContext<"/api/presidente/[grupo]">) {
  const grupo = (await ctx.params).grupo as Grupo;
  if (!GRUPOS.includes(grupo)) return Response.json({ erro: "grupo inválido" }, { status: 404 });
  const busca = new URL(request.url).searchParams;
  const categoria = busca.get("desfecho")?.replace(/[^a-z]/g, "") || null;
  const inicio = Math.max(0, Number(busca.get("inicio")) || 0);
  const q = busca.get("quantos");
  const quantos = q === "todos" ? null : Math.min(Math.max(1, Number(q) || 15), 100);
  return Response.json(await getItensPresidencia(grupo, categoria, inicio, quantos));
}
