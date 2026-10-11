# CodingBros — The *-Files

**NOS challenge · JunctionX Lisbon 2026 · 10–11 October**

A system that reads a clinical report in PDF, finds the data that reveals
**who** each person is, and replaces every word of that data with a `*`,
while keeping the rest of the document intact: its layout, its clinical
information and its meaning.

```text
ORIGINAL                                               ANONYMIZED
Nome: Maria Conceição Oliveira Santos                  Nome: * * * *
Morada: Rua das Flores, 123, Apt 45, Sacavém, Lisboa   Morada: Rua das Flores, *, * *, Sacavém, Lisboa
A paciente Maria Santos, mulher caucasiana de 47 anos  A paciente * *, mulher caucasiana de 47 anos
Ocupação: Professora universitária na Faculdade de     Ocupação: Professora universitária na * * * * *
Direito de Lisboa
Tem histórico de hipertensão e diabetes tipo 2         Tem histórico de hipertensão e diabetes tipo 2
```

> Hide **who** the person is, not **what** the document says.

---

## Contents

1. [The challenge](#1-the-challenge)
2. [Run it in 2 minutes](#2-run-it-in-2-minutes)
3. [How it works](#3-how-it-works)
4. [The anonymization rules](#4-the-anonymization-rules)
5. [The prompt and how it evolved](#5-the-prompt-and-how-it-evolved)
6. [Our journey](#6-our-journey)
7. [Who did what](#7-who-did-what)
8. [How we worked](#8-how-we-worked)
9. [What went wrong and what we learned](#9-what-went-wrong-and-what-we-learned)
10. [Limitations and next steps](#10-limitations-and-next-steps)
11. [Repository structure](#11-repository-structure)
12. [Credits and license](#12-credits-and-license)

---

## 1. The challenge

NOS gave every team the same fictitious document,
[`raw_data/document_to_anonymize.pdf`](raw_data/document_to_anonymize.pdf):
a hospital admission report (in Portuguese) with names, tax number, home
address, phone numbers, credit card, medical history and emergency contacts.

The rules of the brief:

- each anonymized word becomes **a single `*`** (`Ana Correia` → `* *`);
- the layout is preserved; the only allowed change is removing empty lines;
- `submission/submission.txt` contains **only** the system's output, and
  `submission/prompt.txt` the exact prompt that produced it;
- grading is automatic (comparison with a hidden reference, prompt
  evaluation and `flake8`) and human (code, collaboration, documentation and
  pitch).

**Where the solution stands** (branch `team_CodingBros`):

| | |
|---|---|
| Challenge document | 60 of 60 lines, same structure as the original |
| Python tests | 64 passing (`pytest`), `flake8` clean |
| Frontend tests | 41 passing (`npm test`) |
| Merged pull requests | 12, from 5 people, always with a merge commit |
| Official score | ____ (fill in after the PR to NOS) |

---

## 2. Run it in 2 minutes

Requires Python 3.10 or newer.

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and add your Google AI Studio key:

```text
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.1-flash-lite
```

`.env` is in `.gitignore`: the key never goes into the repository.

### Generate the submission

```bash
python submission/anonimizar.py
```

It writes `submission/submission.txt`, prints a summary, checks the
submission and opens a side-by-side comparison of the original and the
result in VS Code.

| Option | Effect |
|---|---|
| `--sem-revisao` | don't open the comparison in VS Code |
| `--prompt FILE` | use another prompt |
| `--sem-regras` | don't apply the regex rules before the model |
| `--sem-reparacao` | don't fix the asterisk count |

### The demo with a user interface (Untrace)

Two terminals: the Python engine and the website.

```bash
python submission/servidor.py
```

```bash
cd frontend
npm install
npm run dev
```

Full steps (including the frontend's `.env.local`) in
[`submission/docs/demo.md`](submission/docs/demo.md).

### Tests

```bash
pip install -r requirements-dev.txt
python -m pytest
flake8 .
```

The tests never call the API: Gemini is always faked.

---

## 3. How it works

```text
raw_data/document_to_anonymize.pdf
   │
   ▼  extract.py      PDF text with PyMuPDF (as in the challenge tutorial)
   ▼  rules.py        regex masks what has a fixed, unambiguous format
   ▼  llm.py          Gemini masks the rest, reasoning from context
   ▼  reparar.py      fixes the asterisk count if the model got it wrong
   ▼  validate.py     cleans the response and compares it with the original
   ▼  cli.py          writes submission.txt
   ▼  verificar.py    confirms the submission is ready
```

| Step | What it does | Why it's done this way |
|---|---|---|
| **Extraction** | PyMuPDF's `page.get_text()`, page by page | It's the method from the challenge tutorial; the hidden reference was very likely built from the same text |
| **Rules (regex)** | Emails, Portuguese phone numbers, tax and social security numbers with their label, Citizen Card, bank cards (Luhn check or the word "cartão") and IBAN (mod 97) | Fixed-format data doesn't need a model. The rules are deliberately narrow: a false positive from a rule can't be undone later. Since each word becomes one `*`, positions don't shift and the model receives those `*` already in place |
| **Gemini** | Receives the prompt with the document and returns it rewritten, with the remaining data masked | Names on their own in the text, the employer, the door number: these need context, not a format. Temperature 0, retry with backoff on 429/5xx errors, responses cached in `.cache/llm` |
| **Repair** | If a line comes back with more or fewer words than the original, it aligns it word by word and fixes only the number of asterisks | The model is good at deciding **what** to mask but sometimes miscounts (see [section 9](#9-what-went-wrong-and-what-we-learned)). It never decides what to mask; turn it off with `--sem-reparacao` |
| **Validation and checks** | Strips code fences and empty lines, compares lines and words, looks for changed words and leftover API keys | A broken submission (extra lines, altered words) loses points in the automatic comparison |

In the challenge document, the rules catch 11 items (emails, phone numbers,
tax number, social security number, Citizen Card, bank card) and the model
handles the rest. More detail in
[`submission/docs/arquitetura.md`](submission/docs/arquitetura.md).

### The interface and the server

```text
browser (Untrace)  ──POST /api/anonymize (PDF)──▶  submission/servidor.py  ──▶  Gemini
       ◀──── anonymized text, highlighted passages, verified download ────
```

- **`submission/servidor.py`**: an HTTP server using only the standard
  library. It runs the same pipeline but **never writes `submission.txt`**.
  It handles one request at a time and only accepts pages from `localhost`
  or from the origins configured in `ALLOWED_ORIGINS`. The key stays on the
  server; the browser never sees it.
- **`frontend/`** (Untrace, built with Lovable): upload the PDF, see the
  original and the result side by side with the masked passages
  highlighted, and download the text after its SHA-256 is verified.
- **Manual review**: any word can be clicked to mask or unmask it, fixing
  false positives and false negatives by hand. The text, the counters and
  the download update. With no changes, the download is exactly the engine
  output; with changes it is named `…-revisto.txt`. See
  [`submission/docs/frontend.md`](submission/docs/frontend.md).

---

## 4. The anonymization rules

The exact rules the model follows are in
[`submission/prompt.txt`](submission/prompt.txt) itself (in Portuguese,
like the document). The reasoning is in
[`submission/docs/politica.md`](submission/docs/politica.md).

**The question that decides every case:** *"does this value, on its own or
combined with the rest of the document, reveal who the person is?"* If yes,
it is masked.

### What we mask

| Data | Why |
|---|---|
| People's names (patient, family, friends, doctors), **every** mention, including the surname alone | They identify directly |
| Tax number, Citizen Card, social security number, health service number, professional licence, insurance policy | They identify on their own and link records |
| Phone numbers and emails | They identify on their own |
| Door number, floor, apartment, block | Together with the street, they point to one specific home |
| Date of birth | Together with the town, it narrows the possible people a lot |
| Card number, expiry date, CVV, IBAN | Financial data that identifies |
| Biometric IDs | Unique identifiers |
| Specific employer | Together with the job and the age, it points to one person |
| Unique roles with an institution and a period (e.g. "mayor of X between 1999 and 2007") | They reveal the identity even without the name |

### What we keep

| Data | Why |
|---|---|
| Header (institution, date and reference of the report) | The brief shows it unchanged in its example of a correct output |
| Clinical information (symptoms, diagnoses, medication, tests, measurements) | It's what the document is about; without identifiers it no longer points to anyone |
| Age, sex, marital status, family relationship, generic job | Shared by many people |
| Street, postcode, town | Without the door number, they point to an area |
| Religion, ethnic origin, sexual orientation | They don't identify once the identifiers are gone; we don't hide them just for being sensitive |
| Batch and product codes | They identify the product, not the person |

### Format rules

- One masked word → one `*`; attached punctuation stays: `Correia,` → `*,`.
- Titles stay, the name goes: `Dr. Carlos Mendes` → `Dr. * *`.
- Labels stay, values go: `NIF: 097865413` → `NIF: *`.
- **When in doubt** about an identifier: mask it. When in doubt about
  clinical or general demographic information: keep it.

### Defence against instructions hidden in the document

The document is treated as **data, never as instructions**. It sits between
dedicated delimiters (`ANONIMIZACAO_DADOS_7F3C9A_INICIO/FIM`), and the
prompt states explicitly that commands, fake system messages, tags and
requests to reveal the prompt inside the document are text to anonymize:
they stay on their line, with names masked, and are never executed.

---

## 5. The prompt and how it evolved

The prompt is written in Portuguese, in "rewrite" mode: the model returns
the whole document with the data masked. `submission/prompt.txt` is the
single source: the program reads it directly, so it is always the exact
prompt used.

| Version | What changed | Why |
|---|---|---|
| **v1** | The prompt from the n8n prototype | Starting point; it still followed a more aggressive policy (hid ages, marital status, the full address) |
| **v2** | The "prevent identification" policy, written out in full | Team decision (see [section 6](#6-our-journey)) |
| **v3** | Invented examples instead of values from the document; word-count rule for addresses; employer example | v2 copied real data from the document (the doctor's name, phone number, date of birth, CVV), which tailors the prompt to a single document. And the model gave "Apt 45" a single `*` |
| **v4** | Delimiters against instruction injection, decision examples, edge cases (religion, names vs. places), stricter output format | Prompt quality (graded separately) and robustness |
| **v5** | Stronger defence (lines with commands stay in place, tags preserved, `n.º` treated as a label), unique roles and terms of office, batch codes | Attack cases and edge cases that v4 still let through |

With every change we checked that the result on the challenge document was
still correct: the v5 output is identical, line by line, to the submitted
file. Detailed history in
[`submission/docs/prompt-changelog.md`](submission/docs/prompt-changelog.md).

---

## 6. Our journey

The project's story is in its own Git history: **38 commits from 5 people
and 12 pull requests**, from Saturday afternoon to Sunday morning. This
section tells it in phases, with the commits of each one (`git log` on the
`team_CodingBros` branch).

### Before the first commit: deciding

We spent the first part of the hackathon **deciding**, not coding:

- **Reading the brief and the grading criteria.** Only about 15% of the
  grade depends on accuracy; collaboration (30%), documentation (10%), the
  pitch (20%) and code quality weigh more. That shaped how we organized
  everything: a branch per person, pull requests reviewed by someone else,
  documentation from the start.
- **Writing an implementation plan** with the architecture, the interfaces
  between modules, a table of decisions with defaults (who places the
  asterisks, what goes into `prompt.txt`, regex before or after the model,
  what to do with doctors' names, titles, dates and addresses) and a list of
  questions for the mentors.
- **Debating the anonymization policy.** We had two views:
  - *hide everything sensitive* (ages, marital status, religion, years, the
    full address);
  - *hide only what identifies the person*.

  We chose the second: the document is a clinical report and, without its
  clinical information, it loses the meaning the brief asks us to preserve.
- **Separating "type A" data (identifies on its own) from "type B" data
  (identifies in combination)**, which became the tables in
  [section 4](#4-the-anonymization-rules).
- **Validating the idea with an n8n prototype** (load the PDF, extract
  text, call Gemini, clean and validate the output), using the sponsors'
  resources. It worked, but the graded solution had to be code that could
  be read, tested and run, so we moved the flow to Python. Along the way we
  swapped `pypdf` for the tutorial's PyMuPDF, and Gemini 2.5 Pro (no free
  quota) for Gemini 3.1 Flash Lite.
- **Splitting the work into one plan per person**, with the code of each
  step, the order of the commits, the checks to run before each commit and
  when each person could start. Before handing them out, we replayed them
  end to end in a separate clone, to make sure every step passed the tests
  and the parallel PRs wouldn't conflict.

| Role | What | Can start |
|---|---|---|
| A | Pipeline skeleton, integration, submission | right away |
| B | Robust Gemini call and the prompt | after the skeleton |
| C | Regex rules | after the skeleton |
| D | Asterisk count repair and submission checks | after the skeleton |
| E | Documentation and pitch | right away |

### Phase 1 — Kick-off

| Commit | Author | What |
|---|---|---|
| `a469b85` | JEMCR7G | First prompt (from the n8n prototype) |
| `c28166f` | marcosantos07 | First README: preparation and criteria |
| `2f6a9ec` | marcosantos07 | License and `.gitignore` |

The first prompt still followed the "hide everything sensitive" view (ages,
marital status, full address). It was replaced by the policy decided in the
next phase.

### Phase 2 — The skeleton · [PR #1](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/1)

A pipeline that already ran end to end, so the others could build on it.

| Commit | Author | What |
|---|---|---|
| `c56755f` | Guilherme779 | Setup: `.gitignore`, `.env.example`, `requirements`, `pytest.ini` |
| `1ad43fe` | Guilherme779 | `anonymizer` package with configuration and PDF extraction |
| `3b0473a` | Guilherme779 | Cleanup and validation of the model's response |
| `5189d52` | Guilherme779 | Gemini call, prompt v2 and the `anonimizar.py` command |

### Phase 3 — Four fronts in parallel · PRs [#2](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/2) [#3](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/3) [#4](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/4) [#5](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/5)

Each person on their own branch and their own files, so the four PRs went
in without conflicts, in under 20 minutes.

| Commit | Author | What |
|---|---|---|
| `668f8bf` | JEMCR7G | Retry the request with exponential backoff on 429 and 5xx errors |
| `15ec1a9` | JEMCR7G | Cache responses so as not to spend quota |
| `1a64e16` | JEMCR7G | Prompt v3: invented examples, word count in addresses, employer |
| `6689cb8` | JEMCR7G | Prompt version history |
| `e3c79c0` | tiagfari-cmd | Asterisk count repair |
| `1672765` | tiagfari-cmd | Submission checks |
| `16e99aa` | João Sobreiro | Interval masking that preserves spacing and punctuation |
| `6fd668c` | João Sobreiro | Rules for email, phone, tax number, social security, Citizen Card, bank card and IBAN |
| `3a2bbf4` | João Sobreiro | Test of the rules on the challenge document |
| `8ef5c53` `20c42da` `74bb849` `4676d34` | marcosantos07 | Documentation branch, policy, architecture and pitch |

The merges were shared out too: #2 was merged by tiagfari-cmd, #3 by João
Sobreiro, #5 by marcosantos07 and #4 by Guilherme779.

### Phase 4 — Integration and the first submission · [PR #6](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/6)

| Commit | Author | What |
|---|---|---|
| `0bf1bb8` | Guilherme779 | Rules before the model, repair and checks wired into the pipeline |
| `cab06be` | Guilherme779 | First `submission.txt` and `prompt.txt` generated by the pipeline |

This is where we confirmed that the model miscounted asterisks ("Apt 45"
with a single `*`, the employer with six for five words) and that the
repair step fixed it, leaving all 60 lines correct.

### Phase 5 — Tidying up

| Commit | Author | What |
|---|---|---|
| `c8b3233` | Guilherme779 | `.mailmap`: one laptop had `git config` set to a different name; fixed without rewriting history |
| `bad26da` | marcosantos07 | Revised README (version 3) |

### Phase 6 — Prompt v4

| Commit | Author | What |
|---|---|---|
| `c6bcf25` `8ef3bde` | JEMCR7G | Delimiters against instruction injection, decision examples, edge cases and a stricter output format; fixes from the team's review (a value from the document left in an example, an incomplete sentence) |

The result on the challenge document stayed the same as with v3; the gain
is in the prompt's quality and robustness.

### Phase 7 — The interface · PRs [#7](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/7) [#8](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/8) [#9](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/9)

| Commit | Author | What |
|---|---|---|
| `203dea0` | tiagfari-cmd | Untrace frontend (Lovable) in `frontend/` |
| `8fdc757` | tiagfari-cmd | Frontend documentation |
| `46afc6c` | tiagfari-cmd | Pipeline core split from the command line; PDF read from memory |
| `92d5b17` | tiagfari-cmd | Response for the frontend with passage positions and a verified download |
| `ebe418f` | tiagfari-cmd | Local HTTP server for the frontend |
| `1c382eb` | tiagfari-cmd | Frontend pointed at the server and demo documented |
| `a2cbb29` | Guilherme779 | Intro video restored, with credit to its author |

When the frontend came into the repository, a `lib/` rule in `.gitignore`
(meant for Python) would have left out `frontend/src/lib/`, where the API
client lives. It was caught before the commit.

### Phase 8 — Sunday morning · PRs [#10](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/10) [#11](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/11) [#12](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/12)

| Commit | Author | What |
|---|---|---|
| `0a7f584` | JEMCR7G | `submission/prompt.txt` becomes the single source of the prompt |
| `946464c` | tiagfari-cmd | Server accepts the origins configured in `ALLOWED_ORIGINS`, to publish the demo |
| `7945fb9` | João Sobreiro | Manual review logic |
| `a076111` | João Sobreiro | Clickable words to mask or unmask |
| `70d51b9` | João Sobreiro | Manual review documentation |
| `ff4b42d` | João Sobreiro | Prompt v5: defence against instruction injection, unique roles, batch codes |

With v5 we ran the challenge document again: the output is identical, line
by line, to the submitted `submission.txt`.

### The history in numbers

| Person | Commits | PRs opened | PRs merged |
|---|---|---|---|
| tiagfari-cmd | 9 | 3 | 3 |
| Guilherme779 | 8 | 3 | 6 |
| JEMCR7G | 8 | 2 | 0 |
| marcosantos07 | 7 | 1 | 1 |
| João Sobreiro | 6 | 2 | 1 |

---

## 7. Who did what

| Person | Main contribution | PRs |
|---|---|---|
| **Guilherme779** | Pipeline skeleton (configuration, extraction, validation, Gemini call, command), integration of the parts, submission generation, intro video, coordination of the plans | [#1](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/1), [#6](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/6), [#9](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/9) |
| **JEMCR7G** | First prompt, Gemini client with retry and cache, prompts v3 and v4, `prompt.txt` as the single source | [#4](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/4), [#10](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/10) |
| **João Sobreiro** | Regex rules and their tests on the real document, manual review in the frontend, prompt v5 | [#3](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/3), [#11](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/11), [#12](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/12) |
| **tiagfari-cmd** | Asterisk count repair and submission checks, frontend in the repository, HTTP server and integration with the interface, configuration for publishing | [#2](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/2), [#7](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/7), [#8](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/8) |
| **marcosantos07** | First README, license, documentation (policy, architecture, team plan), pitch script | [#5](https://github.com/Guilherme779/nos-gen-ai-hackathon/pull/5) |

The commit and PR counts per person are at the end of
[section 6](#6-our-journey). Everyone committed from their own account, on
their own branch, and every PR was merged with a merge commit.

---

## 8. How we worked

- **One branch per task** (`feat/…`, `docs/…`), created from
  `team_CodingBros`. Nobody worked on `main`.
- **Pull requests into `team_CodingBros`**, reviewed by someone else and
  merged with a merge commit: no squash, no rebase, no force-push. The
  history shows who did what.
- **Small steps, one commit per step**, each checked before committing
  (`flake8` and `pytest`; for the frontend, `npm test`, `tsc` and the build).
- **Each person owns their files**, so parallel PRs don't conflict.
- **Tests without network access**: Gemini is faked, so running the tests
  costs no quota.
- **Secrets stay out of the repository**: everyone uses their own key in
  their own `.env`; we checked the whole history and no key was ever
  committed.
- **`submission.txt` is never edited by hand**: it is always generated by
  the pipeline. Manual review exists only in the interface and in the
  downloaded file.
- **Commit messages in English**, imperative and specific.

---

## 9. What went wrong and what we learned

| Problem | What happened | How we fixed it |
|---|---|---|
| **The model miscounts asterisks** | "Apt 45" with a single `*`; the employer (5 words) with 6. Changing the prompt didn't fix it reliably: one attempt made the model merge the `*` the rules had already placed | A repair step in code: it aligns the line with the original and fixes only the count. On the challenge document it brought the result to all 60 lines correct |
| **The prompt copied the document** | The v2 examples used the real doctor's name, phone number and CVV | v3 with invented examples, plus the note "these examples are not a list of values to look for" |
| **Two policies at once** | One prompt hid ages and addresses, the other didn't | An explicit team decision, a single prompt, the other one removed |
| **A `.gitignore` rule dropped part of the frontend** | The `lib/` rule (for Python) ignored `frontend/src/lib/`, where the API client lives: the frontend would have reached GitHub broken | An exception in `.gitignore`, caught before the commit by checking the ignored files |
| **`flake8` failed after `npm install`** | `node_modules` brings in a third-party `.py` file | A `.flake8` file that excludes only `frontend/node_modules` |
| **Commits under the wrong name** | One laptop had `git config` set to a different name | `.mailmap` and the email linked to the right account, without rewriting history |
| **Copyright of the intro video** | The video is an excerpt from someone else's trailer | Discussed as a team: kept, with credit in the footer and in the README; it can be turned off with one line |
| **Publishing the demo** | Railway tried to build `main` (which has no code) and the frontend needed extra configuration | A local demo, published with Cloudflare Tunnel when we needed to share a link |
| **"Works on my machine"** | Animations disabled on one laptop (a Windows accessibility setting); a teammate without a Gemini key | Documented in `demo.md`; the site's status message says what the problem is |

**What we take away:**

1. **Planning pays off.** The time spent deciding the policy, the
   interfaces and the split of work let five people work in parallel
   without conflicts.
2. **The model and the code are good at different things.** The model is
   good at deciding *what* is an identifier; code is better at enforcing
   exact rules (fixed formats, asterisk count, structure).
3. **Check before calling it done.** Several problems (`lib/`, `flake8`,
   the count) only showed up because we tested on a clean clone and on the
   real document.
4. **The policy is a choice.** The law gives principles, not a table; the
   hidden reference may decide differently.

---

## 10. Limitations and next steps

- **External API.** The document is sent to Gemini. With real data, this
  would need a local model or a service with privacy guarantees.
- **No guarantee of full recall.** That's what manual review is for. The
  next step would be **suggesting false negatives**: listing what was left
  visible and might identify someone (ages, years of personal events,
  insurance plan names), with a second pass of the model acting as a
  reviewer. A prototype with simple rules turned out too noisy, so it was
  left for later.
- **Our policy may differ from the official reference**, especially in the
  "grey zone" (ages, marital status, religion, income).
- **The model isn't fully deterministic**, even at temperature 0; the
  cache and the repair step reduce the impact.
- **The public demo is temporary**: it depends on the laptop being on, and
  the tunnel links change when it restarts.

---

## 11. Repository structure

```text
submission/
  submission.txt        system output (generated, never edited by hand)
  prompt.txt            the prompt used (single source)
  anonimizar.py         main command
  servidor.py           server for the interface
  anonymizer/
    config.py           configuration (.env) and paths
    extract.py          PDF -> text
    rules.py            regex rules
    llm.py              Gemini call (retry, cache)
    reparar.py          asterisk count repair
    validate.py         response cleanup and validation
    verificar.py        pre-submission checks
    resposta_api.py     JSON response for the interface
    cli.py              wires the steps together
  tests/                automated tests (no network)
  docs/                 policy, architecture, plan, prompt, demo, pitch
frontend/               Untrace interface (React, built with Lovable)
raw_data/               challenge document
.env.example            environment variables (no values)
```

---

## 12. Credits and license

- Code under the [MIT](LICENSE) license.
- Dependencies: [PyMuPDF](https://pymupdf.readthedocs.io/),
  [google-genai](https://github.com/googleapis/python-genai),
  [python-dotenv](https://github.com/theskumar/python-dotenv); tests with
  [pytest](https://pytest.org/) and [flake8](https://flake8.pycqa.org/).
- Interface generated with [Lovable](https://lovable.dev) (React, TanStack
  Start, Vite); flow prototype in [n8n](https://n8n.io/).
- Intro video: an excerpt from "Cinemas NOS – Policy Trailer" by Luís R.
  Teixeira, without sound. All rights belong to the author.
- Challenge, document and grading: NOS, at JunctionX Lisbon 2026.
