import postgres from "postgres";

// Conexão só no servidor. prepare: false porque o pooler do Supabase não suporta prepared statements.
export const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 3,
  connection: { TimeZone: "America/Sao_Paulo" },
});
