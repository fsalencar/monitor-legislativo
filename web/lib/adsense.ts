// Id de editor do AdSense. O painel mostra "pub-...", o código do anúncio usa "ca-pub-...":
// aceita as duas formas na variável NEXT_PUBLIC_ADSENSE_CLIENT.
const bruto = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || undefined;

/** Formato do código do anúncio e do script: ca-pub-1234567890123456 */
export const ADSENSE_CLIENTE = bruto ? (bruto.startsWith("ca-") ? bruto : `ca-${bruto}`) : undefined;

/** Formato do ads.txt: pub-1234567890123456 */
export const ADSENSE_EDITOR = ADSENSE_CLIENTE?.replace(/^ca-/, "");

export const ADSENSE_BLOCO = process.env.NEXT_PUBLIC_ADSENSE_SLOT?.trim() || undefined;
