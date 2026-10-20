// Id de editor do AdSense (público por natureza: aparece no HTML e no ads.txt de qualquer site).
// NEXT_PUBLIC_ADSENSE_CLIENT, se definida, tem prioridade. O painel mostra "pub-...", o código do
// anúncio usa "ca-pub-...": aceita as duas formas.
const EDITOR_PADRAO = "pub-3001003984463632";
const bruto = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || EDITOR_PADRAO;

/** Formato do código do anúncio e do script: ca-pub-1234567890123456 */
export const ADSENSE_CLIENTE = bruto ? (bruto.startsWith("ca-") ? bruto : `ca-${bruto}`) : undefined;

/** Formato do ads.txt: pub-1234567890123456 */
export const ADSENSE_EDITOR = ADSENSE_CLIENTE?.replace(/^ca-/, "");

export const ADSENSE_BLOCO = process.env.NEXT_PUBLIC_ADSENSE_SLOT?.trim() || undefined;

/** Bloco entre seções do perfil; sem bloco próprio, usa o mesmo do rodapé. */
export const ADSENSE_BLOCO_PERFIL = process.env.NEXT_PUBLIC_ADSENSE_SLOT_PERFIL?.trim() || ADSENSE_BLOCO;
