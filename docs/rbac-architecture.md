# Arquitetura RBAC

## Modelo

```
admin_users (tabela única de usuários)  1 ── N  user_roles  N ── 1  roles (ADMIN, MANAGER, BROKER)
      │                                                           
      ├── 1 ── N  user_tokens        (convites e recuperação de senha, só hash)
      └── 1 ── N  user_audit_events  (somente inserção)
```

- **Uma conta, vários perfis.** Não há tabelas paralelas para administradores, gestores e corretores. `MANAGER + BROKER` usa um único login.
- **Sem hierarquia.** Cada perfil concede um conjunto explícito de permissões; as efetivas são a **união** dos perfis.
- **Negação por padrão.** Perfil desconhecido, usuário inativo ou sem sessão válida: nenhuma permissão.
- O nome físico `admin_users` foi mantido por compatibilidade (chaves estrangeiras de `admin_audit_events` e `admin_bulk_imports`, IDs e sessões). No código, `users` é um alias.

## Matriz de permissões

Fonte única: `src/features/access/permissions.ts`.

| Permissão | ADMIN | MANAGER | BROKER |
|---|:-:|:-:|:-:|
| `users:read`, `users:create`, `users:update`, `users:deactivate`, `users:assign-roles` | ✓ | | |
| `properties:read`, `properties:import`, `properties:edit`, `properties:publish`, `properties:sync` | ✓ | ✓ | |
| `collections:manage` | ✓ | ✓ | |
| `leads:read`, `leads:manage` | ✓ | ✓ | |
| `account:manage-own` (área pessoal) | ✓ | ✓ | ✓ |
| `broker-profile:read-own`, `broker-profile:update-own` | | | ✓ |
| `broker-site:read-own`, `broker-site:create-own`, `broker-site:update-own`, `broker-site:submit-review` | | | ✓ |
| `broker-site:manage-all` | ✓ | | |

As permissões `broker-*:*-own` exigem também **propriedade do recurso**: o dono do site/perfil gravado no banco precisa ser o usuário da sessão (`canAccessBrokerSite`, `requireBrokerSiteAccess`). ADMIN gerencia todos os sites (`broker-site:manage-all`), mas não recebe identidade de corretor. MANAGER não acessa sites pessoais. Detalhes em `docs/broker-sites-foundation.md`.

## Mapa de operações

| Operação | Onde | Permissão |
|---|---|---|
| Dashboard, lista e detalhe de imóveis, prévia | páginas | `properties:read` |
| Explorar Vista (lista e prévia) | página + `previewVistaPropertyAction` | `properties:read` |
| Importar por código (prévia e confirmação) | `previewPropertyAction`, `importPropertyAction` | `properties:import` |
| Importação em lote | `bulkImportPropertiesAction` | `properties:import` |
| Editar curadoria | `updateEditorialAction` | `properties:edit` (+ `properties:publish` para mudar disponibilidade) |
| Destaques | página + `updateFeaturedAction`, `reorderHighlightsAction` | `properties:edit` |
| Confirmar disponibilidade, publicar, despublicar | actions correspondentes | `properties:publish` |
| Salvar e publicar | `saveAndPublishPropertyAction` | `properties:edit` + `properties:publish` |
| Sincronizar com o Vista | `syncPropertyAction` | `properties:sync` |
| Coleções (listar, criar, editar, associar imóveis) | páginas + 4 actions | `collections:manage` |
| Leads (lista e detalhe) | páginas | `leads:read` |
| Reenviar lead | `retryLeadAction` | `leads:manage` |
| Usuários (lista e detalhe) | páginas + `UserManagementService.list/get` | `users:read` |
| Criar usuário | `createUserAction` → serviço | `users:create` (+ `users:assign-roles` para perfis) |
| Editar nome/e-mail | `updateUserAction` → serviço | `users:update` |
| Ativar/desativar | idem | `users:deactivate` |
| Atribuir/remover perfis | idem | `users:assign-roles` |
| Reenviar convite | `resendInviteAction` → serviço | `users:update` |
| Minha conta (nome, senha) | página + actions | `account:manage-own` |
| Meu site: perfil profissional | `saveOwnProfileAction` | `broker-profile:update-own` |
| Meu site: criar, editar, enviar para revisão, prévia | actions + páginas | `broker-site:create-own` / `update-own` / `submit-review` / `read-own` + propriedade |
| Meu site: seleção, destaques e ordem dos imóveis, imagem de apresentação | `addPropertiesAction`, `manageSelectionAction`, `uploadHeroAction` | `broker-site:update-own` + propriedade |
| Meu site → Leads: leads do próprio site (escopo site + usuário da sessão) | `/admin/meu-site/leads` | `broker-site:read-own` + `leads:read-own` (BROKER) |
| Leads: reconciliar entrega e conferir atribuição | `reconcileLeadAction`, `checkLeadAssignmentAction` | `leads:manage` |
| Sites de corretores: listar, revisar, aprovar, devolver, suspender, reativar, prévia, verificar CRECI, código Vista | `/admin/sites-corretores` + actions | `broker-site:manage-all` |

Comandos CLI (`npm run maison:*`, `vista:*`, `admin:create`) rodam no servidor com acesso direto ao banco, fora do painel, e não passam pelo RBAC. O acesso a eles é controlado pela infraestrutura.

## Onde a autorização é verificada

1. **Layout protegido** (`app/admin/(protected)/layout.tsx`): exige sessão de usuário ativo e monta o menu com `navigationFor(user)`, filtrado no servidor.
2. **Cada página**: `requirePagePermission(...)`. Sem sessão → `/admin/login`; sem permissão → `/admin/acesso-negado`. Usuários sem acesso operacional que abrem `/admin` são levados a `/admin/minha-conta`.
3. **Cada Server Action**: `requirePermission`/`requireAllPermissions`, ou a fábrica `getAuthorizedAdminServices(...permissões)`. O tipo exige ao menos uma permissão: não existe acesso implícito "por estar logado".
4. **Serviços sensíveis**: `UserManagementService` verifica a permissão de cada campo alterado.
5. **Banco de dados**: trigger que impede ficar sem ADMIN ativo e trigger que torna a auditoria imutável.

`proxy.ts` (Auth.js) continua anexando a sessão, mas **não é** a barreira de acesso. Esconder itens de menu também não é controle de acesso.

API: `hasPermission`, `hasAnyPermission`, `hasAllPermissions` (puras, em `permissions.ts`); `getCurrentUser`, `requireUser`, `requirePermission`, `requireAnyPermission`, `requireAllPermissions`, `requirePageUser`, `requirePagePermission` (servidor, em `server.ts`).

## Sessão e revogação

- A sessão continua sendo o JWT do Auth.js (8 h). O token guarda **apenas** o ID do usuário e `sessionVersion`; perfis e permissões **não** ficam no token.
- A cada requisição, `loadSessionUser` lê no PostgreSQL o status, `session_version` e os perfis atuais (deduplicado por requisição com React `cache`).
- **Mudança de perfil** vale na requisição seguinte, sem novo login.
- **Desativação, troca de e-mail, redefinição e troca de senha** incrementam `admin_users.session_version`: todos os JWTs emitidos antes deixam de valer imediatamente.
- Sessões emitidas antes da Fase 6 não têm `sessionVersion` e são tratadas como versão 0, igual ao padrão da migration. Por isso o login atual não caiu.

## Proteção do último ADMIN

Nenhuma operação pode deixar o sistema sem ADMIN ativo. São três camadas:

1. **Interface**: o administrador não pode desativar a si mesmo nem remover o próprio perfil ADMIN.
2. **Serviço**: toda edição roda em transação com `pg_advisory_xact_lock('vitoria-maison:active-admins')`, conta os ADMINs ativos antes do commit e lança `LastAdminError`.
3. **Banco**: *constraint triggers* adiadas (`user_roles_keep_admin`, `admin_users_keep_admin`) recontam no COMMIT sob o mesmo advisory lock. Duas transações concorrentes que desativam os dois últimos ADMINs são serializadas, e a segunda é rejeitada. Isso vale também para SQL executado fora da aplicação.

## Auditoria

`user_audit_events` (actor_user_id, target_user_id, action, metadata, created_at). Ações: `USER_CREATED`, `USER_UPDATED`, `USER_EMAIL_CHANGED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `ROLE_ADDED`, `ROLE_REMOVED`, `INVITE_SENT`, `INVITE_ACCEPTED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_EMAIL`, `PASSWORD_RESET_COMPLETED`, `PASSWORD_CHANGED`, `PROFILE_UPDATED`.

- A metadata passa por `sanitizeAuditMetadata`: chaves com `pass`, `hash`, `token`, `secret`, `key`, `cookie` ou `session` são descartadas.
- Um trigger bloqueia `UPDATE` e `DELETE`. Não há tela de edição.
- A troca de e-mail registra o endereço anterior e o novo, necessário para rastrear o acesso.
- As operações de imóveis e coleções continuam em `admin_audit_events`, como antes.

## CSRF

- Server Actions do Next.js validam `Origin` × `Host` nativamente.
- As actions de acesso (usuários, conta, convite, recuperação) chamam também `assertSameOriginAction()`, como defesa em profundidade.
- O login continua com o token CSRF do Auth.js. Cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção.

## Comportamento conhecido

O grupo `/admin/(protected)` tem `loading.tsx`. Por isso, quando uma página redireciona por falta de permissão, a resposta HTTP é 200 com a instrução de redirecionamento no fluxo (streaming), e não um 307. Nenhum dado da página é renderizado; verificado nos testes ponta a ponta.
