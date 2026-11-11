# Checklist de lançamento SEO

Não ative a indexação antes de concluir os blocos 1 a 3.

## 1. Conteúdo e dados

- [ ] Imóveis elegíveis revisados: título editorial coerente com bairro e categoria do snapshot do Vista
- [ ] Descrição editorial Maison preenchida nos imóveis publicados (senão, a meta description usa só atributos)
- [ ] Coleções publicadas com descrição real e ao menos um imóvel elegível; capa editorial HTTPS, se houver
- [ ] Texto jurídico de `/termos` aprovado → trocar `buildNoIndexMetadata` por `buildPageMetadata` e incluir em `INDEXABLE_STATIC_PATHS`
- [ ] `/privacidade` revisada pelo jurídico (inclusive sobre analytics, se for ativado)
- [ ] Artigos de `/perspectivas` substituídos por conteúdo revisado → remover `noindex` e incluir no sitemap (avaliar `Article` JSON-LD)
- [ ] Favicon e ícones a partir de um símbolo oficial da marca (não existe hoje; `/favicon.ico` responde 404)
- [ ] Dados da imobiliária em `src/lib/config/company.ts` conferidos (rodapé e JSON-LD)

## 2. Configuração de produção

- [ ] Domínio definitivo decidido (`docs/seo-migration-plan.md`, seção 3)
- [ ] `NEXT_PUBLIC_SITE_URL=https://<domínio definitivo>` (HTTPS, sem barra final)
- [ ] `PROPERTY_DATA_SOURCE=database`
- [ ] `PROPERTY_DEFAULT_STATE`, `VISTA_IMAGE_HOSTNAME` e `ADMIN_ALLOWED_IMAGE_HOSTNAMES` corretos
- [ ] `npm run db:migrate` aplicado (inclui `0009_collection_slug_redirects`)
- [ ] Homologação/preview **sem** `SITE_INDEXING_ENABLED=true`; se possível, protegida por autenticação
- [ ] HTTPS ativo e um único host canônico (redirecionar `www` ↔ sem `www` no provedor)

## 3. Validação em homologação (indexação ainda desligada)

- [ ] `npm run lint && npm run typecheck && npm test && npm run build`
- [ ] Build temporário com a configuração final em ambiente isolado: `/robots.txt` com `Sitemap:`; `/sitemap.xml` só com URLs válidas
- [ ] Rich Results Test e Schema Markup Validator em: home, um imóvel, uma coleção
- [ ] Depurador de compartilhamento (Facebook/LinkedIn) para home, imóvel e coleção
- [ ] `curl -I` em `/admin/login` → `X-Robots-Tag: noindex, nofollow, noarchive`
- [ ] Filtros (`/comprar?bairro=x`) → `noindex, follow` com canonical na base
- [ ] Imóvel despublicado → 404 e fora do sitemap
- [ ] Lista de URLs legadas rastreada: 301/308 corretos, sem cadeias, sem envio para a home
- [ ] PageSpeed Insights (mobile) em home, catálogo, imóvel, coleção e contato

## 4. Ativação

- [ ] `SITE_INDEXING_ENABLED=true` no ambiente de produção → **novo build e deploy** (as variáveis são lidas no build)
- [ ] Conferir em produção: `<meta name="robots" content="index, follow">` na home e sitemap preenchido

## 5. Search Console

1. Adicionar a propriedade de **domínio** (verificação DNS, recomendada) ou de prefixo de URL.
2. Para verificação por meta tag: copiar o token para `GOOGLE_SITE_VERIFICATION` e fazer novo deploy.
3. Enviar `https://<domínio>/sitemap.xml` em Sitemaps.
4. Inspecionar URL: home, um imóvel e uma coleção → "Solicitar indexação".
5. Na migração de domínio (opção B): usar "Mudança de endereço" na propriedade do legado.

## 6. Monitoramento (primeiras 8 semanas)

- [ ] Cobertura/Páginas: erros 404 inesperados, "Rastreada, não indexada", canonical escolhido pelo Google
- [ ] Desempenho: cliques e impressões de URLs migradas versus o legado
- [ ] Core Web Vitals (campo, p75): LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Exige volume de tráfego
- [ ] Analytics (só após consentimento): `NEXT_PUBLIC_ANALYTICS_ENABLED=true`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`; conferir em DebugView que nenhum dado pessoal é enviado
- [ ] Manter o site legado no ar até estabilizar
