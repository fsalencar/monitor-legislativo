"use client";

import { useEffect } from "react";

// O conteúdo do perfil chega depois da navegação (streaming), quando o navegador já desistiu de
// achar a âncora do endereço (ex.: #projetos). Montado junto do conteúdo, rola até ela.
export function RolarParaAncora() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}
