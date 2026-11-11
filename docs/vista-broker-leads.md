# Vista CRM: leads dos sites de corretores

O que foi **confirmado** e o que **não foi** sobre a atribuição de leads a corretores no Vista. A regra deste projeto: nenhum campo é enviado e nenhuma atribuição é exibida como confirmada sem contrato oficial e teste autorizado.

Contrato base do envio (`POST /lead`, parâmetro form-urlencoded `cadastro`) em `docs/vista-leads.md`.

## Confirmado

| Item | Evidência |
|---|---|
| `POST {VISTA_API_BASE_URL}/lead?key=…` com `cadastro={"lead":{…}}` (form-urlencoded) | Teste autorizado (8/11/2026) e implementação em produção |
| Campos aceitos: `nome`, `fone`, `email`, `mensagem`, `veiculo`, `anuncio` | Documentação da Pluga + teste autorizado |
| Obrigatórios: `nome`, `mensagem`, `veiculo` e ao menos um entre `email`/`fone` | Resposta real da conta |
| Resposta de sucesso: `{"status":200,"message":"Ok.","Codigo":22574,"Corretor":3,"message_integration":{…}}` | Teste autorizado |
| `message_integration` (RD Station, Exact Sales, Webforce "não habilitado") **não** indica falha do lead | Mesmo teste: o lead foi criado (`Codigo` presente) |
| A chave precisa da permissão `REST_LEAD_POST` | Documentação da Pluga |
| Existe distribuição automática por **roleta**: lead novo vai para o próximo corretor online; se o lead já é cliente com corretor vinculado, esse corretor tem prioridade | Central de ajuda do Vista (Roleta de atendimento), via busca |
| A API tem um método separado **"Definir um corretor para um cliente"** | Índice da documentação oficial (vistasoft.com.br/api/) |

## Não confirmado

| Pergunta | Situação |
|---|---|
| Campo do `POST /lead` para escolher o corretor destinatário | **Não documentado publicamente.** A página "Enviar leads" da documentação oficial não expõe os parâmetros (carrega via JavaScript/sandbox) |
| Se o `POST /lead` aceita atribuição explícita | Não confirmado |
| Permissão adicional para atribuir corretor | Não confirmado |
| Semântica exata de `Corretor` na resposta (quem recebeu? o corretor da roleta? o dono do cliente?) | Não confirmado. **Sozinho, não prova que escolhemos o destinatário** |
| Comportamento com cliente já existente (mesmo telefone/e-mail) | Indício (roleta prioriza o corretor vinculado); não testado na conta |
| Se um lead existente pode trocar de corretor pelo `POST /lead` | Não confirmado (a troca parece ser o método "Definir corretor para cliente") |
| Como impedir a substituição do corretor atual | Não confirmado |
| Endpoint para consultar a atribuição de um lead pelo `Codigo` | Não confirmado ("Exibir detalhes de um cliente" existe, mas não sabemos se `Codigo` do lead é o código do cliente) |
| Idempotência oficial (chave de requisição) | Não existe indício. Tratamos como **não idempotente** |

## Decisões de implementação

1. **Nenhum campo extra é enviado por padrão.** O payload continua exatamente o validado (`nome`, `fone`, `email`, `mensagem`, `veiculo`, `anuncio`).
2. **`Codigo`** é gravado como identificador do lead (`vista_reference`) e **`Corretor`** como `vista_broker_code_returned` (apenas informativo). A leitura ignora maiúsculas/minúsculas. Antes desta fase, o parser procurava `codigo` minúsculo e a referência nunca era gravada.
3. **Atribuição sem contrato confirmado = `UNVERIFIED`** (lead entregue, atribuição não verificada). Nenhum texto afirma ao visitante ou ao corretor que o lead chegou ao corretor no Vista.
4. **Cliente existente:** nada é alterado automaticamente. O método "Definir um corretor para um cliente" **não** é chamado; trocar o responsável é decisão comercial feita no Vista.
5. **Idempotência:** chave única por submissão (`submission_key`), trava transacional, deduplicação por 10 minutos, uma tentativa por envio, nenhuma repetição automática após timeout/5xx/resposta desconhecida (`UNKNOWN` → reconciliação manual).
6. **Resposta 2xx sem `Codigo` e sem `status 200`/`"Ok."`** → `UNKNOWN` (`UNRECOGNIZED_RESPONSE`). `status >= 400` no corpo com HTTP 200 → `FAILED` (`BUSINESS_ERROR`).

## Como habilitar a atribuição quando o Vista confirmar

Depois de resposta **por escrito** do suporte (Central de Serviços do Vista / relacionamento da plataforma) indicando o campo e o comportamento:

1. Configurar o código Vista de cada corretor (ADMIN, em Sites de corretores → site → Código no Vista).
2. Fazer um teste autorizado com contato controlado ("TESTE AUTORIZADO – não contatar") e conferir no Vista com quem o lead ficou.
3. Configurar:
   ```dotenv
   BROKER_VISTA_ASSIGNMENT_ENABLED=true
   VISTA_LEAD_BROKER_FIELD=<nome-do-campo-confirmado>   # opcional; vazio = não envia campo
   ```
   Com a flag ligada, o sistema compara `Corretor` retornado com o código do corretor do site: igual → `CONFIRMED`; diferente → `MISMATCH` (ex.: cliente já vinculado a outro corretor). O nome do campo não pode sobrescrever `nome`, `fone`, `email`, `mensagem`, `veiculo` ou `anuncio`.
4. Reiniciar a aplicação.

## Perguntas para o suporte do Vista

1. Qual campo do `cadastro.lead` define o corretor destinatário? Ele é aceito pela chave com `REST_LEAD_POST` ou exige outra permissão?
2. O campo `Corretor` da resposta é o corretor que recebeu o lead?
3. Se o telefone/e-mail já for cliente de outro corretor, o lead é criado como novo atendimento, anexado ao cliente, ou o corretor é substituído?
4. Existe forma de impedir a troca do corretor de um cliente existente?
5. Como consultar um lead pelo `Codigo` retornado (endpoint e permissão)?
6. Existe chave de idempotência ou detecção de duplicidade no `POST /lead`?
7. A roleta de atendimento se aplica a leads via API? Ela respeita um corretor informado no envio?

Fontes consultadas em 11/11/2026: documentação REST do Vista (<https://www.vistasoft.com.br/api/>), central de ajuda (Roleta de atendimento, integração RD Station) e guia da Pluga para `POST /lead`.
