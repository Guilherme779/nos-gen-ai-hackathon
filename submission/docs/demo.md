# Demonstração: frontend + motor Python

O frontend (`frontend/`) envia o PDF ao servidor Python
(`submission/servidor.py`), que corre o mesmo pipeline do
`anonimizar.py`: regras de regex, Gemini, reparação da contagem e
validação. O servidor nunca escreve `submission.txt`.

```text
navegador (frontend, porta do Vite)
   │  GET  /api/health
   │  POST /api/anonymize  (corpo = PDF)
   ▼
submission/servidor.py (porta 8000)  ──▶  Gemini (chave no .env)
```

## Passos

1. Na raiz do repositório, com o `.env` preenchido (ver `.env.example`):

   ```bash
   python submission/servidor.py
   ```

   Deve aparecer `Servidor em http://127.0.0.1:8000 (motor: ready)`.
   Se aparecer `configuration_error`, falta a chave ou o modelo no `.env`.

2. Noutro terminal, na pasta `frontend/` (só da primeira vez, criar o
   `.env.local` a partir do exemplo):

   ```bash
   cp .env.example .env.local
   npm install
   npm run dev
   ```

   No Windows (PowerShell), em vez de `cp`:
   `Copy-Item .env.example .env.local`.

3. Abrir no navegador o endereço que o `npm run dev` mostrar. O estado
   deve passar a "Engine connected". Escolher
   `raw_data/document_to_anonymize.pdf` e carregar em
   "Anonymize document".

## Notas

- O servidor só aceita pedidos de páginas em `localhost` ou `127.0.0.1`
  (CORS). Para a demonstração, o frontend corre localmente.
- Corre uma análise de cada vez; enquanto corre, o estado mostra
  "Engine busy".
- As respostas do Gemini ficam em cache (`.cache/llm`): repetir o mesmo
  documento não gasta quota e responde logo, o que é útil em palco.
- Limites: 10 MB e 40 páginas por PDF.
