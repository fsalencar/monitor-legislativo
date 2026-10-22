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
  // plenarioaberto.org (sem www) leva ao www, menos o /ads.txt: o AdSense verifica o arquivo no
  // domínio principal e ele responde ali mesmo, sem redirecionamento.
  async redirects() {
    return [
      {
        source: "/:caminho((?!ads\.txt$).*)",
        has: [{ type: "host", value: "plenarioaberto.org" }],
        destination: "https://www.plenarioaberto.org/:caminho",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
