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
from .reparar import reparar_texto
from .rules import aplicar_regras
from .validate import limpar_linhas, validar
from .verificar import verificar_submissao


def executar(pdf: Path, template: str, chamar_llm: Callable[[str], str],
             submission_dir: Path, work_dir: Path,
             usar_regras: bool = True, reparar: bool = True) -> dict:
    """Corre o pipeline e escreve submission.txt, prompt.txt e o original."""
    texto = extrair_texto_pdf(pdf)
    if not texto.strip():
        raise ValueError("O PDF não tem texto extraível.")

    # 1. As regras mascaram primeiro o que tem formato fixo; o LLM vê "*"
    #    nesses sítios e trata do resto.
    texto_llm = aplicar_regras(texto) if usar_regras else texto
    resposta = chamar_llm(construir_prompt(template, texto_llm))

    # 2. Se o LLM se enganou a contar asteriscos numa linha, corrige a
    #    contagem (não muda o que foi mascarado).
    reparadas = []
    if reparar:
        resposta, reparadas = reparar_texto(texto, resposta)

    # 3. A validação compara sempre com o texto original.
    r = validar(texto, resposta)
    r["linhasReparadas"] = reparadas

    work_dir.mkdir(parents=True, exist_ok=True)
    (work_dir / "original.txt").write_text(r["original"] + "\n",
                                           encoding="utf-8")
    (submission_dir / "submission.txt").write_text(r["anonimizado"] + "\n",
                                                   encoding="utf-8")
    # prompt.txt = prompt exato usado, com o documento como {DOCUMENT}
    (submission_dir / "prompt.txt").write_text(template, encoding="utf-8")

    r["problemas"] = verificar_submissao(submission_dir,
                                         limpar_linhas(texto))
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
    if r["linhasReparadas"]:
        print(f"Contagem de asteriscos corrigida nas linhas "
              f"{r['linhasReparadas']}")
    if r["linhasContagemErrada"]:
        print(f"AVISO: número de palavras diferente nas linhas "
              f"{r['linhasContagemErrada']}")
    print(f"Linhas alteradas: {len(r['linhasAlteradas'])}")
    for ln in r["linhasAlteradas"]:
        print(f"  {ln}")
    print("\n=== Verificação da submissão ===")
    for p in r["problemas"]:
        print(f"FALHA: {p}")
    print("OK" if not r["problemas"] else
          f"{len(r['problemas'])} problema(s): não submeter assim")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Anonimizador de documentos PDF com Gemini")
    parser.add_argument("pdf", type=Path, nargs="?", default=PDF_FILE,
                        help="PDF a anonimizar (por omissão o do desafio)")
    parser.add_argument("--prompt", type=Path, default=PROMPT_FILE,
                        help="Ficheiro do prompt (por omissão rewrite.txt)")
    parser.add_argument("--sem-revisao", action="store_true",
                        help="Não abre o diff no VS Code")
    parser.add_argument("--sem-regras", action="store_true",
                        help="Não aplica as regras de regex antes do LLM")
    parser.add_argument("--sem-reparacao", action="store_true",
                        help="Não corrige a contagem de asteriscos")
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
                     SUBMISSION_DIR, WORK_DIR,
                     usar_regras=not args.sem_regras,
                     reparar=not args.sem_reparacao)
    except (LLMError, ValueError) as e:
        print(f"Erro: {e}", file=sys.stderr)
        return 2

    imprimir_resumo(r)
    if not args.sem_revisao:
        revisao_manual(WORK_DIR / "original.txt",
                       SUBMISSION_DIR / "submission.txt")
    print(f"\nGravado em: {SUBMISSION_DIR / 'submission.txt'} e "
          f"{SUBMISSION_DIR / 'prompt.txt'}")
    return 1 if r["problemas"] else 0
