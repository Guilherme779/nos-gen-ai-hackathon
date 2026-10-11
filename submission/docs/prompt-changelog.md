# Histórico do prompt (`submission/prompt.txt`)

Uma linha por versão. Cada versão é um commit próprio.

| Versão | O que mudou | Porquê | Resultado observado |
|---|---|---|---|
| v1 | Prompt inicial do protótipo n8n | Ponto de partida | Funcionava, mas com regras de política diferentes das decididas |
| v2 | Política "impedir a identificação": mascara nomes, números de identificação, contactos, nº de porta e andar, data de nascimento, dados financeiros, biometria e empregador. Mantém informação clínica, idades, ruas e cidades | Decisão da equipa: o objetivo é impedir que se saiba QUEM é a pessoa, não esconder a informação | "Apt 45" ficou com um só asterisco; o empregador não foi mascarado |
| v3 | Exemplos inventados em vez de valores do documento; regra da morada com "cada palavra leva o seu asterisco" e exemplo com bloco e andar; exemplo de empregador; regra explícita de contagem de asteriscos | Os exemplos da v2 copiavam dados reais do documento (nomes, telefone, data de nascimento, CVV), o que adapta o prompt a um só documento; e o modelo errava a contagem na morada | Morada e empregador passam a ser mascarados; o modelo ainda erra às vezes o número de asteriscos, que o passo de reparação corrige |
