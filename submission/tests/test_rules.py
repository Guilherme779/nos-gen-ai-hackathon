from anonymizer.rules import mascarar_intervalos


def test_mascarar_intervalos_preserva_espacos():
    linha = "  Nome:  Ana Correia, ok"
    inicio = linha.index("Ana")
    fim = linha.index(",")
    assert mascarar_intervalos(linha, [(inicio, fim)]) == "  Nome:  * *, ok"


def test_mascarar_intervalos_sem_intervalos_nao_muda():
    assert mascarar_intervalos("Nome: Ana", []) == "Nome: Ana"
