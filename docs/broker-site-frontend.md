# Site público do corretor (Fase 6.4B)

Frontend dos sites individuais em `nome.<domínio-base>`, servidos pela mesma aplicação e com os mesmos imóveis da curadoria Maison. Infraestrutura (hostname, status, permissões) em `docs/broker-sites-foundation.md`.

## Rotas (relativas ao subdomínio)

| URL pública | Rota interna | Conteúdo | Indexação |
|---|---|---|---|
| `/` | `app/broker-site/[subdomain]/page.tsx` | Home com 6 seções | indexável se permitido (ver SEO) |
| `/imoveis` | `…/imoveis/page.tsx` | Catálogo exclusivo (filtros, ordenação, paginação) | `noindex, follow` |
| `/imoveis/[slug]` | `…/imoveis/[slug]/page.tsx` | Detalhe com contato do corretor | canonical → URL do imóvel na Maison |
| `/privacidade` | `…/privacidade/page.tsx` | Mesma política da Maison (componente reutilizado) | `noindex`, canonical na Maison |
| `/robots.txt` | `…/robots.txt/route.ts` | Política por site | — |

O `layout.tsx` resolve o site pelo **Host validado** (`resolveRequestSite`). Site não publicado, suspenso ou inexistente responde 404 no layout e em todas as páginas.

## Home (seis seções)

1. **Hero** (`BrokerHero`): eyebrow (primeira especialidade ou título profissional), headline e subtítulo do `broker_sites`, nome do corretor, CTAs "Explorar imóveis" e "Fale comigo". À direita, a foto profissional; sem foto, um retrato neutro com as iniciais, **nunca uma foto ilustrativa de outra pessoa**. No mobile, o retrato tem proporção mais baixa para a headline ficar na primeira dobra.
2. **Minha seleção** (`BrokerPropertySection`): até 6 imóveis, destaques do corretor primeiro e depois `sort_order`. Sem imóveis, um estado editorial, sem anúncios inventados.
3. **Encontrar imóvel** (`BrokerFindSection` + `BrokerSearch`): formulário GET para `/imoveis`. Só aparecem filtros (finalidade, bairro, categoria) com mais de um valor existente entre os imóveis visíveis do site (`listFacets`).
4. **Especialidades e regiões** (`BrokerSpecialties`): só os dados preenchidos; a seção some quando ambos estão vazios.
5. **Sobre** (`BrokerAbout`, âncora `#sobre`): foto, título, biografia e listas. O CRECI só aparece quando **verificado por um ADMIN**. Sem biografia, uma frase neutra, sem histórico inventado.
6. **Contato** (`BrokerContact`, âncora `#contato`, fundo vinho): WhatsApp e e-mail público só quando configurados, e o formulário de contato existente.

Header (`BrokerHeader`): marca Vitória Maison + nome do corretor; Início, Imóveis, Sobre e Contato; menu móvel acessível (Radix Dialog, reaproveitado do institucional); nenhum link administrativo. Rodapé (`BrokerFooter`): marca, link para o site institucional, Grupo Vitória Flats com o CRECI da imobiliária e política de privacidade.

## Catálogo e detalhe: regras

- O escopo é sempre o `siteId` resolvido pelo hostname, aplicado **no SQL** junto com o predicado público do catálogo Maison (publicado, elegível, disponibilidade confirmada, snapshot recente).
- Filtros e ordenação do usuário (`parseCatalogParams`) **apenas restringem** a seleção do site; nunca ampliam para outros imóveis. Valores desconhecidos são descartados.
- Ordem padrão `site`: destaque do corretor, depois `sort_order`. Também há menor preço, maior preço e maior área.
- Detalhe: `findBySlug(siteId, slug)`. Imóvel de outro corretor, fora da seleção ou que perdeu elegibilidade na Maison responde **404**. Os relacionados vêm do mesmo site (mesmo bairro; senão, outros da seleção).
- Dados comerciais vêm do snapshot publicado; nada é duplicado por site.

## Foto profissional (upload)

- Em **Meu site → Perfil profissional**, o corretor escolhe uma imagem e vê a prévia antes de enviar. Também pode remover a foto. Um ADMIN pode trocar a foto de qualquer corretor pelo serviço (`setPhoto(actor, arquivo, userId)`).
- **Validação no servidor** (`src/features/media/image-processing.ts`, com `sharp`):
  - o formato é detectado pelo conteúdo, nunca pela extensão: JPEG, PNG ou WebP;
  - limite de 5 MB e pelo menos 400 × 400 px;
  - recusa GIF, SVG, imagens animadas e arquivos que não são imagem;
  - limite de pixels decodificados contra "bombas" de descompressão.
- **Tratamento:** corrige a orientação, recorta em 4:5 com foco no assunto, reduz para 960 × 1200 e regrava em WebP. **EXIF e GPS são removidos.**
- **Armazenamento:** tabela `media_assets` no PostgreSQL (migration `0012`), cerca de 100 KB por foto. Um novo envio apaga o arquivo anterior, e remover a foto apaga o arquivo. `broker_profiles.profile_image_asset_id` tem precedência sobre a antiga `profile_image_url`.
- **Entrega:** `GET /media/<id>` (domínio institucional e subdomínios). Cada envio gera um ID novo, então o cache é longo e imutável, com `ETag`, `nosniff` e `Content-Security-Policy: sandbox`. Somente mídias do tipo foto profissional são servidas.
- **Privacidade:** a foto é servida a quem conhece o ID (UUID aleatório) mesmo antes de o site ser publicado. Ela aparece no painel e nas prévias.
- As Server Actions aceitam até 6 MB (`experimental.serverActions.bodySizeLimit`) para comportar o envio. O limite da foto continua 5 MB.
- **Migração futura** para armazenamento de objetos (R2/S3/Blob): basta trocar `media_assets` e a rota `/media`, sem mudar as telas.

## Contato e leads

> Atualizado na Fase 6.4D: ver `docs/broker-leads.md`. O formulário usa `InterestForm variant="broker"` (WhatsApp obrigatório, e-mail e mensagem opcionais, CTA "Enviar interesse", confirmação "Recebemos seu interesse. Nossa equipe entrará em contato."), o lead é vinculado ao corretor no servidor e, com `BROKER_LEADS_ENABLED=false`, o formulário dá lugar a um aviso.

- O formulário é o `InterestForm` existente, com o aviso: *"Mensagens enviadas por este formulário são recebidas pela equipe Vitória Maison, que direciona o atendimento."* O formulário não sugere encaminhamento direto ao corretor.
- A origem do lead é marcada **no servidor** pelo hostname: `leadSourceForRequest` transforma `/imoveis/x` em `/corretor/<sub>/imoveis/x`. No domínio institucional, uma origem `/corretor/…` enviada pelo navegador é descartada. O navegador não define o dono do lead.
- Atribuição interna ao corretor ativa desde a 6.4D. A atribuição **no Vista** segue não verificada até o contrato ser confirmado (`docs/vista-broker-leads.md`).
- WhatsApp (`brokerWhatsappLink`): número profissional real; mensagem "Olá! Tenho interesse no imóvel [código] divulgado em seu site: [URL]."; nenhum dado do visitante na URL; o clique não é registrado como lead.

## SEO

| Página | Regra |
|---|---|
| Home publicada | indexável **somente** com indexação global da Maison liberada (`getSeoConfig`) **e** `BROKER_SITES_INDEXING_ENABLED=true`. Caso contrário, `noindex, nofollow` |
| Catálogo | `noindex, follow`; canonical em `/imoveis` do próprio site |
| Detalhe | canonical na URL principal do imóvel na Maison (`NEXT_PUBLIC_SITE_URL/imoveis/<slug>`) |
| Rascunho, revisão, suspenso | 404 |
| Prévias (painel) | `noindex`, autenticadas |
| `robots.txt` | `Allow: /` só se o site for indexável; senão `Disallow: /`. Sem sitemap de corretores |

Metadata por site: título "Nome — Título profissional | Vitória Maison", descrição com dados reais (subtítulo, headline ou biografia), Open Graph com a foto do corretor ou a imagem da marca e JSON-LD `RealEstateAgent` (apenas dados públicos, CRECI verificado e vínculo com a Vitória Maison). Nada de um site aparece em outro, porque metadata e conteúdo são calculados por requisição a partir do Host.

## Cache e isolamento

- Todas as páginas são dinâmicas, sem cache entre requisições. React `cache` só deduplica dentro da mesma requisição (layout, metadata e página).
- O subdomínio está no caminho reescrito (`/broker-site/<sub>/…`), e o cache do navegador é separado por origem.
- Suspender ou despublicar vale na requisição seguinte. Mutações chamam `revalidateBrokerSites()`.
- Arquivos públicos (`/images/*`, como o logo) passam pelo proxy sem rewrite.

## Prévia autenticada

`/admin/meu-site/previa` (dono) e `/admin/sites-corretores/[id]/previa` (ADMIN) renderizam o **site real** (home, `/imoveis` e `/imoveis/[slug]`) em qualquer status, com navegação presa à área autenticada (`previewLinks(base)`) e formulários desativados. Detalhes em `docs/broker-site-editor.md`.

## Componentes

Novos (`src/components/broker-site/`): `broker-header`, `broker-hero`, `broker-portrait`, `broker-property-section`, `broker-search`, `broker-specialties`, `broker-about`, `broker-contact`, `broker-property-contact`, `broker-catalog`, `broker-home`, `broker-footer`, `broker-site-preview` e `links`.

Reutilizados: `PropertyCard` (ganhou `href` opcional), `PropertyDetail` (extraído da página institucional e usado pelos dois sites), `Gallery`, `SafeImage`, `MobileMenu`, `Logo`, `InterestForm`, `JsonLd`, a página de privacidade, `parseCatalogParams`, `propertySeoTitle/Description`, `robotsFor` e o predicado de elegibilidade.

## Design

Mesma identidade do institucional: marfim, vinho, neutros, títulos nas classes editoriais (`serif`, `eyebrow`, `section-title`), fotos grandes, sem sombras nem gradientes. O projeto usa fontes do sistema (Georgia/Arial), conforme `docs/design-system.md`. Instrument Serif e Manrope não estão instaladas, e os sites de corretores seguem o mesmo padrão do institucional.

Verificado com capturas em 1440 px e com emulação de dispositivo em 768 px e 390 px (Lighthouse): sem estouro horizontal, menu móvel visível, hero empilhado no mobile.

## Como testar localmente

```dotenv
BROKER_SITES_ENABLED=true
BROKER_SITES_BASE_DOMAIN=maison.lvh.me
```

1. `npm run db:migrate` e reinicie o `npm run dev`. Se o servidor já estava rodando antes da reorganização das rotas, apague `.next/dev` antes.
2. Crie um corretor, preencha **Meu site**, envie para revisão e aprove como ADMIN (passo a passo em `docs/broker-sites-foundation.md`).
3. Para ter imóveis no site, adicione imóveis elegíveis em **Meu site → Imóveis**.
4. Abra `http://<sub>.maison.lvh.me:3000`, `/imoveis` e um imóvel da seleção.

## Limitações

- O envio pelo subdomínio (Server Action atrás do rewrite) foi testado ponta a ponta no build de produção na 6.4D (envio progressivo, sem JavaScript).
- Sem sitemap de corretores. A indexação depende de decisão explícita (`BROKER_SITES_INDEXING_ENABLED`).
- O envio da foto pelo navegador não foi testado ponta a ponta. Processamento, gravação, substituição, permissões e entrega têm testes automatizados e foram verificados no build de produção.

## Fase 6.4C (concluída)

Editor do corretor, seleção de imóveis, destaques, ordem, imagem de apresentação, textos de introdução e atendimento, prévia completa (home, catálogo e imóveis) e revisão administrativa: ver `docs/broker-site-editor.md` e `docs/broker-site-publication.md`. A imagem de apresentação ocupa o topo da home quando existe; a foto profissional vai para a seção "Sobre".

## Itens originalmente previstos para a 6.4C

- Tela no painel para o corretor buscar imóveis elegíveis da curadoria, adicionar e remover, marcar destaques e ordenar (os serviços `addProperty` e `removeProperty` já existem).
- Edição do conteúdo de sites publicados com novo ciclo de revisão.
- Política de sitemap por site, quando a indexação for liberada.
