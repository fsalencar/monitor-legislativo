import Link from "next/link";
import { corDoPartido } from "@/lib/cores";
import { layoutHemiciclo } from "@/lib/hemiciclo";
import { contarPartidos, ordenarCadeiras } from "@/lib/ordem";
import { getPlenario, type CasaId } from "@/lib/plenario";
import styles from "./perfil.module.css";

// Mini plenário com a mira na cadeira deste parlamentar; leva ao plenário com ela marcada.
export async function Localizador({ id, casa, partido }: { id: number; casa: CasaId; partido: string | null }) {
  const parlamentares = await getPlenario(casa);
  const ordenados = ordenarCadeiras(parlamentares, contarPartidos(parlamentares));
  const idx = ordenados.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const { cadeiras, raioPonto } = layoutHemiciclo(ordenados.length);
  const c = cadeiras[idx];
  const m = Math.max(raioPonto * 4.5, 0.09);

  return (
    <Link href={`/?casa=${casa}&sel=${id}`} className={styles.localizador}>
      <svg viewBox={`${-1 - m} ${-1 - m} ${2 + 2 * m} ${1 + 2 * m}`} aria-hidden>
        {cadeiras.map((s, i) => (
          <circle key={i} cx={s.x} cy={-s.y} r={raioPonto} fill={i === idx ? corDoPartido(partido ?? "") : "var(--nevoa-2)"} opacity={i === idx ? 1 : 0.35} />
        ))}
        <g transform={`translate(${c.x} ${-c.y})`} fill="none" strokeLinecap="round">
          <circle r={raioPonto * 2.3} strokeWidth={raioPonto * 0.75} stroke="var(--indigo)" />
          <circle r={raioPonto * 2.3} strokeWidth={raioPonto * 0.3} stroke="var(--lanterna)" />
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <line x1={raioPonto * 2.8} x2={raioPonto * 3.9} strokeWidth={raioPonto * 0.75} stroke="var(--indigo)" />
              <line x1={raioPonto * 2.8} x2={raioPonto * 3.9} strokeWidth={raioPonto * 0.3} stroke="var(--lanterna)" />
            </g>
          ))}
        </g>
      </svg>
      <span>Ver a cadeira no plenário</span>
    </Link>
  );
}

export function cargo(casa: CasaId, sexo: string | null): string {
  if (casa === "senado") return sexo === "F" ? "senadora" : sexo === "M" ? "senador" : "senador(a)";
  return sexo === "F" ? "deputada federal" : sexo === "M" ? "deputado federal" : "deputado(a) federal";
}
