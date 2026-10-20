"use client";

import { useState } from "react";
import styles from "./perfil.module.css";

export type ItemLista = {
  sigla: string;
  ementa: string | null;
  resumo: string | null;
  situacao: string | null;
  desfecho: string;
  url: string;
};

export type Filtro = { id: string | null; titulo: string };

// Rótulos e filtros dos projetos de parlamentares (desfecho a partir da situação oficial).
export const ROTULOS_DESFECHO: Record<string, string> = {
  lei: "Virou lei",
  rejeitado: "Rejeitado",
  caducou: "Perdeu a validade ou revogado",
  arquivado: "Arquivado ou retirado",
  tramitando: "Em tramitação",
  sem: "Situação não informada",
};

export const FILTROS_DESFECHO: Filtro[] = [
  { id: null, titulo: "Todos" },
  { id: "lei", titulo: "Viraram lei" },
  { id: "rejeitado", titulo: "Rejeitados" },
  { id: "caducou", titulo: "Perderam a validade ou revogados" },
  { id: "arquivado", titulo: "Arquivados ou retirados" },
  { id: "tramitando", titulo: "Em tramitação" },
  { id: "sem", titulo: "Sem situação informada" },
];

const numero = new Intl.NumberFormat("pt-BR");

// Lista com filtro por categoria; busca cada filtro e as páginas seguintes em `endpoint`
// (?desfecho=&inicio=&quantos=). Filtros sem itens não aparecem.
export function ListaFiltrada({
  endpoint,
  total,
  porCategoria,
  iniciais,
  porPagina,
  filtros = FILTROS_DESFECHO,
  rotulos = ROTULOS_DESFECHO,
  rotuloGrupo = "Filtrar projetos por desfecho",
}: {
  endpoint: string;
  total: number;
  porCategoria: Record<string, number>;
  iniciais: ItemLista[];
  porPagina: number;
  filtros?: Filtro[];
  rotulos?: Record<string, string>;
  rotuloGrupo?: string;
}) {
  const [filtro, setFiltro] = useState<string | null>(null);
  const [itens, setItens] = useState(iniciais);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const totalFiltro = filtro ? (porCategoria[filtro] ?? 0) : total;
  const restantes = totalFiltro - itens.length;

  async function buscar(categoria: string | null, inicio: number, quantos: number | "todos") {
    setCarregando(true);
    setErro(false);
    try {
      const busca = new URLSearchParams({ inicio: String(inicio), quantos: String(quantos) });
      if (categoria) busca.set("desfecho", categoria);
      const r = await fetch(`${endpoint}?${busca}`);
      if (!r.ok) throw new Error(String(r.status));
      const novos: ItemLista[] = await r.json();
      setItens((atuais) => (inicio === 0 ? novos : [...atuais, ...novos]));
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  function escolher(categoria: string | null) {
    if (categoria === filtro) return;
    setFiltro(categoria);
    if (categoria === null) setItens(iniciais);
    else buscar(categoria, 0, porPagina);
  }

  return (
    <>
      <div className={styles.filtrosProjeto} role="group" aria-label={rotuloGrupo}>
        {filtros
          .filter((f) => f.id === null || (porCategoria[f.id] ?? 0) > 0)
          .map((f) => (
            <button
              key={f.titulo}
              className={styles.filtroProjeto}
              aria-pressed={filtro === f.id}
              onClick={() => escolher(f.id)}
            >
              {f.titulo} <span>{numero.format(f.id ? (porCategoria[f.id] ?? 0) : total)}</span>
            </button>
          ))}
      </div>

      <ul className={styles.projetos} aria-busy={carregando} data-carregando={carregando || undefined}>
        {itens.map((pr) => (
          <li key={pr.url}>
            <p className={styles.projetoTopo}>
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className={styles.prop}>
                {pr.sigla}
              </a>
              <span className={styles.desfecho} data-desfecho={pr.desfecho}>
                {rotulos[pr.desfecho] ?? pr.desfecho}
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
            Mostrando {numero.format(itens.length)} de {numero.format(totalFiltro)}.
          </p>
          <button className={styles.todos} onClick={() => buscar(filtro, itens.length, porPagina)} disabled={carregando}>
            {carregando ? "Carregando…" : `Mostrar mais ${Math.min(porPagina, restantes)}`}
          </button>
          <button className={styles.botaoSecundario} onClick={() => buscar(filtro, itens.length, "todos")} disabled={carregando}>
            Mostrar todos ({numero.format(totalFiltro)})
          </button>
        </div>
      )}
      {erro && <p className={styles.erro}>Não foi possível carregar a lista. Tente de novo.</p>}
    </>
  );
}
