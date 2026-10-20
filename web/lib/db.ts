import postgres from "postgres";

// Conexão só no servidor. prepare: false porque o pooler do Supabase não suporta prepared statements.
// max baixo: o build pré-renderiza em vários processos e o modo session do pooler aceita só 15 clientes.
// Use o pooler em modo session (porta 5432) também na Vercel: no modo transaction (6543) o build
// trava de forma intermitente esperando respostas que não chegam.
export const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connection: { TimeZone: "America/Sao_Paulo" },
});
