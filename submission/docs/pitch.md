# Pitch (máximo 2 minutos)

## 1. Problema (15 s)

Documentos com dados pessoais não podem ser partilhados nem usados com IA
sem antes serem anonimizados. Fazê-lo à mão é lento e falha.

## 2. A nossa abordagem (35 s)

- Uma política clara: esconder QUEM é a pessoa, não a informação.
- Regras exatas para o que tem formato fixo (emails, telefones, cartões).
- O Gemini para o que precisa de contexto (nomes soltos, empregador,
  número da porta).
- Código que garante a regra "uma palavra, um asterisco" e verifica a
  submissão.

## 3. Demonstração (30 s)

Mostrar o antes e depois de um excerto (resultado já gerado, sem chamar a
API em palco):

```text
A paciente Maria Santos, mulher de 47 anos...  ->  A paciente * *, mulher de 47 anos...
Morada: Rua das Flores, 123, Apt 45, ...        ->  Morada: Rua das Flores, *, * *, ...
```

## 4. O que aprendemos (25 s)

- Começámos com um protótipo em n8n e passámos para Python para ter código
  testável.
- O modelo acerta no que mascarar mas erra a contar asteriscos; resolvemos
  com um passo de reparação em código.
- Pontuação oficial: ____

## 5. Equipa e próximos passos (15 s)

Cinco pessoas, cinco partes, cada uma com o seu branch e pull request.
Próximo passo: um modelo local, para dados reais nunca saírem da
organização.
