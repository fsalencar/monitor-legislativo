// Geometria do plenário em semicírculo: fileiras concêntricas, cadeiras distribuídas
// proporcionalmente ao comprimento de cada fileira, ordenadas da esquerda para a direita.

export type Cadeira = { x: number; y: number };

const RAIO_INTERNO = 0.38;

export function layoutHemiciclo(total: number): { cadeiras: Cadeira[]; raioPonto: number } {
  if (total === 0) return { cadeiras: [], raioPonto: 0 };

  // Escolhe o nº de fileiras em que o espaçamento ao longo do arco ≈ espaçamento entre fileiras.
  let melhor = { fileiras: 1, erro: Infinity };
  for (let f = 2; f <= 40; f++) {
    const raios = fileiraRaios(f);
    const arco = Math.PI * raios.reduce((a, b) => a + b, 0);
    const erro = Math.abs(arco / total - (1 - RAIO_INTERNO) / (f - 1));
    if (erro < melhor.erro) melhor = { fileiras: f, erro };
  }
  const raios = fileiraRaios(melhor.fileiras);
  const soma = raios.reduce((a, b) => a + b, 0);

  // Cadeiras por fileira, com arredondamento que fecha exatamente no total.
  const exatas = raios.map((r) => (total * r) / soma);
  const porFileira = exatas.map(Math.floor);
  let faltam = total - porFileira.reduce((a, b) => a + b, 0);
  exatas
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto)
    .forEach(({ i }) => {
      if (faltam > 0) {
        porFileira[i]++;
        faltam--;
      }
    });

  const pontos: (Cadeira & { angulo: number; r: number })[] = [];
  raios.forEach((r, i) => {
    const n = porFileira[i];
    for (let j = 0; j < n; j++) {
      const angulo = n === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (n - 1);
      pontos.push({ x: r * Math.cos(angulo), y: r * Math.sin(angulo), angulo, r });
    }
  });
  // Da esquerda (ângulo π) para a direita (0); no mesmo ângulo, de dentro para fora.
  pontos.sort((a, b) => b.angulo - a.angulo || a.r - b.r);

  // Raio do ponto limitado pelo menor espaçamento: entre fileiras ou ao longo de qualquer arco.
  const passoRadial = (1 - RAIO_INTERNO) / (melhor.fileiras - 1);
  const passoArco = Math.min(
    ...raios.map((r, i) => (porFileira[i] > 1 ? (Math.PI * r) / (porFileira[i] - 1) : Infinity)),
  );
  return { cadeiras: pontos.map(({ x, y }) => ({ x, y })), raioPonto: 0.42 * Math.min(passoRadial, passoArco) };
}

function fileiraRaios(f: number): number[] {
  return Array.from({ length: f }, (_, i) => RAIO_INTERNO + ((1 - RAIO_INTERNO) * i) / (f - 1));
}
