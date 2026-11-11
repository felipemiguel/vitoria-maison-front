# Plano de migração SEO — Vitória Flats → Vitória Maison

Levantamento feito em 10/11/2026 a partir dos arquivos públicos do site atual (`robots.txt` e sitemaps). Sem acesso ao Search Console, ao Analytics ou a ferramentas de backlinks do domínio legado.

## 1. Inventário do legado

- Domínio canônico: `https://vitoriaflats.com.br` (o `www` redireciona para o domínio sem `www`).
- `robots.txt`: `Allow: /`, `Disallow: /busca/`, sitemap em `/sitemap.xml` (índice com `general.xml` e `imoveis-1..9.xml`).
- **8 páginas gerais** e **436 páginas de imóveis**.

### Páginas gerais

| URL legada | Equivalente no novo site | Ação |
|---|---|---|
| `/` | `/` | mesma rota |
| `/sobre` | `/sobre` | mesma rota |
| `/contato` | `/contato` | mesma rota |
| `/anuncie` | `/anuncie-seu-imovel` | **301** (configurado) |
| `/politica-privacidade` | `/privacidade` | **301** (configurado) |
| `/busca` (com filtros na query string) | `/imoveis` | **301** (configurado); a query string é preservada, e filtros não reconhecidos são descartados e marcados `noindex` |
| `/favoritos` | — | sem equivalente: 404 |
| `/comparar` | — | sem equivalente: 404 |

### Páginas de imóveis

Padrão: `/imovel/{categoria}-{bairro}-{cidade}-{uf}[-{n}-quartos][-{área}m2]-{código}`.

| Categoria | URLs |
|---|---|
| apartamento | 192 |
| flat | 157 |
| studio | 53 |
| cobertura | 9 |
| outras (casa, loft, sala, conjunto…) | 25 |

**O número final é o código Vista.** Confirmado: os dois imóveis publicados no novo site (16784235 e 16786218) aparecem no sitemap legado com o mesmo código. Formato dos códigos: 382 com 8 dígitos e 54 com 2 a 4 dígitos.

## 2. Estratégia de redirecionamento

| Caso | Comportamento | Onde |
|---|---|---|
| Imóvel legado selecionado **e elegível** no novo site | 308 permanente para `/imoveis/vista-{codigo}` | `src/app/imovel/[slug]/page.tsx` (busca por código Vista com o mesmo predicado de elegibilidade) |
| Imóvel legado não selecionado, rascunho ou indisponível | 404 | idem |
| Páginas gerais com equivalente | 301 | `src/features/seo/legacy-redirects.ts` → `next.config.ts` |
| Páginas sem equivalente | 404 | — |

Princípios aplicados: nenhum redirecionamento genérico para a home, nenhuma cadeia (validada em teste), nenhum loop e destinos sempre existentes. A resolução é dinâmica: quando a equipe seleciona e publica um imóvel que existia no legado, a URL antiga passa a redirecionar automaticamente, sem tabela manual.

**Consequência a decidir:** hoje o novo site tem 2 imóveis elegíveis contra 436 no legado. Migrar o domínio agora faria cerca de 434 URLs de imóveis responderem 404. Isso é tecnicamente correto (não há equivalente), mas encerra o tráfego orgânico dessas páginas.

## 3. Opções de domínio (decisão pendente)

| Opção | Descrição | Prós | Contras |
|---|---|---|---|
| A. Novo domínio, legado mantido | Vitória Maison em domínio próprio; Vitória Flats continua no ar | Zero risco ao tráfego atual; migração gradual | Duas marcas competindo; sem transferência de autoridade |
| B. Novo domínio + 301 do legado | Domínio novo; `vitoriaflats.com.br` redireciona via mapa | Consolida autoridade na nova marca | Exige configurar o redirecionamento no servidor legado; imóveis sem equivalente perdem tráfego |
| C. Manter `vitoriaflats.com.br` | Novo site servido no domínio atual | Os redirecionamentos já implementados funcionam diretamente | Marca e domínio desalinhados |

O código atende A, B e C: os redirecionamentos só têm efeito quando o legado aponta para a nova aplicação. **DNS e produção não foram alterados nesta fase.**

## 4. Passos recomendados

1. **Antes**: exportar do Search Console do legado as páginas com cliques e impressões (16 meses) e as páginas com links externos; cruzar com a lista de 436 imóveis.
2. Priorizar na curadoria Maison os imóveis legados com tráfego que ainda estejam disponíveis: cada um publicado ganha redirecionamento automático.
3. Para imóveis com tráfego relevante que não serão curados, decidir caso a caso (manter no legado, 404 ou equivalente real). Nunca enviar para a home.
4. Definir a opção de domínio (seção 3).
5. Em homologação, com o legado apontando para o novo site: rastrear a lista completa de URLs legadas (Screaming Frog ou script) e validar códigos HTTP, destino final e ausência de cadeias.
6. Lançar com `SITE_INDEXING_ENABLED=true`, enviar o sitemap e, na opção B, usar a ferramenta "Mudança de endereço" do Search Console.
7. **Não desativar o legado** até validar os redirecionamentos e acompanhar o Search Console por 4 a 8 semanas.

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Perda de tráfego de imóveis sem equivalente | Exportar dados do GSC antes; curar os imóveis de maior tráfego |
| Backlinks para URLs sem equivalente | Levantar backlinks (GSC → Links) e tratar individualmente |
| Divergência entre conteúdo editorial e dados do Vista (ex.: `vista-16784235` está em Indianópolis no snapshot e "Moema" no texto editorial) | Revisão editorial antes do lançamento |
| Indexação acidental de staging | Indexação bloqueada por padrão e exige 5 condições simultâneas |
| Mudança de código Vista | O redirecionamento depende do código. Se um imóvel for recadastrado com outro código, a URL legada passa a responder 404 |
