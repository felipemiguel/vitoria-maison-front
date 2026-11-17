# Regras de publicação de imóveis Vista

Investigação realizada em 06/11/2026, sem escrita no CRM.

## Campos confirmados

A [documentação REST oficial do Vista](https://www.vistasoft.com.br/api/) determina que os campos precisam ser solicitados explicitamente e podem variar conforme a liberação de cada cliente. Ela documenta `Finalidade` em um exemplo de filtro e `DataAtualizacao` em um filtro de datas.

Leituras isoladas no endpoint `/imoveis/detalhes`, usando o imóvel 31 e a chave da Vitória Maison, confirmaram:

| Campo | Disponível | Resultado sanitizado | Uso Maison |
|---|---:|---|---|
| `Finalidade` | sim | `Residencial` | Classificação de uso; não distingue venda de locação |
| `DataAtualizacao` | sim | data ISO | `source_updated_at` |
| `Categoria` | sim | `Apartamento` | Valor bruto preservado e mapeado para `APARTMENT` |
| `ValorVenda` | sim | string numérica | Preço de venda; não comprova disponibilidade |
| `ValorLocacao` | sim | string numérica | Preço de locação; não comprova disponibilidade |

O valor observado de `Finalidade` demonstra que esse campo não substitui `publication_purpose`. Venda, locação e investimento continuam sendo classificações editoriais explícitas.

Não foi encontrado na documentação pública nem confirmado para a chave atual um campo inequívoco de disponibilidade, situação comercial ou publicação no site. Nomes hipotéticos não são consultados nem persistidos. Até confirmação formal do Vista, todo snapshot recebe `availability_status=UNKNOWN`.

## Estados separados

- `property_snapshots.availability_status`: informação comercial normalizada do Vista (`AVAILABLE`, `UNAVAILABLE`, `UNKNOWN`).
- Confirmação operacional: registrada pela sincronização bem-sucedida, com instante e origem `VISTA_SYNC`.
- `curated_properties.published`: aprovação editorial solicitada.
- Visibilidade pública: resultado calculado de todas as regras; não é uma flag isolada.

Uma indisponibilidade futura explicitamente confirmada pelo Vista sempre prevalecerá sobre a confirmação operacional. Cada sincronização bem-sucedida renova essa confirmação; sua atualidade é controlada pela idade máxima do próprio snapshot.

## Decisão de publicação

`PropertyPublicationService` bloqueia o imóvel quando qualquer condição falha:

- seleção ausente;
- aprovação editorial ausente;
- snapshot ausente, inválido ou mais antigo que `PUBLICATION_SNAPSHOT_MAX_AGE_HOURS`;
- finalidade editorial ausente;
- preço da finalidade ausente ou não positivo;
- estado padrão, título ou área privativa ausente;
- imagem HTTPS válida ausente;
- Vista informa `UNAVAILABLE`;
- Vista retorna `UNKNOWN` e não existe confirmação operacional gerada por sincronização bem-sucedida.

Não existe uma segunda expiração exclusiva para disponibilidade. O predicado SQL remove o imóvel de catálogo, home, coleções, busca, detalhe e sitemap quando o snapshot ultrapassa `PUBLICATION_SNAPSHOT_MAX_AGE_HOURS`, mesmo com `published=true`.

## Operação segura

```bash
npm run maison:property:validate -- --code=31
npm run maison:property:confirm-availability -- --code=31 --operator=nome.sobrenome
npm run maison:property:publish -- --code=31
npm run maison:property:status -- --code=31
npm run maison:property:unpublish -- --code=31
```

`validate` avalia o alvo de publicação sem alterar dados. `confirm-availability` não publica. `publish` reavalia tudo e usa controle otimista de versão. `unpublish` preserva snapshot e histórico. Confirmações e mudanças de publicação geram eventos em `property_publication_events`.

As mesmas operações estão disponíveis no detalhe administrativo. O administrador autenticado é usado como ator; publicar reexecuta a decisão no servidor, e uma edição editorial nunca altera `published` automaticamente.

## Limitações

- A galeria completa usa automaticamente a origem aninhada `Foto`, confirmada pelo suporte e validada com a chave atual (52 fotografias no imóvel `17835787`). A origem genérica `fotos` não é aceita nesta instância.
- `Finalidade=Residencial` não distingue venda/locação.
- Enquanto o Vista não liberar um campo inequívoco, uma resposta válida de sincronização confirma operacionalmente a disponibilidade; a origem `VISTA_SYNC` deixa essa decisão auditável.
- Não há painel administrativo, autenticação administrativa ou cron nesta fase.
