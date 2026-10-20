import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCoberturaVotosCompleta, getIdsEmExercicio, getPerfil, getTodosVotos, textoCobertura } from "@/lib/perfil";
import { ListaVotos } from "../componentes";
import styles from "../perfil.module.css";

// Só um perfil pré-gerado (exigência do cache components); os demais são gerados na primeira visita.
export async function generateStaticParams() {
  const [primeiro] = await getIdsEmExercicio();
  return [{ id: String(primeiro) }];
}

export async function generateMetadata({ params }: PageProps<"/parlamentar/[id]/votos">) {
  const perfil = await getPerfil(Number((await params).id));
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
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
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
