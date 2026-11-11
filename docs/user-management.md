# Gestão de usuários e acessos

## Telas

| Rota | Acesso | Função |
|---|---|---|
| `/admin/usuarios` | `users:read` | Lista com busca por nome/e-mail, filtros por perfil e status, ordenação e paginação no servidor (10/20/50) |
| `/admin/usuarios/novo` | `users:create` | Nome, e-mail, perfis (múltiplos) e status inicial |
| `/admin/usuarios/[id]` | `users:read` (cada alteração exige a sua permissão) | Editar nome e e-mail, ativar/desativar, perfis, reenviar convite, histórico |
| `/admin/minha-conta` | qualquer usuário ativo | Ver dados e perfis, alterar nome e senha |
| `/admin/acesso-negado` | qualquer usuário ativo | Destino de páginas sem permissão |
| `/admin/convite?token=…` | público (token) | Definir a senha a partir do convite |
| `/admin/recuperar-senha` | público | Solicitar link de redefinição |
| `/admin/redefinir-senha?token=…` | público (token) | Definir nova senha |

Status exibidos: **Ativo** (com senha), **Convite pendente** (ativo, sem senha) e **Inativo**.

## Criar um usuário

1. ADMIN abre **Usuários → Novo usuário**, informa nome, e-mail e perfis.
2. O e-mail é normalizado em minúsculas e precisa ser único. Uma conta ativa exige pelo menos um perfil.
3. A conta é criada **sem senha** (`password_hash` nulo). O administrador não define nem vê senhas.
4. Se a conta for criada ativa, um convite é emitido. A tela informa se o e-mail foi **realmente enviado**; quando não há provider configurado, isso é dito explicitamente.
5. Uma conta criada inativa não recebe convite. Ao ativá-la, use **Reenviar convite**.

O primeiro administrador continua sendo criado pelo terminal (`npm run admin:create`), agora já com o perfil ADMIN.

## Convites

- Token de 256 bits (`crypto.randomBytes`), enviado só no link. O banco guarda apenas o **SHA-256**.
- Validade de **72 horas**, uso único (bloqueio de linha + `used_at`).
- Um novo convite revoga os anteriores. Desativar a conta ou trocar o e-mail também revoga os links pendentes.
- Não pode ser usado por conta desativada nem por conta que já definiu senha.
- A URL usa a origem configurada (`APP_URL`, senão `AUTH_URL` ou `NEXT_PUBLIC_SITE_URL`), nunca cabeçalhos da requisição. Em produção a origem precisa ser HTTPS.
- As páginas com token enviam `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex`.
- Mensagem de erro única: "Este link é inválido ou expirou". Não diferencia expirado, usado, revogado ou conta inativa.
- O aceite registra `invitation_accepted_at`, define a senha com Argon2id, incrementa `session_version` e grava `INVITE_ACCEPTED`.
- Rate limiting de 10 tentativas por IP em 15 minutos.

## Recuperação de senha

Não existia antes; foi implementada.

- `/admin/recuperar-senha` responde sempre "Se houver uma conta ativa com este e-mail…", exista a conta ou não.
- O link só é enviado para contas **ativas que já têm senha**. Convites pendentes devem ser reenviados por um administrador.
- Validade de **60 minutos**, uso único, só o hash é persistido, e a nova solicitação revoga a anterior.
- Rate limiting: 10 por IP em 15 minutos e 3 por e-mail por hora. As chaves são HMAC, sem e-mail ou IP legível no banco.
- Ao redefinir: nova senha (Argon2id, mínimo de 12 caracteres), **todas as sessões revogadas** e demais tokens invalidados.
- Nenhuma senha é enviada por e-mail.

## Provider de e-mail

Não havia infraestrutura de envio. Foi criada a interface `EmailProvider` (`src/features/email/provider.ts`):

| `EMAIL_PROVIDER` | Comportamento |
|---|---|
| ausente, em desenvolvimento | `development`: imprime a mensagem e o link no terminal do servidor; **não envia** |
| ausente, em produção | `disabled`: não envia e não registra o conteúdo (que contém o token) |
| `resend` | envia pela API HTTP do Resend (`RESEND_API_KEY`, `EMAIL_FROM`) |

```dotenv
APP_URL=https://painel.dominio-definitivo
EMAIL_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM="Vitória Maison <nao-responda@dominio-definitivo>"
```

O painel e a auditoria (`INVITE_SENT.delivered`) registram se houve entrega. Nunca se afirma envio quando não houve.

## Desativar, reativar e perfis

- **Desativar** encerra imediatamente as sessões (via `session_version`) e invalida convites e links de redefinição.
- **Trocar perfis** vale na próxima requisição do usuário, sem novo login.
- **Trocar e-mail** encerra as sessões e invalida links pendentes.
- Edição simultânea por duas pessoas é barrada pela versão otimista ("alterado por outra pessoa").
- Ninguém altera os próprios perfis nem o próprio status pela área pessoal. O ADMIN não pode desativar a si mesmo nem remover o próprio ADMIN.
- O último ADMIN ativo é protegido no serviço e no banco (ver `docs/rbac-architecture.md`).

## Área pessoal

`/admin/minha-conta` funciona para qualquer perfil, inclusive BROKER sem acesso administrativo:

- mostra e-mail, data de criação, último acesso e perfis;
- permite alterar o nome;
- permite trocar a senha, com reautenticação pela senha atual. Ao trocar, todas as sessões são encerradas e o usuário entra novamente;
- para BROKER, exibe um aviso sobre o futuro site do corretor.

## Migration e rollout

Migration `drizzle/0010_rbac_user_management.sql`. É incremental (expand) e não remove nem renomeia nada:

1. `admin_users.password_hash` passa a aceitar nulo; entram `invited_at`, `invitation_accepted_at`, `session_version` (padrão 0) e `version`.
2. Cria `roles` com ADMIN, MANAGER e BROKER (`ON CONFLICT DO NOTHING`).
3. Cria `user_roles` e associa **todos** os usuários existentes ao ADMIN. Os inativos continuam inativos e sem acesso.
4. Cria `user_tokens` e `user_audit_events` (com trigger de imutabilidade).
5. Cria os triggers de proteção do último ADMIN.

**Preservado**: IDs, e-mails, hashes de senha, `active`, `created_at`, `last_login_at` e sessões abertas (versão 0). Nenhum usuário é criado e nenhuma senha é alterada.

### Antes de aplicar em produção

1. Backup: `pg_dump --format=custom "$DATABASE_URL" > backup-pre-rbac.dump`.
2. Conferir os usuários existentes: `select id, email, active from admin_users;`.
3. Garantir que existe pelo menos um admin **ativo** com senha conhecida.
4. Aplicar em homologação com uma cópia dos dados.

### Aplicar

```bash
npm run db:migrate
```

### Depois

1. Entrar com um admin existente (deve funcionar sem trocar a senha).
2. `select u.email, r.code from admin_users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id;`
3. Criar um usuário de teste como MANAGER e outro como BROKER; validar menus e acesso negado.
4. Desativar o usuário de teste e confirmar que a sessão dele cai.

### Rollback operacional

A migração só acrescenta. Para voltar o código à versão anterior não é preciso desfazer o banco: o código antigo ignora as tabelas novas, e contas convidadas (`password_hash` nulo) continuam sem conseguir entrar.

**Atenção:** o código anterior não conhece perfis e trata **qualquer usuário ativo como administrador**. Antes de voltar o código, desative todos os usuários que não são ADMIN:

```sql
update admin_users set active = false
where id not in (select ur.user_id from user_roles ur join roles r on r.id = ur.role_id where r.code = 'ADMIN');
```

Uma remoção física das estruturas, se necessária, deve ser uma migration futura e separada, após backup.

Validado localmente em um PostgreSQL 18 descartável: banco migrado até a `0009` com usuários fictícios, aplicação da `0010` e comparação de ID, e-mail, status, hash, `last_login_at` e `created_at` antes e depois, sem diferenças. Um admin com senha Argon2 real, criado antes da migration, continuou fazendo login.
