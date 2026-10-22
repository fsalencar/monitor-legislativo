// Símbolo do Plenário Aberto (identidade "Direção 3"): o "A" de Aberto como portal no hemiciclo,
// com a poltrona em destaque ("Você no plenário"). Arcos na cor do texto (currentColor).
export const COR_PORTAL = "#2dd4bf";
export const COR_POLTRONA = "#f59e0b";

export function Simbolo({ tamanho = 32, titulo }: { tamanho?: number; titulo?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      role={titulo ? "img" : undefined}
      aria-hidden={titulo ? undefined : true}
      aria-label={titulo}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M 10 87 A 46 46 0 0 1 38 23" strokeWidth="6.5" />
        <path d="M 62 23 A 46 46 0 0 1 90 87" strokeWidth="6.5" />
        <path d="M 22 87 A 32 32 0 0 1 42 41" strokeWidth="5.5" />
        <path d="M 58 41 A 32 32 0 0 1 78 87" strokeWidth="5.5" />
      </g>
      <g fill="none" stroke={COR_PORTAL} strokeLinecap="round" strokeLinejoin="round">
        <path d="M 32 87 L 50 19 L 68 87" strokeWidth="8.5" />
        <path d="M 40 61 L 60 61" strokeWidth="6" />
      </g>
      <g fill={COR_POLTRONA}>
        <path d="M 42 61 C 42 55, 58 55, 58 61 L 58 74 L 42 74 Z" />
        <path d="M 40 57 C 40 53, 60 53, 60 57 C 60 60, 40 60, 40 57 Z" />
        <rect x="38" y="73" width="24" height="6" rx="2.5" />
        <path d="M 37 63 C 35 63, 35 73, 38 75 L 41 75 L 41 63 Z" />
        <path d="M 63 63 C 65 63, 65 73, 62 75 L 59 75 L 59 63 Z" />
        <path d="M 42 79 L 40 87 M 58 79 L 60 87" stroke={COR_POLTRONA} strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
