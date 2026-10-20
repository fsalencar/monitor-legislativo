import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Libre_Caslon_Text } from "next/font/google";
import Link from "next/link";
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

export const metadata: Metadata = {
  title: "Monitor Legislativo",
  description:
    "Quem ocupa cada cadeira na Câmara dos Deputados e no Senado Federal, e como votou, com dados das fontes oficiais.",
};

export const viewport: Viewport = {
  themeColor: "#0a1021",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${ui.variable} ${nomes.variable}`}>
      <body>
        <header className="barra">
          <div className="moldura">
            <Link href="/" className="marca">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 1.5 13.9 10.1 22.5 12 13.9 13.9 12 22.5 10.1 13.9 1.5 12 10.1 10.1Z"
                  fill="currentColor"
                />
              </svg>
              Monitor Legislativo
            </Link>
            <p>Dados oficiais do Congresso, sem opinião.</p>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
