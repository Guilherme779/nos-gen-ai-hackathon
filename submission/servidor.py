"""
Servidor HTTP local que liga o frontend Untrace ao anonimizador.

Uso (a partir da raiz do repositório):
  python submission/servidor.py
  python submission/servidor.py --porta 8000

Endpoints (contrato em frontend/src/lib/api.ts):
  GET  /api/health     estado do motor
  POST /api/anonymize  corpo = PDF; devolve o texto anonimizado em JSON

Nunca escreve submission.txt. A chave da API fica no .env do servidor.
"""

import argparse
import json
import os
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable
from urllib.parse import unquote

from anonymizer.cli import processar
from anonymizer.config import PROMPT_FILE, load_config
from anonymizer.extract import extrair_pdf_bytes
from anonymizer.llm import LLMError, anonimizar
from anonymizer.resposta_api import construir_resposta

MAX_BYTES = 10 * 1024 * 1024
MAX_PAGINAS = 40
TIMEOUT_S = 120
ORIGEM_LOCAL = re.compile(r"^https?://(localhost|127\.0\.0\.1|\[::1\])"
                          r"(:\d+)?$")


class ErroPedido(Exception):
    def __init__(self, estado: int, mensagem: str):
        super().__init__(mensagem)
        self.estado = estado


class Motor:
    """Corre um pedido de cada vez, como o frontend espera."""

    def __init__(self, template: str | None,
                 chamar_llm: Callable[[str], str] | None, estado: str):
        self.template = template
        self.chamar_llm = chamar_llm
        self.estado = estado
        self.trinco = threading.Lock()

    @property
    def pronto(self) -> bool:
        return self.estado == "ready"

    def saude(self) -> dict:
        return {"engine_ready": self.pronto, "engine_status": self.estado,
                "busy": self.trinco.locked(), "max_file_bytes": MAX_BYTES,
                "max_pages": MAX_PAGINAS, "timeout_seconds": TIMEOUT_S}

    def anonimizar_pdf(self, dados: bytes, nome: str) -> dict:
        if not self.pronto:
            raise ErroPedido(503, "O motor não está configurado.")
        if not self.trinco.acquire(blocking=False):
            raise ErroPedido(409, "Já há uma análise em curso.")
        try:
            inicio = time.monotonic()
            try:
                texto, paginas = extrair_pdf_bytes(dados)
            except Exception:
                raise ErroPedido(400, "O ficheiro não é um PDF válido.")
            if paginas > MAX_PAGINAS:
                raise ErroPedido(400, f"O limite é {MAX_PAGINAS} páginas.")
            try:
                r = processar(texto, self.template, self.chamar_llm)
            except ValueError as e:
                raise ErroPedido(400, str(e))
            except LLMError:
                raise ErroPedido(502, "O modelo não respondeu. Tenta de "
                                      "novo daqui a pouco.")
            ms = int((time.monotonic() - inicio) * 1000)
            return construir_resposta(r["original"] + "\n",
                                      r["anonimizado"] + "\n",
                                      nome, paginas, ms)
        finally:
            self.trinco.release()


def criar_handler(motor: Motor):
    origens_permitidas = {
        origem.strip().rstrip("/")
        for origem in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if origem.strip()
    }

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, formato, *args):
            pass  # sem registos de pedidos (podem conter nomes)

        def _cors(self):
            origem = self.headers.get("Origin", "")
            if ORIGEM_LOCAL.fullmatch(origem) or origem in origens_permitidas:
                self.send_header("Access-Control-Allow-Origin", origem)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods",
                                 "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers",
                                 "Content-Type, X-File-Name")
                self.send_header("Access-Control-Max-Age", "600")

        def _json(self, estado: int, corpo: dict):
            dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
            self.send_response(estado)
            self._cors()
            self.send_header("Content-Type",
                             "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(dados)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(dados)

        def _erro(self, estado: int, mensagem: str):
            self._json(estado, {"error": {"message": mensagem}})

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            if self.path.split("?")[0] == "/api/health":
                self._json(200, motor.saude())
            else:
                self._erro(404, "Endpoint desconhecido.")

        def do_POST(self):
            if self.path.split("?")[0] != "/api/anonymize":
                self._erro(404, "Endpoint desconhecido.")
                return
            try:
                tamanho = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                tamanho = 0
            if tamanho <= 0:
                self._erro(400, "O pedido não tem ficheiro.")
                return
            if tamanho > MAX_BYTES:
                self._erro(413, "O limite é 10 MB por ficheiro.")
                return
            dados = self.rfile.read(tamanho)
            if not dados.startswith(b"%PDF-"):
                self._erro(400, "O ficheiro não é um PDF.")
                return
            nome = unquote(self.headers.get("X-File-Name", "documento.pdf"))
            try:
                self._json(200, motor.anonimizar_pdf(dados, nome))
            except ErroPedido as e:
                self._erro(e.estado, str(e))
            except Exception:
                self._erro(500, "Erro interno no motor.")

    return Handler


def criar_motor() -> Motor:
    try:
        cfg = load_config()
        template = PROMPT_FILE.read_text(encoding="utf-8")
    except (ValueError, OSError) as e:
        print(f"Motor não configurado: {e}", file=sys.stderr)
        return Motor(None, None, "configuration_error")
    return Motor(template, lambda p: anonimizar(p, cfg), "ready")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Servidor local para o frontend Untrace")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--porta", type=int, default=8000)
    args = parser.parse_args(argv)

    motor = criar_motor()
    servidor = ThreadingHTTPServer((args.host, args.porta),
                                   criar_handler(motor))
    print(f"Servidor em http://{args.host}:{args.porta} "
          f"(motor: {motor.estado}). Ctrl+C para parar.")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        servidor.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
