import { revalidateTag } from "next/cache";
import { TAG_DADOS } from "@/lib/cache";

// Chamado pela ingestão depois de gravar dados novos: descarta o cache para os dados aparecerem
// em seguida. Protegido por REVALIDAR_TOKEN (mesmo valor no ambiente da ingestão).
export async function POST(request: Request) {
  const token = process.env.REVALIDAR_TOKEN;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  // Expira na hora: a próxima visita gera a página de novo (rápido). Com "max" (servir a versão
  // anterior e regenerar em segundo plano), a resposta na Vercel ficava presa até a regeneração
  // terminar, e as páginas demoravam até 1 min depois de cada aviso.
  revalidateTag(TAG_DADOS, { expire: 0 });
  return Response.json({ ok: true, revalidado: TAG_DADOS, em: new Date().toISOString() });
}
