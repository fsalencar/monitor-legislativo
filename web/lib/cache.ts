import { cacheLife, cacheTag } from "next/cache";

// Etiqueta de todos os dados vindos do banco. A ingestão chama /api/revalidar ao gravar dados
// novos, e o site descarta o cache na hora em vez de esperar ele expirar (1 hora).
export const TAG_DADOS = "dados";

/** Usar no início de toda função com "use cache" que lê o banco. */
export function cacheDados() {
  cacheLife("hours");
  cacheTag(TAG_DADOS);
}
