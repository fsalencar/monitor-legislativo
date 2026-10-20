import { getPlenario } from "@/lib/plenario";
import Plenario from "./Plenario";

export default async function Home() {
  const [senado, camara] = await Promise.all([getPlenario("senado"), getPlenario("camara")]);

  return (
    <main className="moldura">
      <Plenario casas={{ senado, camara }} />
    </main>
  );
}
