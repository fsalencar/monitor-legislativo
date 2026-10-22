"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { corDoPartido } from "@/lib/cores";
import { layoutHemiciclo, RAIO_INTERNO } from "@/lib/hemiciclo";
import { contarPartidos, ordenarCadeiras } from "@/lib/ordem";
import { ASSEMBLEIAS, SIGLA_CASA, type Assembleia, type CasaId } from "@/lib/casas";
import type { Parlamentar } from "@/lib/plenario";
import styles from "./plenario.module.css";
import { useNomeDigitado } from "./useNomeDigitado";

type Aba = "estaduais" | "camara" | "senado" | "presidente" | "proposicoes";

const ABAS: { id: Aba; titulo: string }[] = [
  { id: "estaduais", titulo: "Deputados estaduais" },
  { id: "camara", titulo: "Deputados federais" },
  { id: "senado", titulo: "Senadores" },
  { id: "presidente", titulo: "Presidente" },
  { id: "proposicoes", titulo: "Proposições" },
];

// Unidades da federação com Assembleia (ou Câmara Legislativa, no DF): 26 estados + DF.
const TOTAL_UFS = 27;
const PERCENTUAL_ESTADOS = Math.round((ASSEMBLEIAS.length / TOTAL_UFS) * 100);
const REGIOES = [...new Set(ASSEMBLEIAS.map((a) => a.regiao))].map((regiao) => ({
  regiao,
  assembleias: ASSEMBLEIAS.filter((a) => a.regiao === regiao),
}));

const ABA_INICIAL: Aba = "camara";

const NOME_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};
// Partidos visíveis na legenda antes de expandir.
const LEGENDA_CURTA = 8;

function assinarUrl(avisar: () => void) {
  window.addEventListener("popstate", avisar);
  return () => window.removeEventListener("popstate", avisar);
}

// ?casa= aceita camara, senado, presidente, proposicoes e a sigla da Assembleia (al-sp, al-mg...).
function lerCasaDaUrl(): string | null {
  return new URLSearchParams(window.location.search).get("casa");
}

function abaDe(casa: string | null): Aba | null {
  if (casa === "camara" || casa === "senado" || casa === "presidente" || casa === "proposicoes") return casa;
  if (casa === "estaduais" || ASSEMBLEIAS.some((a) => a.id === casa)) return "estaduais";
  return null;
}

// ?sel=<id> abre o plenário com uma cadeira já marcada (link vindo do perfil).
function lerSelDaUrl(): number | null {
  const s = Number(new URLSearchParams(window.location.search).get("sel"));
  return Number.isInteger(s) && s > 0 ? s : null;
}

function normaliza(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export default function Plenario({
  casas,
  presidente,
  proposicoes,
}: {
  casas: Record<CasaId, Parlamentar[]>;
  // Painel da Presidência, montado no servidor e mostrado direto ao escolher a aba.
  presidente: React.ReactNode;
  proposicoes: React.ReactNode;
}) {
  // Aba no endereço (?casa=), para poder compartilhar o link; a escolha na página tem prioridade.
  const casaDaUrl = useSyncExternalStore(assinarUrl, lerCasaDaUrl, () => null);
  const selDaUrl = useSyncExternalStore(assinarUrl, lerSelDaUrl, () => null);
  const [abaEscolhida, setAbaEscolhida] = useState<Aba | null>(null);
  const aba = abaEscolhida ?? abaDe(casaDaUrl) ?? ABA_INICIAL;
  const [assembleiaEscolhida, setAssembleia] = useState<Assembleia | null>(null);
  const assembleia =
    assembleiaEscolhida ?? ASSEMBLEIAS.find((a) => a.id === casaDaUrl)?.id ?? ASSEMBLEIAS[0].id;
  // Casa cujo plenário aparece (nas abas que têm plenário).
  const casaAtual: CasaId | null =
    aba === "estaduais" ? assembleia : aba === "presidente" || aba === "proposicoes" ? null : aba;
  const [partido, setPartido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  // undefined = ainda não houve escolha na página; vale a cadeira do endereço.
  const [escolhido, setSelecionado] = useState<number | null | undefined>(undefined);
  const selecionado = escolhido === undefined ? (abaEscolhida ? null : selDaUrl) : escolhido;

  function marcarNaUrl(casa: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("casa", casa);
    url.searchParams.delete("sel");
    window.history.replaceState(null, "", url);
  }

  function limparSelecao() {
    setPartido(null);
    setBusca("");
    setSelecionado(null);
  }

  function escolherAba(nova: Aba) {
    setAbaEscolhida(nova);
    limparSelecao();
    marcarNaUrl(nova === "estaduais" ? assembleia : nova);
  }

  function escolherAssembleia(nova: Assembleia) {
    setAssembleia(nova);
    limparSelecao();
    marcarNaUrl(nova);
  }

  return (
    <div className={styles.raiz}>
      <div role="tablist" aria-label="Casa legislativa" className={styles.abas}>
        {ABAS.map((a) => {
          const detalhe =
            a.id === "estaduais"
              ? `${ASSEMBLEIAS.length} estados · ${PERCENTUAL_ESTADOS}% do país`
              : a.id === "presidente"
                ? "Mandato atual"
                : a.id === "proposicoes"
                  ? "Busca e votações"
                : `${casas[a.id].length} cadeiras`;
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
              <span className={styles.abaDetalhe}>{detalhe}</span>
            </button>
          );
        })}
      </div>

      {aba === "estaduais" && (
        <div className={styles.assembleias} role="group" aria-label="Assembleia Legislativa">
          {REGIOES.map((r) => (
            <div key={r.regiao} className={styles.regiao}>
              <span className={styles.regiaoNome}>{r.regiao}</span>
              <div className={styles.regiaoEstados}>
                {r.assembleias.map((a) => (
                  <button
                    key={a.id}
                    className={styles.assembleia}
                    aria-pressed={assembleia === a.id}
                    onClick={() => escolherAssembleia(a.id)}
                  >
                    {a.estado} <span>{casas[a.id].length} cadeiras</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className={styles.cobertura}>
            <p>
              <strong>
                {ASSEMBLEIAS.length} de {TOTAL_UFS} estados disponíveis ({PERCENTUAL_ESTADOS}%)
              </strong>
              . Outros estados entram aos poucos, conforme as Assembleias publicam dados abertos.
            </p>
            <div
              className={styles.barraCobertura}
              role="progressbar"
              aria-label="Estados disponíveis para consulta"
              aria-valuemin={0}
              aria-valuemax={TOTAL_UFS}
              aria-valuenow={ASSEMBLEIAS.length}
            >
              <span style={{ width: `${PERCENTUAL_ESTADOS}%` }} />
            </div>
          </div>
        </div>
      )}

      {casaAtual === null ? (
        <section id="painel-casa" role="tabpanel" aria-labelledby={`aba-${aba}`}>
          {aba === "proposicoes" ? proposicoes : presidente}
        </section>
      ) : (
        <Casa
          key={casaAtual}
          casa={casaAtual}
          parlamentares={casas[casaAtual]}
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
  partido,
  setPartido,
  busca,
  setBusca,
  selecionado,
  setSelecionado,
}: {
  casa: CasaId;
  parlamentares: Parlamentar[];
  partido: string | null;
  setPartido: (p: string | null) => void;
  busca: string;
  setBusca: (s: string) => void;
  selecionado: number | null;
  setSelecionado: (id: number | null) => void;
}) {
  const [hover, setHover] = useState<{ p: Parlamentar; x: number; y: number } | null>(null);
  const [legendaInteira, setLegendaInteira] = useState(false);
  const [uf, setUf] = useState<string | null>(null);

  // Estados presentes nesta casa, em ordem alfabética do nome, com o nº de cadeiras.
  const ufs = useMemo(() => {
    const cont = new Map<string, number>();
    for (const p of parlamentares) if (p.uf) cont.set(p.uf, (cont.get(p.uf) ?? 0) + 1);
    return [...cont.entries()]
      .map(([sigla, cadeiras]) => ({ sigla, nome: NOME_UF[sigla] ?? sigla, cadeiras }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [parlamentares]);
  const caixa = useRef<HTMLDivElement>(null);
  const [focoNaBusca, setFocoNaBusca] = useState(false);
  const nomes = useMemo(() => parlamentares.map((p) => p.nome), [parlamentares]);
  const exemplo = useNomeDigitado(nomes, !focoNaBusca && busca === "");

  const partidos = useMemo(() => contarPartidos(parlamentares), [parlamentares]);
  const { cadeiras, raioPonto } = useMemo(() => layoutHemiciclo(parlamentares.length), [parlamentares.length]);
  const ordenados = useMemo(() => ordenarCadeiras(parlamentares, partidos), [parlamentares, partidos]);

  const termo = normaliza(busca.trim());
  const filtrando = partido !== null || uf !== null || termo !== "";
  const corresponde = (p: Parlamentar) =>
    (partido === null || p.partido === partido) &&
    (uf === null || p.uf === uf) &&
    (termo === "" || normaliza(p.nome).includes(termo));
  const correspondentes = ordenados.filter(corresponde);

  const atual = parlamentares.find((p) => p.id === selecionado) ?? null;
  const idxAtual = atual ? ordenados.findIndex((p) => p.id === atual.id) : -1;
  const cor = corDoPartido;
  // Legenda curta, mas o partido filtrado aparece mesmo fora dos primeiros.
  const legenda = legendaInteira
    ? partidos
    : partidos.filter((p, i) => i < LEGENDA_CURTA || p.sigla === partido);

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

  const titulo = casa === "senado" ? "senadores" : casa === "camara" ? "deputados federais" : "deputados estaduais";
  const nomeCasa = SIGLA_CASA[casa].nome;
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
            onFocus={() => setFocoNaBusca(true)}
            onBlur={() => setFocoNaBusca(false)}
            placeholder={focoNaBusca ? "Digite parte do nome" : `Ex.: ${exemplo}`}
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
        {ufs.length > 1 && (
        <div className={styles.campo}>
          <label htmlFor="filtro-uf">Estado</label>
          <select id="filtro-uf" value={uf ?? ""} onChange={(e) => setUf(e.target.value || null)}>
            <option value="">Todos os estados</option>
            {ufs.map((u) => (
              <option key={u.sigla} value={u.sigla}>
                {u.nome} ({u.cadeiras})
              </option>
            ))}
          </select>
        </div>
        )}
        {filtrando && (
          <button
            className={styles.limpar}
            onClick={() => {
              setPartido(null);
              setUf(null);
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
                    {/* Contorno escuro separa a mira de cadeiras vermelhas. */}
                    <circle r={raioPonto * 2.3} strokeWidth={raioPonto * 0.75} className={styles.miraHalo} />
                    <circle r={raioPonto * 2.3} strokeWidth={raioPonto * 0.28} />
                    {[0, 90, 180, 270].map((a) => (
                      <g key={a} transform={`rotate(${a})`}>
                        <line x1={raioPonto * 2.8} x2={raioPonto * 3.9} strokeWidth={raioPonto * 0.75} className={styles.miraHalo} />
                        <line x1={raioPonto * 2.8} x2={raioPonto * 3.9} strokeWidth={raioPonto * 0.28} />
                      </g>
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
              Ninguém corresponde a esses filtros. Confira a grafia do nome ou escolha outro partido ou estado.
            </p>
          )}
          <ListaCompleta parlamentares={correspondentes} total={parlamentares.length} filtrando={filtrando} />
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
              {legenda.map((p) => (
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
          {partidos.length > LEGENDA_CURTA && (
            <button className={styles.expandir} onClick={() => setLegendaInteira(!legendaInteira)} aria-expanded={legendaInteira}>
              {legendaInteira
                ? "Mostrar só os maiores partidos"
                : `Mostrar os outros ${partidos.length - LEGENDA_CURTA} partidos`}
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}

type Coluna = "nome" | "partido" | "uf";

const COLUNAS: { id: Coluna; titulo: string }[] = [
  { id: "nome", titulo: "Nome" },
  { id: "partido", titulo: "Partido" },
  { id: "uf", titulo: "UF" },
];

function ListaCompleta({
  parlamentares,
  total,
  filtrando,
}: {
  parlamentares: Parlamentar[];
  total: number;
  filtrando: boolean;
}) {
  const [ordem, setOrdem] = useState<{ coluna: Coluna; crescente: boolean }>({ coluna: "nome", crescente: true });

  // Ordena pela coluna escolhida; empates ficam em ordem alfabética de nome.
  const ordenados = useMemo(() => {
    const sentido = ordem.crescente ? 1 : -1;
    return [...parlamentares].sort(
      (a, b) =>
        sentido * a[ordem.coluna].localeCompare(b[ordem.coluna], "pt-BR") ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [parlamentares, ordem]);

  function ordenarPor(coluna: Coluna) {
    setOrdem((o) => ({ coluna, crescente: o.coluna === coluna ? !o.crescente : true }));
  }

  return (
      <details className={styles.lista}>
        <summary>
          Ver lista {filtrando ? `filtrada (${parlamentares.length})` : `completa (${total})`}
        </summary>
        <div className={styles.tabelaRolagem}>
          <table>
            <thead>
              <tr>
                {COLUNAS.map((c) => {
                  const ativa = ordem.coluna === c.id;
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      aria-sort={ativa ? (ordem.crescente ? "ascending" : "descending") : "none"}
                    >
                      <button className={styles.ordenar} data-ativa={ativa || undefined} onClick={() => ordenarPor(c.id)}>
                        {c.titulo}
                        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" data-crescente={ativa ? ordem.crescente : undefined}>
                          <path d="M2 6.5 5 3.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((p) => (
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
  const [fotoFalhou, setFotoFalhou] = useState<string | null>(null);
  const iniciais = p.nome
    .split(/\s+/)
    .filter((s) => s.length > 2 || /^[A-ZÀ-Ú]/.test(s))
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  return (
    <article className={styles.cartao} aria-live="polite">
      <button className={styles.fechar} onClick={fechar} aria-label="Fechar">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div className={styles.cartaoTopo}>
        {/* Foto direto do site oficial; sem otimizador de imagens (evita custo e intermediário). */}
        {p.foto && fotoFalhou !== p.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.foto}
            src={p.foto}
            alt={`Foto oficial de ${p.nome}`}
            width={72}
            height={96}
            onError={() => setFotoFalhou(p.foto)}
          />
        ) : (
          <span className={styles.semFoto} aria-hidden>
            {iniciais}
          </span>
        )}
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
                <dt>Legislaturas {SIGLA_CASA[casa].na}</dt>
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
          Página oficial {SIGLA_CASA[casa].na}
        </a>
      </div>
    </article>
  );
}
