# Vitória Maison

Experiência editorial da Vitória Maison em Next.js App Router, TypeScript e Tailwind CSS, com catálogo alternável entre mocks e PostgreSQL sincronizado em leitura com o Vista CRM.

## Executar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Verificar

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Configuração de contato

Configure opcionalmente `NEXT_PUBLIC_WHATSAPP_NUMBER` e `NEXT_PUBLIC_CONTACT_EMAIL`. Sem esses valores, o site não cria links de contato fictícios.

Os artigos de Perspectivas são demonstrativos e nunca são indexados. A indexação do site fica bloqueada por padrão; veja a seção SEO.

## PoC Vista CRM

Copie `.env.example` para `.env.local`, preencha as variáveis `VISTA_*` e habilite explicitamente `VISTA_POC_ENABLED=true`. As credenciais são usadas apenas pelos scripts server-side e nunca devem receber o prefixo `NEXT_PUBLIC`.

Execute em ordem:

```bash
npm run vista:test:connection
npm run vista:test:list
npm run vista:test:details -- --code=CODIGO
npm run vista:test:report
```

O último comando consulta no máximo cinco registros, consulta os detalhes do primeiro código retornado e atualiza `docs/vista-poc-report.md` com informações técnicas sanitizadas. Nenhum endpoint público foi criado e o site continua usando os mocks.

## Backend PostgreSQL

Configure no `.env` local:

```dotenv
DATABASE_URL=postgresql://...
PROPERTY_DATA_SOURCE=mock
PROPERTY_DEFAULT_STATE=SP
VISTA_IMAGE_HOSTNAME=
AVAILABILITY_CONFIRMATION_TTL_DAYS=7
PUBLICATION_SNAPSHOT_MAX_AGE_HOURS=48
NEXT_PUBLIC_SITE_URL=https://www.seu-dominio.com.br
AUTH_SECRET=gere-com-npx-auth-secret
AUTH_TRUST_HOST=true
```

Execute a migration:

```bash
npm run db:migrate
```

Adicione e sincronize um imóvel sem publicá-lo:

```bash
npm run maison:property:add -- --code=31
npm run maison:property:list
npm run maison:property:sync -- --code=31
```

Sincronização e status:

```bash
npm run vista:sync -- --code=31
npm run vista:sync:all
npm run vista:sync:status
```

Para usar PostgreSQL no site, defina `PROPERTY_DATA_SOURCE=database`. Não existe fallback silencioso para mocks. Enquanto disponibilidade não estiver confirmada e persistida, a fonte database retorna estado vazio mesmo que um registro esteja marcado como publicado.

## Publicar um imóvel real

Depois de migrar e sincronizar, valide sem alterar o banco:

```bash
npm run maison:property:validate -- --code=31
```

Enquanto o Vista não fornecer disponibilidade inequívoca, registre uma confirmação temporária com operador explícito e publique:

```bash
npm run maison:property:confirm-availability -- --code=31 --operator=nome.sobrenome
npm run maison:property:publish -- --code=31
npm run maison:property:status -- --code=31
```

Para retirar do site sem apagar snapshot ou histórico:

```bash
npm run maison:property:unpublish -- --code=31
```

A confirmação expira automaticamente após `AVAILABILITY_CONFIRMATION_TTL_DAYS`; o imóvel sai de todas as consultas públicas mesmo que `published=true`. O snapshot também precisa ser mais recente que `PUBLICATION_SNAPSHOT_MAX_AGE_HOURS`. Detalhes em `docs/vista-publication-rules.md`.

O teste de integração PostgreSQL só executa com `TEST_DATABASE_URL` apontando para um banco de teste já migrado:

```bash
TEST_DATABASE_URL=postgresql://... npm test
```

Mais detalhes em `docs/backend-architecture.md`, `docs/database-schema.md`, `docs/vista-sync.md` e `docs/vista-field-mapping.md`.

## Painel administrativo

Depois de aplicar as migrations, crie o primeiro administrador em um terminal seguro:

```bash
npm run admin:create
```

Inicie o projeto e acesse `http://localhost:3000/admin/login`. O painel oferece dashboard, explorador visual do Vista, importação individual ou em lote, edição editorial, confirmação de disponibilidade, publicação segura, destaques, coleções, sincronização individual e prévia autenticada.

No explorador `/admin/vista`, os filtros e a paginação são processados pelo Vista. As fotos dos cards vêm exclusivamente de `FotoDestaque`, validada como HTTPS no host configurado em `VISTA_IMAGE_HOSTNAME`. A seleção é limitada a 20 imóveis e todos os novos registros entram como rascunho.

Consulte `docs/admin-auth.md` e `docs/admin-panel.md` para configuração, segurança e operação.

## Usuários, perfis e permissões

Cada usuário pode acumular perfis: **ADMIN** (tudo, inclusive usuários), **MANAGER** (imóveis, importação, publicação, sincronização, coleções e leads) e **BROKER** (área pessoal; base para o futuro site do corretor). As permissões são verificadas no servidor em cada página, Server Action e serviço, a partir dos perfis lidos do banco a cada requisição.

- `/admin/usuarios`: ADMIN cria contas e atribui perfis. A pessoa recebe um convite e define a própria senha.
- `/admin/minha-conta`: dados pessoais e troca de senha, para qualquer perfil.
- `/admin/recuperar-senha`: redefinição por e-mail com link de uso único.
- O sistema nunca fica sem um ADMIN ativo (regra no serviço e no banco).

Antes de produção, aplique `npm run db:migrate` (migration `0010`, que preserva os administradores atuais como ADMIN) e configure `APP_URL` e `EMAIL_PROVIDER`. Sem provider, nenhum e-mail é enviado e o painel informa isso.

Documentação: `docs/rbac-architecture.md`, `docs/user-management.md` e `docs/broker-sites-architecture.md`.

## Sites de corretores (fundação)

Cada corretor (perfil BROKER) pode preparar um perfil profissional e um site em `nome.<domínio-base>`, servido pela mesma aplicação e pelo mesmo banco. O site nasce em rascunho, é enviado para revisão e só fica público após a aprovação de um ADMIN. O site publicado tem home editorial, catálogo exclusivo (somente os imóveis selecionados e elegíveis na Maison) e página de imóvel com o contato do corretor (`docs/broker-site-frontend.md`).

```dotenv
BROKER_SITES_ENABLED=false
BROKER_SITES_BASE_DOMAIN=vitoriamaison.com.br   # local: maison.lvh.me
BROKER_SITES_INDEXING_ENABLED=false             # home dos sites publicados indexável (exige indexação global)
```

O corretor configura tudo em **Meu site** (perfil, foto, textos da página, imagem de apresentação, imóveis da Maison, até 6 destaques, ordem e prévia completa) e solicita a publicação quando a completude chega a 100%. O ADMIN revisa em **Sites de corretores**: verifica o CRECI, define o código Vista, aprova, devolve com justificativa, suspende ou reativa (`docs/broker-site-editor.md`, `docs/broker-site-publication.md`).

Local: `BROKER_SITES_ENABLED=true BROKER_SITES_BASE_DOMAIN=maison.lvh.me npm run dev` e abra `http://ana.maison.lvh.me:3000`. Detalhes, segurança e pendências de DNS em `docs/broker-sites-foundation.md`.

Testes de integração com PostgreSQL (incluindo concorrência do último ADMIN):

```bash
TEST_DATABASE_URL=postgresql://... npm test   # banco de TESTE migrado; tabelas de usuários são truncadas
```

## SEO e performance

A indexação só é liberada quando todas as condições forem verdadeiras: `SITE_INDEXING_ENABLED=true`, `NEXT_PUBLIC_SITE_URL` em HTTPS e diferente dos valores de exemplo, `PROPERTY_DATA_SOURCE=database`, build de produção e, se existir, `VERCEL_ENV=production`. Fora disso, todas as páginas recebem `noindex`, o sitemap fica vazio e o robots.txt não anuncia sitemap. Como as variáveis são lidas no build, alterá-las exige novo build e deploy.

```dotenv
NEXT_PUBLIC_SITE_URL=https://DOMINIO-DEFINITIVO
SITE_INDEXING_ENABLED=false
GOOGLE_SITE_VERIFICATION=
SEO_ORGANIZATION_SAME_AS=
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_ANALYTICS_CONSENT_DEFAULT=denied
```

- Metadata, canonical, Open Graph e JSON-LD são centralizados em `src/features/seo/`.
- `/comprar` e `/alugar` são catálogos próprios e indexáveis. URLs com filtros ou ordenação recebem `noindex, follow` com canonical na rota base.
- Imóveis inelegíveis respondem 404 e ficam fora do sitemap. Slugs de imóveis (`vista-{codigo}`) são estáveis; slugs de coleções alterados no painel redirecionam do endereço anterior.
- URLs do site Vitória Flats (`/imovel/...-{codigo}`, `/anuncie`, `/politica-privacidade`, `/busca`) já redirecionam para equivalentes reais.
- Analytics (GA4) é opcional, desligado por padrão e não envia dados pessoais. Exige consentimento antes de ativar.

Documentação: `docs/seo-audit.md`, `docs/seo-architecture.md`, `docs/performance-report.md`, `docs/seo-migration-plan.md` e `docs/seo-launch-checklist.md`.
