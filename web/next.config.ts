import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Em desenvolvimento, reaproveita o .env da raiz do repositório (o mesmo da ingestão).
// Na Vercel, DATABASE_URL vem das variáveis de ambiente do projeto e este arquivo não existe.
const envRaiz = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envRaiz)) {
  for (const linha of fs.readFileSync(envRaiz, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (m && !linha.trimStart().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
