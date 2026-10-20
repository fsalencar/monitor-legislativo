"""Avisa o site que há dados novos, para ele descartar o cache e mostrá-los em seguida.

Configuração (opcional; sem ela nada acontece):
- REVALIDAR_URL: endereço do site + /api/revalidar
- REVALIDAR_TOKEN: o mesmo valor configurado no site (Vercel)

Durante cargas longas, os jobs chamam `avisar()` a cada lote; o aviso é limitado a um a cada
INTERVALO segundos para não sobrecarregar o site. Ao fim de cada job, `avisar(forcar=True)`.
"""
import os
import time

import httpx

INTERVALO = 300
_ultimo = 0.0


def avisar(forcar: bool = False) -> None:
    global _ultimo
    url, token = os.environ.get("REVALIDAR_URL"), os.environ.get("REVALIDAR_TOKEN")
    if not url or not token:
        return
    agora = time.monotonic()
    if not forcar and agora - _ultimo < INTERVALO:
        return
    _ultimo = agora
    try:
        r = httpx.post(url, headers={"Authorization": f"Bearer {token}"}, timeout=20)
        if r.status_code != 200:
            print(f"  aviso ao site falhou: HTTP {r.status_code}", flush=True)
    except httpx.HTTPError as e:
        # O aviso é só uma conveniência: falhar aqui não pode derrubar a ingestão.
        print(f"  aviso ao site falhou: {e!r}", flush=True)
