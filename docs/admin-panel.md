# Painel administrativo — Fase 3.2A

## Acesso

1. Aplique migrations com `npm run db:migrate`.
2. Configure `AUTH_SECRET` e `AUTH_TRUST_HOST`.
3. Crie o primeiro usuário com `npm run admin:create`.
4. Execute `npm run dev` e acesse `/admin/login`.

## Rotas

- `/admin`: dashboard com totais reais, elegibilidade pública e sincronizações.
- `/admin/imoveis`: busca, filtros, ordenação e paginação server-side.
- `/admin/imoveis/novo`: prévia somente leitura e importação por código Vista.
- `/admin/imoveis/[id]`: dados comerciais, curadoria, operação e impedimentos de publicação.
- `/admin/vista`: explorador visual da base do Vista e importação em lote.
- `/admin/usuarios`: gestão de usuários, perfis e convites (somente `users:read`).
- `/admin/minha-conta`: área pessoal de qualquer usuário.

Cada rota exige uma permissão específica (matriz em `docs/rbac-architecture.md`); o menu lateral mostra apenas o que o perfil pode acessar.

O painel não reutiliza header/footer público e não mistura mocks. Desde a Fase 6, o acesso é por perfil (ADMIN, MANAGER, BROKER), e não mais "qualquer administrador ativo". Todas as consultas administrativas usam PostgreSQL.

## Importação

O código é validado no servidor. A prévia consulta o Vista sem persistir. A confirmação reutiliza `PropertySyncService.addAndSync`, cria curadoria e snapshot e mantém `published=false`. Duplicidades apontam para o registro existente. A operação nunca escreve no Vista.

Timeouts, falhas de rede/autenticação, códigos inválidos e limites de requisição recebem mensagens públicas sanitizadas. Logs técnicos continuam sem credenciais ou payload bruto.

## Indicadores

O dashboard separa:

- imóveis selecionados;
- flag editorial aprovada (`published`);
- rascunhos;
- imóveis realmente elegíveis e visíveis;
- disponibilidade desconhecida/expirada;
- último erro de sincronização por imóvel;
- execuções recentes de sincronização.

## Gestão operacional

Na página de detalhes do imóvel é possível:

- editar título, descrição, finalidade e capa editorial;
- confirmar disponibilidade manual com o administrador autenticado;
- publicar e despublicar após revalidação server-side;
- marcar como destaque e definir ordem;
- sincronizar individualmente com o Vista;
- abrir uma prévia autenticada, não indexável e independente da publicação.

Preço, metragem, localização e demais dados comerciais continuam somente leitura.

Em `/admin/destaques`, a ordem da home pode ser ajustada. Imóveis que perderem elegibilidade permanecem marcados internamente, mas desaparecem automaticamente da home.

Em `/admin/colecoes`, é possível criar, editar, ativar/desativar e ordenar coleções, além de associar imóveis sem removê-los da curadoria. A página pública utiliza somente coleções ativas e imóveis elegíveis.

Todas as mutações usam Server Actions autenticadas, Zod, controle de versão, auditoria e revalidação das superfícies públicas.

Sincronização em lote continua fora do painel até existir infraestrutura de jobs com acompanhamento confiável.

## Explorador do Vista

`/admin/vista` consulta diretamente `/imoveis/listar`, sem copiar toda a base para o PostgreSQL. Os filtros de código, cidade, bairro, categoria, faixa de valor e dormitórios são enviados ao Vista; paginação aceita 10, 20 ou 50 itens. Finalidade e disponibilidade não são oferecidas como filtros porque os campos atuais não são inequívocos.

Cards são a visualização padrão e usam somente `FotoDestaque`. URLs precisam ser HTTPS e pertencer a `VISTA_IMAGE_HOSTNAME`; ausências ou falhas exibem “Sem fotografia”. A visualização em lista usa os mesmos filtros e a seleção permanece ao trocar de página dentro da navegação do explorador.

“Visualizar” consulta `/imoveis/detalhes` somente para o imóvel escolhido. A prévia mostra a foto confirmada, dados comerciais, características, infraestrutura e situação de importação. O componente está preparado para galeria, mas não cria imagens quando `fotos` não está liberado.

É possível selecionar no máximo 20 códigos. A importação é síncrona, limitada a duas consultas concorrentes, idempotente e retorna sucesso, já existente ou falha por código. Imóveis criados entram sempre como rascunho (`published=false`). O filtro “somente não importados” considera apenas os registros da página corrente, pois a informação de curadoria pertence ao PostgreSQL e não ao Vista.
