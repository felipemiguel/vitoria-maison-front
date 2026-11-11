# Sites de corretores em produção (`*.vitoriamaison.com.br`)

Checklist para expor os subdomínios com segurança. **Nada aqui foi aplicado**: DNS, nameservers e configuração da hospedagem dependem de autorização.

## O que o repositório permite inferir

- **Hospedagem:** não há `vercel.json`, Dockerfile nem configuração de outro provedor no repositório. O código trata `VERCEL_ENV` (indexação) e considera `*.vercel.app` como preview, o que sugere **Vercel**. Confirme no painel do provedor antes de seguir.
- **Next.js 16** com `proxy.ts`: o roteamento por subdomínio é feito pela aplicação (rewrite para `/broker-site/<sub>`). A plataforma só precisa entregar as requisições de `*.vitoriamaison.com.br` à mesma aplicação, preservando o cabeçalho `Host`.
- **Cookies:**
  - a sessão do painel (`__Secure-vitoria-admin.session-token`) é host-only, não é enviada aos subdomínios, e `/admin` responde 404 nos hosts de corretor;
  - o cookie anônimo de leads (`vm_lead_session`) também é por host.

## DNS, TLS e roteamento: três coisas diferentes

Um registro DNS curinga **sozinho não resolve** TLS nem roteamento:

1. **DNS:** `*.vitoriamaison.com.br` precisa apontar para a plataforma.
2. **TLS:** é preciso um certificado curinga (`*.vitoriamaison.com.br`). Um certificado só do apex não cobre os subdomínios.
3. **Roteamento:** a plataforma precisa associar o domínio curinga ao projeto.

### Vercel

- Adicione `vitoriamaison.com.br`, `www.vitoriamaison.com.br` e `*.vitoriamaison.com.br` ao projeto (Settings → Domains).
- **Requisito oficial:** domínios curinga exigem os **nameservers da Vercel**, porque o certificado curinga é emitido por desafio DNS-01. Isso significa migrar a zona DNS inteira:
  - antes, recrie na Vercel todos os registros existentes (MX, SPF, DKIM, DMARC, verificações);
  - nunca migre nameservers automaticamente;
  - planeje com quem administra o domínio e o e-mail.
- Alternativa sem migrar a zona: cadastrar cada subdomínio explicitamente (`ana.vitoriamaison.com.br`, …) como domínio do projeto, com CNAME individual. É viável com poucos corretores, mas exige um passo manual por site publicado.

### Cloudflare (DNS/proxy na frente de outra origem)

- Registro `*` (CNAME para a origem) com proxy laranja.
- O certificado de borda curinga exige o Universal SSL cobrindo `*.dominio` (cobre um nível) ou um Advanced Certificate.
- A origem também precisa aceitar o `Host` curinga e ter certificado válido (modo SSL "Full (strict)").
- Não recomendado na frente da Vercel (a Vercel desaconselha proxy de terceiros).

## Variáveis de ambiente (produção)

```dotenv
NEXT_PUBLIC_SITE_URL=https://www.vitoriamaison.com.br
BROKER_SITES_BASE_DOMAIN=vitoriamaison.com.br
BROKER_SITES_ENABLED=false            # true só após DNS/TLS validados
BROKER_LEADS_ENABLED=false            # true após homologação dos formulários
BROKER_VISTA_ASSIGNMENT_ENABLED=false # true só com contrato do Vista confirmado
VISTA_LEAD_BROKER_FIELD=
BROKER_SITES_INDEXING_ENABLED=false   # decisão de SEO separada
BROKER_SITES_REQUIRE_VERIFIED_CRECI=true
LEAD_DELIVERY_MODE=vista
VISTA_LEADS_ENABLED=true
```

Em produção, domínios de desenvolvimento (`*.localhost`, `*.lvh.me`) são recusados como domínio-base. `NEXT_PUBLIC_*` é embutido no build: alterar essas variáveis exige novo deploy.

## Deploy

1. `npm run lint && npm run typecheck && npm test && npm run build`.
2. Aplique as migrations **antes** do novo código: `npm run db:migrate` (0013 e 0014). As duas só fazem acréscimos e são compatíveis com o código anterior.
3. Faça o deploy com todas as flags de corretor em `false`.
4. Smoke test do institucional: home, `/imoveis`, um imóvel, `/contato` com envio, `/admin`.
5. Ligue `BROKER_SITES_ENABLED=true` e faça novo deploy. Teste:
   - `https://<sub-publicado>.vitoriamaison.com.br/` responde 200, com certificado válido;
   - `https://<sub-rascunho>.…/` e `https://inexistente.…/` respondem 404;
   - `https://admin.vitoriamaison.com.br/` é reservado (404);
   - `https://<sub>.…/admin` responde 404;
   - `robots.txt` do subdomínio responde `Disallow: /` enquanto a indexação estiver desligada.
6. Faça a homologação (abaixo) e então ligue `BROKER_LEADS_ENABLED=true`.

## Homologação

Participantes: ADMIN, BROKER A, BROKER B e um usuário MANAGER + BROKER. Os leads reais no Vista só podem ser feitos com autorização e contato controlado ("TESTE AUTORIZADO – Vitória Maison – não contatar").

1. A e B publicam seus sites (aprovação do ADMIN), cada um com imóveis diferentes.
2. Visitante acessa o site A, escolhe um imóvel e envia interesse. Deve ver "Recebemos seu interesse. Nossa equipe entrará em contato."
3. O lead aparece em **Meu site → Leads** de A e **não** aparece no de B.
4. O MANAGER + BROKER vê os próprios leads em Meu site e a lista global em Leads.
5. ADMIN, em **Leads**, vê canal, corretor, hostname e caminho.
6. A entrega fica `Entregue ao Vista`, com o código do lead (`Codigo`).
7. No Vista, conferir com quem o lead ficou e registrar no detalhe: "está com o corretor do site" ou "está com outro corretor".
8. ADMIN suspende o site A. O site responde 404 e um envio pelo host de A é recusado.
9. O site B continua funcionando e recebendo contatos.
10. Desligar `BROKER_LEADS_ENABLED`: os sites mostram "Formulário em preparação" e o institucional segue normal.

## Rollback

- **Rápido (sem deploy de código):**
  - `BROKER_LEADS_ENABLED=false` interrompe os formulários dos corretores;
  - `BROKER_SITES_ENABLED=false` tira todos os subdomínios do ar (404).
  - O institucional não é afetado.
- **Código:** voltar ao deploy anterior. As migrations 0013/0014 são aditivas e podem ficar aplicadas.
- **DNS:** remover o registro curinga ou o domínio do projeto. Reverter nameservers só com planejamento (cache de DNS de até 48 h).
- **Leads já recebidos:** permanecem no banco com a origem; nada é apagado no rollback.

## Riscos conhecidos

- A atribuição no Vista não está confirmada: leads de corretores entram como `UNVERIFIED` e dependem de conferência comercial.
- A migração de nameservers pode afetar o e-mail do domínio se os registros não forem recriados antes.
- Sem analytics de cliques no WhatsApp: a conversão por site só considera formulários.
