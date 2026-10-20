import { revalidateTag } from "next/cache";
import { TAG_DADOS } from "@/lib/cache";

// Chamado pela ingestão depois de gravar dados novos: descarta o cache para os dados aparecerem
// em seguida. Protegido por REVALIDAR_TOKEN (mesmo valor no ambiente da ingestão).
export async function POST(request: Request) {
  const token = process.env.REVALIDAR_TOKEN;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  // "max": quem chegar logo depois ainda recebe a versão anterior enquanto a nova é gerada.
  revalidateTag(TAG_DADOS, "max");
  return Response.json({ ok: true, revalidado: TAG_DADOS, em: new Date().toISOString() });
}
