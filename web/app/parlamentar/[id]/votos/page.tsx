import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCoberturaVotosCompleta, getPerfil, getTodosVotos, idDoParametro, PARAMS_DE_BUILD, textoCobertura } from "@/lib/perfil";
import { ListaVotos } from "../componentes";
import styles from "../perfil.module.css";

export function generateStaticParams() {
  return PARAMS_DE_BUILD;
}

export async function generateMetadata({ params }: PageProps<"/parlamentar/[id]/votos">) {
  const id = idDoParametro((await params).id);
  const perfil = id ? await getPerfil(id) : null;
  return { title: perfil ? `Votos de ${perfil.nome} | Monitor Legislativo` : "Monitor Legislativo" };
}

export default function Page(props: PageProps<"/parlamentar/[id]/votos">) {
  return (
    <Suspense fallback={<p className={`moldura ${styles.carregando}`}>Carregando…</p>}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}

async function Conteudo({ params }: { params: PageProps<"/parlamentar/[id]/votos">["params"] }) {
  const id = idDoParametro((await params).id);
  if (!id) notFound();
  const [p, votos, completa] = await Promise.all([getPerfil(id), getTodosVotos(id), getCoberturaVotosCompleta()]);
  if (!p) notFound();

  return (
    <main className={`moldura ${styles.pagina}`}>
      <Link href={`/parlamentar/${p.id}`} className={styles.voltar}>
        Voltar ao perfil
      </Link>
      <section className={styles.secao}>
        <h1 className={styles.tituloVotos}>Votos de {p.nome}</h1>
        <p className={styles.nota}>
          {votos.length} votos em votações nominais {textoCobertura(completa)}, do mais recente ao mais antigo.
          Votações simbólicas não registram voto individual e não aparecem aqui.
        </p>
        {votos.length > 0 && <ListaVotos votos={votos} partidoAtual={p.partido} />}
      </section>
    </main>
  );
}
