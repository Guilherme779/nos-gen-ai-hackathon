import pytest

from anonymizer import config
from anonymizer.extract import extrair_texto_pdf


def test_extrai_inicio_do_documento():
    texto = extrair_texto_pdf(config.PDF_FILE)
    linhas = [ln for ln in texto.splitlines() if ln.strip()]
    assert linhas[0].strip() == "Relatório de Admissão - Centro Médico Lisboa"
    assert linhas[2].strip() == "Referência: ADM-2025-04-15-089"


def test_config_le_variaveis(monkeypatch):
    monkeypatch.setattr(config, "load_dotenv", lambda *a, **k: None)
    monkeypatch.setenv("GEMINI_API_KEY", "chave-falsa")
    monkeypatch.setenv("GEMINI_MODEL", "modelo-falso")
    cfg = config.load_config()
    assert cfg.api_key == "chave-falsa"
    assert cfg.model == "modelo-falso"
    assert cfg.temperature == 0.0


def test_config_sem_chave_da_erro(monkeypatch):
    monkeypatch.setattr(config, "load_dotenv", lambda *a, **k: None)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_MODEL", "modelo-falso")
    with pytest.raises(ValueError):
        config.load_config()
