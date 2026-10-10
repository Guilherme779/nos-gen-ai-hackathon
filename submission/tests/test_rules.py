from anonymizer.rules import (aplicar_regras, encontrar, iban_valido,
                              luhn_valido, mascarar_intervalos)


# --- máscara por palavra ---

def test_mascarar_intervalos_preserva_espacos():
    linha = "  Nome:  Ana Correia, ok"
    inicio = linha.index("Ana")
    fim = linha.index(",")
    assert mascarar_intervalos(linha, [(inicio, fim)]) == "  Nome:  * *, ok"


# --- regras ---

def test_email():
    assert aplicar_regras("Email: ana.correia@example.pt,") == "Email: *,"


def test_telefone_com_prefixo_e_agrupado():
    assert aplicar_regras("Telefone: +351 934 567 890") == \
        "Telefone: * * * *"
    assert aplicar_regras("Telefone: +351934567890") == "Telefone: *"
    assert aplicar_regras("ligar 934 567 890 hoje") == "ligar * * * hoje"


def test_telefone_sem_prefixo_precisa_de_contexto():
    assert aplicar_regras("Tel.: 934567890") == "Tel.: *"
    assert aplicar_regras("Código 934567890") == "Código 934567890"


def test_nif_e_niss_precisam_de_contexto():
    assert aplicar_regras("NIF: 123456789") == "NIF: *"
    assert aplicar_regras("Número da Segurança Social: 11223344556") == \
        "Número da Segurança Social: *"
    assert aplicar_regras("apólice nº 987654321") == "apólice nº 987654321"


def test_cartao_de_cidadao():
    assert aplicar_regras("Cartão de Cidadão: 87654321-0AB1") == \
        "Cartão de Cidadão: *"


def test_cartao_bancario():
    assert luhn_valido("4111 1111 1111 1111")
    assert not luhn_valido("4111 1111 1111 1112")
    assert aplicar_regras("pago com 4111 1111 1111 1111.") == \
        "pago com * * * *."
    # Luhn inválido mas com a palavra "cartão" antes: mascara na mesma
    assert aplicar_regras("cartão: 1234 5678 1234 5678") == \
        "cartão: * * * *"
    assert aplicar_regras("lote 1234 5678 1234 5678") == \
        "lote 1234 5678 1234 5678"


def test_iban():
    assert iban_valido("PT50 0002 0123 1234 5678 9015 4")
    assert not iban_valido("PT50 0002 0123 1234 5678 9015 5")
    assert aplicar_regras("IBAN: PT50 0002 0123 1234 5678 9015 4") == \
        "IBAN: * * * * * * *"


def test_nao_mascara_datas_nem_referencias():
    for linha in ["Data: 15 de abril de 2025",
                  "Referência: ADM-2025-04-15-089",
                  "Pressão arterial na admissão: 145/90 mmHg",
                  "CRM: 12345-PT",
                  "consulta em 15/04/2025"]:
        assert encontrar(linha) == []


def test_numero_de_palavras_nunca_muda():
    texto = ("Telefone: +351 934 567 890\nNIF: 123456789\n"
             "IBAN: PT50 0002 0123 1234 5678 9015 4")
    for a, b in zip(texto.split("\n"), aplicar_regras(texto).split("\n")):
        assert len(a.split()) == len(b.split())
