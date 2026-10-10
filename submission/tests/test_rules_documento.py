"""As regras aplicadas ao documento real do desafio."""

from anonymizer import config
from anonymizer.extract import extrair_texto_pdf
from anonymizer.rules import aplicar_regras, encontrar

ESPERADO = {
    "NIF: 097865413": "nif",
    "Cartão de Cidadão: 12345678-9ZX0": "cc",
    "Telefone: +351 912 345 678": "telefone",
    "Email: maria.santos@emailpessoal.pt": "email",
    "Número da Segurança Social: 11223344556": "niss",
    "Número do cartão de crédito: 4111 2222 3333 4444 (validade 09/27, "
    "CVV 123)": "cartao",
    "Telefone: +351961234567": "telefone",
    "Email: antonio.santos@emailpessoal.pt": "email",
    "Telefone: +351939876543": "telefone",
    "Email: carlos.mendes@centromedicalisboa.pt": "email",
    "Telefone: +351213456789": "telefone",
}


def linhas_documento():
    texto = extrair_texto_pdf(config.PDF_FILE)
    return [ln.rstrip() for ln in texto.splitlines() if ln.strip()]


def test_regras_encontram_so_o_esperado():
    encontrados = {}
    for linha in linhas_documento():
        regras = [r for _, _, r in encontrar(linha)]
        if regras:
            encontrados[linha] = regras
    assert encontrados == {ln: [r] for ln, r in ESPERADO.items()}


def test_regras_nao_mudam_numero_de_palavras():
    texto = extrair_texto_pdf(config.PDF_FILE)
    for a, b in zip(texto.split("\n"), aplicar_regras(texto).split("\n")):
        assert len(a.split()) == len(b.split())
