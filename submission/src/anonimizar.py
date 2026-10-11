"""
The *-Files - Anonimizador com Gemini

Uso (a partir de submission/src):
  python anonimizar.py
  python anonimizar.py --sem-revisao

Fluxo: PDF (PyMuPDF) -> prompt (submission/prompt.txt) ->
Gemini -> limpeza e validação -> submission/submission.txt
"""

import sys

from anonymizer.cli import main

if __name__ == "__main__":
    sys.exit(main())
