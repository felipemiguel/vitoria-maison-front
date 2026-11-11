# Schema PostgreSQL

Migrations: `0000_initial_backend` a `0013_broker_site_editor`.

## curated_properties

Seleção e conteúdo Maison. `vista_code` e `slug` são únicos; `published` e `featured` iniciam falsos. `publication_purpose` é editorial. A confirmação manual guarda instante, expiração, operador e origem. `publication_version` evita publicação concorrente sobre dados alterados.

## property_snapshots

Último snapshot comercial válido, um por imóvel selecionado. Valores monetários usam `numeric(14,2)`; áreas usam `numeric(12,2)`. Ausências permanecem `NULL`. A tabela não armazena o payload bruto.

Falhas de sincronização não sobrescrevem o snapshot anterior. `availability_status` é explícito e inicia `UNKNOWN`. `source_purpose` preserva `Finalidade` sem interpretá-la como venda/locação; `source_updated_at` recebe `DataAtualizacao`.

## collections e collection_properties

Coleções editoriais e relacionamento N:N, com unicidade no par de IDs e ordem por coleção. A migration cria quatro coleções iniciais como não publicadas.

## collection_slug_redirects

Slugs anteriores de coleções (`old_slug` → `collection_id`), gravados na mesma transação em que o slug é alterado no painel. `/colecoes/{antigo}` responde com redirecionamento permanente para o slug atual. A resolução por ID evita cadeias; um slug que volta a ser usado sai da tabela, evitando loops.

## broker_profiles, broker_sites e broker_site_properties

Perfil profissional (1 por usuário), site do corretor (1 por perfil, subdomínio único com CHECK de formato, status com CHECK, publicado exige aprovação) e seleção N:N de imóveis da curadoria (sem duplicar dados comerciais). Ver `docs/broker-sites-foundation.md`.

## media_assets

Mídia enviada pelo painel, armazenada em `bytea` (hoje só a foto profissional do corretor, WebP já tratado, até 2 MB por CHECK). Ligada a `broker_profiles.profile_image_asset_id`. Servida por `/media/<id>`.

## sync_runs

Auditoria sanitizada das execuções: status, contadores, timestamps e resumo limitado de erro. Não contém chave Vista nem respostas completas.

## property_publication_events

Auditoria append-only de confirmação, publicação e despublicação. Guarda ator, tipo, instante e detalhes mínimos; não armazena credenciais ou payload do Vista.

## admin_users e admin_login_attempts

Desde a `0010`, `admin_users` é a tabela única de usuários (nome físico mantido por compatibilidade). `password_hash` é nulo em convites pendentes; `session_version` revoga JWTs; `version` faz o controle otimista. `admin_login_attempts` também guarda os contadores de rate limiting de convite e recuperação (chaves HMAC).

## roles, user_roles, user_tokens e user_audit_events

`roles` (ADMIN, MANAGER, BROKER) e `user_roles` (N:N, PK composta, `assigned_by`). `user_tokens` guarda convites e redefinições apenas como hash SHA-256, com expiração, `used_at` e `revoked_at`. `user_audit_events` é somente inserção (trigger). Constraint triggers adiadas impedem que o último ADMIN ativo seja desativado ou perca o perfil. Detalhes em `docs/rbac-architecture.md`.


`admin_users` armazena identidade, hash Argon2id, estado ativo e último login. `admin_login_attempts` guarda apenas chaves HMAC e contadores temporais para rate limiting; e-mail e IP não são persistidos nessa tabela.

`curated_properties` também guarda `last_sync_status`, erro sanitizado e instante da última tentativa para o painel. Falhas preservam o último snapshot comercial válido.

## admin_audit_events

Registra administrador, entidade, ação, estado anterior/novo e data para edição editorial, destaques, coleções e sincronizações manuais. Não contém senhas, tokens ou payload bruto do Vista.

## admin_bulk_imports

Registra o administrador, chave de idempotência, somente os códigos solicitados, contadores e resultados sanitizados do lote. A execução é concluída dentro da requisição; nenhuma tarefa desacoplada é iniciada. Payloads comerciais e URLs com chave não são persistidos.

## Executar

```bash
npm run db:migrate
```

Para gerar uma nova migration após alterar o schema:

```bash
npm run db:generate
```

Nunca aponte `DATABASE_URL` ou `TEST_DATABASE_URL` para produção durante testes.
