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

## Revisão manual (falsos positivos e falsos negativos)

Depois da análise, **qualquer palavra** do original ou do resultado pode ser
clicada para a mascarar ou desmascarar:

- desmascarar corrige um falso positivo (o motor escondeu algo que não
  identifica ninguém);
- mascarar corrige um falso negativo (ficou visível algo que identifica a
  pessoa).

O texto anonimizado, os realces, os contadores e o download atualizam-se
na hora. As palavras alteradas à mão ficam contornadas, a página mostra
quantas alterações foram feitas e "Reset to engine result" volta ao
resultado do motor. Com alterações, o download chama-se `…-revisto.txt`;
sem alterações, continua a ser exatamente o resultado do motor (verificado
por SHA-256). Esta revisão acontece só no navegador: não muda o motor nem
o `submission/submission.txt`, que continua a ser gerado só pelo pipeline.

A lógica está em [`frontend/src/lib/review.ts`](../../frontend/src/lib/review.ts)
(funções puras, com testes em `frontend/src/test/review-utils.test.ts`).

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

- Ao abrir, a página mostra uma vez por sessão um vídeo de introdução de
  8 segundos (`src/assets/untrace-intro-8s.mp4`), feito a partir do trailer
  "Cinemas NOS – Policy Trailer" de Luís R. Teixeira, sem som. Está
  creditado no rodapé da página e os direitos são do autor. Pode ser
  saltado ("Saltar") e desliga-se com `<IntroVideo enabled={false}>` em
  `src/routes/__root.tsx`.
- Nunca colocar chaves de API em variáveis `VITE_*`: vão para o navegador.
  A chave do Gemini fica só no `.env` do motor Python.
