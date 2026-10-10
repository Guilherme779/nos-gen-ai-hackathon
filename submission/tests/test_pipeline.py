from anonymizer import config
from anonymizer.cli import executar
from anonymizer.llm import construir_prompt

TEMPLATE = "Anonimiza:\n{DOCUMENT}"


def test_construir_prompt_substitui_marcador():
    assert construir_prompt("DOC:\n{DOCUMENT}", "x") == "DOC:\nx"


def test_executar_com_llm_falso(tmp_path):
    enviados = []

    def llm_falso(prompt):
        enviados.append(prompt)
        # devolve o documento sem alterações, dentro de um bloco ```
        return "```\n" + prompt.split("Anonimiza:\n", 1)[1] + "\n```"

    r = executar(config.PDF_FILE, TEMPLATE, llm_falso, tmp_path,
                 tmp_path / "saida")

    assert len(enviados) == 1 and "{DOCUMENT}" not in enviados[0]
    assert r["estruturaOk"]
    assert r["linhasAlteradas"] == []
    sub = (tmp_path / "submission.txt").read_text(encoding="utf-8")
    assert sub.startswith("Relatório de Admissão")
    assert "\n\n" not in sub
    assert (tmp_path / "prompt.txt").read_text(encoding="utf-8") == TEMPLATE
