"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ResumoCurto } from "@/lib/perfil";
import styles from "./plenario.module.css";

const numero = new Intl.NumberFormat("pt-BR");
const reaisCurto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 2,
});
const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

// Até 3 números do parlamentar no cartão do plenário, cada um levando à seção do perfil.
// Mesmas regras do resumo do perfil: só dados oficiais, item só quando a fonte tem o dado.
export function ResumoCartao({ id }: { id: number }) {
  const [resumo, setResumo] = useState<{
    id: number;
    dados: ResumoCurto | null;
  } | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch(`/api/parlamentar/${id}/resumo`)
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: ResumoCurto | null) => ativo && setResumo({ id, dados }))
      .catch(() => ativo && setResumo({ id, dados: null }));
    return () => {
      ativo = false;
    };
  }, [id]);

  // Enquanto carrega (ou ao trocar de cadeira), reserva o espaço para o cartão não "pular".
  if (!resumo || resumo.id !== id)
    return <div className={styles.resumoCartao} aria-busy="true" />;
  const r = resumo.dados;
  if (!r) return null;

  const itens: { valor: string; rotulo: string; href: string }[] = [];
  if (r.projetos > 0) {
    itens.push(
      r.leis === 0 && r.aprovados > 0
        ? {
            valor: `${numero.format(r.aprovados)} de ${numero.format(r.projetos)}`,
            rotulo: "projetos aprovados pela Assembleia",
            href: "#projetos",
          }
        : {
            valor: `${numero.format(r.leis)} de ${numero.format(r.projetos)}`,
            rotulo: "projetos que viraram lei",
            href: "#projetos",
          },
    );
  }
  if (r.sessoes > 0) {
    itens.push({
      valor: `${numero.format(r.presencas)} de ${numero.format(r.sessoes)}`,
      rotulo: "sessões com presença registrada",
      href: "#presenca",
    });
  }
  if (r.gastosLegislatura !== null && r.inicioLegislatura) {
    const [ano, mes] = r.inicioLegislatura.split("-").map(Number);
    itens.push({
      valor: reaisCurto.format(r.gastosLegislatura),
      rotulo: `gastos da cota desde ${MESES[mes - 1]}/${ano}`,
      href: "#gastos-inicio",
    });
  }
  if (itens.length === 0) return null;

  return (
    <ul className={styles.resumoCartao} aria-label="Resumo">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <Link href={`/parlamentar/${id}${i.href}`}>
            <strong>{i.valor}</strong>
            <span>{i.rotulo}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
