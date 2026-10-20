"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_BLOCO as BLOCO, ADSENSE_CLIENTE as CLIENTE } from "@/lib/adsense";

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number };
  }
}

// Um único bloco de anúncio por página, no rodapé, longe dos dados (regra do projeto).
// Anúncios não personalizados: não usam o histórico do visitante para escolher o anúncio.
export default function Anuncio() {
  const ins = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!CLIENTE || !BLOCO || !ins.current || ins.current.dataset.adsbygoogleStatus) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.requestNonPersonalizedAds = 1;
      window.adsbygoogle.push({});
    } catch {
      // Bloqueador de anúncios ou script ainda não carregado: o espaço fica vazio, sem quebrar a página.
    }
  }, []);

  if (!CLIENTE || !BLOCO) return null;

  return (
    <aside className="anuncio" aria-label="Publicidade">
      <div className="moldura">
        <p>Publicidade</p>
        <ins
          ref={ins}
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={CLIENTE}
          data-ad-slot={BLOCO}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
