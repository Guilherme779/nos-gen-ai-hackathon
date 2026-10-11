import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from anonymizer import config
from servidor import Motor, criar_handler

LOCAL = "http://localhost:8080"


def eco(prompt):
    return prompt.split("Anonimiza:\n", 1)[1]


@pytest.fixture
def servidor():
    motores = {}

    def iniciar(motor):
        srv = ThreadingHTTPServer(("127.0.0.1", 0), criar_handler(motor))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        motores["srv"] = srv
        return f"http://127.0.0.1:{srv.server_address[1]}"

    yield iniciar
    motores["srv"].shutdown()
    motores["srv"].server_close()


def pedir(url, metodo="GET", corpo=None, cabecalhos=None):
    req = urllib.request.Request(url, data=corpo, method=metodo,
                                 headers=cabecalhos or {})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def motor_pronto():
    return Motor("Anonimiza:\n{DOCUMENT}", eco, "ready")


def test_health(servidor):
    base = servidor(motor_pronto())
    estado, cab, corpo = pedir(base + "/api/health",
                               cabecalhos={"Origin": LOCAL})
    saude = json.loads(corpo)
    assert estado == 200
    assert saude["engine_ready"] is True and saude["busy"] is False
    assert saude["max_file_bytes"] > 0 and saude["timeout_seconds"] > 0
    assert cab["Access-Control-Allow-Origin"] == LOCAL


def test_cors_preflight_so_para_localhost(servidor):
    base = servidor(motor_pronto())
    estado, cab, _ = pedir(base + "/api/anonymize", "OPTIONS",
                           cabecalhos={"Origin": LOCAL})
    assert estado == 204
    assert "X-File-Name" in cab["Access-Control-Allow-Headers"]
    _, cab, _ = pedir(base + "/api/anonymize", "OPTIONS",
                      cabecalhos={"Origin": "https://exemplo.com"})
    assert "Access-Control-Allow-Origin" not in cab


def test_anonymize_documento_real(servidor):
    base = servidor(motor_pronto())
    pdf = config.PDF_FILE.read_bytes()
    estado, _, corpo = pedir(base + "/api/anonymize", "POST", pdf,
                             {"Content-Type": "application/pdf",
                              "X-File-Name": "relat%C3%B3rio.pdf",
                              "Origin": LOCAL})
    r = json.loads(corpo)
    assert estado == 200 and r["status"] == "completed"
    assert r["anonymized_text"].startswith("Relatório de Admissão")
    assert "Email: *" in r["anonymized_text"]
    assert r["download"]["filename"] == "relatório-anonimizado.txt"
    assert r["page_count"] >= 1
    assert r["summary"]["masked_spans"] > 0


def test_cors_producao_apenas_origem_configurada(servidor, monkeypatch):
    origem = "https://untrace-hackathon.onrender.com"
    monkeypatch.setenv("ALLOWED_ORIGINS", " " + origem + "/ ")
    base = servidor(motor_pronto())
    estado, cab, _ = pedir(base + "/api/anonymize", "OPTIONS",
                           cabecalhos={"Origin": origem})
    assert estado == 204
    assert cab["Access-Control-Allow-Origin"] == origem
    for outra in [origem + ".evil.com", "https://exemplo.com"]:
        _, cab, _ = pedir(base + "/api/health",
                          cabecalhos={"Origin": outra})
        assert "Access-Control-Allow-Origin" not in cab


def test_rejeita_nao_pdf(servidor):
    base = servidor(motor_pronto())
    estado, _, corpo = pedir(base + "/api/anonymize", "POST", b"ola",
                             {"Content-Type": "application/pdf"})
    assert estado == 400
    assert "PDF" in json.loads(corpo)["error"]["message"]


def test_ocupado_devolve_409(servidor):
    motor = motor_pronto()
    base = servidor(motor)
    motor.trinco.acquire()
    try:
        _, _, corpo = pedir(base + "/api/health")
        assert json.loads(corpo)["busy"] is True
        estado, _, _ = pedir(base + "/api/anonymize", "POST",
                             config.PDF_FILE.read_bytes())
        assert estado == 409
    finally:
        motor.trinco.release()


def test_motor_sem_configuracao(servidor):
    base = servidor(Motor(None, None, "configuration_error"))
    _, _, corpo = pedir(base + "/api/health")
    saude = json.loads(corpo)
    assert saude["engine_ready"] is False
    assert saude["engine_status"] == "configuration_error"
    estado, _, _ = pedir(base + "/api/anonymize", "POST",
                         config.PDF_FILE.read_bytes())
    assert estado == 503


def test_nao_escreve_submission(servidor):
    antes = (config.SUBMISSION_DIR / "submission.txt").read_bytes()
    base = servidor(motor_pronto())
    pedir(base + "/api/anonymize", "POST", config.PDF_FILE.read_bytes())
    assert (config.SUBMISSION_DIR / "submission.txt").read_bytes() == antes
