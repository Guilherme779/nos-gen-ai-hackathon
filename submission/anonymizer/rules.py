"""Regras de regex para dados com formato fixo, aplicadas antes do LLM.

Só mascaram o que é inequívoco (emails, telefones, cartões, IBAN, números
de identificação com o rótulo ao lado). O resto fica para o LLM.
Cada palavra tocada por uma regra passa a "*" e a pontuação colada
mantém-se, por isso o número de palavras de cada linha nunca muda.
"""

import re

from .validate import mascarar_token


def mascarar_intervalos(linha: str, intervalos: list[tuple[int, int]]) -> str:
    """Mascara cada palavra que toca algum intervalo [início, fim)."""
    partes = []
    pos = 0
    for m in re.finditer(r"\S+", linha):
        partes.append(linha[pos:m.start()])
        toca = any(s < m.end() and m.start() < e for s, e in intervalos)
        partes.append(mascarar_token(m.group()) if toca else m.group())
        pos = m.end()
    partes.append(linha[pos:])
    return "".join(partes)
