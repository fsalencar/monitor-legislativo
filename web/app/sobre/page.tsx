import type { Metadata } from "next";
import Link from "next/link";
import styles from "../textos.module.css";

export const metadata: Metadata = {
  title: "Sobre | Monitor Legislativo",
  description: "O que é o Monitor Legislativo, de onde vêm os dados e como o site se mantém.",
};

const REPOSITORIO = "https://github.com/fsalencar/monitor-legislativo";

export default function Sobre() {
  return (
    <main className={`moldura ${styles.pagina}`}>
      <h1>Sobre o Monitor Legislativo</h1>
      <p className={styles.atualizado}>Um site independente e apartidário de transparência legislativa.</p>

      <p>
        O Monitor Legislativo mostra quem ocupa cada cadeira da Câmara dos Deputados e do Senado Federal e o
        que cada parlamentar faz no mandato: como votou, quais projetos apresentou, a presença nas sessões e
        os períodos de afastamento. A ideia é que qualquer pessoa consiga entender isso em poucos segundos, sem
        precisar navegar pelos sites oficiais.
      </p>

      <h2>De onde vêm os dados</h2>
      <ul>
        <li>
          <a href="https://dadosabertos.camara.leg.br" target="_blank" rel="noopener noreferrer">
            Dados Abertos da Câmara dos Deputados
          </a>{" "}
          e o serviço de frequência da Câmara.
        </li>
        <li>
          <a href="https://legis.senado.leg.br/dadosabertos" target="_blank" rel="noopener noreferrer">
            Dados Abertos do Senado Federal
          </a>
          .
        </li>
      </ul>
      <p>
        Os dados são copiados dessas fontes todos os dias e exibidos como vieram, sempre com link para o
        registro original. Câmaras Municipais entrarão aos poucos, começando pela de São Paulo.
      </p>

      <h2>Princípios</h2>
      <ul>
        <li>
          <strong>Só o dado oficial.</strong> Não há notas, rankings, pontuações nem adjetivos sobre
          parlamentares ou partidos.
        </li>
        <li>
          <strong>Palavras cuidadosas.</strong> Usamos os termos das fontes, como “presença em sessões”, “ausência
          justificada” e “afastamento ou licença”. Votações simbólicas não registram voto individual, e isso é
          informado como tal, não como dado faltando.
        </li>
        <li>
          <strong>Ordem sem juízo.</strong> Os partidos aparecem pela quantidade de cadeiras, nunca em um eixo de
          esquerda e direita. Cada partido usa a cor da própria identidade visual, sem repetir cores.
        </li>
        <li>
          <strong>Resumos em linguagem simples.</strong> Alguns projetos têm um resumo gerado por inteligência
          artificial a partir da ementa oficial, para facilitar a leitura. Esses resumos são sempre identificados
          como gerados por IA e mostrados ao lado da ementa oficial.
        </li>
      </ul>

      <h2>Independência e financiamento</h2>
      <p>
        O site não tem vínculo com partidos, parlamentares, governos ou entidades ligadas a eles, e não aceita
        patrocínio dessas origens. Os custos de hospedagem e banco de dados são pagos com anúncios discretos do
        Google AdSense (com anúncios de política e religião bloqueados) e com{" "}
        <Link href="/doacao">contribuições de quem usa o site</Link>.
      </p>

      <h2>Código aberto e correções</h2>
      <p>
        O código do projeto é público em{" "}
        <a href={REPOSITORIO} target="_blank" rel="noopener noreferrer">
          github.com/fsalencar/monitor-legislativo
        </a>
        . Se encontrar um dado errado ou tiver uma sugestão, abra uma solicitação (issue) no repositório. Como
        os dados vêm das fontes oficiais, um erro também pode estar na própria fonte; nesse caso, indicamos o
        canal do órgão responsável.
      </p>

      <p>
        Veja também a <Link href="/privacidade">política de privacidade</Link>.
      </p>
    </main>
  );
}
