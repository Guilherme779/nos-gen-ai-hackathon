"""Torna o código de submission/src importável, corra o pytest de onde correr.

Com o pytest.ini de submission/src isto já acontece; este ficheiro faz o
mesmo quando alguém corre `pytest` a partir da raiz do repositório.
"""

import sys
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parents[1]
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
