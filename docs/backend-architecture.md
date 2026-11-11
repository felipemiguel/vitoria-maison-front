# Arquitetura do backend

O projeto continua sendo uma aplicação Next.js única. Não há backend separado nem endpoints administrativos públicos.

## Camadas

1. `integrations/vista`: cliente HTTP somente leitura, validação e normalização do Vista.
2. `features/properties/sync`: serviço idempotente e porta de persistência da sincronização.
3. `features/properties/publication`: política, decisão, serviço transacional e store de publicação.
4. `database`: schema Drizzle e conexão PostgreSQL lazy.
5. `features/properties/repositories`: contratos e implementações mock/database.
6. `app` e `components`: consomem apenas `PropertyRepository` e o modelo publicado.

## Painel administrativo

`features/admin/auth` contém autenticação, Argon2id, validação de usuário ativo e rate limiting persistente. `features/admin/properties` agrega consultas administrativas e reutiliza `PropertySyncService` e `PropertyPublicationService`; não existe uma segunda regra de importação ou elegibilidade.

As rotas `/admin` são Server Components dinâmicos. O layout protegido, Server Actions e factory dos serviços validam autorização no servidor. `proxy.ts` mantém a integração do Auth.js, mas não é a única barreira de acesso.

O cliente Vista é compartilhado no processo administrativo para que o semáforo de concorrência cubra requisições simultâneas. Prévia e importação também possuem limite por administrador.

`AdminCurationService` e `AdminCollectionService` executam mutações transacionais, usam versões otimistas e escrevem em `admin_audit_events`. Publicação e disponibilidade continuam no `PropertyPublicationService`, que registra `property_publication_events` com ator e estados anterior/novo.

`VistaPropertyExplorerService` mantém a consulta externa separada do estado local e identifica códigos importados em lote. `BulkPropertyImportService` orquestra até 20 códigos com concorrência limitada, reutiliza `AdminPropertyService.importVistaProperty` e persiste a idempotência em `admin_bulk_imports`.

Após edição, publicação, destaque, coleção ou sincronização, `revalidatePublicCatalog` invalida home, catálogo, detalhes, coleções e sitemap. As consultas públicas ainda aplicam o predicado de elegibilidade no SQL.

## Fontes de dados

`PROPERTY_DATA_SOURCE=mock` preserva o comportamento atual. `database` instancia `DatabasePropertyRepository`. Não existe fallback de banco para mocks.

No modo banco, a consulta pública exige simultaneamente:

- curadoria `published=true`;
- snapshot `SUCCESS`;
- disponibilidade explícita `AVAILABLE` ou confirmação manual completa e vigente quando o Vista retorna `UNKNOWN`;
- ausência de indisponibilidade explícita do Vista;
- snapshot mais novo que `PUBLICATION_SNAPSHOT_MAX_AGE_HOURS`;
- finalidade editorial, título, categoria conhecida, área privativa, preço e capa;
- `PROPERTY_DEFAULT_STATE` configurado.

O predicado SQL reutilizável é derivado da mesma política de domínio. Contagem e paginação já são calculadas somente sobre imóveis elegíveis. Uma URL inelegível retorna `notFound()`.

## Cache

Não há cache de aplicação para imóveis. Home, catálogo, detalhe e sitemap são dinâmicos; publicação, confirmação e despublicação acionam o ponto de invalidação do serviço para permitir uma estratégia futura sem alterar o domínio.

Não existem rotas administrativas públicas. As mutações desta fase são exclusivamente CLI, no ambiente servidor.
