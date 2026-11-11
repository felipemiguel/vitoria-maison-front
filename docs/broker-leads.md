# Leads dos sites de corretores (Fase 6.4D)

Formulários dos sites individuais (`ana.<domínio-base>`) geram leads da Vitória Maison **vinculados ao corretor de origem**, entregues ao Vista pelo adapter existente e visíveis no painel do corretor e no painel administrativo. Não há CRM paralelo: a tabela `lead_submissions` foi estendida.

Contrato Vista e o que está confirmado: `docs/vista-broker-leads.md`. Entrega em geral: `docs/lead-delivery.md`.

## Fluxo

1. O visitante envia o formulário (Server Action `submitLeadAction`).
2. `BrokerLeadSubmissionService` resolve a **origem no servidor**:
   - lê apenas o cabeçalho `Host`, normalizado (porta, maiúsculas, ponto final);
   - host institucional ou externo (preview `*.vercel.app`) → `MAISON_SITE`;
   - host de corretor → exige `BROKER_SITES_ENABLED`, `BROKER_LEADS_ENABLED`, site **PUBLICADO**, usuário dono **ativo** e com perfil **BROKER**;
   - host inválido ou reservado (`admin.`, `a.b.`) → recusado.
3. `LeadSubmissionService` (existente):
   - valida o payload (Zod, honeypot, limites);
   - no site do corretor, exige WhatsApp ou telefone;
   - para interesse em imóvel, o imóvel precisa estar **na seleção do site e público na Maison** (mesmo predicado do catálogo); senão, recusa sem registrar;
   - grava a submissão **antes** da entrega, com origem, site, corretor, hostname, caminho e código Vista esperado do corretor.
4. Entrega única ao Vista (`VistaLeadProvider`). Resultado, `Codigo` e `Corretor` vão para `lead_delivery_attempts` e `lead_submissions`.
5. O estado de atribuição é calculado (abaixo) e o visitante vê: *"Recebemos seu interesse. Nossa equipe entrará em contato."*
6. O lead aparece em **Meu site → Leads** (corretor) e em **Leads** (ADMIN/MANAGER).

Nenhum identificador de site, corretor ou código Vista vem do navegador. Campos como `brokerUserId`, `brokerSiteId` e `source` no corpo são ignorados (há teste).

## Origem registrada

| Campo | Conteúdo |
|---|---|
| `source` | `MAISON_SITE` ou `BROKER_SITE` |
| `broker_site_id`, `broker_user_id` | Site e corretor dono no momento do envio |
| `source_hostname`, `source_path` | Ex.: `ana.vitoriamaison.com.br` e `/imoveis/apto-itaim` |
| `source_page` | O que vai ao Vista em `anuncio`: `/corretor/ana/imoveis/apto-itaim` |
| `vista_broker_code_requested` | Código Vista do corretor (definido por ADMIN) no momento do envio |
| `vista_broker_code_returned` | `Corretor` informado pela resposta do Vista |

A origem é **imutável**. Um gatilho no banco recusa alterações de `source`, `source_hostname`, `source_path`, `source_page`, do código solicitado e de site/corretor; a única exceção é o `ON DELETE SET NULL`. Trocar o subdomínio não altera leads anteriores, e um novo envio cria outro registro, sem sobrescrever o anterior.

## Estados

**Entrega** (`delivery_status`, já existente): `PENDING`, `DELIVERED`, `MOCKED`, `FAILED`, `UNKNOWN`.

**Atribuição** (`assignment_status`, novo, independente da entrega):

| Estado | Quando |
|---|---|
| `NOT_APPLICABLE` | Lead do site institucional |
| `PENDING` | Site de corretor, entrega ainda não confirmada (inclui `FAILED`/`UNKNOWN`) |
| `UNVERIFIED` | Entregue, mas sem contrato de atribuição confirmado (padrão atual), sem código do corretor ou sem `Corretor` na resposta |
| `CONFIRMED` | Com `BROKER_VISTA_ASSIGNMENT_ENABLED=true` e `Corretor` = código do corretor, **ou** conferido manualmente no Vista por ADMIN/MANAGER |
| `MISMATCH` | Com a flag ligada e `Corretor` diferente (ex.: cliente já vinculado a outro corretor), **ou** divergência registrada manualmente |

"Entregue ao Vista" e "atribuição não verificada" podem ser verdade ao mesmo tempo, e isso é exibido assim. Uma nova tentativa de entrega nunca sobrescreve uma conferência manual.

## Duplicidades e casos especiais

- **Clique repetido ou replay:** a mesma `submissionKey` devolve o lead existente, sem novo envio.
- **Mesmo contato, mesma mensagem, em 10 minutos:** deduplicado por HMAC, **por site**. O mesmo visitante falando com dois corretores gera dois leads.
- **Rajada:** no máximo 5 envios por sessão anônima em 10 minutos.
- **Timeout, 5xx ou resposta desconhecida:** `UNKNOWN`, sem repetição automática. O ADMIN reconcilia depois de procurar no Vista:
  - **Consta no Vista** → `DELIVERED`, com o código opcional;
  - **Não consta** → `FAILED`, o que libera nova tentativa.
  - Um `PENDING` parado há mais de 10 minutos (processo interrompido) também pode ser reconciliado.
- **Nova tentativa:** somente `FAILED`, com reserva atômica `FAILED → PENDING`. Duas abas ou cliques não geram dois envios.
- **Cliente existente com outro corretor no Vista:** nada é alterado automaticamente. Aparece como `UNVERIFIED` (ou `MISMATCH` com a flag), e a decisão é comercial.
- **Spam:** honeypot, limites de tamanho e taxa.

## Painéis

**Meu site → Leads** (`/admin/meu-site/leads`), perfil BROKER (`leads:read-own`):
- **Escopo:** o site do usuário logado, resolvido pela sessão. A consulta filtra **por site E por usuário**; nenhum ID de site é aceito da URL.
- **Conteúdo:** data, nome, WhatsApp (link direto), e-mail, imóvel (título + código), mensagem, origem, entrega, atribuição e código do lead no Vista.
- **Filtros e ordem:** código do imóvel, entrega, atribuição e período; mais recentes primeiro, 20 por página no servidor.
- **Escopo do MVP:** consulta. Não há funil, propostas nem tarefas.

**Meu site → Painel**, indicadores reais (somente formulários):
- total;
- últimos 30 dias;
- entregues ao Vista;
- atribuição a conferir (`PENDING` + `UNVERIFIED`);
- divergências;
- top 5 imóveis.

Cliques no WhatsApp não são contados.

**Leads** (`/admin/leads`), `leads:read` (ADMIN, MANAGER):
- colunas de origem (corretor + hostname), código Vista e atribuição;
- filtros por canal, corretor, site, atribuição, entrega, tipo, imóvel e período;
- atalho **Ver divergências**.

**Detalhe do lead** (`leads:manage` para as ações):
- origem completa, código esperado × código retornado e histórico de tentativas (com `Codigo`/`Corretor`);
- ações:
  - nova tentativa (só `FAILED`);
  - reconciliação de entrega (`UNKNOWN`/`PENDING` parado);
  - conferência de atribuição: "está com o corretor do site" / "está com outro corretor".
- Ações auditadas em `admin_audit_events` (`LEAD_DELIVERY_RECONCILED`, `LEAD_ASSIGNMENT_CHECKED`), sem dados pessoais.

## WhatsApp

- **Número e mensagem:** número profissional do perfil (10–13 dígitos), link `wa.me`. Mensagem: *"Olá! Tenho interesse no imóvel [código] divulgado em seu site: [URL]."*
- **Validação:**
  - o código precisa seguir o padrão `[\w.-]`;
  - a URL é a do imóvel no site do corretor, montada no servidor a partir da configuração (nunca do `Host`), só `http(s)`.
- **Privacidade e registro:**
  - nenhum dado do visitante entra no link;
  - não há infraestrutura analítica de cliques, então nada é registrado;
  - clique nunca vira lead.

## Feature flags

| Variável | Padrão | Efeito |
|---|---|---|
| `BROKER_SITES_ENABLED` | `false` | Resolução pública dos subdomínios (desligado → 404). Faz o papel do "público ligado" da especificação |
| `BROKER_LEADS_ENABLED` | `false` | Formulários dos sites de corretor. Desligado: aviso "Formulário em preparação" (WhatsApp/e-mail continuam) e o servidor recusa envios com mensagem clara. O site institucional não é afetado |
| `BROKER_VISTA_ASSIGNMENT_ENABLED` | `false` | Comparação `Corretor` × código do corretor (`CONFIRMED`/`MISMATCH`). Exige contrato confirmado |
| `VISTA_LEAD_BROKER_FIELD` | vazio | Campo de corretor no `POST /lead`, enviado só com a flag acima |

Flags são lidas no servidor (sem `NEXT_PUBLIC_`) e não substituem autorização.

## Segurança

| Tema | Como é tratado |
|---|---|
| Isolamento | Consultas do painel com `broker_site_id` **e** `broker_user_id` da sessão. Testes cobrem A × B, MANAGER+BROKER, MANAGER sem BROKER e ADMIN global |
| Hostname | Só o `Host`; `X-Forwarded-Host` não decide o site. Hosts externos viram institucional, nunca corretor |
| Imóvel | Fora da seleção, de outro corretor ou despublicado → recusado sem registro |
| Site suspenso, rascunho ou inexistente | Recusado; o proxy também responde 404 |
| CSRF | Server Actions (origem verificada pelo Next) + `assertSameOriginAction` nas ações administrativas |
| Logs | Sem nome, telefone, e-mail ou mensagem; a chave do Vista é mascarada |
| Credenciais | Somente no servidor; nada em `NEXT_PUBLIC_` |
| Retenção | `npm run leads:cleanup` (`LEAD_RETENTION_DAYS`) vale também para leads de corretores |

## Migration

`0014_broker_leads`:
- novos campos em `lead_submissions` (tabela acima), com `CHECK` de consistência da origem;
- índices por site, corretor e atribuição;
- gatilho de imutabilidade da origem;
- `vista_reference` e `vista_broker_code_returned` em `lead_delivery_attempts`.

Leads antigos ficam como `MAISON_SITE` / `NOT_APPLICABLE`.

`0015_backfill_broker_leads` vincula ao corretor os leads recebidos pelos sites **antes** da 0014. Eles tinham `source_page` `/corretor/<subdomínio>/…`, prefixo que o servidor só gravava quando o envio vinha do host do corretor. Leads cujo subdomínio não existe mais continuam como `MAISON_SITE`. O gatilho de imutabilidade é suspenso apenas durante essa correção.

O corretor acessa os leads pelo item **Meus leads** do menu lateral (ou pela aba Leads de Meu site).
