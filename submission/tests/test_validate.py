from anonymizer.validate import (e_mascara, limpar_linhas, mascarar_token,
                                 remover_fences, validar)

SRC = "Nome: Ana Correia\n\nNIF: 123456789\n"


def test_limpar_linhas_remove_vazias_e_espacos_finais():
    assert limpar_linhas("a  \n\n   \n  b\n") == ["a", "  b"]


def test_remover_fences():
    assert remover_fences("```text\nNome: * *\n```") == "Nome: * *\n"


def test_validar_estrutura_ok():
    r = validar(SRC, "Nome: * *\nNIF: *")
    assert r["estruturaOk"]
    assert r["totalMascaras"] == 3
    assert r["linhasContagemErrada"] == []
    assert r["linhasAlteradas"] == ["1: Nome: * *", "2: NIF: *"]


def test_validar_detecta_contagem_errada():
    r = validar(SRC, "Nome: *\nNIF: *")
    assert r["linhasContagemErrada"] == [1]


def test_validar_detecta_linhas_a_mais():
    r = validar(SRC, "Nome: * *\nNIF: *\nlinha extra")
    assert not r["estruturaOk"]


def test_mascarar_token_mantem_pontuacao():
    assert mascarar_token("Correia,") == "*,"
    assert mascarar_token("(João,") == "(*,"
    assert mascarar_token("123)") == "*)"
    assert mascarar_token("*") == "*"
    assert mascarar_token("...") == "..."


def test_e_mascara():
    assert e_mascara("*") and e_mascara("*,") and e_mascara("(*,")
    assert not e_mascara("Ana") and not e_mascara("*a")
