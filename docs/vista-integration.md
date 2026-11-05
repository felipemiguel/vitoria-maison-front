# Integração futura com Vista CRM

## Limite desta etapa

Nenhuma chamada real ao Vista foi implementada. Endpoints, nomes de campos e capacidades precisam ser validados na documentação e na conta contratada antes do desenvolvimento do adaptador.

## Modelo de domínio

`Property` separa `commercial`, `location`, `editorial` e `curation`. O adaptador Vista deverá mapear identificador externo, finalidade, tipo, preço, área, dormitórios, suítes, banheiros, vagas, localização pública permitida e disponibilidade. Textos editoriais, ordem de destaque e coleções permanecem sob gestão Maison.

## Pontos a validar

- Endpoints oficiais de listagem, detalhe e atualização incremental.
- Convenções e códigos de tipo/finalidade.
- Método de autenticação, expiração, rotação e limites de requisição.
- Campos de publicação e disponibilidade.
- Formato, estabilidade, dimensões e licenças das URLs de imagem.
- Possibilidade de obter data de alteração para sincronização incremental.

## Estratégia proposta

Criar `VistaPropertyRepository` implementando a interface existente. Credenciais ficam exclusivamente no servidor. Respostas normalizadas podem usar cache do Next com revalidação e invalidação sob demanda, conforme capacidades confirmadas. Falhas de uma imagem não devem invalidar o imóvel; imagens devem ser normalizadas e servidas com `next/image`.

Disponibilidade exige política explícita: leitura periódica ou webhook apenas se oficialmente suportado. O identificador externo será a chave de sincronização; slug editorial e dados de curadoria não serão sobrescritos automaticamente.
