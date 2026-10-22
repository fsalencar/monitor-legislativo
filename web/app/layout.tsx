import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Libre_Caslon_Text, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import Anuncio from "./Anuncio";
import { BoasVindas, LinkComoUsar } from "./BoasVindas";
import Rodape from "./Rodape";
import { Simbolo } from "./Simbolo";
import { ADSENSE_CLIENTE as ADSENSE } from "@/lib/adsense";
import "./globals.css";

const ui = Atkinson_Hyperlegible({
  variable: "--fonte-ui",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Serifa itálica para nomes de casas e parlamentares, como os nomes das constelações numa carta.
const nomes = Libre_Caslon_Text({
  variable: "--fonte-nomes",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
});

// Fonte do nome da marca (logotipo), só no topo.
const marca = Plus_Jakarta_Sans({
  variable: "--fonte-marca",
  subsets: ["latin"],
  weight: ["800"],
});

export const metadata: Metadata = {
  title: { default: "Plenário Aberto — Você no plenário.", template: "%s | Plenário Aberto" },
  description:
    "Quem ocupa cada cadeira na Câmara dos Deputados, no Senado Federal e nas Assembleias Legislativas, como votou, o que propôs e quanto gastou da cota, com dados das fontes oficiais.",
  // Verificação do site no AdSense (meta tag google-adsense-account).
  ...(ADSENSE && { other: { "google-adsense-account": ADSENSE } }),
};

export const viewport: Viewport = {
  themeColor: "#0a1021",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${ui.variable} ${nomes.variable} ${marca.variable}`}>
      <head>
        {/* Tag do AdSense como o Google recomenda: <script> simples no <head> (o componente Script
            do Next acrescenta data-nscript, que o AdSense não aceita). */}
        {ADSENSE && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>
        <header className="barra">
          <div className="moldura">
            <Link href="/" className="marca" aria-label="Plenário Aberto, página inicial">
              <Simbolo tamanho={34} />
              <span>
                Plenário <span className="marcaAberto">Aberto</span>
              </span>
            </Link>
            <nav aria-label="Seções" className="secoes">
              <Link href="/proposicoes">Proposições</Link>
              <LinkComoUsar />
            </nav>
            <p>Você no plenário. Dados oficiais, sem opiniões pessoais ou manipulação de dados.</p>
          </div>
        </header>
        {children}
        <Anuncio />
        <Rodape />
        <BoasVindas />
      </body>
    </html>
  );
}
