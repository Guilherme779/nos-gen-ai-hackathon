"""Limpeza da resposta do LLM e verificação da estrutura.

Não corrige o conteúdo: a saída é o texto devolvido pelo modelo.
"""

import re

PAGE_MARKER = re.compile(r"^--\s*\d+\s+of\s+\d+\s*--$")
MASK_WORD = re.compile(r"[^A-Za-z0-9]*\*[^A-Za-z0-9]*")
PUNCT = ".,;:!?()[]{}\"'«»"


def e_mascara(palavra: str) -> bool:
    """True se a palavra, sem a pontuação à volta, for "*"."""
    return bool(MASK_WORD.fullmatch(palavra))


def mascarar_token(token: str) -> str:
    """Troca a palavra por "*", mantendo a pontuação colada."""
    inicio, fim = 0, len(token)
    while inicio < fim and token[inicio] in PUNCT:
        inicio += 1
    while fim > inicio and token[fim - 1] in PUNCT:
        fim -= 1
    if inicio == fim:
        return token  # só pontuação: nunca é mascarado
    return token[:inicio] + "*" + token[fim:]


def limpar_linhas(s: str) -> list[str]:
    linhas = [ln.rstrip() for ln in re.split(r"\r?\n", s)]
    return [
        ln for ln in linhas
        if ln.strip() and not PAGE_MARKER.match(ln.strip())
    ]


def remover_fences(texto: str) -> str:
    fence = "```"
    texto = texto.strip()
    if texto.startswith(fence):
        texto = texto[texto.find("\n") + 1:]
    if texto.endswith(fence):
        texto = texto[:-3]
    return texto


def validar(original: str, saida: str) -> dict:
    orig_linhas = limpar_linhas(original)
    out_linhas = limpar_linhas(remover_fences(saida))

    palavras = " ".join(out_linhas).split()
    mascaras = sum(1 for w in palavras if e_mascara(w))

    alteradas = [
        f"{i + 1}: {out}"
        for i, (ln, out) in enumerate(zip(orig_linhas, out_linhas))
        if out != ln
    ]
    contagem = [
        i + 1
        for i, (ln, out) in enumerate(zip(orig_linhas, out_linhas))
        if len(out.split()) != len(ln.split())
    ]

    return {
        "original": "\n".join(orig_linhas),
        "anonimizado": "\n".join(out_linhas),
        "linhasOriginal": len(orig_linhas),
        "linhasSaida": len(out_linhas),
        "estruturaOk": len(orig_linhas) == len(out_linhas),
        "totalMascaras": mascaras,
        "linhasAlteradas": alteradas,
        "linhasContagemErrada": contagem,
    }
