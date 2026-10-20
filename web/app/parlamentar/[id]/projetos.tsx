"use client";

import { useState } from "react";
import type { Desfecho, ProjetoAutoria } from "@/lib/perfil";
import styles from "./perfil.module.css";

const ROTULO: Record<Desfecho, string> = {
  lei: "Virou lei",
  rejeitado: "Rejeitado",
  arquivado: "Arquivado ou retirado",
  tramitando: "Em tramitação",
  sem: "Situação não informada",
};

const FILTROS: { id: Desfecho | null; titulo: string }[] = [
  { id: null, titulo: "Todos" },
  { id: "lei", titulo: "Viraram lei" },
  { id: "rejeitado", titulo: "Rejeitados" },
  { id: "arquivado", titulo: "Arquivados ou retirados" },
  { id: "tramitando", titulo: "Em tramitação" },
  { id: "sem", titulo: "Sem situação informada" },
];

const numero = new Intl.NumberFormat("pt-BR");

// Lista de projetos de autoria com filtro por desfecho; busca cada filtro e as páginas seguintes sob demanda.
export function ProjetosLista({
  id,
  total,
  porDesfecho,
  iniciais,
  porPagina,
}: {
  id: number;
  total: number;
  porDesfecho: Record<Desfecho, number>;
  iniciais: ProjetoAutoria[];
  porPagina: number;
}) {
  const [filtro, setFiltro] = useState<Desfecho | null>(null);
  const [projetos, setProjetos] = useState(iniciais);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const totalFiltro = filtro ? porDesfecho[filtro] : total;
  const restantes = totalFiltro - projetos.length;

  async function buscar(desfecho: Desfecho | null, inicio: number, quantos: number | "todos") {
    setCarregando(true);
    setErro(false);
    try {
      const busca = new URLSearchParams({ inicio: String(inicio), quantos: String(quantos) });
      if (desfecho) busca.set("desfecho", desfecho);
      const r = await fetch(`/api/parlamentar/${id}/projetos?${busca}`);
      if (!r.ok) throw new Error(String(r.status));
      const novos: ProjetoAutoria[] = await r.json();
      setProjetos((atuais) => (inicio === 0 ? novos : [...atuais, ...novos]));
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  function escolher(desfecho: Desfecho | null) {
    if (desfecho === filtro) return;
    setFiltro(desfecho);
    if (desfecho === null) setProjetos(iniciais);
    else buscar(desfecho, 0, porPagina);
  }

  return (
    <>
      <div className={styles.filtrosProjeto} role="group" aria-label="Filtrar projetos por desfecho">
        {FILTROS.filter((f) => f.id === null || porDesfecho[f.id] > 0).map((f) => (
          <button
            key={f.titulo}
            className={styles.filtroProjeto}
            aria-pressed={filtro === f.id}
            onClick={() => escolher(f.id)}
          >
            {f.titulo} <span>{numero.format(f.id ? porDesfecho[f.id] : total)}</span>
          </button>
        ))}
      </div>

      <ul className={styles.projetos} aria-busy={carregando} data-carregando={carregando || undefined}>
        {projetos.map((pr) => (
          <li key={pr.url}>
            <p className={styles.projetoTopo}>
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className={styles.prop}>
                {pr.sigla}
              </a>
              <span className={styles.desfecho} data-desfecho={pr.desfecho}>
                {ROTULO[pr.desfecho]}
              </span>
            </p>
            {pr.resumo ? (
              <>
                <p className={styles.resumo}>{pr.resumo}</p>
                <p className={styles.rotuloIa}>Resumo gerado por IA a partir da ementa oficial: {pr.ementa}</p>
              </>
            ) : (
              pr.ementa && <p className={styles.ementa}>{pr.ementa}</p>
            )}
            {pr.situacao && <p className={styles.situacaoProjeto}>Situação oficial: {pr.situacao}</p>}
          </li>
        ))}
      </ul>

      {restantes > 0 && (
        <div className={styles.maisVotos} aria-live="polite">
          <p>
            Mostrando {numero.format(projetos.length)} de {numero.format(totalFiltro)}.
          </p>
          <button className={styles.todos} onClick={() => buscar(filtro, projetos.length, porPagina)} disabled={carregando}>
            {carregando ? "Carregando…" : `Mostrar mais ${Math.min(porPagina, restantes)}`}
          </button>
          <button className={styles.botaoSecundario} onClick={() => buscar(filtro, projetos.length, "todos")} disabled={carregando}>
            Mostrar todos ({numero.format(totalFiltro)})
          </button>
        </div>
      )}
      {erro && <p className={styles.erro}>Não foi possível carregar os projetos. Tente de novo.</p>}
    </>
  );
}
