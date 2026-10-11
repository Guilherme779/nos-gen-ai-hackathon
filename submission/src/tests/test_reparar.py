from anonymizer.reparar import reparar_linha, reparar_texto

MORADA = "Morada: Avenida da Liberdade, 200, Bloco 3, 1250-096 Lisboa"


def test_linha_certa_fica_igual():
    saida = "Morada: Avenida da Liberdade, *, * *, 1250-096 Lisboa"
    assert reparar_linha(MORADA, saida) == saida


def test_asteriscos_a_menos():
    saida = "Morada: Avenida da Liberdade, *, *, 1250-096 Lisboa"
    assert reparar_linha(MORADA, saida) == \
        "Morada: Avenida da Liberdade, *, * *, 1250-096 Lisboa"


def test_asteriscos_a_mais():
    original = "Professora no Hospital de São João"
    saida = "Professora no * * * * * *"
    assert reparar_linha(original, saida) == "Professora no * * * *"


def test_mantem_pontuacao_do_original():
    original = "Filhos: 2 (Pedro, 15 anos e Rita, 12 anos)"
    saida = "Filhos: 2 (* * 15 anos e *, 12 anos)"
    assert reparar_linha(original, saida) == \
        "Filhos: 2 (*, 15 anos e *, 12 anos)"


def test_palavra_alterada_nao_se_repara():
    original = "Nome: Ana Correia"
    assert reparar_linha(original, "Name: * * *") is None


def test_reparar_texto_so_mexe_nas_linhas_erradas():
    original = "Nome: Ana Correia\n\n" + MORADA + "\n"
    saida = "```\nNome: * *\n" + \
        "Morada: Avenida da Liberdade, *, *, 1250-096 Lisboa\n```"
    texto, linhas = reparar_texto(original, saida)
    assert linhas == [2]
    assert texto.split("\n") == [
        "Nome: * *",
        "Morada: Avenida da Liberdade, *, * *, 1250-096 Lisboa"]


def test_reparar_texto_com_linhas_a_mais_nao_mexe():
    saida = "Nome: *\nextra"
    assert reparar_texto("Nome: Ana Correia", saida) == (saida, [])
