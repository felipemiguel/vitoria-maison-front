# Autenticação administrativa

O painel usa Auth.js com Credentials. Desde a Fase 6 a mesma autenticação atende todos os perfis (ADMIN, MANAGER, BROKER); autorização em `docs/rbac-architecture.md` e gestão de contas em `docs/user-management.md`.

O painel usa Auth.js com Credentials, sessão JWT de oito horas em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Senhas são armazenadas somente como hash Argon2id. Não existem usuário ou senha padrão.

## Configuração

```dotenv
AUTH_SECRET=valor-aleatorio-longo
AUTH_TRUST_HOST=true
```

Gere o segredo no ambiente servidor:

```bash
npx auth secret
```

Nunca use prefixo `NEXT_PUBLIC` para essas variáveis. Em produção, configure-as no secret manager da plataforma.

## Primeiro administrador

O primeiro acesso continua sendo criado pelo terminal; os demais usuários são convidados pelo painel (`/admin/usuarios`). O comando cria o usuário **já com o perfil ADMIN**, na mesma transação, e registra o evento na auditoria.

Em um terminal seguro:

```bash
npm run admin:create
```

O comando solicita nome, e-mail, senha e confirmação. A senha não é exibida, não é aceita em argumentos e não é registrada em logs.

Em ambientes sem TTY, forneça nome/e-mail por secrets e envie somente a senha por `stdin` protegido:

```bash
secret-manager-read admin-password | \
  ADMIN_CREATE_NAME="Nome" ADMIN_CREATE_EMAIL="admin@dominio.com" npm run admin:create -- --password-stdin
```

`secret-manager-read` representa o comando do gerenciador de segredos adotado pela infraestrutura; não grave a senha em arquivo versionado.

## Controles de segurança

- validação de sessão no layout e novamente em cada serviço/action;
- consulta do usuário ativo no PostgreSQL a cada operação administrativa;
- resposta genérica para usuário inexistente, inativo ou senha incorreta;
- verificação Argon2 também para e-mails inexistentes, reduzindo enumeração temporal;
- cinco falhas em quinze minutos bloqueiam e-mail e IP por quinze minutos;
- prévias/importações Vista limitadas por administrador e cliente compartilhado com concorrência máxima;
- CSRF e rotação de tokens tratados pelo Auth.js;
- hashes, tokens e detalhes internos nunca são enviados ao browser.

## Sessão, perfis e revogação

- O JWT guarda somente o ID do usuário e `sessionVersion`. Perfis e permissões são lidos do PostgreSQL a cada requisição, então mudanças de perfil valem imediatamente.
- Desativar o usuário, trocar o e-mail, redefinir ou trocar a senha incrementa `admin_users.session_version` e invalida todos os JWTs anteriores, mesmo antes de expirarem.
- Sessões emitidas antes da Fase 6 (sem versão) equivalem à versão 0 e continuam válidas até o próximo evento de revogação.
- Contas convidadas ainda sem senha passam pela mesma verificação Argon2 com hash fictício e recebem a resposta genérica.

## Recuperação de senha e convites

Ver `docs/user-management.md`: tokens de uso único, só hash no banco, expiração (convite 72 h, redefinição 60 min), rate limiting e respostas que não revelam a existência da conta. Rotas públicas: `/admin/convite`, `/admin/recuperar-senha` e `/admin/redefinir-senha`.
