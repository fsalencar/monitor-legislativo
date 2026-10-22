"use client";

import Link from "next/link";
import { useState } from "react";
import type { CasaProposicao, ProposicaoVotadaRecente } from "@/lib/proposicao";
import styles from "../proposicao/[id]/proposicao.module.css";

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const CASAS: { id: CasaProposicao | null; titulo: string }[] = [
  { id: null, titulo: "Todas" },
  { id: "camara", titulo: "Câmara" },
  { id: "senado", titulo: "Senado" },
  { id: "congresso", titulo: "Congresso" },
  { id: "al-sp", titulo: "SP" },
  { id: "al-am", titulo: "AM" },
  { id: "al-pb", titulo: "PB" },
  { id: "al-ro", titulo: "RO" },
  { id: "al-ac", titulo: "AC" },
];

const NOME_CURTO: Partial<Record<CasaProposicao, string>> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
  "al-sp": "Assembleia Legislativa de SP",
  "al-am": "Assembleia Legislativa do AM",
  "al-pb": "Assembleia Legislativa da PB",
  "al-ro": "Assembleia Legislativa de RO",
  "al-ac": "Assembleia Legislativa do AC",
  congresso: "Congresso Nacional",
};

const POR_PAGINA = 10;

// Proposições votadas recentemente, com filtro por casa (os dados vêm todos do servidor).
export function VotadasRecentes({ itens }: { itens: ProposicaoVotadaRecente[] }) {
  const [casa, setCasa] = useState<CasaProposicao | null>(null);
  const [todas, setTodas] = useState(false);
  const filtradas = itens.filter((i) => casa === null || i.casa === casa);
  const visiveis = todas ? filtradas : filtradas.slice(0, POR_PAGINA);

  return (
    <>
      <div className={styles.filtros} role="group" aria-label="Filtrar por casa">
        {CASAS.filter((c) => c.id === null || itens.some((i) => i.casa === c.id)).map((c) => (
          <button
            key={c.titulo}
            aria-pressed={casa === c.id}
            onClick={() => {
              setCasa(c.id);
              setTodas(false);
            }}
          >
            {c.titulo}
          </button>
        ))}
      </div>
      <ul className={styles.resultados}>
        {visiveis.map((p) => (
          <li key={p.id}>
            <Link href={`/proposicao/${p.id}`} className={styles.resultado}>
              <span className={styles.resultadoTopo}>
                <strong>{p.sigla}</strong>
                <span>{NOME_CURTO[p.casa]}</span>
                {p.votacoesNominais > 1 && <span>{p.votacoesNominais} votações nominais</span>}
              </span>
              {p.ementa && <span className={styles.resultadoEmenta}>{p.ementa}</span>}
              <span className={styles.ultimaVotacao}>
                Última votação nominal{p.dataHora && `, ${dataCurta.format(new Date(p.dataHora))}`}
                {p.aprovada !== null && (
                  <>
                    {": "}
                    <b>{p.aprovada ? "aprovado" : "rejeitado"}</b>
                  </>
                )}
                {p.secreta ? " (votação secreta)" : ` · Sim ${p.sim} · Não ${p.nao}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!todas && filtradas.length > POR_PAGINA && (
        <button className={styles.botao} onClick={() => setTodas(true)}>
          Mostrar mais {filtradas.length - POR_PAGINA}
        </button>
      )}
    </>
  );
}
