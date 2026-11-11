# Mapeamento Vista → Maison

| Vista | Snapshot | Regra |
|---|---|---|
| Codigo | external_code | string, chave externa |
| Categoria | raw_category / category | valor bruto preservado; tipo interno somente para aliases conhecidos |
| Cidade | city | obrigatório |
| Bairro | neighborhood | obrigatório |
| ValorVenda | sale_price | decimal opcional |
| ValorLocacao | rental_price | decimal opcional |
| Dormitorios | bedrooms | inteiro opcional |
| Suites | suites | inteiro opcional |
| Vagas | parking_spaces | inteiro opcional |
| AreaPrivativa | private_area | decimal opcional; não confundir com área total |
| AreaTotal | total_area | decimal opcional |
| Caracteristicas | characteristics | JSONB, sem suposição sobre estrutura interna |
| InfraEstrutura | infrastructure | JSONB, sem suposição sobre estrutura interna |
| FotoDestaque | cover_image_url / images[0] | somente HTTPS e host permitido |
| TituloSite | source_title | título de origem opcional; editorial_title tem precedência |
| DescricaoWeb | source_description | descrição de origem opcional; editorial_description tem precedência |
| Finalidade | source_purpose | valor bruto; `Residencial` não significa venda ou locação |
| DataAtualizacao | source_updated_at | data da última atualização informada pelo Vista |

Categorias internas reconhecidas: apartamento, flat/apart-hotel, studio/estúdio e cobertura. Categorias desconhecidas permanecem no snapshot, mas bloqueiam publicação no modelo atual.

`TituloSite` e `DescricaoWeb` estão disponíveis. No imóvel 31, `Finalidade` retornou `Residencial`, `DataAtualizacao` retornou uma data ISO e `Categoria` retornou `Apartamento`. Não suportados/confirmados: galeria completa, disponibilidade, status comercial, condomínio, IPTU e banheiros. Preços não são usados para inferir finalidade ou disponibilidade.
