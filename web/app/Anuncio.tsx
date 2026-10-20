"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_BLOCO, ADSENSE_BLOCO_PERFIL, ADSENSE_CLIENTE as CLIENTE } from "@/lib/adsense";

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number };
  }
}

// Blocos de anúncio discretos e rotulados, nunca sobre os dados (regra do projeto):
// "rodape" em todas as páginas; "secao" só entre seções do perfil do parlamentar.
// Anúncios não personalizados: não usam o histórico do visitante para escolher o anúncio.
export default function Anuncio({ posicao = "rodape" }: { posicao?: "rodape" | "secao" }) {
  const ins = useRef<HTMLModElement>(null);
  const BLOCO = posicao === "secao" ? ADSENSE_BLOCO_PERFIL : ADSENSE_BLOCO;

  useEffect(() => {
    if (!CLIENTE || !BLOCO || !ins.current || ins.current.dataset.adsbygoogleStatus) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.requestNonPersonalizedAds = 1;
      window.adsbygoogle.push({});
    } catch {
      // Bloqueador de anúncios ou script ainda não carregado: o espaço fica vazio, sem quebrar a página.
    }
  }, [BLOCO]);

  if (!CLIENTE || !BLOCO) return null;

  const bloco = (
    <>
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
    </>
  );

  return posicao === "secao" ? (
    <aside className="anuncio anuncioSecao" aria-label="Publicidade">
      {bloco}
    </aside>
  ) : (
    <aside className="anuncio" aria-label="Publicidade">
      <div className="moldura">{bloco}</div>
    </aside>
  );
}
