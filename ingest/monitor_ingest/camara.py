"""Cliente da API Dados Abertos da Câmara (v2)."""
import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor

import httpx

BASE_URL = "https://dadosabertos.camara.leg.br/api/v2"
MAX_TENTATIVAS = 5


class CamaraClient:
    def __init__(self, workers: int = 8):
        self.http = httpx.Client(
            base_url=BASE_URL,
            headers={"Accept": "application/json", "User-Agent": "monitor-legislativo (ingestao)"},
            timeout=30,
        )
        self.workers = workers

    def get(self, path: str, params: dict | None = None) -> dict:
        for tentativa in range(1, MAX_TENTATIVAS + 1):
            try:
                r = self.http.get(path, params=params)
                if r.status_code < 500 and r.status_code != 429:
                    r.raise_for_status()
                    return r.json()
            except (httpx.TransportError, httpx.TimeoutException):
                if tentativa == MAX_TENTATIVAS:
                    raise
            if tentativa == MAX_TENTATIVAS:
                r.raise_for_status()
            time.sleep(2**tentativa)
        raise RuntimeError("inalcançável")

    def paginate(self, path: str, params: dict | None = None) -> Iterator[dict]:
        """Itera sobre 'dados' de todas as páginas, seguindo o link rel=next."""
        params = {"itens": 100, **(params or {})}
        url: str | None = path
        while url:
            body = self.get(url, params)
            yield from body["dados"]
            url = next((l["href"] for l in body.get("links", []) if l["rel"] == "next"), None)
            params = None  # o href de next já traz os parâmetros

    def get_many(self, paths: list[str], ignorar_404: bool = False) -> list:
        """Busca vários recursos em paralelo; retorna 'dados' de cada um, na mesma ordem.
        Com ignorar_404, recursos inexistentes viram None."""
        def um(p: str):
            try:
                return self.get(p)["dados"]
            except httpx.HTTPStatusError as e:
                if ignorar_404 and e.response.status_code == 404:
                    return None
                raise

        with ThreadPoolExecutor(self.workers) as pool:
            return list(pool.map(um, paths))
