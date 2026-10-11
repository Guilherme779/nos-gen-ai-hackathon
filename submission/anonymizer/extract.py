"""Extração de texto do PDF, igual a tutorials/pdf__to__txt.ipynb."""

from pathlib import Path

import fitz  # PyMuPDF


def extrair_texto_pdf(caminho: Path) -> str:
    texto = ""
    with fitz.open(caminho) as doc:
        for page in doc:
            texto += page.get_text()
    return texto


def extrair_pdf_bytes(dados: bytes) -> tuple[str, int]:
    """Texto e número de páginas de um PDF recebido em memória."""
    texto = ""
    with fitz.open(stream=dados, filetype="pdf") as doc:
        for page in doc:
            texto += page.get_text()
        return texto, doc.page_count
