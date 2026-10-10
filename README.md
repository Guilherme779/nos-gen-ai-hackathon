# CodingBros — The *-Files

**Desafio NOS · JunctionX Lisbon 2026**

Registo da preparação, das decisões e do desenvolvimento da nossa solução de anonimização de documentos.

## Before you start

- Confirmar que todos os membros têm acesso ao repositório e conseguem contribuir com a sua própria conta.
- Obter a chave API necessária e configurar o ambiente de trabalho, sem publicar credenciais no repositório.

## Hacking begins!

### 1. Definir os critérios de anonimização

Começámos por distinguir os dados que identificam uma pessoa por si só daqueles cujo risco depende da combinação com outras informações do documento.

- Acordar o guião comum de trabalho, `Nosguião.md`.
- Definir os critérios que orientam o que mascarar e o que preservar.
- Registar esses critérios no repositório para manter a equipa alinhada.
- Preparar um prompt inicial para o fluxo em n8n.

### 2. Organizar as ferramentas e a demonstração

Explorámos os recursos disponibilizados pelos patrocinadores, incluindo Lovable, n8n e ElevenLabs.

O código é o núcleo da solução. O n8n fica associado à visualização e demonstração do fluxo, com imagens para o repositório e para a apresentação.

Iniciámos a interface no Lovable, com afinação e personalização do site base. A interface e os extras devem preservar o funcionamento principal do sistema e a saída exigida pelo desafio.

### 3. Implementar a solução

O código já integrado em `team_CodingBros` inclui:

- **Configuração do projeto:** dependências, configuração por variáveis de ambiente e estrutura de testes.
- **Extração de texto:** leitura do documento PDF com PyMuPDF.
- **Integração com Gemini:** construção do pedido a partir do prompt e do documento, chamada ao modelo e extração da resposta textual.
- **Validação inicial:** limpeza da resposta e comparação do número de linhas e palavras, com contagem de máscaras e identificação das linhas alteradas.
- **Execução por linha de comandos:** geração de `submission/submission.txt` e gravação do template do prompt em `submission/prompt.txt`.
- **Revisão visual:** abertura da comparação entre o original e o resultado no VS Code, quando disponível.
- **Testes automáticos:** testes de configuração, extração, validação e pipeline.

Nas branches de trabalho, ainda por integrar na branch da equipa, existem também:

| Branch | Implementações presentes |
|---|---|
| `feat/llm` | Repetição de pedidos após erros temporários, cache de respostas e evolução do prompt para a versão 3. |
| `feat/validacao` | Reparação da contagem de asteriscos e verificações dos ficheiros de submissão. |

Esta lista descreve o código consultado; não representa uma confirmação de aprovação nos testes ou de pontuação oficial.

### 4. Preparar os elementos de diferenciação

- Aprofundar a pesquisa sobre a NOS e identificar aplicações e extras relevantes para o desafio.
- Reunir a equipa para escolher a funcionalidade extra a apresentar.
- Dividir o trabalho em tarefas concretas, com responsáveis e branches próprias.
- Integrar as contribuições através de pull requests para `team_CodingBros`, no fork da equipa.

## Organização da equipa

Repositório de trabalho: [Guilherme779/nos-gen-ai-hackathon](https://github.com/Guilherme779/nos-gen-ai-hackathon).

O desenvolvimento decorre em branches por pessoa ou tema. O pull request para o repositório da NOS fica reservado para a entrega final, quando a equipa decidir submeter.
