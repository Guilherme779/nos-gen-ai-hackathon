"""Caminhos do projeto e configuração lida do ficheiro .env."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
SUBMISSION_DIR = REPO / "submission"
PROMPT_FILE = SUBMISSION_DIR / "prompt.txt"
PDF_FILE = REPO / "raw_data" / "document_to_anonymize.pdf"
WORK_DIR = REPO / "saida"
PLACEHOLDER = "{DOCUMENT}"


@dataclass(frozen=True)
class Config:
    api_key: str
    model: str
    temperature: float = 0.0
    max_output_tokens: int = 16000
    max_retries: int = 5
    cache_dir: Path = REPO / ".cache" / "llm"


def load_config() -> Config:
    """Lê a configuração do ambiente (ou do ficheiro .env na raiz)."""
    load_dotenv(REPO / ".env")
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    model = os.getenv("GEMINI_MODEL")
    if not api_key or not model:
        raise ValueError("Define GEMINI_API_KEY e GEMINI_MODEL no ficheiro "
                         ".env (ver .env.example)")
    return Config(
        api_key=api_key,
        model=model,
        temperature=float(os.getenv("LLM_TEMPERATURE", "0")),
        max_retries=int(os.getenv("LLM_MAX_RETRIES", "5")),
        cache_dir=REPO / os.getenv("LLM_CACHE_DIR", ".cache/llm"),
    )
