"""Resposta JSON para o frontend Untrace (contrato em frontend/src/lib/api.ts).

As posições dos spans são em code points (índices de str em Python), que é
o que o frontend usa com Array.from(texto).
"""

import base64
import hashlib
import re
from pathlib import PurePath

from .rules import encontrar
from .validate import e_mascara


def _linhas_com_inicio(texto: str) -> list[tuple[int, str]]:
    resultado, pos = [], 0
    for linha in texto.split("\n"):
        resultado.append((pos, linha))
        pos += len(linha) + 1
    return resultado


def construir_spans(original: str, anonimizado: str) -> list[dict] | None:
    """Um span por sequência de palavras mascaradas seguidas numa linha.

    Devolve None se os textos não estiverem alinhados palavra a palavra.
    """
    orig = _linhas_com_inicio(original)
    anon = _linhas_com_inicio(anonimizado)
    if len(orig) != len(anon):
        return None
    spans = []
    for (o_ini, o_linha), (a_ini, a_linha) in zip(orig, anon):
        o_tok = list(re.finditer(r"\S+", o_linha))
        a_tok = list(re.finditer(r"\S+", a_linha))
        if len(o_tok) != len(a_tok):
            return None
        regras = encontrar(o_linha)
        atual = None
        for o, a in zip(o_tok, a_tok):
            mascarado = e_mascara(a.group()) and not e_mascara(o.group())
            if not mascarado:
                atual = None
                continue
            if atual is None:
                atual = {"original_start": o_ini + o.start(),
                         "result_start": a_ini + a.start(),
                         "word_count": 0}
                spans.append(atual)
            atual["original_end"] = o_ini + o.end()
            atual["result_end"] = a_ini + a.end()
            atual["word_count"] += 1
            for s, e, regra in regras:
                if s < o.end() and o.start() < e:
                    atual["category"] = regra
    return [{k: s[k] for k in ("original_start", "original_end",
                               "result_start", "result_end", "category",
                               "word_count") if k in s}
            for s in spans]


def nome_download(nome_pdf: str) -> str:
    base = PurePath(nome_pdf.replace("\\", "/")).stem or "documento"
    base = re.sub(r"[^\w.-]+", "_", base)[:80]
    return f"{base}-anonimizado.txt"


def construir_resposta(original: str, anonimizado: str, nome_pdf: str,
                       paginas: int | None, ms: int | None) -> dict:
    spans = construir_spans(original, anonimizado)
    dados = anonimizado.encode("utf-8")
    categorias = None
    completas = False
    if spans is not None:
        categorias = sorted({s["category"] for s in spans if "category" in s})
        completas = all("category" in s for s in spans)
    return {
        "status": "completed",
        "original_text": original,
        "anonymized_text": anonimizado,
        "page_count": paginas,
        "processing_ms": ms,
        "spans": spans,
        "summary": {
            "masked_spans": None if spans is None else len(spans),
            "substitutions": (None if spans is None
                              else sum(s["word_count"] for s in spans)),
            "categories": categorias,
            "categories_complete": completas,
        },
        "download": {
            "filename": nome_download(nome_pdf),
            "encoding": "utf-8",
            "byte_length": len(dados),
            "sha256": hashlib.sha256(dados).hexdigest(),
            "base64": base64.b64encode(dados).decode("ascii"),
        },
    }
