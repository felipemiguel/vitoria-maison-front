# Relatório de performance — antes e depois

## Metodologia

- Build de produção local (`npm run build` + `next start`), mesmo banco e mesmos dados nas duas medições (dois imóveis elegíveis, coleção "Flats para Investimento").
- Lighthouse 12.8.2, Chrome headless. Mobile = perfil padrão (Moto G Power, 4× CPU, rede 4G lenta simulada). Desktop = `--preset=desktop`.
- **Uma execução por página**: variações de ±10% em LCP e TTFB são ruído. O TTFB local não representa produção.
- **Dados de laboratório.** As metas de Core Web Vitals (LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1) valem para o p75 de usuários reais e **não podem ser declaradas atingidas** com estes números. INP não é medível em laboratório; o TBT é diagnóstico.
- Páginas: home (`/`), catálogo (`/imoveis`), detalhe (`/imoveis/vista-16784235`), coleção (`/colecoes/jardins`, publicada mas sem imóveis elegíveis no banco local, por isso quase sem imagens) e contato (`/contato`).

## Resultados

| Página | Perf | LCP | TBT | CLS | TTFB | JS (KB) | Imagens (KB) | Req. | Total (KB) |
|---|---|---|---|---|---|---|---|---|---|
| Home — mobile | **53 → 96** | **4,87 s → 2,69 s** | **1.868 → 107 ms** | 0 → 0 | 477 → 68 ms | 165 → 165 | **288 → 117** | 19 → 19 | 475 → 305 |
| Home — desktop | 98 → 100 | 1,06 s → 0,78 s | 0 → 0 ms | 0 → 0 | 429 → 34 ms | 172 → 171 | **510 → 233** | 41 → 41 | 723 → 446 |
| Catálogo — mobile | 99 → 99 | 2,23 s → 2,15 s | 32 → 42 ms | 0 → 0 | 86 → 39 ms | 165 → 167 | 124 → 36 | 16 → 17 | 307 → 223 |
| Catálogo — desktop | 100 → 100 | 0,53 s → 0,51 s | 0 → 0 ms | 0 → 0 | 82 → 34 ms | 172 → 173 | 115 → 28 | 39 → 40 | 328 → 244 |
| Detalhe — mobile | 98 → 98 | 2,30 s → 2,33 s | 47 → 47 ms | 0 → 0 | 415 → 78 ms | 169 → 171 | 107 → 24 | 18 → 19 | 298 → 219 |
| Detalhe — desktop | 100 → 98 | 0,73 s → 0,64 s | 0 → 0 ms | 0 → 0 | 102 → 186 ms | 172 → 173 | 125 → 34 | 36 → 37 | 337 → 249 |
| Coleção — mobile | 98 → 99 | 2,32 s → 2,22 s | 47 → 59 ms | 0 → 0 | 162 → 173 ms | 163 → 166 | 84 → 9 | 17 → 19 | 269 → 197 |
| Coleção — desktop | 100 → 100 | 0,51 s → 0,48 s | 0 → 0 ms | 0 → 0 | 178 → 26 ms | 170 → 173 | 84 → 6 | 38 → 40 | 297 → 222 |
| Contato — mobile | 98 → 99 | 2,40 s → 2,24 s | 59 → 40 ms | 0 → 0 | 578 → 16 ms | 168 → 170 | 84 → 9 | 15 → 16 | 269 → 197 |
| Contato — desktop | 100 → 100 | 0,27 s → 0,33 s | 0 → 0 ms | 0 → 0 | 85 → 16 ms | 170 → 171 | 84 → 6 | 31 → 33 | 289 → 214 |

### SEO (Lighthouse)

| Configuração | Home | Catálogo | Detalhe | Coleção | Contato |
|---|---|---|---|---|---|
| Antes (indexação bloqueada) | 66 | 66 | 66 | 66 | 66 |
| Depois, indexação bloqueada (padrão local) | 66 | 66 | 66 | 66 | 66 |
| Depois, configuração de lançamento simulada¹ | **100** | **100** | **100** | **100** | **100** |

¹ Build local com `NEXT_PUBLIC_SITE_URL=https://www.vitoria-maison.test` e `SITE_INDEXING_ENABLED=true` (domínio fictício). Em ambientes bloqueados, a única auditoria reprovada é `is-crawlable`, por decisão de projeto.

## O que mudou e por quê

1. **Logo** (maior ganho). Declarado com 2172×724 e sem `sizes`, era servido em 3840 px (84 KB) com prioridade alta em todas as páginas. A decodificação desse PNG ocupava a thread principal por cerca de 2 s no mobile simulado (TBT de 1.868 ms) e competia com a imagem LCP. Agora: 300×100, variantes de 384/640 px, sem preload.
2. **Cards**: `sizes` por grade (25vw na home, 33vw no catálogo e nas coleções) e `preload` só no primeiro card das listagens. Os cards da home deixaram de disputar com o hero.
3. **Formatos**: AVIF e WebP habilitados; `minimumCacheTTL` de 30 dias, alinhado ao `Cache-Control` da CDN do Vista.
4. **Header/footer**: o footer deixou de ser hidratado; o header virou Server Component, e só o menu móvel (Radix Dialog) é cliente. O JavaScript total ficou estável (±3 KB): o bundle inicial é dominado pelo React/Next, e os componentes cliente novos (fallback de imagem e eventos opcionais) compensaram a economia.
5. **Consultas**: metadata e página compartilham a mesma consulta (React `cache`); o sitemap usa uma consulta enxuta (slug e data).

## Imagens do Vista (inspeção)

Amostra de `cdn.vistahost.com.br`: JPEG de 969×1024 px, 121 KB, `Cache-Control: max-age=2592000`, ETag e Last-Modified. Os nomes de arquivo contêm hash. Compatível com `next/image`: o otimizador gera variantes AVIF/WebP sem ampliar além da resolução original. Não foi feito download em massa; nenhum proxy aberto foi criado (`remotePatterns` restrito aos hosts configurados).

## Limitações e próximos passos de medição

- Medir em produção com WebPageTest ou PageSpeed Insights depois do deploy (CDN e região do banco mudam TTFB e LCP).
- Coletar Web Vitals reais (o reporter já existe no componente de analytics, ativado só com consentimento) e acompanhar o relatório de Core Web Vitals do Search Console (exige volume mínimo de tráfego).
- Elemento LCP após as mudanças (mobile): **home** = foto do hero (o tempo de carga domina, cerca de 2,1 s em 4G simulado); **detalhe** = primeira foto da galeria; **catálogo, coleção e contato** = o H1 do cabeçalho em fonte do sistema, com cerca de 1,7 s de *render delay* no perfil simulado. Reduzir mais o LCP da home exigiria baixar a qualidade da foto, o que foi evitado para preservar a fidelidade fotográfica.
