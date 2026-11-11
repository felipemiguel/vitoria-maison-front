# Arquitetura futura: sites individuais de corretores

Visão de arquitetura. **Implementado na Fase 6.4A** (ver `docs/broker-sites-foundation.md`): `broker_profiles`, `broker_sites`, `broker_site_properties`, permissões, serviços, validação de subdomínio, roteamento por hostname, prévia autenticada e página de diagnóstico. **Implementado na Fase 6.4B** (ver `docs/broker-site-frontend.md`): home, catálogo exclusivo, detalhe de imóvel, SEO individual e contato. **Implementado na Fase 6.4C** (ver `docs/broker-site-editor.md` e `docs/broker-site-publication.md`): editor do corretor (perfil, página, imagem de apresentação, seleção, destaques e ordem dos imóveis), prévia completa, completude e revisão administrativa com justificativa. **Implementado na Fase 6.4D** (ver `docs/broker-leads.md`, `docs/vista-broker-leads.md` e `docs/broker-sites-production.md`): leads vinculados ao corretor de origem (origem resolvida pelo Host, imóvel validado na seleção do site), painel Meu site → Leads, visão administrativa com divergências, estados de atribuição separados da entrega, reconciliação manual e feature flags. **Pendente**: confirmação oficial do Vista sobre atribuição de corretor, DNS/TLS curinga em produção e domínios próprios.

## Princípios

1. **Perfil de acesso ≠ identidade de corretor.** `BROKER` diz o que a pessoa pode fazer no painel. A identidade profissional (nome público, CRECI, foto, biografia) é uma entidade própria, `broker_profiles`.
2. **Um usuário, vários papéis.** Quem é `MANAGER + BROKER` usa uma conta e um login.
3. **Autorização por propriedade.** As permissões `broker-site:*-own` só valem para o site cujo dono é o próprio usuário. Ter `BROKER` nunca dá acesso ao site de outro corretor.
4. **ADMIN tem controle administrativo global**, mas não vira corretor nem ganha site automaticamente.
5. **MANAGER não acessa automaticamente** os sites pessoais. Se for necessário, cria-se uma permissão explícita (ex.: `broker-sites:moderate`).
6. **Um registro comercial por imóvel.** Sites selecionam imóveis da curadoria; não duplicam `curated_properties` nem `property_snapshots`.
7. **Leads com escopo próprio**: cada lead sabe de qual site veio e a quem está atribuído.

## Modelo

> O modelo implementado na 6.4A segue esta proposta com ajustes: status `DRAFT | IN_REVIEW | PUBLISHED | SUSPENDED` (em vez de `published`), `headline`/`subtitle`/`hero_image_url`/`settings`, datas de revisão/aprovação/publicação/suspensão, `creci_verified_at` e `vista_broker_code_verified_at`, especialidades e regiões em JSONB. `custom_domain`, `theme` e as colunas de leads **ainda não existem**. O SQL abaixo é a referência original.

```sql
-- Identidade profissional (0..1 por usuário). Existe apenas para quem atua como corretor.
create table broker_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references admin_users(id) on delete restrict,
  public_name varchar(160) not null,
  creci varchar(40),                       -- validado pela equipe antes da publicação
  phone varchar(30), whatsapp varchar(30), public_email varchar(320),
  bio text, photo_url text,
  status varchar(20) not null default 'DRAFT',  -- DRAFT | ACTIVE | SUSPENDED
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Site do corretor (0..1 por perfil, extensível para N no futuro).
create table broker_sites (
  id uuid primary key default gen_random_uuid(),
  broker_profile_id uuid not null unique references broker_profiles(id) on delete restrict,
  slug varchar(80) not null unique,        -- vitoriamaison.com.br/corretores/{slug} ou {slug}.vitoriamaison.com.br
  custom_domain varchar(253) unique,       -- opcional, com verificação de DNS
  domain_verified_at timestamptz,
  published boolean not null default false,
  theme jsonb not null default '{}',       -- variações dentro da identidade Maison
  seo_title varchar(160), seo_description varchar(300),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Seleção de imóveis por site: N:N com a curadoria existente (sem duplicar o registro comercial).
create table broker_site_properties (
  broker_site_id uuid not null references broker_sites(id) on delete cascade,
  curated_property_id uuid not null references curated_properties(id) on delete cascade,
  sort_order integer not null default 0,
  highlight boolean not null default false,
  primary key (broker_site_id, curated_property_id)
);

-- Leads: origem e atribuição.
alter table lead_submissions add column broker_site_id uuid references broker_sites(id);
alter table lead_submissions add column assigned_user_id uuid references admin_users(id);
```

## Relacionamentos

```
admin_users 1 ── 0..1 broker_profiles 1 ── 0..1 broker_sites N ── N curated_properties
      │                                              │
      └── N user_roles (BROKER, MANAGER, ...)        └── 1 ── N lead_submissions (origem)
```

- Um imóvel pode aparecer em vários sites e no site institucional ao mesmo tempo.
- **A elegibilidade pública continua central**: o site do corretor usa o mesmo `publicVisibilityConditions`. Imóvel despublicado, indisponível ou com confirmação expirada some de todos os sites. O corretor escolhe **quais** imóveis elegíveis exibir, nunca torna elegível um imóvel inelegível.
- O conteúdo comercial é somente leitura no site do corretor. Destaque e ordem são por site.

## Escopo de leads

| Origem | `broker_site_id` | `assigned_user_id` | Quem vê |
|---|---|---|---|
| Site institucional | nulo | definido pela equipe | `leads:read` (ADMIN, MANAGER) |
| Site do corretor | site de origem | dono do site (padrão) | o corretor (próprios leads) + `leads:read` |

Permissão futura sugerida: `leads:read-own` para BROKER, com filtro obrigatório `assigned_user_id = usuário atual` aplicado no serviço/consulta, nunca só na interface. A entrega ao Vista continua igual; o campo de corretor no Vista deve ser mapeado quando confirmado.

## Domínios e subdomínios

1. **Caminho** (recomendado para começar): `/{corretores}/{slug}` no domínio principal. Sem DNS adicional e com a autoridade do domínio principal.
2. **Subdomínio**: `{slug}.dominio`. Exige DNS curinga e roteamento por host no `proxy.ts`.
3. **Domínio próprio**: `custom_domain` com verificação por registro TXT, certificado automático na plataforma e canonical apontando para o domínio escolhido.

Regras de SEO: um único canonical por página de imóvel (o do site institucional, salvo decisão contrária), sitemap por site e `noindex` enquanto `published=false`.

## Regras de autorização futuras

```ts
// Permissões efetivas continuam vindo dos perfis; o recurso decide a propriedade.
function canManageBrokerSite(user: SessionUser, site: { ownerUserId: string }): boolean {
  if (hasPermission(user, "broker-site:manage-all")) return true;           // ADMIN
  return hasPermission(user, "broker-site:update-own") && site.ownerUserId === user.id;
}
```

- Implementado: `broker-profile:read-own`, `broker-profile:update-own`, `broker-site:read-own`, `broker-site:create-own`, `broker-site:update-own`, `broker-site:submit-review` (BROKER) e `broker-site:manage-all` (ADMIN), com a regra `canAccessBrokerSite`.
- Toda consulta de site/leads do corretor filtra por `owner = user.id` no SQL.
- Suspender o `broker_profiles` despublica o site sem desativar o usuário (que pode continuar como MANAGER).
- Desativar o usuário revoga as sessões e despublica o site.
- Auditoria: novas ações em `user_audit_events` (perfil profissional) e em `admin_audit_events` (site e seleção de imóveis).

## Fora do escopo até a implementação

Distribuição automática de leads, comissões, multi-tenant completo, domínios personalizados e editor visual de site.
