import base64
import hashlib

from anonymizer.resposta_api import (construir_resposta, construir_spans,
                                     nome_download)

ORIGINAL = "Nome: Ana Correia,\nEmail: ana@mail.pt\nIdade: 40 anos\n"
ANONIMO = "Nome: * *,\nEmail: *\nIdade: 40 anos\n"


def validar_como_frontend(r):
    """Mesmas regras que validateResult/readDownload em result-utils.ts."""
    assert r["status"] == "completed"
    assert r["anonymized_text"].strip()
    dados = base64.b64decode(r["download"]["base64"])
    assert dados.decode("utf-8") == r["anonymized_text"]
    assert len(dados) == r["download"]["byte_length"]
    assert hashlib.sha256(dados).hexdigest() == r["download"]["sha256"]
    for lado, texto in (("original", r["original_text"]),
                        ("result", r["anonymized_text"])):
        anterior = 0
        for s in r["spans"] or []:
            ini, fim = s[f"{lado}_start"], s[f"{lado}_end"]
            assert anterior <= ini < fim <= len(texto)
            anterior = fim


def test_spans_por_sequencia_de_palavras():
    spans = construir_spans(ORIGINAL, ANONIMO)
    assert len(spans) == 2
    nome, email = spans
    assert ORIGINAL[nome["original_start"]:nome["original_end"]] == \
        "Ana Correia,"
    assert ANONIMO[nome["result_start"]:nome["result_end"]] == "* *,"
    assert nome["word_count"] == 2 and "category" not in nome
    assert email["category"] == "email" and email["word_count"] == 1


def test_spans_none_se_desalinhado():
    assert construir_spans("a b\nc", "a *\nc\nd") is None
    assert construir_spans("a b\nc", "*\nc") is None


def test_resposta_completa_valida():
    r = construir_resposta(ORIGINAL, ANONIMO, "relatorio.pdf", 1, 1234)
    validar_como_frontend(r)
    assert r["summary"] == {"masked_spans": 2, "substitutions": 3,
                            "categories": ["email"],
                            "categories_complete": False}
    assert r["download"]["filename"] == "relatorio-anonimizado.txt"
    assert r["page_count"] == 1 and r["processing_ms"] == 1234


def test_resposta_sem_spans_continua_valida():
    r = construir_resposta("a b", "a b c", "x.pdf", None, None)
    validar_como_frontend(r)
    assert r["spans"] is None
    assert r["summary"]["masked_spans"] is None


def test_acentos_contam_como_um_caractere():
    original = "Nome: João Conceição\n"
    r = construir_resposta(original, "Nome: * *\n", "a.pdf", 1, 1)
    validar_como_frontend(r)
    s = r["spans"][0]
    assert original[s["original_start"]:s["original_end"]] == \
        "João Conceição"


def test_nome_download_seguro():
    assert nome_download("..\\pasta/Relatório final.pdf") == \
        "Relatório_final-anonimizado.txt"
    assert nome_download("") == "documento-anonimizado.txt"
