import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

const fonte = Atkinson_Hyperlegible({
  variable: "--fonte",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Monitor Legislativo",
  description:
    "Quem ocupa cada cadeira no Senado e na Câmara dos Deputados, com dados das fontes oficiais.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={fonte.variable}>
      <body>{children}</body>
    </html>
  );
}
