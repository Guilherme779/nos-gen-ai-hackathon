"""Linha de comandos: PDF -> Gemini -> submission.txt e prompt.txt."""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable

from .config import (PDF_FILE, PROMPT_FILE, SUBMISSION_DIR, WORK_DIR,
                     load_config)
from .extract import extrair_texto_pdf
from .llm import LLMError, anonimizar, construir_prompt
from .validate import validar


def executar(pdf: Path, template: str, chamar_llm: Callable[[str], str],
             submission_dir: Path, work_dir: Path) -> dict:
    """Corre o pipeline e escreve submission.txt, prompt.txt e o original."""
    texto = extrair_texto_pdf(pdf)
    if not texto.strip():
        raise ValueError("O PDF não tem texto extraível.")

    resposta = chamar_llm(construir_prompt(template, texto))
    r = validar(texto, resposta)

    work_dir.mkdir(parents=True, exist_ok=True)
    (work_dir / "original.txt").write_text(r["original"] + "\n",
                                           encoding="utf-8")
    (submission_dir / "submission.txt").write_text(r["anonimizado"] + "\n",
                                                   encoding="utf-8")
    # prompt.txt = prompt exato usado, com o documento como {DOCUMENT}
    (submission_dir / "prompt.txt").write_text(template, encoding="utf-8")
    return r


# Validação manual (só leitura: o submission.txt não pode ser editado
# à mão; para corrigir, muda o prompt e volta a correr)
def revisao_manual(original_path: Path, submission_path: Path) -> None:
    code = shutil.which("code")
    if code:
        subprocess.run([code, "--diff", str(original_path),
                        str(submission_path)])
        print("\nAbri o diff no VS Code: original à esquerda, "
              "anonimizado à direita.")
    else:
        print(f"\nRevê: {submission_path}")
    print("Se houver erros, corrige o prompt e corre outra vez "
          "(não edites o submission.txt à mão).")


def imprimir_resumo(r: dict) -> None:
    estrutura = "OK" if r["estruturaOk"] else "DIFERENTE do original - rever"
    print("\n=== Resumo ===")
    print(f"Máscaras aplicadas: {r['totalMascaras']}")
    print(f"Linhas: {r['linhasSaida']} / {r['linhasOriginal']}")
    print(f"Estrutura: {estrutura}")
    if r["linhasContagemErrada"]:
        print(f"AVISO: número de palavras diferente nas linhas "
              f"{r['linhasContagemErrada']}")
    print(f"Linhas alteradas: {len(r['linhasAlteradas'])}")
    for ln in r["linhasAlteradas"]:
        print(f"  {ln}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Anonimizador de documentos PDF com Gemini")
    parser.add_argument("pdf", type=Path, nargs="?", default=PDF_FILE,
                        help="PDF a anonimizar (por omissão o do desafio)")
    parser.add_argument("--prompt", type=Path, default=PROMPT_FILE,
                        help="Ficheiro do prompt (por omissão rewrite.txt)")
    parser.add_argument("--sem-revisao", action="store_true",
                        help="Não abre o diff no VS Code")
    args = parser.parse_args(argv)

    try:
        cfg = load_config()
    except ValueError as e:
        print(e, file=sys.stderr)
        return 2

    if not args.pdf.exists() or args.pdf.suffix.lower() != ".pdf":
        print(f"PDF não encontrado ou inválido: {args.pdf}", file=sys.stderr)
        return 2

    template = args.prompt.read_text(encoding="utf-8")
    print(f"A anonimizar {args.pdf.name} com {cfg.model} "
          f"(prompt: {args.prompt.name})...")
    try:
        r = executar(args.pdf, template, lambda p: anonimizar(p, cfg),
                     SUBMISSION_DIR, WORK_DIR)
    except (LLMError, ValueError) as e:
        print(f"Erro: {e}", file=sys.stderr)
        return 2

    imprimir_resumo(r)
    if not args.sem_revisao:
        revisao_manual(WORK_DIR / "original.txt",
                       SUBMISSION_DIR / "submission.txt")
    print(f"\nGravado em: {SUBMISSION_DIR / 'submission.txt'} e "
          f"{SUBMISSION_DIR / 'prompt.txt'}")
    return 0
