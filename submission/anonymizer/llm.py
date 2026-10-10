"""Chamada ao Gemini: recebe o prompt completo e devolve o texto."""

from google import genai
from google.genai import types

from .config import PLACEHOLDER, Config


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


def anonimizar(prompt: str, cfg: Config) -> str:
    client = genai.Client(api_key=cfg.api_key)
    resp = client.models.generate_content(
        model=cfg.model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=cfg.temperature,
            max_output_tokens=cfg.max_output_tokens,
        ),
    )
    return extrair_texto(resp)
