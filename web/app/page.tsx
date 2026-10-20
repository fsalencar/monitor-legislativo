import { getPlenario } from "@/lib/plenario";
import PainelPresidente from "./PainelPresidente";
import Plenario from "./Plenario";

export default async function Home() {
  const [senado, camara] = await Promise.all([getPlenario("senado"), getPlenario("camara")]);

  return (
    <main className="moldura">
      <Plenario casas={{ senado, camara }} presidente={<PainelPresidente />} />
    </main>
  );
}
