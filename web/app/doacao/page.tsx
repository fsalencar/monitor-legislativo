import type { Metadata } from "next";
import Link from "next/link";
import { CHAVE_PIX, LINK_APOIO, TITULAR_PIX } from "@/lib/doacao";
import styles from "../textos.module.css";
import CopiarPix from "./CopiarPix";
import estilos from "./doacao.module.css";

export const metadata: Metadata = {
  title: "Ajude o projeto | Monitor Legislativo",
  description: "Contribua para manter o Monitor Legislativo independente e no ar.",
};

export default function Doacao() {
  const temForma = Boolean(CHAVE_PIX || LINK_APOIO);
  return (
    <main className={`moldura ${styles.pagina}`}>
      <h1>Ajude o projeto</h1>
      <p className={styles.atualizado}>Faça sua contribuição para manter o Monitor Legislativo no ar.</p>

      <p>
        O Monitor Legislativo é independente: não tem vínculo com partidos, parlamentares ou governos. Os custos
        de hospedagem, banco de dados e atualização diária dos dados são pagos com anúncios discretos e com
        contribuições de quem usa o site. Qualquer valor ajuda a manter os dados oficiais acessíveis para todos.
      </p>

      <h2>Como contribuir</h2>
      {temForma ? (
        <div className={estilos.opcoes}>
          {CHAVE_PIX && (
            <section className={estilos.opcao}>
              <h3>Pix direto</h3>
              <p>
                Copie a chave e cole no app do seu banco, na opção Pix com chave aleatória. O valor chega
                inteiro, sem taxas{TITULAR_PIX && <>, em nome de {TITULAR_PIX}</>}.
              </p>
              <CopiarPix chave={CHAVE_PIX} />
            </section>
          )}
          {LINK_APOIO && (
            <section className={estilos.opcao}>
              <h3>Cartão ou Pix pelo {LINK_APOIO.nome}</h3>
              <p>Pague com cartão de crédito, débito ou Pix pela página segura do {LINK_APOIO.nome}.</p>
              <a href={LINK_APOIO.url} target="_blank" rel="noopener noreferrer" className={estilos.botao}>
                Contribuir pelo {LINK_APOIO.nome}
              </a>
            </section>
          )}
        </div>
      ) : (
        <div className={styles.destaque}>
          <p>As formas de contribuição estarão disponíveis em breve.</p>
        </div>
      )}

      <h2>Regras para contribuições</h2>
      <ul>
        <li>
          Não aceitamos contribuições de partidos, parlamentares, candidatos, governos ou entidades ligadas a
          eles. Se uma contribuição dessas origens for identificada, ela será devolvida.
        </li>
        <li>Contribuir não dá acesso a nenhum conteúdo diferente: os dados são os mesmos para todos.</li>
        <li>A contribuição não influencia o que o site mostra; os dados vêm das fontes oficiais.</li>
      </ul>

      <p>
        Saiba mais <Link href="/sobre">sobre o projeto</Link> e veja a{" "}
        <Link href="/privacidade">política de privacidade</Link>.
      </p>
    </main>
  );
}
