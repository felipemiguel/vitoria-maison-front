import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { VISTA_CONFIRMED_FIELD_NAMES, VISTA_DETAIL_FIELDS, VISTA_LIST_FIELDS } from "../../src/integrations/vista/vista-fields";
import { analyzePhotoFields, extractVistaDetail, extractVistaRecords } from "../../src/integrations/vista/vista-response";
import { createVistaClient, recordShape, runDiagnostic } from "./common";

void runDiagnostic(async () => {
  const client = createVistaClient();
  const listStarted = Date.now();
  const listResponse = await client.listProperties({ fields: VISTA_LIST_FIELDS, page: 1, pageSize: 5, showTotal: true });
  const listDuration = Date.now() - listStarted;
  const records = extractVistaRecords(listResponse);
  const firstCode = records.find((record) => record.Codigo !== undefined)?.Codigo;
  if (firstCode === undefined) throw new Error("A listagem não retornou um código de imóvel utilizável.");
  const detailsStarted = Date.now();
  const detailResponse = await client.getPropertyDetails(String(firstCode), { fields: VISTA_DETAIL_FIELDS });
  const detailsDuration = Date.now() - detailsStarted;
  const detail = extractVistaDetail(detailResponse);
  const photos = analyzePhotoFields(detailResponse);
  const today = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const report = `# Relatório da PoC Vista CRM

## Execução

- Data: ${today}
- Listagem: validada (${listDuration} ms; ${records.length} registros, limite 5)
- Detalhes: validado (${detailsDuration} ms)
- Endpoints: \`GET /imoveis/listar\` e \`GET /imoveis/detalhes\`
- Escrita no Vista: não realizada
- Respostas brutas: não persistidas

## Status dos testes

| Teste | Status |
|---|---|
| Autenticação por API key | Aprovado |
| Listagem paginada | Aprovado |
| Detalhe por código | Aprovado |
| Foto de destaque | ${photos.coverPresent ? "Aprovado" : "Não retornada"} |
| Galeria aninhada | Indisponível para a chave atual |
| Escrita no CRM | Fora do escopo |

## Estrutura sanitizada

- Primeiro item da listagem: \`${JSON.stringify(recordShape(records[0] ?? null))}\`
- Detalhe: \`${JSON.stringify(recordShape(detail))}\`
- Campos confirmados: ${VISTA_CONFIRMED_FIELD_NAMES.join(", ")}

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

- \`Descricao\` foi recusado pelo endpoint de detalhes para a chave atual.
- A origem \`fotos\` e os campos \`Foto\`, \`FotoPequena\`, \`Destaque\`, \`Tipo\` e \`Descricao\` foram recusados.
- Ainda não foram confirmados: finalidade, estado, banheiros, condomínio, IPTU, disponibilidade e data de atualização.

## Fotografias

- Foto de destaque presente: ${photos.coverPresent ? "sim" : "não"}
- Itens na galeria: ${photos.galleryCount}
- URLs HTTPS absolutas: ${photos.absoluteHttps}
- URLs inválidas ou não HTTPS: ${photos.invalidOrNonHttps}
- Fotos pequenas: ${photos.smallImages}
- Descrições de fotos: ${photos.descriptions}

A foto de destaque retornada é uma URL HTTPS absoluta. A galeria não pôde ser validada porque a origem \`fotos\` não está disponível para a chave. Nenhuma fotografia foi baixada ou armazenada.

## Disponibilidade e finalidade

Não foi confirmado um campo de disponibilidade nem um campo inequívoco de finalidade. A presença de \`ValorVenda\` ou \`ValorLocacao\` não será usada isoladamente para publicar ou classificar um imóvel. Nenhum registro recebido do Vista é marcado automaticamente como publicado.

## Compatibilidade e limitações

O frontend continua usando mocks. O modelo atual pode receber os dados confirmados após normalização, mas finalidade, tradução de categoria, estado e curadoria ainda precisam de contexto explícito. A curadoria permanece separada dos dados comerciais. Respostas brutas, URLs e códigos reais não foram gravados neste relatório.

## Limitações

- A amostra foi limitada a ${records.length} imóveis e um detalhe.
- Descrição e galeria não estão disponíveis para a chave atual.
- Estruturas internas de características e infraestrutura não foram persistidas no relatório.
- Não foram testados banco, sincronização, escrita, leads ou painel administrativo.

## Próxima etapa recomendada

Solicitar ao Vista a liberação ou os nomes alternativos de descrição e galeria; confirmar finalidade, disponibilidade e data de atualização; levantar os valores possíveis de categoria; então implementar o adaptador definitivo e a persistência separada de curadoria.
`;
  const outputPath = resolve(process.cwd(), "docs/vista-poc-report.md");
  await writeFile(outputPath, report, "utf8");
  console.log(JSON.stringify({ ok: true, report: "docs/vista-poc-report.md", recordsConsulted: records.length, listDurationMs: listDuration, detailsDurationMs: detailsDuration }, null, 2));
});
