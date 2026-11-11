# Vista CRM — envio de leads

## Contrato investigado

Consulta realizada em 8 de novembro de 2026:

- A documentação oficial do Vista lista **Clientes → Enviar leads**, mas a página pública não expõe de forma legível todo o contrato da operação: <https://www.vistasoft.com.br/api/>.
- A documentação da Pluga confirma `POST /lead`, chave no parâmetro `key` e a permissão `REST_LEAD_POST`: <https://pluga.zendesk.com/hc/pt-br/articles/4406711615507-Como-integrar-a-Vista-CRM-para-receber-informa%C3%A7%C3%B5es-de-outras-ferramentas-via-Pluga-Webhooks>.
- Campos documentados pela Pluga: `cadastro.lead.nome`, `cadastro.lead.fone`, `cadastro.lead.email`, `cadastro.lead.mensagem`, `cadastro.lead.veiculo` e `cadastro.lead.anuncio`.
- Um teste autorizado em 8 de novembro de 2026 confirmou que o endpoint exige um parâmetro form-urlencoded chamado `cadastro`, contendo o JSON aninhado `{ "lead": { ... } }`. O envio do objeto com chaves pontuadas diretamente como JSON foi recusado.
- A resposta real da conta confirmou como obrigatórios `nome`, `mensagem`, ao menos um entre `email` e `fone`, e `veiculo`. Nos anúncios, `veiculo` é o código resolvido no servidor; nas demais origens, é uma descrição informada pelo visitante.

O formato do identificador de resposta, a semântica de erro de negócio e a existência de idempotência **não foram confirmados para a conta da Vitória Maison**. Por isso o modo real permanece desabilitado por padrão e não existe repetição automática após timeout, erro de rede ou HTTP 5xx.

## Configuração

```dotenv
LEAD_DELIVERY_MODE=mock
VISTA_LEADS_ENABLED=false
VISTA_LEADS_ENDPOINT=/lead
VISTA_LEADS_TIMEOUT_MS=10000
```

Para produção, a chave configurada em `VISTA_API_KEY` precisa possuir também a permissão `REST_LEAD_POST`. Não use variáveis `NEXT_PUBLIC_`.

## Curl para teste manual autorizado

Este comando cria um lead real quando executado contra a conta de produção. Use dados de teste previamente autorizados e confirme com a equipe do Vista como localizar/remover o registro.

```bash
export VISTA_API_BASE_URL='https://SEU-DOMINIO.vistahost.com.br'
export VISTA_API_KEY='SUA-CHAVE-COM-REST_LEAD_POST'

curl --request POST \
  --url "${VISTA_API_BASE_URL%/}/lead?key=${VISTA_API_KEY}" \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'cadastro={"lead":{"nome":"TESTE AUTORIZADO - Vitória Maison","fone":"11999999999","email":"teste-autorizado@example.com","mensagem":"Teste autorizado da integração. Não contatar.","veiculo":"31","anuncio":"/imoveis/slug-do-imovel"}}' \
  --silent --show-error \
  --write-out '\nHTTP %{http_code}\n'
```

Não compartilhe a saída se ela contiver dados pessoais ou a chave. Registre o status HTTP e o JSON sanitizado para confirmar o parser antes de habilitar o modo `vista`.

## Habilitação real

Somente após o teste autorizado:

```dotenv
LEAD_DELIVERY_MODE=vista
VISTA_LEADS_ENABLED=true
```

Reinicie a aplicação após mudar as variáveis. O navegador nunca escolhe o provider.
