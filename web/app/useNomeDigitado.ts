"use client";

import { useEffect, useState } from "react";

const ESCREVER_MS = 85;
const APAGAR_MS = 40;
const PAUSA_MS = 1600;

// Exemplo do campo de busca: escreve um nome sorteado da lista, pausa, apaga e escreve outro.
// Para quando `ativo` é falso (o usuário clicou no campo); com movimento reduzido, mostra um nome fixo.
export function useNomeDigitado(nomes: string[], ativo: boolean): string {
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (!ativo || nomes.length === 0) return;
    const sorteia = (anterior?: string) => {
      if (nomes.length === 1) return nomes[0];
      let nome;
      do nome = nomes[Math.floor(Math.random() * nomes.length)];
      while (nome === anterior);
      return nome;
    };
    let nome = sorteia();
    let timer: ReturnType<typeof setTimeout>;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = setTimeout(() => setTexto(nome), 0);
      return () => clearTimeout(timer);
    }

    let n = 0;
    let apagando = false;
    const passo = () => {
      if (!apagando) {
        n++;
        setTexto(nome.slice(0, n));
        if (n === nome.length) apagando = true;
        timer = setTimeout(passo, apagando ? PAUSA_MS : ESCREVER_MS);
      } else {
        n--;
        setTexto(nome.slice(0, n));
        if (n === 0) {
          apagando = false;
          nome = sorteia(nome);
        }
        timer = setTimeout(passo, n === 0 ? ESCREVER_MS * 4 : APAGAR_MS);
      }
    };
    timer = setTimeout(passo, ESCREVER_MS * 4);
    return () => clearTimeout(timer);
  }, [nomes, ativo]);

  return texto;
}
