"""Regras de regex para dados com formato fixo, aplicadas antes do LLM.

Só mascaram o que é inequívoco (emails, telefones, cartões, IBAN, números
de identificação com o rótulo ao lado). O resto fica para o LLM.
Cada palavra tocada por uma regra passa a "*" e a pontuação colada
mantém-se, por isso o número de palavras de cada linha nunca muda.
"""

import re
import unicodedata

from .validate import mascarar_token

JANELA_CONTEXTO = 40

CONTEXTO_ID = ("nif", "contribuinte", "fiscal", "seguranca social", "niss",
               "utente", "cartao de cidadao", "passaporte", "identificacao")
CONTEXTO_TELEFONE = ("tel", "telefone", "telemovel", "contacto", "contato",
                     "movel", "fax")
CONTEXTO_CARTAO = ("cartao", "card", "visa", "mastercard")

RE_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
RE_TELEFONE = re.compile(
    r"(?<![\w+])(?P<prefixo>(?:\+|00)351[\s.-]?)?"
    r"(?P<numero>(?:9[1236]|2\d)\d(?P<sep>[\s.-]?)\d{3}(?P=sep)\d{3})"
    r"(?![\w])")
RE_CARTAO = re.compile(r"(?<!\d)(?:\d{4}[ -]){3}\d{4}(?!\d)")
RE_IBAN = re.compile(
    r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b")
RE_CC = re.compile(r"(?<![\w-])\d{8} ?-? ?\d ?[A-Z]{2}\d(?![\w-])")
RE_NIF = re.compile(r"(?<![\w-])\d{9}(?![\w-])")
RE_NISS = re.compile(r"(?<![\w-])[12]\d{10}(?![\w-])")


def sem_acentos(s: str) -> str:
    nfkd = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def tem_contexto(linha: str, inicio: int, palavras: tuple[str, ...]) -> bool:
    antes = sem_acentos(linha[max(0, inicio - JANELA_CONTEXTO):inicio])
    return any(re.search(r"\b" + p + r"\b", antes) for p in palavras)


def luhn_valido(numero: str) -> bool:
    digitos = [int(c) for c in numero if c.isdigit()]
    total = 0
    for i, d in enumerate(reversed(digitos)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def iban_valido(iban: str) -> bool:
    s = iban.replace(" ", "")
    s = s[4:] + s[:4]
    numero = "".join(str(int(c, 36)) for c in s)
    return int(numero) % 97 == 1


def encontrar(linha: str) -> list[tuple[int, int, str]]:
    """Devolve (início, fim, regra) de cada dado encontrado na linha."""
    achados = []
    for m in RE_EMAIL.finditer(linha):
        achados.append((m.start(), m.end(), "email"))
    for m in RE_TELEFONE.finditer(linha):
        agrupado = m.group("sep") != ""
        if (m.group("prefixo") or agrupado
                or tem_contexto(linha, m.start(), CONTEXTO_TELEFONE)):
            achados.append((m.start(), m.end(), "telefone"))
    for m in RE_CARTAO.finditer(linha):
        if luhn_valido(m.group()) or tem_contexto(linha, m.start(),
                                                  CONTEXTO_CARTAO):
            achados.append((m.start(), m.end(), "cartao"))
    for m in RE_IBAN.finditer(linha):
        if iban_valido(m.group()):
            achados.append((m.start(), m.end(), "iban"))
    for m in RE_CC.finditer(linha):
        achados.append((m.start(), m.end(), "cc"))
    for m in RE_NIF.finditer(linha):
        if tem_contexto(linha, m.start(), CONTEXTO_ID):
            achados.append((m.start(), m.end(), "nif"))
    for m in RE_NISS.finditer(linha):
        if tem_contexto(linha, m.start(), CONTEXTO_ID):
            achados.append((m.start(), m.end(), "niss"))
    return sorted(achados)


def mascarar_intervalos(linha: str, intervalos: list[tuple[int, int]]) -> str:
    """Mascara cada palavra que toca algum intervalo [início, fim)."""
    partes = []
    pos = 0
    for m in re.finditer(r"\S+", linha):
        partes.append(linha[pos:m.start()])
        toca = any(s < m.end() and m.start() < e for s, e in intervalos)
        partes.append(mascarar_token(m.group()) if toca else m.group())
        pos = m.end()
    partes.append(linha[pos:])
    return "".join(partes)


def aplicar_regras(texto: str) -> str:
    linhas = []
    for linha in texto.split("\n"):
        intervalos = [(s, e) for s, e, _ in encontrar(linha)]
        linhas.append(mascarar_intervalos(linha, intervalos)
                      if intervalos else linha)
    return "\n".join(linhas)
