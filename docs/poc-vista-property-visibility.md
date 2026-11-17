# POC — visibilidade de imóveis na API Vista

## Objetivo

Investigar, sem qualquer escrita, se um imóvel cadastrado e comercialmente disponível deixa de aparecer em `/imoveis/listar` quando não está marcado para o site legado, embora continue acessível em `/imoveis/detalhes`.

O diagnóstico não importa imóveis, não acessa PostgreSQL, não altera o CRM e não modifica os filtros usados em produção.

## Inspeção da aplicação

O painel `/admin/vista` usa `VistaPropertyExplorerService.list`, que envia:

- campos de `VISTA_LIST_FIELDS`;
- paginação de 10, 20 ou 50 itens e `showtotal=1`;
- ordenação por `Codigo`;
- somente os filtros preenchidos pelo administrador: `Codigo`, `Cidade`, `Bairro`, `Categoria`, `Dormitorios` e faixa de `ValorVenda`/`ValorLocacao`.

Não há filtro explícito de publicação, exibição no site, status comercial, finalidade ou disponibilidade. O suporte confirmou posteriormente que a visibilidade ampliada é controlada pelos parâmetros de query `showInternal` e `showSuspended`, não pelo objeto `filter` dentro de `pesquisa`.

A [documentação oficial do Vista](https://www.vistasoft.com.br/api/) confirma `fields`, `filter`, `advFilter`, `order`, paginação e `showtotal`, mas não documenta nessa página um nome universal de campo ou filtro de publicação. Nenhum nome foi presumido nesta POC.

Em 17/11/2026, o suporte Vista confirmou para esta integração os parâmetros de query `showInternal=1` e `showSuspended=1`. A POC passou então a testá-los isoladamente e em conjunto, sem alterar as consultas de produção.

## Comando

```bash
npm run poc:vista-visibility -- --code=CODIGO_DO_IMOVEL
```

Ajuda:

```bash
npm run poc:vista-visibility -- --help
```

O comando exige as variáveis já utilizadas pelos diagnósticos Vista:

- `VISTA_POC_ENABLED=true`
- `VISTA_API_BASE_URL`
- `VISTA_API_KEY`
- `VISTA_API_TIMEOUT_MS` (opcional)

A chave nunca é exibida. A saída mostra apenas consultas sanitizadas.

## Cenários executados

| Cenário | Consulta |
|---|---|
| A — Listagem atual | Mesmos campos, filtro por código, ordenação, paginação e totalização do painel |
| B — Internos | Listagem atual acrescida somente de `showInternal=1` |
| C — Suspensos | Listagem atual acrescida somente de `showSuspended=1` |
| D — Ampliada | Listagem atual acrescida de `showInternal=1` e `showSuspended=1` |
| E — Detalhes atuais | `/imoveis/detalhes` sem os novos parâmetros |
| F — Detalhes ampliados | `/imoveis/detalhes` com os dois parâmetros |
| G — Mínima ampliada | Apenas `Codigo`, filtro, paginação, totalização e os dois parâmetros |

O comando distingue `ABSENT`, `NULL`, `VALUE`, resposta vazia, identificação ambígua e requisição rejeitada. A ausência de campo nunca vira `false`.

## Comparação antes/depois

Antes de alterar manualmente a publicação de um imóvel de teste no Vista:

```bash
npm run poc:vista-visibility -- --code=CODIGO --json > /tmp/vista-visibility-before.json
```

Depois da alteração manual controlada no CRM:

```bash
npm run poc:vista-visibility -- --code=CODIGO --compare=/tmp/vista-visibility-before.json
```

O segundo comando executa novamente os sete cenários e informa mudanças de HTTP, presença, totais, códigos e campos comerciais observados. O script nunca realiza a alteração no Vista.

## Interpretação

- **A — filtro da aplicação:** reservado para uma diferença causada pelo objeto `filter`; não foi o caso observado.
- **B — comportamento/restrição da API:** a consulta atual omite, mas listagem e detalhes encontram quando os parâmetros confirmados são enviados.
- **C — disponibilidade não identificada:** continua sendo uma limitação separada; preço não é prova de disponibilidade.
- **D — inconclusivo:** requisição rejeitada, identificação ambígua, detalhes ausente ou imóvel visível em todos os cenários.

Uma execução com imóvel hoje visível valida o mecanismo, mas não prova a hipótese. Para concluir, é necessário um código que esteja fora da publicação do site legado ou comparar o mesmo código antes/depois da alteração manual.

## Execução de validação

Em 13/11/2026 (America/Sao_Paulo), o comando foi validado com o imóvel conhecido `16784235`:

| Consulta | HTTP | Imóvel encontrado | Observação |
|---|---:|---|---|
| Listagem atual | 200 | Sim | Consulta do painel com filtro por código |
| Listagem sem publicação | 200 | Sim | Controle idêntico; não há filtro local para remover |
| Consulta direta | 200 | Sim | Detalhes retornados |
| Consulta mínima | 200 | Sim | Encontrado apenas com `Codigo`, paginação e totalização |

`Finalidade` foi recebida como string vazia, `ValorVenda` como string preenchida e `ValorLocacao` como `"0"`. Nenhum desses valores foi interpretado como disponibilidade. Nenhum indicador confirmado de publicação foi retornado. Classificação: **D — inconclusivo**, pois o imóvel usado está visível e não reproduz a hipótese investigada.

### Imóvel fora da publicação legada

Também em 13/11/2026, o código `17835787`, informado como disponível para venda no CRM e ausente do site legado, produziu:

| Consulta | HTTP | Imóvel encontrado |
|---|---:|---|
| Listagem atual | 200 | Não |
| Listagem sem publicação | 200 | Não |
| Consulta direta | 200 | Não |
| Consulta mínima | 200 | Não |

Nenhum campo de imóvel foi recebido. Isso demonstra que, com a URL e a chave atuais, a Maison não consegue listar nem consultar diretamente esse código e, portanto, não consegue importá-lo ou mantê-lo sincronizado. Como não existe filtro explícito de publicação na aplicação, a causa não está nos filtros do painel. Ainda é necessário confirmar com o suporte Vista se o recorte é imposto pela configuração da URL, pelo escopo da chave, por uma seleção implícita de publicação ou por outro identificador exigido para imóveis fora do site legado.

Após o suporte informar `showInternal=1` e `showSuspended=1`, o código `17835787` foi testado novamente em 17/11/2026:

| Consulta | HTTP | Imóvel encontrado |
|---|---:|---|
| Listagem atual | 200 | Não |
| Somente `showInternal=1` | 200 | Sim |
| Somente `showSuspended=1` | 200 | Não |
| Ambos os parâmetros | 200 | Sim |
| Detalhes atuais | 200 | Não |
| Detalhes com ambos | 200 | Sim |
| Listagem mínima com ambos | 200 | Sim |

O detalhe ampliado retornou os campos comerciais esperados, incluindo `ValorVenda = "2999000"`. Para este imóvel específico, `showInternal=1` é o parâmetro que altera a listagem; ainda assim, a recomendação do suporte é enviar ambos para abranger internos e suspensos. Classificação: **B — restrição/comportamento confirmado da API Vista**.

## Próxima alteração recomendada

Uma medição de totais realizada em 17/11/2026 mostrou:

| Parâmetros | Total informado pela API |
|---|---:|
| Consulta atual | 431 |
| Somente `showInternal=1` | 1.576 |
| Somente `showSuspended=1` | 533 |
| Ambos | 35.447 |

Não habilitar os dois parâmetros indiscriminadamente em produção antes de confirmar o filtro exato de disponibilidade comercial. A combinação amplia o universo para mais de 35 mil registros.

Para o imóvel `17835787`, `showInternal=1` sozinho funcionou tanto em `/imoveis/listar` quanto em `/imoveis/detalhes`; `showSuspended=1` sozinho não o encontrou. Assim, `showInternal=1` é suficiente para esse caso e é a opção de menor abrangência para uma próxima fase controlada.

Antes da alteração funcional, solicitar ao suporte o nome exato do campo/filtro que representa **disponível para venda ou locação**, independentemente da publicação no site legado, e esclarecer por que a combinação dos dois parâmetros retorna 35.447 registros.

`showSuspended=1` amplia o conjunto de candidatos, mas não comprova disponibilidade comercial. Imóveis retornados por esse parâmetro devem continuar sujeitos às regras Maison existentes: curadoria manual, snapshot válido, finalidade editorial, confirmação de disponibilidade e bloqueio de publicação automática.

### Filtro de modalidade confirmado

A documentação oficial apresenta `Finalidade = "Venda"` como filtro. Testes read-only com a chave real e `showInternal=1` confirmaram:

| Filtro em `pesquisa.filter` | Total informado |
|---|---:|
| Sem `Finalidade` | 1.576 |
| `Finalidade: "Venda"` | 1.437 |
| `Finalidade: "Locacao"` | 4 |

`Finalidade: "Locação"` também foi aceito e normalizado pela resposta para `"Locacao"`. O imóvel `17835787` foi encontrado com `Codigo: "17835787"` e `Finalidade: "Venda"`, e não foi encontrado com `Finalidade: "Locacao"`.

O filtro com array `Finalidade: ["Venda", "Locacao"]` retornou somente 30 registros e não se comportou como a união dos dois totais; portanto, não deve ser usado para representar “Venda ou Locação”. A interface recomendada é um seletor mutuamente exclusivo: **Venda** ou **Locação**, emitindo uma única string por consulta.

O campo `Finalidade` recebido nos registros não é semanticamente consistente: na amostra sem filtro retornou valores como `Residencial` e `Comercial`, e no detalhe de `17835787` veio vazio. A utilidade confirmada aqui é o comportamento do **filtro**, não a interpretação do valor retornado nem a confirmação de disponibilidade comercial.

## Confirmações do suporte Vista

O suporte confirmou que:

1. `showInternal=1` inclui imóveis internos;
2. `showSuspended=1` inclui imóveis suspensos;
3. ambos devem ser adicionados para ampliar o conjunto retornado sem excluir os imóveis já visíveis.

Ainda não foi confirmado um campo inequívoco de disponibilidade comercial. A inclusão na resposta ampliada não autoriza publicação automática na Maison.
