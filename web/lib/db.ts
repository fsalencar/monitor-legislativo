import { waitUntil } from "@vercel/functions";
import postgres from "postgres";

// Conexão só no servidor. prepare: false porque o pooler do Supabase não suporta prepared statements.
// max baixo: o build pré-renderiza em vários processos e o modo session do pooler aceita só 15 clientes.
// Funciona com o pooler em modo session (5432) ou transaction (6543). Os perfis não são
// pré-renderizados no build (ver PARAMS_DE_BUILD em lib/perfil.ts): pré-renderizá-los com o
// modo transaction travava o build de forma intermitente.
const OCIOSO_S = 5;

const cliente = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 2,
  idle_timeout: OCIOSO_S,
  connect_timeout: 10,
  connection: { TimeZone: "America/Sao_Paulo" },
});

// Na Vercel a função é congelada entre requisições; uma conexão aberta nesse momento morre, e a
// próxima consulta fica presa no socket morto até o TCP desistir (~1 min). Como faz o
// attachDatabasePool de @vercel/functions (que não reconhece o postgres.js), cada consulta mantém
// a função viva até o idle_timeout fechar as conexões ociosas.
let fimDaEspera: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function esperarOcioso() {
  if (!process.env.VERCEL) return;
  clearTimeout(timer);
  fimDaEspera?.();
  waitUntil(
    new Promise<void>((resolve) => {
      fimDaEspera = resolve;
      timer = setTimeout(resolve, OCIOSO_S * 1000 + 200);
    }),
  );
}

export const sql = new Proxy(cliente, {
  apply(alvo, este, args: Parameters<typeof cliente>) {
    const consulta = Reflect.apply(alvo, este, args);
    // Só a forma sql`...` executa consulta; sql(valor) monta fragmentos e não é uma promessa.
    if (Array.isArray(args[0]) && "raw" in args[0]) {
      (consulta as Promise<unknown>).then(esperarOcioso, esperarOcioso);
    }
    return consulta;
  },
});
