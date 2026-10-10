"""Corrige a contagem de asteriscos quando o LLM se engana.

O LLM decide O QUE mascarar; este módulo só garante a regra "uma palavra,
um asterisco". Numa linha com número de palavras diferente do original,
alinha as duas: cada palavra que o LLM manteve tem de ser igual à do
original, e cada sequência de "*" corresponde às palavras do original que
ficam entre elas. Essas palavras são mascaradas uma a uma.
Se a linha não se conseguir alinhar, fica como o LLM a devolveu.
"""

from functools import lru_cache

from .validate import (e_mascara, limpar_linhas, mascarar_token,
                       remover_fences)


def _agrupar(palavras: list[str]) -> list[tuple[str, object]]:
    """("txt", palavra) ou ("mask", nº de asteriscos seguidos)."""
    itens: list[tuple[str, object]] = []
    for p in palavras:
        if e_mascara(p):
            if itens and itens[-1][0] == "mask":
                itens[-1] = ("mask", itens[-1][1] + 1)
            else:
                itens.append(("mask", 1))
        else:
            itens.append(("txt", p))
    return itens


def reparar_linha(original: str, saida: str) -> str | None:
    """Devolve a linha corrigida, ou None se não for possível alinhar."""
    s, o = original.split(), saida.split()
    if len(s) == len(o):
        return saida
    itens = _agrupar(o)

    @lru_cache(maxsize=None)
    def melhor(i: int, j: int):
        """(custo, tamanhos de cada sequência) para itens[i:] vs s[j:]."""
        if i == len(itens):
            return (0, ()) if j == len(s) else None
        tipo, valor = itens[i]
        if tipo == "txt":
            if j < len(s) and s[j] == valor:
                return melhor(i + 1, j + 1)
            return None
        escolha = None
        for k in range(1, len(s) - j + 1):
            resto = melhor(i + 1, j + k)
            if resto is not None:
                custo = resto[0] + abs(k - valor)
                if escolha is None or custo < escolha[0]:
                    escolha = (custo, (k,) + resto[1])
        return escolha

    resultado = melhor(0, 0)
    if resultado is None:
        return None

    tamanhos = iter(resultado[1])
    novas, j = [], 0
    for tipo, valor in itens:
        if tipo == "txt":
            novas.append(valor)
            j += 1
        else:
            k = next(tamanhos)
            novas.extend(mascarar_token(p) for p in s[j:j + k])
            j += k
    indentacao = saida[:len(saida) - len(saida.lstrip())]
    return indentacao + " ".join(novas)


def reparar_texto(original: str, saida: str) -> tuple[str, list[int]]:
    """Corrige as linhas com contagem errada. Devolve (texto, linhas)."""
    orig = limpar_linhas(original)
    out = limpar_linhas(remover_fences(saida))
    if len(orig) != len(out):
        return saida, []
    corrigidas = []
    for n, (a, b) in enumerate(zip(orig, out)):
        if len(a.split()) != len(b.split()):
            nova = reparar_linha(a, b)
            if nova is not None:
                out[n] = nova
                corrigidas.append(n + 1)
    return "\n".join(out), corrigidas
