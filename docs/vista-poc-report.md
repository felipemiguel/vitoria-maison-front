# Relatório da PoC Vista CRM

## Execução

- Data: 06/11/2026
- Listagem: validada (782 ms; 5 registros, limite 5)
- Detalhes: validado (564 ms)
- Endpoints: `GET /imoveis/listar` e `GET /imoveis/detalhes`
- Escrita no Vista: não realizada
- Respostas brutas: não persistidas

## Status dos testes

| Teste | Status |
|---|---|
| Autenticação por API key | Aprovado |
| Listagem paginada | Aprovado |
| Detalhe por código | Aprovado |
| Foto de destaque | Aprovado |
| Galeria aninhada | Indisponível para a chave atual |
| Escrita no CRM | Fora do escopo |

## Estrutura sanitizada

- Primeiro item da listagem: `{"Codigo":"string","Categoria":"string","Cidade":"string","Bairro":"string","ValorVenda":"string","ValorLocacao":"string","Dormitorios":"string","Suites":"string","Vagas":"string","AreaTotal":"string","AreaPrivativa":"string","Caracteristicas":"object","InfraEstrutura":"object","BairroComercial":"string","CodigoImobiliaria":"string"}`
- Detalhe: `{"Codigo":"string","Categoria":"string","Cidade":"string","Bairro":"string","ValorVenda":"string","ValorLocacao":"string","Dormitorios":"string","Suites":"string","Vagas":"string","AreaTotal":"string","AreaPrivativa":"string","Caracteristicas":"object","InfraEstrutura":"object","FotoDestaque":"string","BairroComercial":"string"}`
- Campos confirmados: Codigo, Categoria, Cidade, Bairro, ValorVenda, ValorLocacao, Dormitorios, Suites, Vagas, AreaTotal, AreaPrivativa, Caracteristicas, InfraEstrutura, FotoDestaque

## Mapeamento confirmado

| Campo Vista | Campo Maison | Tipo real | Transformação |
|---|---|---|---|
| Codigo | externalId / commercial.code | string | Preservar como string |
| Categoria | commercial.type | string | Exige tabela de valores antes do mapeamento |
| Cidade | location.city | string | Direto |
| Bairro | location.neighborhood | string | Direto |
| ValorVenda | commercial.price para SALE | string | Converter sem usar zero para vazio |
| ValorLocacao | preço de locação futuro | string | Converter sem confundir com venda |
| Dormitorios | commercial.bedrooms | string | Converter quando preenchido |
| Suites | commercial.suites | string | Converter quando preenchido |
| Vagas | commercial.parkingSpaces | string | Converter quando preenchido |
| AreaPrivativa | commercial.area | string | Preferencial; converter quando preenchido |
| AreaTotal | área total futura | string | Manter separada da área privativa |
| Caracteristicas | editorial.features | object | Estrutura interna ainda não analisada |
| InfraEstrutura | diferenciais futuros | object | Estrutura interna ainda não analisada |
| FotoDestaque | editorial.images[0] | string | Aceitar somente HTTPS absoluta |

## Campos ausentes ou indisponíveis

- `Descricao` foi recusado pelo endpoint de detalhes para a chave atual.
- A origem `fotos` e os campos `Foto`, `FotoPequena`, `Destaque`, `Tipo` e `Descricao` foram recusados.
- Ainda não foram confirmados: finalidade, estado, banheiros, condomínio, IPTU, disponibilidade e data de atualização.

## Fotografias

- Foto de destaque presente: sim
- Itens na galeria: 0
- URLs HTTPS absolutas: 1
- URLs inválidas ou não HTTPS: 0
- Fotos pequenas: 0
- Descrições de fotos: 0

A foto de destaque retornada é uma URL HTTPS absoluta. A galeria não pôde ser validada porque a origem `fotos` não está disponível para a chave. Nenhuma fotografia foi baixada ou armazenada.

## Disponibilidade e finalidade

Não foi confirmado um campo de disponibilidade nem um campo inequívoco de finalidade. A presença de `ValorVenda` ou `ValorLocacao` não será usada isoladamente para publicar ou classificar um imóvel. Nenhum registro recebido do Vista é marcado automaticamente como publicado.

## Compatibilidade e limitações

O frontend continua usando mocks. O modelo atual pode receber os dados confirmados após normalização, mas finalidade, tradução de categoria, estado e curadoria ainda precisam de contexto explícito. A curadoria permanece separada dos dados comerciais. Respostas brutas, URLs e códigos reais não foram gravados neste relatório.

## Limitações

- A amostra foi limitada a 5 imóveis e um detalhe.
- Descrição e galeria não estão disponíveis para a chave atual.
- Estruturas internas de características e infraestrutura não foram persistidas no relatório.
- Não foram testados banco, sincronização, escrita, leads ou painel administrativo.

## Próxima etapa recomendada

Solicitar ao Vista a liberação ou os nomes alternativos de descrição e galeria; confirmar finalidade, disponibilidade e data de atualização; levantar os valores possíveis de categoria; então implementar o adaptador definitivo e a persistência separada de curadoria.
