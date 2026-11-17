# Landing pages de imóvel

Páginas de venda de **um imóvel** para tráfego pago e divulgação, em `/lp/<slug>` no domínio principal. O contato é feito **só pelo WhatsApp**: não há formulário e nenhum lead é registrado no banco.

## Regras

- **Quem cria:** ADMIN e MANAGER (`landing-pages:manage`). BROKER não acessa. A permissão é conferida na página, na Server Action e no serviço.
- **Imóvel:** informado pelo código Vista na criação. Precisa estar visível no catálogo público (mesmo predicado do site). Não pode ser trocado depois; para outro imóvel, crie outra página.
- **Dados comerciais:** preço, finalidade, área, dormitórios, suítes, vagas, código e fotos vêm sempre do snapshot do Vista, no momento da exibição. Os blocos guardam só textos.
- **Fora do Google:** toda landing page é `noindex, nofollow` e fica fora do sitemap. A página indexável do imóvel continua sendo `/imoveis/<slug>`.
- **Hosts de corretores:** `/lp/...` responde 404 nos subdomínios.

## Status

| Status | Público | Observação |
|---|---|---|
| `DRAFT` | 404 | Estado inicial e após despublicar |
| `PUBLISHED` | 200 | Exige: imóvel visível, bloco de topo ativo com título e WhatsApp válido |
| `ARCHIVED` | 404 | Não editável; pode ser restaurada como rascunho |

- **Endereço travado:** o slug fica fixo depois da primeira publicação, para não quebrar links que já estejam em anúncios.
- **Imóvel indisponível:** se o imóvel sai do catálogo (vendido, despublicado, snapshot antigo), a página publicada continua respondendo 200. Ela mostra *"Este imóvel não está mais disponível"*, um botão de WhatsApp genérico e três imóveis da curadoria. O painel avisa que há páginas nessa situação, para pausar as campanhas.

## Blocos

O conteúdo é uma lista ordenada de blocos (`content` jsonb, `schemaVersion: 1`), validada por Zod no servidor:

| Bloco | O que é editável | O que vem do Vista |
|---|---|---|
| Topo (obrigatório para publicar, sempre o primeiro) | chamada, título, subtítulo, texto do botão | imagem (se não houver imagem enviada), preço e finalidade |
| Ficha do imóvel | título | valor, área, dormitórios, suítes, vagas, código |
| Texto | título e texto | — |
| Galeria | título e quantidade de fotos (1–24) | fotos |
| Diferenciais | título e até 12 itens | — |
| Localização | título e texto sobre a região | bairro e cidade |
| Condições | título e texto | — (a página adiciona o aviso de valores sujeitos a alteração) |
| Perguntas frequentes | título e até 12 perguntas | — |
| Chamada para o WhatsApp | título, texto e texto do botão | — |

Na criação, a página já vem preenchida com os dados do imóvel; FAQ e Condições começam ocultos.

- **Formatação:** os textos são texto puro, sem HTML. Uma linha em branco separa parágrafos e "- " no início da linha cria uma lista.
- **Conteúdo inválido no banco** (por exemplo, de uma versão futura do schema) vira página vazia, nunca erro 500.

## WhatsApp

- **Número:** o da própria página ou, se vazio, `NEXT_PUBLIC_WHATSAPP_NUMBER`. Sem nenhum dos dois, a página não pode ser publicada.
- **Mensagem:** editável por página, com `{codigo}` e `{titulo}`. Padrão: *"Olá! Vi a página do imóvel {codigo} e gostaria de mais informações."*
- **Privacidade:** o link é sempre `wa.me` e nenhum dado do visitante vai na URL.
- **Analytics:** com GA4 habilitado, o clique dispara `whatsapp_click` (código do imóvel e `/lp/<slug>`) e a visita dispara `view_item`. Nada é gravado no banco.

## Painel (`/admin/landing-pages`)

- **Lista:** status e imóvel de cada página, com aviso de imóvel indisponível. A criação também fica aqui (nome interno, código Vista e endereço opcional).
- **Edição:**
  - publicar, despublicar, arquivar, restaurar e duplicar (a cópia nasce em rascunho, com endereço `-copia`);
  - link para anúncios com UTMs (origem, mídia, campanha, conteúdo), lidas pelo GA4 quando habilitado;
  - configurações: nome, endereço, WhatsApp, mensagem e textos de compartilhamento (título e descrição da prévia do link);
  - imagem de topo opcional, recortada em 16:9 (1920 × 1080), convertida para WebP e sem metadados;
  - editor de blocos: ordenar, ocultar, remover e adicionar, salvando tudo de uma vez.
- **Prévia** (`/admin/landing-pages/<id>/previa`): o mesmo template da página pública, em qualquer status.
- **Concorrência:** toda alteração confere a `version`. Duas abas abertas não sobrescrevem o trabalho uma da outra.
- **Auditoria:** `admin_audit_events` (`entity_type = LANDING_PAGE`) registra criação, configurações, conteúdo, imagem, status e duplicação.

## Migration

`0016_landing_pages`:
- cria a tabela `landing_pages`;
- adiciona o tipo `LANDING_PAGE_HERO` em `media_assets`.

A migration só faz acréscimos e é compatível com o código anterior.

## Fora do escopo (próximas fases)

- formulário e leads com UTM gravadas;
- contagem de visitas e taxa de conversão;
- Meta Pixel e Google Ads (exigem banner de consentimento, pela LGPD);
- landing pages de corretores;
- várias unidades por página;
- teste A/B.
