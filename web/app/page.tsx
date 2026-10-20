import { CASAS, type CasaId } from "@/lib/casas";
import { getPlenario } from "@/lib/plenario";
import PainelPresidente from "./PainelPresidente";
import Plenario from "./Plenario";

export default async function Home() {
  const listas = await Promise.all(CASAS.map((c) => getPlenario(c)));
  const casas = Object.fromEntries(CASAS.map((c, i) => [c, listas[i]])) as Record<CasaId, (typeof listas)[number]>;

  return (
    <main className="moldura">
      <Plenario casas={casas} presidente={<PainelPresidente />} />
    </main>
  );
}
