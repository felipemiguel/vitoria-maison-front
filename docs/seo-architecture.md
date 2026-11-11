# Arquitetura de SEO

Módulo central: `src/features/seo/`. Funções puras e testadas; páginas e rotas só consomem.

| Arquivo | Responsabilidade |
|---|---|
| `config.ts` | Marca, URL canônica, descrição, locale, imagem padrão, dados públicos da organização e decisão de indexação |
| `metadata.ts` | `buildPageMetadata` / `buildNoIndexMetadata`: title, description, canonical, Open Graph, Twitter, robots |
| `indexing.ts` | Política de URLs com parâmetros e de coleções |
| `catalog-params.ts` | Validação dos parâmetros do catálogo e rota equivalente por finalidade |
| `property-seo.ts` | Title e description de imóveis a partir de atributos reais |
| `json-ld.ts` | Organization/RealEstateAgent, WebSite, BreadcrumbList, RealEstateListing, CollectionPage |
| `sitemap.ts`, `robots.ts` | Construção do sitemap e do robots.txt |
| `legacy-redirects.ts` | Redirecionamentos do Vitória Flats (importado pelo `next.config.ts`) |

## Configuração

```dotenv
NEXT_PUBLIC_SITE_URL=https://DOMINIO-DEFINITIVO   # obrigatório para canonical, OG, JSON-LD e sitemap
SITE_INDEXING_ENABLED=false                        # true apenas no lançamento
GOOGLE_SITE_VERIFICATION=                          # token da meta tag do Search Console (opcional)
SEO_ORGANIZATION_SAME_AS=                          # perfis oficiais HTTPS, separados por vírgula (opcional)
```

A indexação só é liberada quando **todas** as condições forem verdadeiras: `SITE_INDEXING_ENABLED=true`, URL válida em HTTPS e diferente dos valores de exemplo (`seu-dominio`, `DOMINIO-DEFINITIVO`, `example.com`), `PROPERTY_DATA_SOURCE=database`, `NODE_ENV=production` e, quando existir, `VERCEL_ENV=production`. Qualquer outro caso gera `noindex, nofollow` em todas as páginas, sitemap vazio e robots.txt sem sitemap. Conteúdo mock nunca é indexado.

> `NEXT_PUBLIC_*` é embutido no build, e páginas estáticas (contato, investir, privacidade…) são pré-renderizadas. **Alterar essas variáveis exige novo build e deploy.**

Sem URL configurada, canonical e `og:url` são omitidos (um canonical relativo é inválido) e o JSON-LD não é emitido.

Os dados da organização no JSON-LD (telefones, e-mail, endereço e CRECI) vêm de `src/lib/config/company.ts`, a mesma fonte do rodapé.

## Regras de indexação

| URL | robots | canonical | Sitemap |
|---|---|---|---|
| `/` | index | `/` | sim |
| `/imoveis`, `/comprar`, `/alugar` | index (se houver resultados) | a própria rota | sim |
| `…?pagina=N` (N válido) | index | `…?pagina=N` | não |
| `…?bairro=…`, `?tipo=…`, `?ordem=…` e qualquer filtro | **noindex, follow** | rota base | não |
| `…?utm_*`, `gclid`, `fbclid`… | igual à rota sem os parâmetros | rota limpa | — |
| Resultado vazio ou página inexistente | noindex, follow | rota base | não |
| `/imoveis/[slug]` elegível | index | `/imoveis/[slug]` | sim |
| `/imoveis/[slug]` inelegível (rascunho, indisponível, expirado, removido) | 404 | — | não |
| `/colecoes` | index se houver ≥1 coleção com imóvel elegível | `/colecoes` | idem |
| `/colecoes/[slug]` publicada com ≥1 imóvel | index | `/colecoes/[slug]` | sim |
| `/colecoes/[slug]` publicada vazia | noindex, follow | idem | não |
| `/investir`, `/sobre`, `/contato`, `/anuncie-seu-imovel`, `/privacidade` | index | a própria rota | sim |
| `/perspectivas`, `/perspectivas/[slug]` (demonstrativos) | noindex, follow | — | não |
| `/termos` (provisório) | noindex, follow | — | não |
| `/admin/**` (inclui login e prévia) | noindex, nofollow + `X-Robots-Tag` | — | não |
| `/api/**` | `X-Robots-Tag` + `Disallow` no robots.txt | — | não |
| `/imovel/[slug]` (legado) | 308 para o imóvel equivalente, ou 404 | — | não |

### robots.txt × noindex × canonical

- **robots.txt** controla rastreamento. Bloqueia só `/api/`. Filtros e admin **não** são bloqueados, porque o robô precisa acessá-los para ler o `noindex`.
- **noindex** (meta robots e `X-Robots-Tag`) impede a indexação.
- **canonical** consolida variações que mostram o mesmo conteúdo (rastreamento, página 1 explícita).
- A proteção do painel é a autenticação. robots.txt não é mecanismo de segurança.

## Metadata dinâmica

- `/imoveis/[slug]`: título `"{Categoria} {finalidade} {em/nos} {Bairro}, {área} m²"` (ex.: "Flat à venda em Moema, 48 m² | Vitória Maison"). A descrição usa o texto editorial Maison quando houver (≥ 60 caracteres); caso contrário, só atributos existentes: área, dormitórios, suítes, vagas, valor e código. O texto bruto do Vista não é reaproveitado na meta description. Nada de metrô, vista, rentabilidade, condomínio ou infraestrutura inventados.
- A fonte é o PostgreSQL (snapshot publicado), pelo mesmo repositório da página. Nenhuma chamada ao Vista durante a geração de metadata.
- `getPublishedPropertyBySlug` (React `cache`) evita a consulta duplicada entre `generateMetadata` e a página.
- Coleções: `"Coleção {nome}"`; descrição cadastrada ou frase factual com a quantidade de imóveis.

## Imóveis indisponíveis e slugs

- A elegibilidade continua centralizada em `publicVisibilityConditions` (SQL derivado da política de publicação). Páginas, sitemap, coleções, metadata e redirecionamento do legado usam o mesmo predicado.
- **Indisponível, expirado, despublicado ou removido → 404.** Não há página "indisponível" com dados comerciais desatualizados. O 404 é preferido ao 410 porque a indisponibilidade costuma ser temporária (confirmação expirada, snapshot antigo); quando o imóvel volta a ser elegível, a mesma URL volta a responder.
- **Slugs de imóveis** são `vista-{codigo}`, gerados na importação e nunca alterados por preço, título ou descrição. Não há edição de slug de imóvel no painel.
- **Slugs de coleções** são editáveis: o slug anterior é gravado em `collection_slug_redirects` (migration `0009`) e `/colecoes/{antigo}` responde 308 para o slug atual. A resolução é por ID, o que evita cadeias, e o slug que volta a ser usado sai da tabela, o que evita loops.
- Redirecionamentos dinâmicos usam `permanentRedirect` (HTTP 308). O Google trata 308 como 301. Os redirecionamentos fixos do `next.config.ts` usam 301 explícito.

## Futuras landing pages (ex.: `/comprar/flats/moema`)

Não são geradas automaticamente. Para criar uma, verifique antes que existem:
1. Demanda identificada (Search Console/pesquisa) e volume real de imóveis elegíveis.
2. Texto editorial próprio, revisado e verdadeiro.

Implementação sugerida: rota estática por landing (`app/comprar/[categoria]/[bairro]` com `generateStaticParams` alimentado por uma lista curada no banco, nunca por combinação de filtros), reaproveitando `CatalogView` com filtros fixos, `buildPageMetadata`, indexação condicionada a resultados e entrada no sitemap pela mesma lista.

## Sitemap

`app/sitemap.ts` (dinâmico) → `buildSitemap`. Inclui páginas estáticas indexáveis, `/colecoes` (se houver coleção indexável), coleções com imóveis elegíveis e imóveis elegíveis (`listSitemapEntries`, consulta só de slug e data).

- `lastModified`: imóveis = `DataAtualizacao` do Vista (`source_updated_at`); coleções = `collections.updated_at` (só muda por edição no painel). Páginas estáticas não recebem data. `curated_properties.updated_at` não é usado porque cada sincronização o altera.
- Limite de 50.000 URLs por arquivo: acima disso o build falha de propósito, e o sitemap deve ser dividido com `generateSitemaps`.

## Dados estruturados

| Página | Tipos |
|---|---|
| Home | `RealEstateAgent` (nome, URL, logo, área atendida, telefones, e-mail, endereço comercial, CRECI e `parentOrganization` Grupo Vitória Flats, os mesmos dados do rodapé, em `src/lib/config/company.ts`; `sameAs` só se configurado) + `WebSite` |
| Imóvel | `RealEstateListing` (título, descrição, fotos, `Offer` com preço em BRL, `Apartment` com área, dormitórios, cidade e UF) + `BreadcrumbList` |
| Coleção com imóveis | `CollectionPage` + `ItemList` + `BreadcrumbList` |

Sem avaliações, coordenadas, disponibilidade ou preço ausente. O endereço é só o comercial da imobiliária; imóveis recebem apenas cidade e UF. Um único `<script type="application/ld+json">` por página, com `<` escapado. Adicionar Schema.org não garante rich results.

## Open Graph

- Home e páginas institucionais: `/og/marca.png` (1200×630, gerado no build a partir do logo oficial).
- Imóvel: até três fotografias reais HTTPS do snapshot publicado.
- Coleção: imagem editorial cadastrada; senão, a foto real do primeiro imóvel; senão, a marca.
- Imagens mock nunca são usadas para imóveis reais (mocks não são indexados).

## Política de cache

| Superfície | Estratégia | Motivo |
|---|---|---|
| Home, catálogo, comprar, alugar, detalhe, coleções, sitemap | Renderização dinâmica, sem cache entre requisições | A elegibilidade depende do horário (expiração da confirmação, idade do snapshot) e de sincronizações executadas por CLI, fora do Next.js. Um cache de página poderia manter visível um imóvel inelegível |
| Mesma requisição | React `cache` (metadata + página, coleções) | Elimina consultas duplicadas |
| Mutações no painel | `revalidatePublicCatalog` (home, catálogos, detalhe, coleções, sitemap) | Limpa o Router Cache dos clientes |
| Páginas institucionais | Estáticas no build | Sem dados dinâmicos |
| `/og/marca.png` | Estática no build | — |
| Imagens otimizadas | `minimumCacheTTL` de 30 dias | Fotos do Vista têm hash no nome |
| Admin, leads, sessões | Nunca em cache público | Dados pessoais |

Sem Redis. Evolução possível quando a sincronização rodar dentro do Next.js (job ou rota protegida): `unstable_cache`/`use cache` com tags por imóvel, `revalidate` curto, menor que o menor prazo de expiração, e `revalidateTag` na sincronização.

## Imagens

- `remotePatterns`: Unsplash (`/photo-**`, editoriais e mocks) e os hosts em `VISTA_IMAGE_HOSTNAME` e `ADMIN_ALLOWED_IMAGE_HOSTNAMES`. Sem curingas e sem proxy aberto.
- `sizes` por grade; `preload` apenas no LCP (hero, primeira foto da galeria, primeiro card das listagens).
- Falha de carregamento: o fundo neutro permanece, com proporção fixa e sem layout shift ("Fotografia indisponível").

## Fontes

O código usa fontes do sistema (Georgia e Arial), decisão registrada em `docs/design-system.md`. Não há download de fontes nem CLS por troca de fonte. Instrument Serif e Manrope, citadas no briefing, **não estão no código atual**. Adotá-las mudaria a composição aprovada; se forem confirmadas, carregue via `next/font/google` com `display: "swap"`, `subsets: ["latin"]`, só os pesos usados e variáveis CSS em `.serif` e `body`.

## Analytics e monitoramento (opcional, desligado por padrão)

```dotenv
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_GA_MEASUREMENT_ID=             # G-XXXXXXXX (validado antes de injetar o script)
NEXT_PUBLIC_ANALYTICS_CONSENT_DEFAULT=denied
```

- Sem as variáveis, nenhum script de terceiros é carregado.
- Consent Mode v2 com armazenamento negado por padrão. **Implemente o registro de consentimento (LGPD) antes de ativar em produção.**
- Eventos: `search`, `view_item`, `view_collection`, `generate_lead` e `web_vitals` (LCP, INP, CLS, TTFB, FCP). `whatsapp_click` fica disponível para quando houver link de WhatsApp.
- Parâmetros filtrados por lista permitida (finalidade, tipo, bairro, código do imóvel, coleção, tipo de lead, página de origem, situação). Nome, e-mail, telefone, mensagem e tokens nunca são enviados.
- Admin não envia page views.
