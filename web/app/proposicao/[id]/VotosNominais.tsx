"use client";

import Link from "next/link";
import { useState } from "react";
import type { VotoNominal } from "@/lib/proposicao";
import styles from "./proposicao.module.css";

// Lista nominal de uma votação, buscada só quando a pessoa pede (pode ter mais de 500 nomes).
export function VotosNominais({ votacaoId }: { votacaoId: number }) {
  const [votos, setVotos] = useState<VotoNominal[] | null>(null);
  const [estado, setEstado] = useState<"ocioso" | "carregando" | "erro">("ocioso");
  const [filtro, setFiltro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  async function carregar() {
    setEstado("carregando");
    try {
      const r = await fetch(`/api/votacao/${votacaoId}/votos`);
      if (!r.ok) throw new Error(String(r.status));
      setVotos(await r.json());
      setEstado("ocioso");
    } catch {
      setEstado("erro");
    }
  }

  if (!votos) {
    return (
      <div className={styles.nominal}>
        <button className={styles.botao} onClick={carregar} disabled={estado === "carregando"}>
          {estado === "carregando" ? "Carregando…" : "Ver o voto de cada parlamentar"}
        </button>
        {estado === "erro" && <p className={styles.erro}>Não foi possível carregar os votos. Tente de novo.</p>}
      </div>
    );
  }

  const valores = [...new Set(votos.map((v) => v.voto))];
  const termo = normaliza(busca.trim());
  const visiveis = votos.filter(
    (v) => (filtro === null || v.voto === filtro) && (!termo || normaliza(v.nome).includes(termo)),
  );

  return (
    <div className={styles.nominal}>
      <div className={styles.filtros} role="group" aria-label="Filtrar por voto">
        {[null, ...valores].map((valor) => (
          <button key={valor ?? "todos"} aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>
            {valor ?? "Todos"} <span>{valor ? votos.filter((v) => v.voto === valor).length : votos.length}</span>
          </button>
        ))}
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome"
          aria-label="Buscar parlamentar pelo nome"
        />
      </div>
      <ul className={styles.listaNominal}>
        {visiveis.map((v) => (
          <li key={v.parlamentarId}>
            <Link href={`/parlamentar/${v.parlamentarId}`}>{v.nome}</Link>
            <span>{[v.partido, v.uf].filter(Boolean).join("/")}</span>
            <span data-voto={v.voto}>{v.voto}</span>
          </li>
        ))}
      </ul>
      {visiveis.length === 0 && <p className={styles.erro}>Nenhum parlamentar com esse filtro.</p>}
    </div>
  );
}

function normaliza(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
