"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { layoutHemiciclo, RAIO_INTERNO } from "@/lib/hemiciclo";
import type { CasaId, Parlamentar } from "@/lib/plenario";
import styles from "./plenario.module.css";

type Aba = CasaId | "vereadores";

const ABAS: { id: Aba; titulo: string; casa: string }[] = [
  { id: "vereadores", titulo: "Vereadores", casa: "Câmaras Municipais" },
  { id: "camara", titulo: "Deputados", casa: "Câmara dos Deputados" },
  { id: "senado", titulo: "Senadores", casa: "Senado Federal" },
];

const ABA_INICIAL: Aba = "camara";
const SEM_PARTIDO = "Sem partido";

function assinarUrl(avisar: () => void) {
  window.addEventListener("popstate", avisar);
  return () => window.removeEventListener("popstate", avisar);
}

function lerAbaDaUrl(): Aba | null {
  const c = new URLSearchParams(window.location.search).get("casa");
  return c === "senado" || c === "camara" || c === "vereadores" ? c : null;
}

function normaliza(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export default function Plenario({
  casas,
  slots,
}: {
  casas: Record<CasaId, Parlamentar[]>;
  slots: Record<string, number>;
}) {
  // Aba no endereço (?casa=), para poder compartilhar o link; a escolha na página tem prioridade.
  const abaDaUrl = useSyncExternalStore(assinarUrl, lerAbaDaUrl, () => null);
  const [abaEscolhida, setAbaEscolhida] = useState<Aba | null>(null);
  const aba = abaEscolhida ?? abaDaUrl ?? ABA_INICIAL;
  const [partido, setPartido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<number | null>(null);

  function escolherAba(nova: Aba) {
    setAbaEscolhida(nova);
    setPartido(null);
    setBusca("");
    setSelecionado(null);
    const url = new URL(window.location.href);
    url.searchParams.set("casa", nova);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className={styles.raiz}>
      <div role="tablist" aria-label="Casa legislativa" className={styles.abas}>
        {ABAS.map((a) => {
          const total = a.id === "vereadores" ? null : casas[a.id].length;
          return (
            <button
              key={a.id}
              role="tab"
              id={`aba-${a.id}`}
              aria-selected={aba === a.id}
              aria-controls="painel-casa"
              className={styles.aba}
              onClick={() => escolherAba(a.id)}
            >
              <span className={styles.abaTitulo}>{a.titulo}</span>
              <span className={styles.abaDetalhe}>{total === null ? "Em construção" : `${total} cadeiras`}</span>
            </button>
          );
        })}
      </div>

      {aba === "vereadores" ? (
        <section id="painel-casa" role="tabpanel" aria-labelledby="aba-vereadores" className={styles.emConstrucao}>
          <h1 className={styles.titulo}>Câmaras Municipais</h1>
          <p>
            Cada Câmara Municipal publica seus dados de um jeito diferente. A primeira a entrar será a Câmara
            Municipal de São Paulo; depois, as demais capitais, uma a uma.
          </p>
        </section>
      ) : (
        <Casa
          key={aba}
          casa={aba}
          parlamentares={casas[aba]}
          slots={slots}
          partido={partido}
          setPartido={setPartido}
          busca={busca}
          setBusca={setBusca}
          selecionado={selecionado}
          setSelecionado={setSelecionado}
        />
      )}
    </div>
  );
}

function Casa({
  casa,
  parlamentares,
  slots,
  partido,
  setPartido,
  busca,
  setBusca,
  selecionado,
  setSelecionado,
}: {
  casa: CasaId;
  parlamentares: Parlamentar[];
  slots: Record<string, number>;
  partido: string | null;
  setPartido: (p: string | null) => void;
  busca: string;
  setBusca: (s: string) => void;
  selecionado: number | null;
  setSelecionado: (id: number | null) => void;
}) {
  const [hover, setHover] = useState<{ p: Parlamentar; x: number; y: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  // Partidos do maior para o menor; empate em ordem alfabética; "Sem partido" por último.
  const partidos = useMemo(() => {
    const cont = new Map<string, number>();
    for (const p of parlamentares) cont.set(p.partido, (cont.get(p.partido) ?? 0) + 1);
    return [...cont.entries()]
      .map(([sigla, cadeiras]) => ({ sigla, cadeiras }))
      .sort(
        (a, b) =>
          Number(a.sigla === SEM_PARTIDO) - Number(b.sigla === SEM_PARTIDO) ||
          b.cadeiras - a.cadeiras ||
          a.sigla.localeCompare(b.sigla, "pt-BR"),
      );
  }, [parlamentares]);

  const { cadeiras, raioPonto } = useMemo(() => layoutHemiciclo(parlamentares.length), [parlamentares.length]);

  const ordenados = useMemo(() => {
    const ordem = new Map(partidos.map((p, i) => [p.sigla, i]));
    return [...parlamentares].sort(
      (a, b) => ordem.get(a.partido)! - ordem.get(b.partido)! || a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [parlamentares, partidos]);

  const termo = normaliza(busca.trim());
  const filtrando = partido !== null || termo !== "";
  const corresponde = (p: Parlamentar) =>
    (partido === null || p.partido === partido) && (termo === "" || normaliza(p.nome).includes(termo));
  const correspondentes = ordenados.filter(corresponde);

  const atual = parlamentares.find((p) => p.id === selecionado) ?? null;
  const idxAtual = atual ? ordenados.findIndex((p) => p.id === atual.id) : -1;
  const cor = (sigla: string) => `var(--serie-${slots[sigla] ?? "outros"})`;

  // Enquadramento: margem para a mira e a retícula não serem cortadas.
  const margem = Math.max(raioPonto * 4.5, 0.09);
  const vb = { x: -1 - margem, y: -1 - margem, w: 2 + margem * 2, h: 1 + margem * 2 };
  const pct = (cx: number, cy: number) => ({ left: ((cx - vb.x) / vb.w) * 100, top: ((cy - vb.y) / vb.h) * 100 });

  function mover(e: React.PointerEvent<SVGSVGElement>) {
    const alvo = (e.target as Element).closest("[data-i]");
    if (!alvo || !caixa.current) return setHover(null);
    const r = caixa.current.getBoundingClientRect();
    setHover({ p: ordenados[Number(alvo.getAttribute("data-i"))], x: e.clientX - r.left, y: e.clientY - r.top });
  }

  function clicar(e: React.MouseEvent<SVGSVGElement>) {
    const alvo = (e.target as Element).closest("[data-i]");
    if (alvo) setSelecionado(ordenados[Number(alvo.getAttribute("data-i"))].id);
  }

  const titulo = casa === "senado" ? "senadores" : "deputados";
  const nomeCasa = casa === "senado" ? "Senado Federal" : "Câmara dos Deputados";
  const mira = idxAtual >= 0 ? cadeiras[idxAtual] : null;
  const rotulo = mira ? pct(mira.x, -mira.y) : null;

  return (
    <section id="painel-casa" role="tabpanel" aria-labelledby={`aba-${casa}`} className={styles.casa}>
      <div className={styles.cabecalhoCasa}>
        <h1 className={styles.titulo}>{nomeCasa}</h1>
        <p className={styles.resumo} aria-live="polite">
          {filtrando ? (
            <>
              <strong>{correspondentes.length}</strong> de {parlamentares.length} {titulo} correspondem aos filtros
            </>
          ) : (
            <>
              <strong>{parlamentares.length}</strong> {titulo} em exercício
            </>
          )}
        </p>
      </div>

      <div className={styles.filtros}>
        <div className={styles.campo}>
          <label htmlFor="busca-nome">Buscar pelo nome</label>
          <input
            id="busca-nome"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={casa === "senado" ? "Ex.: Alan Rick" : "Ex.: Tabata"}
            autoComplete="off"
          />
        </div>
        <div className={styles.campo}>
          <label htmlFor="filtro-partido">Partido</label>
          <select id="filtro-partido" value={partido ?? ""} onChange={(e) => setPartido(e.target.value || null)}>
            <option value="">Todos os partidos</option>
            {partidos.map((p) => (
              <option key={p.sigla} value={p.sigla}>
                {p.sigla} ({p.cadeiras})
              </option>
            ))}
          </select>
        </div>
        {filtrando && (
          <button
            className={styles.limpar}
            onClick={() => {
              setPartido(null);
              setBusca("");
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className={styles.grade}>
        <div className={styles.carta}>
          <div className={styles.grafico} ref={caixa}>
            <svg
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              className={styles.svg}
              role="img"
              aria-label={`Plenário com ${parlamentares.length} ${titulo}, agrupados por partido. Toque em uma cadeira para ver quem a ocupa.`}
              onPointerMove={mover}
              onPointerLeave={() => setHover(null)}
              onClick={clicar}
            >
              <Reticula raioPonto={raioPonto} />
              {cadeiras.map((c, i) => {
                const p = ordenados[i];
                const ativo = !filtrando || corresponde(p);
                return (
                  <circle
                    key={p.id}
                    data-i={i}
                    cx={c.x}
                    cy={-c.y}
                    r={raioPonto}
                    fill={cor(p.partido)}
                    className={styles.cadeira}
                    data-apagada={!ativo || undefined}
                  />
                );
              })}
              {mira && (
                <g key={atual!.id} transform={`translate(${mira.x} ${-mira.y})`} aria-hidden>
                  <g className={styles.mira}>
                    <circle r={raioPonto * 2.3} strokeWidth={raioPonto * 0.28} />
                    {[0, 90, 180, 270].map((a) => (
                      <line
                        key={a}
                        x1={raioPonto * 2.8}
                        x2={raioPonto * 3.9}
                        strokeWidth={raioPonto * 0.28}
                        transform={`rotate(${a})`}
                      />
                    ))}
                  </g>
                </g>
              )}
            </svg>

            {atual && rotulo && (
              <div
                className={styles.coordenadas}
                data-lado={mira!.x > 0.35 ? "esquerda" : "direita"}
                style={{ left: `${rotulo.left}%`, top: `${rotulo.top}%` }}
                aria-hidden
              >
                <span>{atual.nome}</span>
                <span>
                  {atual.partido}, {atual.uf}
                </span>
              </div>
            )}

            {hover && hover.p.id !== selecionado && (
              <div className={styles.dica} style={{ left: hover.x, top: hover.y }} role="presentation">
                <strong>{hover.p.nome}</strong>
                <span>
                  {hover.p.partido}, {hover.p.uf}
                </span>
              </div>
            )}
          </div>

          {termo !== "" && correspondentes.length > 0 && correspondentes.length <= 12 && (
            <ul className={styles.encontrados} aria-label="Resultados da busca">
              {correspondentes.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setSelecionado(p.id)} aria-pressed={p.id === selecionado}>
                    <span className={styles.amostra} style={{ background: cor(p.partido) }} aria-hidden />
                    {p.nome}
                    <span className={styles.encontradoMeta}>
                      {p.partido}, {p.uf}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filtrando && correspondentes.length === 0 && (
            <p className={styles.vazio}>
              Ninguém corresponde a esses filtros. Confira a grafia do nome ou escolha outro partido.
            </p>
          )}
        </div>

        <aside className={styles.lateral}>
          {atual ? (
            <Cartao p={atual} casa={casa} cor={cor(atual.partido)} fechar={() => setSelecionado(null)} />
          ) : (
            <p className={styles.dicaCartao}>
              Toque em uma cadeira, ou busque pelo nome, para ver quem a ocupa e como tem votado.
            </p>
          )}

          <table className={styles.legenda}>
            <caption>Cadeiras por partido</caption>
            <thead>
              <tr>
                <th scope="col">Partido</th>
                <th scope="col">Cadeiras</th>
              </tr>
            </thead>
            <tbody>
              {partidos.map((p) => (
                <tr key={p.sigla} data-apagada={(partido !== null && partido !== p.sigla) || undefined}>
                  <td>
                    <button
                      className={styles.legendaItem}
                      aria-pressed={partido === p.sigla}
                      onClick={() => setPartido(partido === p.sigla ? null : p.sigla)}
                    >
                      <span className={styles.amostra} style={{ background: cor(p.sigla) }} aria-hidden />
                      {p.sigla}
                    </button>
                  </td>
                  <td className={styles.numero}>{p.cadeiras}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </aside>
      </div>

      <details className={styles.lista}>
        <summary>
          Ver lista {filtrando ? `filtrada (${correspondentes.length})` : `completa (${parlamentares.length})`}
        </summary>
        <div className={styles.tabelaRolagem}>
          <table>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Partido</th>
                <th scope="col">UF</th>
              </tr>
            </thead>
            <tbody>
              {[...correspondentes]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/parlamentar/${p.id}`}>{p.nome}</Link>
                    </td>
                    <td>{p.partido}</td>
                    <td>{p.uf}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

// Retícula da carta: arcos e raios finos atrás das cadeiras, como as coordenadas de um atlas.
function Reticula({ raioPonto }: { raioPonto: number }) {
  const interno = RAIO_INTERNO - raioPonto * 2.2;
  const externo = 1 + raioPonto * 2.2;
  const arco = (r: number) => `M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`;
  const raios = Array.from({ length: 11 }, (_, i) => (Math.PI * (i + 1)) / 12);
  return (
    <g className={styles.reticula} aria-hidden>
      <path d={arco(interno)} />
      <path d={arco((interno + externo) / 2)} />
      <path d={arco(externo)} />
      {raios.map((a) => (
        <line
          key={a}
          x1={interno * Math.cos(a)}
          y1={-interno * Math.sin(a)}
          x2={externo * Math.cos(a)}
          y2={-externo * Math.sin(a)}
        />
      ))}
      <line x1={-externo} y1={0} x2={externo} y2={0} />
    </g>
  );
}

function Cartao({ p, casa, cor, fechar }: { p: Parlamentar; casa: CasaId; cor: string; fechar: () => void }) {
  return (
    <article className={styles.cartao} aria-live="polite">
      <button className={styles.fechar} onClick={fechar} aria-label="Fechar">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div className={styles.cartaoTopo}>
        {/* Foto direto do site oficial; sem otimizador de imagens (evita custo e intermediário). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.foto && <img src={p.foto} alt={`Foto oficial de ${p.nome}`} width={72} height={96} loading="lazy" />}
        <div>
          <h2>{p.nome}</h2>
          <dl className={styles.coordenadasCartao}>
            <div>
              <dt>Partido</dt>
              <dd>
                <span className={styles.amostra} style={{ background: cor }} aria-hidden />
                {p.partido}
              </dd>
            </div>
            <div>
              <dt>UF</dt>
              <dd>{p.uf}</dd>
            </div>
            {p.mandatos !== null && (
              <div>
                <dt>Legislaturas na Câmara</dt>
                <dd>{p.mandatos}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      <div className={styles.acoes}>
        <Link href={`/parlamentar/${p.id}`} className={styles.atividade}>
          Ver atividade
        </Link>
        <a href={p.urlFonte} target="_blank" rel="noopener noreferrer" className={styles.oficial}>
          Página oficial {casa === "senado" ? "no Senado" : "na Câmara"}
        </a>
      </div>
    </article>
  );
}
