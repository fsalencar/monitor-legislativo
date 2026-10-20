import { waitUntil } from "@vercel/functions";
import postgres from "postgres";

// Conexão só no servidor. prepare: false porque o pooler do Supabase não suporta prepared statements.
// max baixo: o build pré-renderiza em vários processos e o modo session do pooler aceita só 15 clientes.
// Use o pooler em modo SESSION (porta 5432), inclusive na Vercel. Com o modo transaction (6543),
// o Next trava ~1 min na primeira leva de consultas de cada processo: o build falha com "use cache
// took too long" e a primeira página de cada instância fica presa (reproduzido localmente; fora
// do Next o mesmo cliente funciona). Os perfis não são pré-renderizados no build (PARAMS_DE_BUILD).
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
