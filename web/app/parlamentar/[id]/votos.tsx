"use client";

import { useState } from "react";
import Link from "next/link";
import { GLOSSARIO } from "@/lib/glossario";
import type { ProposicaoVotada, VotoRegistrado } from "@/lib/perfil";
import styles from "./perfil.module.css";


const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

// Lista de votos que começa com os primeiros e busca o resto sob demanda: mais N, ou todos.
export function VotosLista({
  id,
  iniciais,
  total,
  porPagina,
  partidoAtual,
}: {
  id: number;
  iniciais: VotoRegistrado[];
  total: number;
  porPagina: number;
  partidoAtual: string | null;
}) {
  const [votos, setVotos] = useState(iniciais);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const restantes = total - votos.length;

  async function carregar(quantos: number | "todos") {
    setCarregando(true);
    setErro(false);
    try {
      const r = await fetch(`/api/parlamentar/${id}/votos?inicio=${votos.length}&quantos=${quantos}`);
      if (!r.ok) throw new Error(String(r.status));
      const novos: VotoRegistrado[] = await r.json();
      setVotos((atuais) => [...atuais, ...novos]);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  const usados = [...new Set(votos.map((v) => v.voto))].filter((v) => GLOSSARIO[v]);

  return (
    <>
      <ol className={styles.votos}>
        {votos.map((v) => (
          <ItemVoto key={v.votacaoId} v={v} partidoAtual={partidoAtual} />
        ))}
      </ol>

      {restantes > 0 && (
        <div className={styles.maisVotos} aria-live="polite">
          <p>
            Mostrando {votos.length} de {total} votos.
          </p>
          <button className={styles.todos} onClick={() => carregar(porPagina)} disabled={carregando}>
            {carregando ? "Carregando…" : `Mostrar mais ${Math.min(porPagina, restantes)}`}
          </button>
          <button className={styles.botaoSecundario} onClick={() => carregar("todos")} disabled={carregando}>
            Mostrar todos ({total})
          </button>
          {erro && <p className={styles.erro}>Não foi possível carregar os votos. Tente de novo.</p>}
        </div>
      )}

      {usados.length > 0 && (
        <dl className={styles.glossario}>
          {usados.map((v) => (
            <div key={v}>
              <dt>{v}</dt>
              <dd>{GLOSSARIO[v]}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

function ItemVoto({ v, partidoAtual }: { v: VotoRegistrado; partidoAtual: string | null }) {
  return (
    <li className={styles.voto}>
      <div className={styles.votoValor} data-voto={v.voto}>
        {v.voto}
      </div>
      <div className={styles.votoCorpo}>
        <p className={styles.votoMeta}>
          {v.dataHora && <time dateTime={v.dataHora}>{dataCurta.format(new Date(v.dataHora))}</time>}
          {v.orgao && v.orgao !== "PLEN" && <span>{v.orgao}</span>}
          {v.proposicoes.map((pr) => (
            <Link key={pr.id} href={`/proposicao/${pr.id}`} className={styles.prop} title="Ver a proposição e todas as votações">
              {pr.sigla}
            </Link>
          ))}
        </p>
        {v.descricao && <p className={styles.votoDescricao}>{v.descricao}</p>}
        <SobreProjeto p={principal(v.proposicoes)} />
        <p className={styles.votoRodape}>
          {/* Federação que inclui o partido atual (ALESP: "FED PT/PC DO B/PV") não é mudança de partido. */}
          {v.partidoNoVoto && !(partidoAtual && v.partidoNoVoto.includes(partidoAtual)) && (
            <span>Partido ou federação na data: {v.partidoNoVoto}. </span>
          )}
          <a href={v.urlFonte} target="_blank" rel="noopener noreferrer">
            Registro oficial da votação
          </a>
        </p>
      </div>
    </li>
  );
}

// Tipos que são o projeto em si; requerimentos, pareceres e emendas são etapas da tramitação.
const TIPOS_PRINCIPAIS = new Set(["PL", "PLS", "PLP", "PEC", "MPV", "PLV", "PDL", "PDC", "PDS", "PRC", "PRS", "PLN"]);

function principal(proposicoes: ProposicaoVotada[]): ProposicaoVotada | null {
  return proposicoes.find((p) => TIPOS_PRINCIPAIS.has(p.tipo)) ?? proposicoes[0] ?? null;
}

function SobreProjeto({ p }: { p: ProposicaoVotada | null }) {
  if (!p || (!p.ementa && !p.resumo)) return null;
  const temas = p.temas
    ?.split(/[,;]/)
    .map((t) => t.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 6);
  return (
    <div className={styles.sobre}>
      {p.resumo && (
        <>
          <p className={styles.resumo}>{p.resumo}</p>
          <p className={styles.rotuloIa}>Resumo em linguagem simples, gerado por IA a partir da ementa oficial abaixo.</p>
        </>
      )}
      {p.ementa && (
        <p className={p.resumo ? styles.ementaOficial : styles.ementa}>
          {p.resumo && <span>Ementa oficial ({p.sigla}): </span>}
          {p.ementa}
        </p>
      )}
      {(temas?.length || p.situacao || p.urlTexto) && (
        <dl className={styles.fichaProjeto}>
          {temas && temas.length > 0 && (
            <div>
              <dt>Temas</dt>
              <dd>{temas.join(", ")}</dd>
            </div>
          )}
          {p.situacao && (
            <div>
              <dt>Situação atual</dt>
              <dd>{p.situacao}</dd>
            </div>
          )}
          {p.urlTexto && (
            <div>
              <dt>Texto</dt>
              <dd>
                <a href={p.urlTexto} target="_blank" rel="noopener noreferrer">
                  Ler o texto integral
                </a>
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
