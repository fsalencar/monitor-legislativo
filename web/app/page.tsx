import { getPlenario } from "@/lib/plenario";
import PainelPresidente from "./PainelPresidente";
import Plenario from "./Plenario";

export default async function Home() {
  const [senado, camara, alSp, alMg] = await Promise.all([
    getPlenario("senado"),
    getPlenario("camara"),
    getPlenario("al-sp"),
    getPlenario("al-mg"),
  ]);

  return (
    <main className="moldura">
      <Plenario casas={{ senado, camara, "al-sp": alSp, "al-mg": alMg }} presidente={<PainelPresidente />} />
    </main>
  );
}
