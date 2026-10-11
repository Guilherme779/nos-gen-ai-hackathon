from anonymizer.verificar import verificar_submissao

SRC = ["Nome: Ana Correia,", "NIF: 123 ok"]


def escrever(pasta, sub, prompt="Anonimiza:\n{DOCUMENT}"):
    (pasta / "submission.txt").write_text(sub, encoding="utf-8")
    (pasta / "prompt.txt").write_text(prompt, encoding="utf-8")


def test_tudo_ok(tmp_path):
    escrever(tmp_path, "Nome: * *,\nNIF: * ok\n")
    assert verificar_submissao(tmp_path, SRC) == []


def test_ficheiro_em_falta(tmp_path):
    (tmp_path / "prompt.txt").write_text("x", encoding="utf-8")
    assert verificar_submissao(tmp_path, SRC) == [
        "submission.txt não existe ou está vazio"]


def test_ficheiro_vazio(tmp_path):
    escrever(tmp_path, "Nome: * *,\nNIF: * ok\n", prompt="  \n")
    assert verificar_submissao(tmp_path, SRC) == [
        "prompt.txt não existe ou está vazio"]


def test_detecta_problemas(tmp_path):
    escrever(tmp_path, "Nome: *\n\nNIF: * OK\n",
             prompt="AIza" + "x" * 30)
    problemas = verificar_submissao(tmp_path, SRC)
    assert "prompt.txt parece conter uma chave da API" in problemas
    assert "submission.txt tem linhas vazias" in problemas
    assert "linha 1: 3 palavras -> 2" in problemas
    assert "linha 2: 'ok' mudou para 'OK'" in problemas


def test_linhas_a_menos(tmp_path):
    escrever(tmp_path, "Nome: * *,\n")
    assert "submission.txt tem 1 linhas, o original tem 2" in \
        verificar_submissao(tmp_path, SRC)
