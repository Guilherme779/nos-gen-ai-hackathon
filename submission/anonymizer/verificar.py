"""Verificações da submissão antes de abrir o pull request.

Não diz se as palavras CERTAS foram mascaradas; só apanha erros de forma
que estragam a avaliação automática ou expõem segredos.
"""

import re
from pathlib import Path

from .validate import e_mascara, limpar_linhas

PADRAO_CHAVE = re.compile(r"AIza[0-9A-Za-z_\-]{20,}")


def verificar_submissao(submission_dir: Path,
                        original: list[str]) -> list[str]:
    """Lista de problemas encontrados. Lista vazia = tudo OK."""
    problemas = []
    sub = submission_dir / "submission.txt"
    prm = submission_dir / "prompt.txt"
    for f in (sub, prm):
        if not f.is_file() or not f.read_text(encoding="utf-8").strip():
            problemas.append(f"{f.name} não existe ou está vazio")
    if problemas:
        return problemas

    for f in (sub, prm):
        if PADRAO_CHAVE.search(f.read_text(encoding="utf-8")):
            problemas.append(f"{f.name} parece conter uma chave da API")

    texto = sub.read_text(encoding="utf-8")
    if any(not ln.strip() for ln in texto.rstrip("\n").split("\n")):
        problemas.append("submission.txt tem linhas vazias")

    linhas = limpar_linhas(texto)
    if len(linhas) != len(original):
        problemas.append(f"submission.txt tem {len(linhas)} linhas, o "
                         f"original tem {len(original)}")
    for n, (src, out) in enumerate(zip(original, linhas), start=1):
        s, o = src.split(), out.split()
        if len(s) != len(o):
            problemas.append(f"linha {n}: {len(s)} palavras -> {len(o)}")
            continue
        for a, b in zip(s, o):
            if a != b and not e_mascara(b):
                problemas.append(f"linha {n}: '{a}' mudou para '{b}'")
    return problemas
