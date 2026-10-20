"use client";

import { useState } from "react";
import styles from "./doacao.module.css";

// Mostra a chave Pix com um botão para copiar (o visitante cola no app do banco).
export default function CopiarPix({ chave }: { chave: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(chave);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className={styles.pix}>
      <code>{chave}</code>
      <button onClick={copiar} aria-live="polite">
        {copiado ? "Chave copiada" : "Copiar chave Pix"}
      </button>
    </div>
  );
}
