"""
The *-Files - Anonimizador com Gemini

Uso (a partir da raiz do repositório):
  python submission/anonimizar.py
  python submission/anonimizar.py --sem-revisao

Fluxo: PDF (PyMuPDF) -> prompt (submission/prompt.txt) ->
Gemini -> limpeza e validação -> submission/submission.txt
"""

import sys

from anonymizer.cli import main

if __name__ == "__main__":
    sys.exit(main())
