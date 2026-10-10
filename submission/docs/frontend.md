# Frontend (Untrace)

Interface web do projeto, na pasta [`frontend/`](../../frontend). Foi
gerada com [Lovable](https://lovable.dev) e é uma aplicação React
(TanStack Start + Vite). Não faz parte da solução avaliada: a solução é o
código Python em `submission/`. O frontend serve para demonstrar o sistema.

## O que faz

- Recebe um PDF (arrastar ou escolher ficheiro, até 10 MB).
- Envia-o ao motor Python e mostra o original e o resultado lado a lado,
  com os excertos mascarados realçados.
- Permite descarregar o texto anonimizado, depois de verificar que o
  ficheiro é exatamente o que o motor devolveu (tamanho, UTF-8 e SHA-256).
- Sem motor ligado, mostra "Backend pending connection" e não envia nada.

O contrato com o motor (`GET /api/health` e `POST /api/anonymize`) está em
[`frontend/src/lib/api.ts`](../../frontend/src/lib/api.ts) e descrito no
[`frontend/README.md`](../../frontend/README.md).

## Correr

Requer Node.js (ou Bun). Na pasta `frontend/`:

```bash
npm install
npm run dev
```

Testes do frontend: `npm test`.

## Notas

- A versão original no Lovable tinha um vídeo de introdução feito a partir
  de um trailer de terceiros. Não foi incluído neste repositório, por ser
  público e ter licença open-source; a página abre diretamente.
- Nunca colocar chaves de API em variáveis `VITE_*`: vão para o navegador.
  A chave do Gemini fica só no `.env` do motor Python.
