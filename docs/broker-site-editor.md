# Editor do site do corretor (Fase 6.4C)

Autosserviço para corretores (perfil BROKER, inclusive MANAGER + BROKER) montarem o próprio site pelo painel, sem CLI. Infraestrutura em `docs/broker-sites-foundation.md`; template público em `docs/broker-site-frontend.md`; publicação e revisão em `docs/broker-site-publication.md`.

## Telas (`/admin/meu-site`, no padrão de rotas do painel)

| Aba | Rota | O que faz |
|---|---|---|
| Painel | `/admin/meu-site` | Nome, endereço, status, última atualização, imóveis selecionados/visíveis, destaques, completude (barra + checklist), prévia e **Solicitar publicação**. Mostra a justificativa quando a solicitação foi devolvida e o motivo quando suspenso. Sem perfil → leva ao Perfil; sem site → criação do site |
| Perfil | `/admin/meu-site/perfil` | Foto profissional (upload) e dados: nome, título, biografia, WhatsApp, telefone, e-mail público, CRECI, especialidades e regiões |
| Página inicial | `/admin/meu-site/pagina` | Título principal, subtítulo, texto de introdução, texto de atendimento, endereço (só em rascunho) e imagem de apresentação, com a renderização real do topo da página |
| Imóveis | `/admin/meu-site/imoveis` | Imóveis disponíveis da Maison (cards com foto) e a seleção do corretor (destaques e ordem) |
| Prévia | `/admin/meu-site/previa` (+ `/imoveis`, `/imoveis/[slug]`) | O site real (mesmo template público) em qualquer status |

Cada página e cada Server Action revalidam permissão e propriedade no servidor. O site e o perfil são sempre os do usuário da sessão; nenhum ID enviado pelo navegador decide o dono.

## Perfil profissional

- O corretor edita apenas o próprio perfil (`broker-profile:update-own`).
- **CRECI:** o número informado não é considerado válido. Alterar o CRECI apaga a verificação e registra `BROKER_CRECI_CHANGE_REQUESTED`. O número só aparece no site depois que um ADMIN marca como verificado.
- **Código Vista:** não aparece para o corretor e, se enviado, é ignorado pelo serviço. Somente ADMIN configura (`setVistaBrokerCode`), na revisão do site.
- **Foto:** pipeline seguro já existente (formato detectado pelo conteúdo, limites, recorte 4:5, WebP, sem EXIF/GPS, armazenada no PostgreSQL e servida por `/media/<id>`).

## Página inicial

- Campos de texto simples, com limites (título 160, subtítulo 300, introdução 400, atendimento 300). Os caracteres `<` e `>` são recusados (não há HTML nem JavaScript), caracteres de controle são removidos e espaços normalizados.
- Introdução e atendimento ficam em `broker_sites.settings` (`introText`, `serviceText`). Ausentes, o site usa os textos padrão.
- **Imagem de apresentação:** mesmo pipeline seguro (mínimo 600 × 600, recorte 4:5, 1200 × 1500, WebP), tipo de mídia `BROKER_SITE_HERO`. Quando existe, ocupa o topo da home e a foto profissional fica na seção "Sobre". A troca apaga a imagem anterior.
- Paleta, tipografia e estrutura editorial não são configuráveis. Ordem de seções não foi implementada, porque o template atual não comporta isso sem um editor de layout.

### Modelo de edição

- **Rascunho:** tudo editável (inclusive o endereço).
- **Em revisão:** página e imagem de apresentação congeladas para o administrador avaliar exatamente o que foi enviado. Perfil e seleção de imóveis continuam editáveis.
- **Publicado:** edição direta. Textos, imagem, perfil e seleção valem na hora, com auditoria. O endereço não muda. O ADMIN pode suspender a qualquer momento.
- **Suspenso:** nada é editável.

## Seleção de imóveis

- A lista "Imóveis disponíveis" consulta o PostgreSQL com o **mesmo predicado público** do catálogo Maison: publicados, elegíveis, disponibilidade confirmada e snapshot recente. O inventário do Vista não é consultado. Rascunhos, indisponíveis e bloqueados não aparecem.
- **Filtros** (validados no servidor): código, bairro, cidade, tipo, finalidade, valor mínimo e máximo, dormitórios e ordenação (curadoria, preço, área). Paginação de 12 no banco.
- **Adicionar:** individual ou múltiplo (caixas de seleção + "Adicionar selecionados", até 20 por vez).
  - O servidor confere a elegibilidade de cada imóvel.
  - Duplicados são ignorados.
  - Limite de **60 imóveis por site**.
  - Grava só o vínculo, sem copiar dados comerciais.
- **Remover:** com confirmação. O imóvel continua na Maison.
- Imóvel selecionado que perde elegibilidade aparece sinalizado ("Indisponível na Maison — não aparece no site") e some do site sozinho.

### Destaques e ordem

- Até **6 destaques** (validado no servidor, sob bloqueio do site). Destaques aparecem primeiro na home.
- **Ordem:** setas ↑/↓ dentro do grupo (destaques e demais), gravada em `broker_site_properties.sort_order` e renumerada de forma contígua.
- A ordem é independente por site e não altera a ordem da Maison.
- Não há arrastar-e-soltar: usei controles simples, acessíveis por teclado.

## Prévia autenticada

- Mesmo template público (`BrokerHome`, `BrokerCatalog`, `PropertyDetail`), sem implementação visual paralela.
- Navegação entre home, catálogo e imóveis dentro de `/admin/meu-site/previa`; o site vem da sessão, não da URL.
- Mostra o conteúdo atual em qualquer status. Os imóveis seguem a mesma regra de elegibilidade do site público.
- Formulários desativados: nenhum lead de teste é criado nem enviado ao Vista. Páginas `noindex`, dentro do painel autenticado.
- ADMIN: `/admin/sites-corretores/[id]/previa` (+ `/imoveis`, `/imoveis/[slug]`).

## Completude (`BrokerSiteReadinessService`)

Oito critérios obrigatórios. O percentual é `concluídos / 8`.

1. Nome profissional.
2. CRECI verificado pela equipe. Política configurável: `BROKER_SITES_REQUIRE_VERIFIED_CRECI=false` passa a exigir apenas o CRECI informado.
3. Foto profissional.
4. Biografia com pelo menos 40 caracteres.
5. WhatsApp, telefone ou e-mail público.
6. Endereço válido.
7. Título principal.
8. Pelo menos um imóvel selecionado **e** elegível na Maison.

Retorno: `{ ready, completed, total, missing, items }`. Usado no Painel, no envio para revisão e na aprovação.

## Segurança

- **Acesso:** sessão + permissão (RBAC existente) + propriedade do recurso em cada action e serviço. MANAGER sem BROKER não acessa "Meu site"; BROKER não acessa a revisão nem a prévia administrativa.
- **Corretor não aprova a própria publicação:** as transições administrativas exigem `broker-site:manage-all`.
- **Requisições:** CSRF pela verificação de origem das actions (`assertSameOriginAction`) + proteção nativa das Server Actions.
- **Dados e arquivos:** uploads validados pelo conteúdo, textos sem HTML, auditoria em `user_audit_events`.
- **Leads:** nenhum lead na prévia.

## Cache

Toda alteração chama `revalidateBrokerSites()`: perfil, foto, textos, imagem, inclusão/remoção, destaque, ordem, envio, aprovação, devolução, suspensão e reativação. As páginas do site são dinâmicas, e o subdomínio faz parte do caminho reescrito, então nada é compartilhado entre sites.

## Migration

`0013_broker_site_editor` (só acréscimos):
- novo tipo de mídia `BROKER_SITE_HERO`;
- `broker_sites.hero_image_asset_id`;
- `last_review_decision`, `last_review_notes`, `last_reviewed_at`, `last_reviewed_by`;
- `suspension_reason`.

## Validação manual

1. `npm run db:migrate` e reinicie o `npm run dev`.
2. Com um usuário BROKER:
   - **Perfil:** preencha os dados e envie a foto.
   - **Painel:** crie o site.
   - **Página inicial:** escreva o título e os textos.
   - **Imóveis:** adicione imóveis, destaque e ordene.
   - **Prévia:** navegue pela home, pelo catálogo e por um imóvel.
3. **Painel:** a completude mostra o que falta. Sem CRECI verificado, "Solicitar publicação" fica desabilitado.
4. Com um ADMIN, em **Sites de corretores → site**, verifique o CRECI, confira tudo e aprove (ou devolva com justificativa).
5. Abra `http://<subdominio>.maison.lvh.me:3000`.

## Limitações

- Sem ordem de seções nem editor visual (fora do escopo).
- Edição direta em sites publicados: não há versão "pendente" separada da versão no ar; mudanças publicadas são moderadas a posteriori (auditoria e suspensão).
- Leads do site: aba **Leads** e indicadores no Painel desde a Fase 6.4D (`docs/broker-leads.md`).
