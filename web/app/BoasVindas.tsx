"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Simbolo } from "./Simbolo";

// Apresentação do site: abre sozinha na 1ª visita à página inicial (e nas seguintes, até a pessoa
// marcar "não mostrar novamente"); o link "Como usar" do topo reabre em qualquer página.
const CHAVE = "boas-vindas-dispensada";
export const EVENTO_ABRIR = "abrir-boas-vindas";

function dispensada(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false; // navegação privada ou armazenamento bloqueado: só não lembra a escolha
  }
}

export function BoasVindas() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [naoMostrar, setNaoMostrar] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const abrir = () => {
      setNaoMostrar(dispensada());
      if (!dialogo.current?.open) dialogo.current?.showModal();
    };
    window.addEventListener(EVENTO_ABRIR, abrir);
    if (pathname === "/" && !dispensada()) abrir();
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
    // Só na entrada no site; navegar entre páginas não reabre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aoFechar() {
    try {
      if (naoMostrar) localStorage.setItem(CHAVE, "1");
      else localStorage.removeItem(CHAVE);
    } catch {
      // sem armazenamento: a escolha vale só nesta visita
    }
  }

  return (
    <dialog
      ref={dialogo}
      className="boasVindas"
      aria-labelledby="boas-vindas-titulo"
      onClose={aoFechar}
      // Clique fora do conteúdo (no fundo escurecido) fecha.
      onClick={(e) => e.target === dialogo.current && dialogo.current.close()}
    >
      <div className="boasVindasCorpo">
        <button className="boasVindasFechar" onClick={() => dialogo.current?.close()} aria-label="Fechar">
          ×
        </button>
        <div className="boasVindasTopo">
          <Simbolo tamanho={44} />
          <h2 id="boas-vindas-titulo">
            Boas-vindas ao Plenário <span className="marcaAberto">Aberto</span>
          </h2>
        </div>
        <p>
          Um site independente e apartidário que mostra, com dados oficiais, quem ocupa cada cadeira do Congresso
          Nacional e das Assembleias Legislativas: como vota, o que propõe, quando está presente e quanto gasta da
          cota parlamentar. Sem opiniões, sem rankings; cada número leva à fonte oficial.
        </p>
        <h3>Como usar</h3>
        <ol>
          <li>
            <strong>Escolha a casa</strong> nas abas: deputados estaduais, deputados federais, senadores ou
            presidente.
          </li>
          <li>
            <strong>Toque numa cadeira</strong> do plenário, ou busque pelo nome, partido ou estado, para ver quem a
            ocupa.
          </li>
          <li>
            Em <strong>Ver atividade</strong>, veja o resumo e o detalhe: votos, projetos, presença, afastamentos e
            gastos.
          </li>
          <li>
            Em <strong>Proposições</strong>, no topo, busque um projeto (ex.: PL 2338/2023) e veja como cada
            parlamentar votou.
          </li>
        </ol>
        <div className="boasVindasRodape">
          <label>
            <input type="checkbox" checked={naoMostrar} onChange={(e) => setNaoMostrar(e.target.checked)} />
            Não mostrar novamente
          </label>
          <button className="boasVindasComecar" onClick={() => dialogo.current?.close()} autoFocus>
            Começar
          </button>
        </div>
      </div>
    </dialog>
  );
}

// Link "Como usar" do topo: reabre a apresentação.
export function LinkComoUsar() {
  return (
    <button type="button" className="linkComoUsar" onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR))}>
      <span className="comoUsarLongo">Como usar</span>
      <span className="comoUsarCurto">Ajuda</span>
    </button>
  );
}
