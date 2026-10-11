# Plano da equipa CodingBros

Desafio: The *-Files (NOS, JunctionX Lisbon 2026, 10-11 outubro).

Cada pessoa é dona de ficheiros concretos e só ela os edita. Cada commit é
feito por quem fez o trabalho, a partir da sua conta GitHub. Tudo entra em
`team_CodingBros` por pull request revisto por outra pessoa e integrado com
"Create a merge commit".

## Pessoas e responsabilidades

| Pessoa | Papel | Branch(es) | Ficheiros |
|---|---|---|---|
| A | Pipeline e integração | `feat/skeleton`, `feat/integracao`, `feat/submissao` | `config.py`, `extract.py`, `validate.py`, `llm.py` (versão inicial), `cli.py`, `anonimizar.py`, `requirements*.txt`, `pytest.ini`, `.gitignore`, `.env.example`, `submission.txt`, `prompt.txt` |
| B | LLM e prompt | `feat/llm` | `llm.py` (repetição e cache), `prompt.txt` (v3), `docs/prompt-changelog.md` |
| C | Regras (regex) | `feat/rules` | `rules.py` e os seus testes |
| D | Validação da saída | `feat/validacao` | `reparar.py`, `verificar.py` e os seus testes |
| E | Documentação e pitch | `docs/documentacao` | `README.md`, `docs/plano-equipa.md`, `docs/politica.md`, `docs/arquitetura.md`, `docs/pitch.md` |

Revisão de pull requests: A é revisto por E, B por A, C por B, D por C,
E por D.

## Ordem de trabalho

1. A abre o PR do esqueleto (`feat/skeleton`). Quando é integrado, B, C e D
   começam. E pode começar logo, porque só mexe em documentação.
2. B, C e D trabalham em paralelo, cada um no seu branch, e abrem o seu PR.
3. Depois de B, C e D integrados, A liga as regras, a reparação e a
   verificação ao pipeline (`feat/integracao`).
4. A corre o pipeline, faz commit do `submission.txt` e do `prompt.txt` e
   abre o PR para `nosportugal/nos-gen-ai-hackathon`.
5. E atualiza o README com o resultado oficial e a equipa ensaia o pitch.

## Regras

- Nunca trabalhar no `main`.
- Antes de cada push: `flake8 .` e `python -m pytest` sem erros.
- Nunca editar `submission.txt` à mão: só o script o escreve.
- Nunca fazer commit do `.env` nem de chaves.
- Sem squash, rebase-merge ou force-push.
- Cada pessoa confirma que `git config user.email` é o email da sua conta
  GitHub, senão os commits não lhe são atribuídos.
