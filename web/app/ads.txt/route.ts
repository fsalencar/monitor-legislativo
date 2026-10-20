// ads.txt exigido pelo AdSense, gerado a partir do id de editor configurado no ambiente.
export function GET() {
  const cliente = process.env.NEXT_PUBLIC_ADSENSE_CLIENT; // ca-pub-1234567890
  if (!cliente) return new Response("", { status: 404 });
  const editor = cliente.replace(/^ca-/, "");
  return new Response(`google.com, ${editor}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
