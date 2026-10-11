from anonymizer import config
from anonymizer.cli import executar
from anonymizer.llm import construir_prompt

TEMPLATE = "Anonimiza:\n{DOCUMENT}"


def documento(prompt):
    return prompt.split("Anonimiza:\n", 1)[1]


def test_construir_prompt_substitui_marcador():
    assert construir_prompt("DOC:\n{DOCUMENT}", "x") == "DOC:\nx"


def test_executar_com_llm_falso(tmp_path):
    enviados = []

    def llm_falso(prompt):
        enviados.append(prompt)
        # devolve o documento sem alterações, dentro de um bloco ```
        return "```\n" + documento(prompt) + "\n```"

    r = executar(config.PDF_FILE, TEMPLATE, llm_falso, tmp_path,
                 tmp_path / "saida", usar_regras=False)

    assert len(enviados) == 1 and "{DOCUMENT}" not in enviados[0]
    assert r["estruturaOk"]
    assert r["linhasAlteradas"] == []
    assert r["problemas"] == []
    sub = (tmp_path / "submission.txt").read_text(encoding="utf-8")
    assert sub.startswith("Relatório de Admissão")
    assert "\n\n" not in sub
    assert (tmp_path / "prompt.txt").read_text(encoding="utf-8") == TEMPLATE


def test_regras_correm_antes_do_llm(tmp_path):
    enviados = []

    def llm_eco(prompt):
        enviados.append(prompt)
        return documento(prompt)

    r = executar(config.PDF_FILE, TEMPLATE, llm_eco, tmp_path,
                 tmp_path / "saida")
    assert "maria.santos@emailpessoal.pt" not in enviados[0]
    assert "Email: *" in enviados[0]
    assert "12: Email: *" in r["linhasAlteradas"]

    executar(config.PDF_FILE, TEMPLATE, llm_eco, tmp_path,
             tmp_path / "saida", usar_regras=False)
    assert "maria.santos@emailpessoal.pt" in enviados[1]


def test_reparacao_corrige_contagem(tmp_path):
    def llm_que_junta(prompt):
        # junta os quatro asteriscos do telefone num só
        return documento(prompt).replace("Telefone: * * * *",
                                         "Telefone: *")

    r = executar(config.PDF_FILE, TEMPLATE, llm_que_junta, tmp_path,
                 tmp_path / "saida")
    assert r["linhasReparadas"] == [11]
    assert r["linhasContagemErrada"] == []
    assert r["problemas"] == []

    r = executar(config.PDF_FILE, TEMPLATE, llm_que_junta, tmp_path,
                 tmp_path / "saida", reparar=False)
    assert r["linhasContagemErrada"] == [11]
    assert "linha 11: 5 palavras -> 2" in r["problemas"]
