from types import SimpleNamespace

import pytest

from anonymizer.config import Config
from anonymizer.llm import LLMError, anonimizar

CHAVE = "CHAVE-SECRETA-DE-TESTE"


class ErroFalso(Exception):
    def __init__(self, code):
        super().__init__(f"erro {code}")
        self.code = code


def resposta(texto, finish="STOP"):
    parte = SimpleNamespace(text=texto, thought=False)
    cand = SimpleNamespace(finish_reason=SimpleNamespace(name=finish),
                           content=SimpleNamespace(parts=[parte]))
    return SimpleNamespace(candidates=[cand], prompt_feedback=None)


class ClienteFalso:
    """Devolve (ou lança) os resultados da lista, por ordem."""

    def __init__(self, resultados):
        self.resultados = list(resultados)
        self.chamadas = 0
        self.models = self

    def generate_content(self, model, contents, config):
        self.chamadas += 1
        r = self.resultados.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


@pytest.fixture
def cfg(tmp_path):
    return Config(api_key=CHAVE, model="modelo-teste", max_retries=3,
                  cache_dir=tmp_path / "cache")


def test_sucesso(cfg):
    cliente = ClienteFalso([resposta("Nome: * *")])
    assert anonimizar("p", cfg, client=cliente) == "Nome: * *"


def test_cache_evita_segundo_pedido(cfg):
    anonimizar("p", cfg, client=ClienteFalso([resposta("ok")]))
    cliente = ClienteFalso([])
    assert anonimizar("p", cfg, client=cliente) == "ok"
    assert cliente.chamadas == 0


def test_prompt_diferente_nao_usa_cache(cfg):
    anonimizar("p1", cfg, client=ClienteFalso([resposta("um")]))
    assert anonimizar("p2", cfg, client=ClienteFalso([resposta("dois")])) \
        == "dois"


def test_429_repete_e_espera(cfg):
    esperas = []
    cliente = ClienteFalso([ErroFalso(429), resposta("ok")])
    assert anonimizar("p", cfg, client=cliente, sleep=esperas.append) == "ok"
    assert cliente.chamadas == 2
    assert len(esperas) == 1


def test_429_sempre_desiste(cfg):
    esperas = []
    cliente = ClienteFalso([ErroFalso(429)] * 4)
    with pytest.raises(LLMError):
        anonimizar("p", cfg, client=cliente, sleep=esperas.append)
    assert cliente.chamadas == 4
    assert len(esperas) == 3


def test_403_falha_logo(cfg):
    esperas = []
    cliente = ClienteFalso([ErroFalso(403)])
    with pytest.raises(LLMError):
        anonimizar("p", cfg, client=cliente, sleep=esperas.append)
    assert esperas == []


def test_sem_candidatos(cfg):
    vazia = SimpleNamespace(candidates=[], prompt_feedback="bloqueado")
    with pytest.raises(LLMError):
        anonimizar("p", cfg, client=ClienteFalso([vazia]))


def test_resposta_cortada(cfg):
    with pytest.raises(LLMError):
        anonimizar("p", cfg,
                   client=ClienteFalso([resposta("x", "MAX_TOKENS")]))


def test_chave_nao_vai_para_a_cache(cfg):
    anonimizar("p", cfg, client=ClienteFalso([resposta("ok")]))
    for f in cfg.cache_dir.iterdir():
        assert CHAVE not in f.read_text(encoding="utf-8")
