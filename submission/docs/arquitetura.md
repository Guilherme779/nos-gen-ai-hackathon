# Arquitetura e decisões

## Fluxo

```text
raw_data/document_to_anonymize.pdf
  -> extract.py   texto do PDF (PyMuPDF, page.get_text())
  -> rules.py     regex mascara emails, telefones, cartões, IBAN, NIF...
  -> llm.py       Gemini mascara o resto, pelo contexto
  -> reparar.py   corrige a contagem de asteriscos, se preciso
  -> validate.py  remove ``` e linhas vazias, compara com o original
  -> cli.py       escreve submission.txt e prompt.txt
  -> verificar.py confirma que os ficheiros estão prontos para submeter
```

## Decisões

**Protótipo em n8n, solução em Python.** Fizemos primeiro o fluxo em n8n
para validar a ideia rapidamente. A solução avaliada é em Python porque o
código faz parte da avaliação e tem de poder ser lido, testado e corrido
por qualquer pessoa.

**Regex antes do LLM.** Dados com formato fixo (email, telefone, cartão)
não precisam de um modelo: uma regra validada é exata e não gasta quota.
As regras são estreitas (exigem prefixo, agrupamento ou o rótulo ao lado)
para não mascararem por engano, porque um falso positivo das regras já não
é desfeito. Como cada palavra é trocada por um `*`, as posições das
palavras não mudam e o LLM recebe o texto com esses `*` já colocados.

**O LLM devolve o documento reescrito.** É a forma mais direta de cumprir
"o output é o que o modelo devolve". O prompt tem a política escrita por
extenso e exemplos inventados (não copiados do documento).

**Reparação da contagem.** O modelo decide bem O QUE mascarar, mas às vezes
põe asteriscos a mais ou a menos (por exemplo "Apt 45" com um só `*`).
O passo de reparação alinha a linha com o original e corrige só a
contagem; nunca decide o que mascarar. Pode desligar-se com
`--sem-reparacao`.

**Gemini 3.1 Flash Lite, temperatura 0.** O plano gratuito permite 15
pedidos por minuto e 500 por dia, suficiente para iterar. Temperatura 0
para respostas tão repetíveis quanto possível. As respostas ficam em cache
(`.cache/llm`), por isso repetir o mesmo pedido não gasta quota.

**Validação manual opcional.** O comando abre a comparação no VS Code para
rever. As correções fazem-se no prompt e volta a correr-se; o
`submission.txt` nunca é editado à mão, para ser sempre a saída do
sistema.
