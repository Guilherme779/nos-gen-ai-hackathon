"""Chamada ao Gemini: recebe o prompt completo e devolve o texto.

Repete o pedido com espera crescente em erros temporários (429, 5xx).
"""

import random
import time
from typing import Callable

from google import genai
from google.genai import types

from .config import PLACEHOLDER, Config

CODIGOS_REPETIR = {429, 500, 502, 503, 504}


class LLMError(Exception):
    pass


def construir_prompt(template: str, texto: str) -> str:
    if PLACEHOLDER not in template:
        raise ValueError(f"O prompt não tem o marcador {PLACEHOLDER}")
    return template.replace(PLACEHOLDER, texto)


def extrair_texto(resp) -> str:
    if not resp.candidates:
        raise LLMError(f"O Gemini não devolveu resposta: "
                       f"{resp.prompt_feedback}")
    cand = resp.candidates[0]
    if cand.finish_reason and cand.finish_reason.name == "MAX_TOKENS":
        raise LLMError("Resposta cortada (MAX_TOKENS).")
    # Ignora partes de "pensamento" e junta só o texto (como no n8n)
    partes = cand.content.parts if cand.content and cand.content.parts else []
    return "".join(
        p.text for p in partes if not getattr(p, "thought", False) and p.text
    )


def e_repetivel(erro: Exception) -> bool:
    if isinstance(erro, (ConnectionError, TimeoutError)):
        return True
    return getattr(erro, "code", None) in CODIGOS_REPETIR


def pedir_com_repeticao(client, prompt: str, cfg: Config,
                        sleep: Callable[[float], None]):
    for tentativa in range(cfg.max_retries + 1):
        try:
            return client.models.generate_content(
                model=cfg.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=cfg.temperature,
                    max_output_tokens=cfg.max_output_tokens,
                ),
            )
        except Exception as erro:
            codigo = getattr(erro, "code", "?")
            if not e_repetivel(erro):
                raise LLMError(
                    f"Erro {codigo} do Gemini (chave, nome do modelo ou "
                    f"quota?): {erro}") from erro
            if tentativa == cfg.max_retries:
                raise LLMError(
                    f"Erro {codigo} do Gemini depois de "
                    f"{cfg.max_retries + 1} tentativas") from erro
            sleep(min(60, 2 ** tentativa) + random.random())


def anonimizar(prompt: str, cfg: Config, client=None,
               sleep: Callable[[float], None] = time.sleep) -> str:
    client = client or genai.Client(api_key=cfg.api_key)
    return extrair_texto(pedir_com_repeticao(client, prompt, cfg, sleep))
