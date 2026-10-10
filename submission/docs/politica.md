# Política de anonimização

As regras exatas que o modelo segue estão no prompt,
[`submission/prompts/rewrite.txt`](../prompts/rewrite.txt). Este documento
explica o porquê dessas regras; não as repete, para não haver duas versões
a manter.

## Princípio

Mascarar só o que permite descobrir **quem** é a pessoa. O objetivo é
impedir a identificação, não esconder a informação. Um relatório clínico
sem os dados clínicos perde o significado, o que o enunciado pede para
preservar.

Pergunta que decide cada caso: "este valor, sozinho ou combinado com o
resto do documento, permite saber quem é a pessoa?" Se sim, mascara-se.

## O que mascaramos e porquê

| Dado | Porquê |
|---|---|
| Nomes de pessoas (paciente, família, amigos, médicos) | Identificam diretamente. Todas as menções, incluindo só o apelido |
| NIF, Cartão de Cidadão, Segurança Social, nº de utente, cédula, apólice | Identificam sozinhos e permitem ligar registos |
| Telefones e emails | Identificam sozinhos |
| Nº da porta, andar e apartamento | Com a rua, apontam para uma casa concreta |
| Data de nascimento | Com a localidade, reduz muito o número de pessoas possíveis |
| Cartão bancário, validade, CVV, IBAN | Dados financeiros que identificam e expõem a pessoa |
| IDs biométricos | Identificadores únicos da pessoa |
| Entidade empregadora concreta | Com a profissão e a idade, aponta para uma pessoa |

## O que mantemos e porquê

| Dado | Porquê |
|---|---|
| Cabeçalho (instituição, data e referência do relatório) | O enunciado mostra-o inalterado no exemplo de saída correta |
| Informação clínica (sintomas, diagnósticos, medicação, exames) | É o conteúdo do documento; sem os identificadores já não aponta para ninguém |
| Idade, sexo, estado civil, profissão genérica | Partilhados por muitas pessoas |
| Nome da rua, código postal, cidade | Sem o nº da porta, apontam para uma zona, não para uma pessoa |
| Títulos (Dr., Sra.) e parentesco (irmão, mãe) | Preservam o significado; o nome ao lado é mascarado |

## Regra de forma

Cada palavra mascarada passa a um único `*` e a pontuação colada mantém-se:
`Ana Correia,` passa a `* *,`. As linhas vazias são removidas; nada mais
muda.

## Na dúvida

Num identificador (nome, número, contacto): mascarar. Em informação
clínica ou demográfica geral: manter.
