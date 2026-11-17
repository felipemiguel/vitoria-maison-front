# Sincronização Vista

Somente códigos existentes em `curated_properties` são sincronizados por `vista:sync:all`. Não há varredura integral do Vista nem job automático.

## Fluxo

1. Consultar `/imoveis/detalhes` com os campos confirmados, incluindo `Finalidade` e `DataAtualizacao`.
2. Validar a resposta com Zod.
3. Converter strings numéricas sem transformar vazio em zero.
4. Validar `FotoDestaque` como HTTPS e, se configurado, exigir `VISTA_IMAGE_HOSTNAME`.
5. Atualizar o snapshot em transação.
6. Persistir disponibilidade `UNKNOWN` enquanto não existir campo confiável do Vista.
7. Confirmar operacionalmente a disponibilidade com origem `VISTA_SYNC` quando o snapshot continuar `UNKNOWN`.
8. Preservar integralmente curadoria e publicação.
9. Registrar o resultado em `sync_runs`.

A sincronização solicita automaticamente a relação aninhada `Foto` (`Foto`, `FotoPequena`, `Destaque`) em uma segunda consulta. A resposta é um objeto indexado por código de foto, convertido para a lista `images` do snapshot. Somente URLs HTTPS válidas são persistidas, sem download local e sem imagens fictícias. Se a consulta falhar, o snapshot comercial continua válido com a capa; uma nova operação tenta novamente.

### Contrato confirmado de fotografias

O exemplo genérico da documentação usava a origem `fotos`, recusada nesta instância. O suporte confirmou a origem correta `Foto`, no singular e com inicial maiúscula. O teste real com a chave atual e o imóvel `17835787` retornou HTTP 200 e 52 fotografias.

Consulta confirmada: `GET /imoveis/detalhes`, parâmetros `key`, `imovel`, `pesquisa={"fields":["Codigo","FotoDestaque",{"Foto":["Foto","FotoPequena","Destaque"]}]}`. A sincronização preenche a galeria de imóveis novos e já importados; não é necessário reimportar. Não há variável de ambiente para habilitar a galeria.

Falhas de rede são temporárias e preservam o snapshot. Resposta inválida e imóvel ausente são registrados sem exclusão automática. A sincronização não publica nem republica; uma sincronização bem-sucedida renova a confirmação operacional de disponibilidade. Um snapshot mais antigo que o limite configurado deixa de ser elegível mesmo quando preservado.

## Comandos

```bash
npm run maison:property:add -- --code=31
npm run maison:property:list
npm run maison:property:sync -- --code=31
npm run vista:sync -- --code=31
npm run vista:sync:all
npm run vista:sync:status
npm run maison:property:validate -- --code=31
npm run maison:property:confirm-availability -- --code=31 --operator=nome.sobrenome
npm run maison:property:publish -- --code=31
npm run maison:property:status -- --code=31
npm run maison:property:unpublish -- --code=31
```

Adicionar é idempotente, consulta o Vista antes da seleção e sempre cria `published=false`.

## Agendamento futuro

Executar `npm run vista:sync:all` em um worker/serviço protegido com lock distribuído ou garantia de execução única. Cron de produção não foi criado nesta fase. A rotina deve receber `DATABASE_URL` e variáveis Vista por secrets manager, nunca por argumentos.
## Identificadores do imóvel

O valor usado no parâmetro `imovel` de `/imoveis/detalhes` pode ser o identificador interno apresentado pela listagem, enquanto o campo `Codigo` da resposta de detalhes representa o código comercial da imobiliária. Eles não devem ser comparados como se fossem o mesmo identificador.

- `curated_properties.vista_code` mantém o identificador de consulta, necessário para sincronizações futuras.
- `property_snapshots.external_code` mantém o `Codigo` comercial retornado nos detalhes e exibido publicamente.

