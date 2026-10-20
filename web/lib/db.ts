import postgres from "postgres";

// Conexão só no servidor. prepare: false porque o pooler do Supabase não suporta prepared statements.
// max baixo: o build pré-renderiza em vários processos e o modo session do pooler aceita só 15 clientes.
// Funciona com o pooler em modo session (5432) ou transaction (6543). Os perfis não são
// pré-renderizados no build (ver PARAMS_DE_BUILD em lib/perfil.ts): pré-renderizá-los com o
// modo transaction travava o build de forma intermitente.
export const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connection: { TimeZone: "America/Sao_Paulo" },
});
