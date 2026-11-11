# Sites de corretores — fundação (Fase 6.4A)

Fundação técnica para servir `nome.vitoriamaison.com.br` (o frontend público está em `docs/broker-site-frontend.md`, Fase 6.4B) com a **mesma aplicação Next.js** e o **mesmo PostgreSQL**. O template público definitivo, a seleção de imóveis pela interface e os leads por corretor ficam para as fases 6.4B/C.

## Modelos (migration `0011_broker_sites_foundation`)

| Tabela | Papel | Restrições principais |
|---|---|---|
| `broker_profiles` | Identidade profissional pública (nome de exibição, título, bio, foto, contatos, CRECI, código Vista, especialidades, regiões) | `user_id` único → `admin_users` (sem duplicar autenticação); `specialties`/`service_regions` precisam ser arrays JSON |
| `broker_sites` | Site do corretor | `broker_profile_id` único (1 site por corretor); `subdomain` único com CHECK de formato; `status` ∈ DRAFT/IN_REVIEW/PUBLISHED/SUSPENDED; **PUBLISHED exige `approved_at` e `published_at`** (CHECK); SUSPENDED exige `suspended_at` |
| `broker_site_properties` | Seleção de imóveis da curadoria por site | PK (site, imóvel); FK para `curated_properties` (o imóvel precisa existir); `sort_order ≥ 0`; remover a associação não remove o imóvel |

- O perfil profissional só é criado para usuário **ativo com o perfil BROKER**, nunca automaticamente.
- **CRECI e código Vista** são campos separados com `*_verified_at`. Preencher não significa verificar: só um ADMIN registra a verificação, e alterar o dado apaga a verificação anterior. O código Vista não é usado em integrações enquanto não for verificado.
- Alterações críticas (criação, edição, mudanças de status, verificação) entram em `user_audit_events` (somente inserção), com o dono do site como alvo.

## Status e fluxo

```
DRAFT ──(dono: submit)──▶ IN_REVIEW ──(ADMIN: approve)──▶ PUBLISHED
  ▲                          │
  └──(ADMIN: return)─────────┘
DRAFT / IN_REVIEW / PUBLISHED ──(ADMIN: suspend)──▶ SUSPENDED ──(ADMIN: reactivate)──▶ DRAFT
```

- Nenhum site nasce publicado. Apenas ADMIN aprova, devolve, suspende e reativa.
- O dono edita conteúdo e endereço **somente em rascunho**. Reativar volta para rascunho, então o site passa por nova revisão.
- Versão otimista (`version`) em todas as mudanças.

## Permissões

| Permissão | ADMIN | MANAGER | BROKER |
|---|:-:|:-:|:-:|
| `broker-profile:read-own`, `broker-profile:update-own` | | | ✓ |
| `broker-site:read-own`, `broker-site:create-own`, `broker-site:update-own`, `broker-site:submit-review` | | | ✓ |
| `broker-site:manage-all` | ✓ | | |

- As permissões `-own` exigem também **ser dono do recurso**: `canAccessBrokerSite` compara o dono gravado no banco com o usuário da sessão.
- Site de outro corretor responde "Site não encontrado", sem revelar que existe.
- MANAGER não tem acesso aos sites pessoais. Quem é MANAGER + BROKER acumula a operação e o próprio site.
- ADMIN gerencia todos, mas não recebe identidade de corretor.
- Helper de servidor: `requireBrokerSiteAccess({ siteId, action })`. Nenhum `userId` ou `brokerProfileId` vindo do navegador é usado.

## Serviços

| Serviço | Responsabilidade |
|---|---|
| `BrokerProfileService` | criar (próprio ou pelo ADMIN), consultar, atualizar campos permitidos, verificar CRECI/código Vista |
| `BrokerSiteService` | criar rascunho, consultar, editar, transições de status, associar/remover imóveis (contrato para 6.4C), regra de acesso |
| `BrokerSubdomainService` | validar, verificar disponibilidade, sugerir alternativas, gerar o endereço público. A reserva é garantida pelo índice único na criação |
| `BrokerSitePropertyRepository` | imóveis visíveis de um site: **mesmo predicado público do catálogo** + seleção do site |

## Subdomínios

- Formato: 3 a 30 caracteres, `a-z`, `0-9` e hífen interno; sem hífen duplo, espaços, pontos ou acentos. O valor é validado também por CHECK no banco.
- Reservados (`src/features/brokers/subdomain-rules.ts`): `www admin api app mail smtp ftp suporte contato blog status assets static cdn auth login dashboard vitoria maison vitoriamaison`, além de infraestrutura de e-mail/DNS, ambientes (`dev`, `staging`, `preview`…), áreas oficiais (`painel`, `conta`, `oficial`, `corretores`, `imoveis`…) e a marca Vitória Flats.
- Fragmentos proibidos em qualquer posição: `vitoriamaison`, `vitoria-maison`, `maison`, `vitoriaflats`, `oficial`, `admin`, `suporte`, `atendimento`. Por exemplo, `ana-oficial` e `suporte-maison` são recusados.
- Conflito: `checkAvailability` sugere `nome-2`, `nome-3`…; `normalizeSubdomainCandidate("Ana Souza")` gera `ana-souza`.

## Roteamento por hostname

```
Host: ana.vitoriamaison.com.br  ──proxy.ts──▶ rewrite /broker-site/ana  ──página──▶ revalida o Host ──▶ site PUBLICADO?
```

1. `src/proxy.ts` (integra o Auth.js existente, sem fluxo concorrente) chama `routeRequest(Host, pathname, config)`:
   - host institucional, `www`, `localhost` ou externo (ex.: preview `*.vercel.app`): segue normal;
   - `<sub>.<domínio-base>` válido com o recurso ligado: rewrite para `/broker-site/<sub>…`;
   - reservado, multinível, inválido ou recurso desligado: **404**;
   - `/broker-site/*` acessado diretamente, em qualquer host: **404**;
   - `/admin`, `/api`, `/sitemap.xml` e `/og` em host de corretor: **404**. Não há operações administrativas pelas rotas dos corretores.
2. A página (`src/app/broker-site/[subdomain]`) resolve o `Host` **de novo** e exige que corresponda ao subdomínio do caminho. Só então busca o site, e somente se estiver `PUBLISHED`.
3. Apenas o cabeçalho `Host` (definido pela plataforma) é considerado. `X-Forwarded-Host` e query parameters nunca escolhem o site.
4. Rascunho, em revisão, suspenso e inexistente respondem o **mesmo 404**, o que impede enumerar sites.
5. As páginas institucionais foram movidas para o grupo `src/app/(public)`, com layout próprio (header e footer). As URLs não mudaram. O site do corretor tem layout separado, sem o header institucional.

## Prévia autenticada

- Corretor: `/admin/meu-site/previa`. ADMIN: `/admin/sites/[id]/previa`.
- As prévias ficam no domínio do painel, onde está o cookie de sessão, e mostram qualquer status. São `noindex`, exigem permissão e propriedade, e nunca são liberadas por parâmetro de URL.

## Cache e isolamento

- As páginas dos sites são dinâmicas (`force-dynamic`), sem cache de página entre requisições. A deduplicação usa React `cache` dentro da mesma requisição.
- O subdomínio faz parte do **caminho reescrito** (`/broker-site/ana`). Qualquer cache por caminho fica naturalmente separado por site, e o cache do navegador é separado por origem (hostname).
- O proxy define `Vary: Host` no rewrite, mas o Next.js substitui esse cabeçalho nas respostas finais (verificado no build). O isolamento **não** depende dele: as respostas dinâmicas não são cacheáveis publicamente e o caminho interno inclui o subdomínio.
- Mutações (site, imóveis, publicação na Maison) chamam `revalidateBrokerSites()`, e `revalidatePublicCatalog` também a chama.
- Consultas de imóveis sempre filtram pelo ID do site resolvido no servidor. Imóvel despublicado ou inelegível na Maison some de todos os sites.

## SEO nesta fase

- Metadata por site (título com o nome do corretor e canonical no hostname do site).
- Na 6.4A, todas as páginas de corretor eram `noindex`. Desde a 6.4B, a política é por página (ver `docs/broker-site-frontend.md`) e o proxy não força mais `X-Robots-Tag`.
- Sem sitemap de corretores. O sitemap institucional não lista sites de corretores.

## Configuração

```dotenv
NEXT_PUBLIC_SITE_URL=https://vitoriamaison.com.br   # domínio institucional
BROKER_SITES_BASE_DOMAIN=vitoriamaison.com.br        # domínio-base dos corretores
BROKER_SITES_ENABLED=false                           # liga a resolução pública
BROKER_SITES_DEV_PORT=3000                           # porta dos links em desenvolvimento
```

- Desligado (padrão): subdomínios respondem 404 e o institucional segue normal. O painel ainda permite preparar perfil e rascunho.
- Em produção, domínios de desenvolvimento (`*.localhost`, `*.lvh.me`) são recusados, e os links usam HTTPS sem porta.
- Hosts de preview e quaisquer hosts fora do domínio-base são sempre institucionais.

## Desenvolvimento local

**Opção recomendada (`lvh.me`, DNS público apontando para 127.0.0.1):**

```dotenv
BROKER_SITES_ENABLED=true
BROKER_SITES_BASE_DOMAIN=maison.lvh.me
```

```bash
npm run dev
# http://maison.lvh.me:3000          → institucional
# http://ana.maison.lvh.me:3000      → site "ana" (se PUBLICADO)
# http://joao.maison.lvh.me:3000     → site "joao"
```

O `next.config.ts` libera `allowedDevOrigins` apenas para o domínio configurado (só em desenvolvimento). Verificado nesta máquina: `ana.maison.lvh.me` resolve para 127.0.0.1. Exige acesso à internet para a consulta DNS.

**Sem internet (`localhost`):** `BROKER_SITES_BASE_DOMAIN=maison.localhost`. O Chrome resolve `*.localhost` sozinho; no macOS, o resolvedor do sistema devolve `::1` (IPv6). Se a página não abrir, inicie com `npx next dev -H ::`, ou adicione no `/etc/hosts`:

```
127.0.0.1 maison.localhost ana.maison.localhost joao.maison.localhost
```

**Sem navegador:** `curl -H "Host: ana.maison.lvh.me" http://127.0.0.1:3000/`.

Fluxo de teste: crie um usuário BROKER em `/admin/usuarios` → entre com ele → **Meu site**: perfil, criação e envio para revisão → com um ADMIN, aprove em **Sites de corretores** → abra `http://<sub>.maison.lvh.me:3000`.

## Como validar

```bash
npm run lint && npm run typecheck && npm test && npm run build
TEST_DATABASE_URL=postgresql://...teste npm test   # inclui integração de sites (perfis, isolamento, visibilidade)
```

Validado ponta a ponta com o build de produção e domínio fictício `maison.test`:
- `ana` (publicado) → 200;
- `joana` (rascunho) e `paulo` (suspenso) → 404;
- subdomínio inexistente e `admin.` → 404;
- `/admin` e `/api` em host de corretor → 404;
- `/broker-site/ana` direto → 404;
- `?preview=1` não libera rascunho;
- rotas institucionais → 200.

## Pendências de infraestrutura

- DNS curinga `*.vitoriamaison.com.br` e certificado TLS curinga. **Não foram ativados nesta fase.**
- Confirmar que a plataforma de hospedagem repassa o `Host` original (sem reescrevê-lo) e não aceita `Host` arbitrário de clientes.
- Decidir o domínio definitivo (ver `docs/seo-migration-plan.md`).
- Aplicar a migration `0011` (`npm run db:migrate`) após backup.
