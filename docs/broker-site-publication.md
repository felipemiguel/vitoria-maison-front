# Publicação e revisão dos sites de corretores

## Estados

```
DRAFT ──(corretor: solicitar publicação, completude 100%)──▶ IN_REVIEW
IN_REVIEW ──(ADMIN: aprovar, completude 100%)──▶ PUBLISHED
IN_REVIEW ──(ADMIN: devolver, justificativa obrigatória)──▶ DRAFT
DRAFT / IN_REVIEW / PUBLISHED ──(ADMIN: suspender, motivo obrigatório)──▶ SUSPENDED
SUSPENDED ──(ADMIN: reativar)──▶ DRAFT (nova revisão necessária)
```

- Não existe estado REJECTED. A devolução volta para DRAFT e grava `last_review_decision = 'RETURNED'`, `last_review_notes`, `last_reviewed_at` e `last_reviewed_by`. O corretor vê a justificativa no Painel.
- A aprovação grava `last_review_decision = 'APPROVED'`, `approved_at/by` e `published_at`. O banco já impede PUBLISHED sem aprovação registrada (CHECK da 6.4A).
- A suspensão grava `suspension_reason`, e a reativação limpa esse campo. Site suspenso não é servido (404) e não é editável.
- Versão otimista (`version`) em todas as transições; mudança concorrente é recusada.

## Solicitar publicação (corretor)

Em **Meu site → Painel → Solicitar publicação**, com confirmação. O servidor:

1. Valida a sessão e a permissão `broker-site:submit-review` (perfil BROKER).
2. Valida a propriedade do site (o site vem da sessão).
3. Executa o `BrokerSiteReadinessService`. Havendo pendência, recusa e lista os itens.
4. Muda para IN_REVIEW, grava `submitted_for_review_at` e registra a auditoria (`BROKER_SITE_SUBMIT`).

Nada é publicado automaticamente. Em revisão, a página fica congelada; perfil e seleção de imóveis continuam editáveis.

## Revisão administrativa (`/admin/sites-corretores`)

Acesso exclusivo de ADMIN (`broker-site:manage-all`). `/admin/sites` redireciona para cá.

- **Lista** filtrada por status (Em revisão, Publicado, Rascunho, Suspenso, Todos), com contagem. "Em revisão" é a aba padrão quando há pendências.
- **Página do site** (`/admin/sites-corretores/[id]`):
  - perfil profissional completo (foto, contatos, biografia, especialidades, regiões);
  - textos da página;
  - imóveis selecionados, com destaque e situação na Maison;
  - checklist de completude;
  - CRECI, com **Marcar como verificado** (conferir no cadastro oficial antes);
  - código no Vista (somente ADMIN configura);
  - prévia administrativa (home, catálogo e imóveis);
  - decisão: aprovar, devolver (justificativa), suspender (motivo) e reativar.
- **Aprovação bloqueada** enquanto o site não cumprir os requisitos mínimos: botão desabilitado na tela e recusa no servidor. A completude é reavaliada na hora da aprovação; se um imóvel deixar de estar elegível durante a revisão, a aprovação é recusada.

Todas as decisões ficam em `user_audit_events` (`BROKER_SITE_APPROVE`, `BROKER_SITE_RETURN_TO_DRAFT`, `BROKER_SITE_SUSPEND`, `BROKER_SITE_REACTIVATE`, `BROKER_PROFESSIONAL_DATA_VERIFIED`, `BROKER_VISTA_CODE_SET`), com o motivo quando houver.

## Depois de publicado

- O site responde em `https://<subdominio>.<domínio-base>` se `BROKER_SITES_ENABLED=true` e o DNS estiver configurado.
- Edição direta (ver `docs/broker-site-editor.md`); o ADMIN pode suspender a qualquer momento.
- Imóveis despublicados ou inelegíveis na Maison somem do site automaticamente.

## Testes

`src/features/brokers/broker-sites.integration.test.ts` (PostgreSQL real) cobre:
- completude incompleta e completa;
- envio, aprovação, devolução com justificativa e suspensão com motivo;
- aprovação bloqueada por completude;
- o corretor não aprova o próprio site;
- reativação e revalidação de cache.

`src/app/admin/rbac-actions.test.ts` cobre as permissões das telas e actions.
