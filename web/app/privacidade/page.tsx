import type { Metadata } from "next";
import styles from "../textos.module.css";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o Plenário Aberto trata dados de visitantes, cookies e anúncios.",
};

const REPOSITORIO = "https://github.com/fsalencar/monitor-legislativo";

export default function Privacidade() {
  return (
    <main className={`moldura ${styles.pagina}`}>
      <h1>Política de privacidade</h1>
      <p className={styles.atualizado}>Última atualização: 20 de outubro de 2026.</p>

      <div className={styles.destaque}>
        <p>
          Em resumo: o Plenário Aberto não tem cadastro, login nem formulários, e não coleta dados pessoais
          por conta própria. Os anúncios exibidos no site são do Google AdSense, que usa cookies conforme as
          regras do Google, descritas abaixo.
        </p>
      </div>

      <h2>Quais dados o site coleta</h2>
      <p>
        O Plenário Aberto não pede nem armazena dados pessoais de visitantes: não há cadastro, login,
        comentários ou formulários. O site não usa ferramentas próprias de análise de audiência.
      </p>
      <p>
        Como em qualquer site, os provedores de infraestrutura registram dados técnicos das conexões (como o
        endereço IP e o navegador usado) para funcionamento, segurança e prevenção de abusos. O site é
        hospedado pela Vercel e os dados legislativos ficam armazenados no Supabase.
      </p>

      <h2>Dados de parlamentares</h2>
      <p>
        As informações sobre deputados e senadores (nome, partido, estado, mandatos, votos, projetos, presença
        e afastamentos) vêm das bases de dados abertos oficiais da Câmara dos Deputados e do Senado Federal e
        são públicas por lei. O site não armazena dados pessoais sensíveis desses registros, como CPF.
      </p>

      <h2>Anúncios e cookies</h2>
      <p>
        O site exibe anúncios do Google AdSense, que ajudam a pagar os custos de funcionamento. O Google e seus
        parceiros usam cookies e tecnologias semelhantes para exibir anúncios, limitar quantas vezes um anúncio
        aparece, medir resultados e prevenir fraudes.
      </p>
      <ul>
        <li>
          O site solicita anúncios <strong>não personalizados</strong>: o Google não usa o seu histórico de
          navegação para escolher os anúncios exibidos aqui. Mesmo assim, ele pode usar cookies para as
          finalidades acima.
        </li>
        <li>
          Anúncios de política e de religião são bloqueados nas configurações do AdSense. Nenhum partido,
          parlamentar ou candidato patrocina o site.
        </li>
        <li>
          Saiba como o Google usa dados em sites parceiros em{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
            policies.google.com/technologies/partner-sites
          </a>{" "}
          e sobre os cookies de publicidade em{" "}
          <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">
            policies.google.com/technologies/ads
          </a>
          .
        </li>
        <li>
          Você pode controlar a personalização de anúncios do Google em{" "}
          <a href="https://myadcenter.google.com" target="_blank" rel="noopener noreferrer">
            myadcenter.google.com
          </a>{" "}
          e bloquear ou apagar cookies nas configurações do seu navegador.
        </li>
      </ul>

      <h2>Seus direitos</h2>
      <p>
        A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) garante, entre outros, os direitos de saber quais
        dados são tratados, de corrigi-los e de pedir sua exclusão. Como o site não guarda dados pessoais de
        visitantes, pedidos sobre cookies de anúncios devem ser feitos ao Google pelos links acima. Para
        qualquer outra dúvida sobre privacidade, fale com o responsável pelo site.
      </p>

      <h2>Contato</h2>
      <p>
        Dúvidas, pedidos ou correções podem ser enviados abrindo uma solicitação (issue) no repositório público
        do projeto:{" "}
        <a href={`${REPOSITORIO}/issues`} target="_blank" rel="noopener noreferrer">
          github.com/fsalencar/monitor-legislativo
        </a>
        .
      </p>

      <h2>Mudanças nesta política</h2>
      <p>
        Esta política pode ser atualizada quando o site mudar, por exemplo se passar a oferecer cadastro de
        apoiadores. A data da última atualização fica sempre no topo da página.
      </p>
    </main>
  );
}
