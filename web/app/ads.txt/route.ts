import { ADSENSE_EDITOR } from "@/lib/adsense";

// ads.txt exigido pelo AdSense, gerado a partir do id de editor configurado no ambiente.
export function GET() {
  if (!ADSENSE_EDITOR) return new Response("", { status: 404 });
  return new Response(`google.com, ${ADSENSE_EDITOR}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
