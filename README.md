# CodingBros — The *-Files

**Desafio NOS · JunctionX Lisbon 2026**

Registo da preparação, das decisões e do desenvolvimento da nossa solução de anonimização de documentos.

## Before you start

- Confirmar que todos os membros tinham acesso ao repositório e conseguiam fazer alterações com a sua própria conta.
- Obter a chave API necessária e configurar o ambiente de trabalho, mantendo as credenciais fora do repositório.

## Hacking begins!

### 1. Definir os critérios e o guião de trabalho

Começámos por distinguir os dados que identificam uma pessoa por si só daqueles cujo risco depende da combinação com outras informações do documento. O objetivo é definir o que mascarar e preservar o significado do texto.

- Definir um guião comum de trabalho, com a designação inicial `Nosguião.md`, para orientar a equipa.
- Acordar os critérios de anonimização e registá-los no repositório.
- Preparar um prompt inicial para o fluxo em n8n, com instruções sobre o que mascarar e o que preservar.

Os critérios estão documentados na [política de anonimização](submission/docs/politica.md).

### 2. Explorar as ferramentas dos patrocinadores

Tirámos partido dos recursos disponibilizados pelos patrocinadores, incluindo Lovable, n8n e ElevenLabs.

Começámos pelo código e orientámos a utilização do n8n para a automação e demonstração do fluxo de agentes de IA. O núcleo do desafio permanece no código; o n8n serve de apoio à visualização e à apresentação, incluindo imagens do fluxo para o repositório.

### 3. Iniciar a interface

Iniciámos a UI através do Lovable, com afinação e personalização do site base. A interface e as funcionalidades extra devem preservar o funcionamento principal da solução e o formato de saída exigido pelo desafio.

### 4. Implementar e integrar o código

Na branch `team_CodingBros`, estão publicadas as seguintes implementações:

| Componente | O que implementámos |
|---|---|
| Configuração | Dependências, variáveis de ambiente e estrutura de testes. |
| Extração de texto | Leitura do PDF com PyMuPDF. |
| Regras de deteção | Identificação e mascaramento de emails, telefones, NIF, NISS, Cartão de Cidadão, cartões bancários e IBAN antes da chamada ao modelo. |
| Gemini | Construção do pedido, chamada ao modelo e extração da resposta textual, com repetição após erros temporários e cache de respostas. |
| Prompt | Evolução até à versão 3, com histórico das alterações. |
| Reparação e validação | Reparação da contagem de asteriscos, comparação de linhas e palavras e identificação das alterações ao texto. |
| Ficheiros de saída | Geração de `submission/submission.txt` e gravação do template utilizado em `submission/prompt.txt`. |
| Verificação da submissão | Verificações de conteúdo vazio, estrutura, alterações ao texto e possíveis chaves API. |
| Revisão visual | Comparação do original com o resultado no VS Code, quando disponível. |
| Testes automáticos | Testes de configuração, extração, regras, Gemini, reparação, validação e integração, incluindo aplicação das regras ao documento do desafio. |

O fluxo integrado segue esta sequência:

**PDF → extração de texto → regras de deteção → Gemini → reparação de máscaras → validação → gravação e verificação dos ficheiros.**

O resultado gerado e o template do prompt já estão publicados no repositório da equipa. A presença destes ficheiros não corresponde à entrega final à NOS nem a uma pontuação oficial.

### 5. Preparar os elementos de diferenciação

- Aprofundar a pesquisa sobre a NOS e identificar potenciais funcionalidades extra que acrescentem valor ao projeto.
- Reunir a equipa para decidir qual a funcionalidade extra a desenvolver e apresentar.
- Dividir o trabalho em partes, com responsáveis e branches por pessoa ou tema.
- Manter os extras compatíveis com o núcleo de anonimização e com os testes do desafio.

## Organização e documentação

O desenvolvimento decorre no [repositório da equipa](https://github.com/Guilherme779/nos-gen-ai-hackathon), com integração das contribuições através de pull requests para `team_CodingBros`. O pull request para o repositório da NOS fica reservado para a entrega final, quando a equipa decidir submeter.

A documentação publicada inclui:

- [Política de anonimização](submission/docs/politica.md): critérios de mascaramento e preservação do texto.
- [Arquitetura](submission/docs/arquitetura.md): organização dos componentes da solução.
- [Plano da equipa](submission/docs/plano-equipa.md): divisão do trabalho.
- [Histórico de prompts](submission/docs/prompt-changelog.md): evolução das instruções utilizadas.
- [Rascunho do pitch](submission/docs/pitch.md): preparação da apresentação.

O repositório inclui também a licença MIT, o `.gitignore` e o `.mailmap` para uniformizar a apresentação dos autores dos commits.
