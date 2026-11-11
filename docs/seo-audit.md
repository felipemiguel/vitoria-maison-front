# Auditoria inicial de SEO e performance

Realizada em 10/11/2026 sobre o código antes da Fase 5. Build de produção local (`next build` + `next start`), fonte de dados `database` com dois imóveis elegíveis, Lighthouse 12.8.2 em Chrome headless. Medições de laboratório, não de usuários reais.

## Ambiente

| Item | Estado encontrado |
|---|---|
| Next.js | 16.4.5, App Router, sem `cacheComponents` |
| React | 19.2 |
| Renderização | Home, catálogo, coleções e sitemap com `force-dynamic`; detalhe com ISR de 300 s; páginas institucionais estáticas |
| Fontes | Fontes do sistema (Georgia/Arial), sem download. O design system documenta essa escolha (`docs/design-system.md`). Instrument Serif e Manrope **não** são usadas no código |
| CSS | Tailwind 4, um arquivo global, sem CSS bloqueante adicional |
| Imagens | `next/image` em todo o site; `remotePatterns` para Unsplash e para o host do Vista |
| Dependências sem uso | `motion` e `@radix-ui/react-select` declaradas, sem nenhum import |

## Problemas encontrados

### Indexação e metadata

| # | Problema | Impacto | Prioridade |
|---|---|---|---|
| 1 | `robots.txt` com `Disallow: /` e `noindex` fixo no layout, sem configuração por ambiente | Nada indexável; sem caminho seguro para o lançamento | Alta |
| 2 | Sem `metadataBase`, canonical, Open Graph completo ou Twitter Cards | URLs duplicadas sem consolidação; compartilhamento sem imagem | Alta |
| 3 | Title e description do imóvel = título editorial + 150 primeiros caracteres da descrição (corte no meio da palavra) | Títulos pouco descritivos; descrições truncadas | Alta |
| 4 | `/comprar` e `/alugar` faziam redirecionamento **temporário** (307) para `/imoveis?finalidade=…` | Rotas principais sem conteúdo próprio; sinais divididos | Alta |
| 5 | Filtros e ordenações do catálogo geravam URLs indexáveis sem canonical | Risco de milhares de combinações indexadas | Alta |
| 6 | Parâmetros inválidos (`?finalidade=X`, `?pagina=abc`) eram repassados ao SQL | Erro 500 em URLs arbitrárias acessadas por robôs | Alta |
| 7 | Sitemap incluía `/perspectivas` (demonstrativo) e não tinha `lastModified`; carregava imóveis completos página a página | Conteúdo fictício anunciado; consulta pesada | Média |
| 8 | Sem dados estruturados | Sem entidade de organização nem breadcrumbs | Média |
| 9 | Coleções sem metadata; coleções vazias indexáveis | Páginas finas | Média |
| 10 | Admin protegido por autenticação, mas sem `noindex` explícito nem `X-Robots-Tag` | Risco baixo (exige login), mas sem defesa em profundidade | Média |
| 11 | Slug de coleção editável no painel, sem redirecionamento do anterior | URL quebrada após renomear | Média |
| 12 | Sem favicon (`/favicon.ico` → 404) | Erro no console; sem ícone nos resultados | Baixa |

### Performance

| # | Problema | Evidência | Prioridade |
|---|---|---|---|
| 13 | Logo declarado com `width=2172` sem `sizes`: o otimizador servia a variante de **3840 px** (84 KB) com prioridade alta em todas as páginas | Requisição `w=3840` no waterfall; decodificação de ~2 s no mobile simulado | Alta |
| 14 | Home mobile: Performance 53, LCP 4,87 s, TBT 1.868 ms | Lighthouse | Alta |
| 15 | Cards com `sizes` genérico (33vw) também em grades de 4 colunas; dois cards da home com `priority` abaixo do hero | Fotos maiores que o necessário; disputa com o LCP | Média |
| 16 | `SiteShell` cliente importava `Header` e `Footer`: o footer era hidratado sem necessidade | Bundle cliente | Baixa |
| 17 | `generateMetadata` e página do imóvel faziam a mesma consulta duas vezes | 2 consultas por requisição | Baixa |
| 18 | Galeria sem tratamento de falha de imagem | Imagem quebrada visível | Baixa |

### Riscos de exposição do painel

- Todas as rotas `/admin` exigem sessão (layout protegido, Server Actions e `proxy.ts`). Nenhuma rota de API administrativa pública.
- `robots.txt` não deve listar `/admin` como mecanismo de proteção: a defesa é a autenticação. A fase acrescentou `noindex` e `X-Robots-Tag`.

### Páginas sem conteúdo indexável

- `/perspectivas` e os três artigos: marcados como "leitura demonstrativa".
- `/termos`: "documento provisório".
- Home e `/sobre` usam fotografias ilustrativas do Unsplash (não são de imóveis), aceitáveis como imagens editoriais.

## Medições iniciais (Lighthouse, execução única)

| Página | Perf. mobile | LCP mobile | TBT mobile | CLS | Perf. desktop | SEO |
|---|---|---|---|---|---|---|
| Home | 53 | 4,87 s | 1.868 ms | 0 | 98 | 66* |
| Catálogo | 99 | 2,23 s | 32 ms | 0 | 100 | 66* |
| Detalhe | 98 | 2,30 s | 47 ms | 0 | 100 | 66* |
| Coleção | 98 | 2,32 s | 47 ms | 0 | 100 | 66* |
| Contato | 98 | 2,40 s | 59 ms | 0 | 100 | 66* |

\* O SEO 66 reflete o bloqueio intencional de indexação. Detalhes completos em `docs/performance-report.md`.

## O que não foi possível medir

- **INP e métricas de campo (p75)**: não há tráfego real nem CrUX para o novo site. O INP só pode ser obtido com usuários reais; o TBT é usado como diagnóstico de laboratório.
- **Search Console do domínio legado**: sem acesso. Backlinks e páginas com tráfego orgânico não foram levantados.
- **Rede e CPU de produção**: as medições foram feitas localmente; o TTFB depende da infraestrutura e da latência até o PostgreSQL.
