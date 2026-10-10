from anonymizer import config
from anonymizer.cli import processar
from anonymizer.extract import extrair_pdf_bytes, extrair_texto_pdf

TEMPLATE = "Anonimiza:\n{DOCUMENT}"


def eco(prompt):
    return prompt.split("Anonimiza:\n", 1)[1]


def test_extrair_pdf_bytes_igual_ao_ficheiro():
    texto, paginas = extrair_pdf_bytes(config.PDF_FILE.read_bytes())
    assert texto == extrair_texto_pdf(config.PDF_FILE)
    assert paginas >= 1


def test_processar_nao_escreve_ficheiros(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    antes = config.SUBMISSION_DIR.joinpath("submission.txt").read_bytes()
    r = processar("Email: ana@mail.pt\n\nNome: Ana\n", TEMPLATE, eco)
    assert r["anonimizado"] == "Email: *\nNome: Ana"
    assert r["estruturaOk"]
    assert r["linhasReparadas"] == []
    assert list(tmp_path.iterdir()) == []
    depois = config.SUBMISSION_DIR.joinpath("submission.txt").read_bytes()
    assert antes == depois


def test_processar_texto_vazio_da_erro():
    try:
        processar("   \n", TEMPLATE, eco)
    except ValueError:
        return
    raise AssertionError("devia dar ValueError")
