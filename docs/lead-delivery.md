# Captação e entrega de leads

## Fluxo

1. O formulário envia uma Server Action do Next.js.
2. Zod valida nome, mensagem, ao menos um meio de contato, referência/objetivo do imóvel, limites, origem e honeypot.
3. Para interesse em imóvel, o servidor resolve o código Vista usando o UUID e as mesmas regras do catálogo público. Código Vista vindo do navegador não é aceito.
4. A submissão é persistida antes da entrega.
5. O provider `mock` ou `vista` realiza uma única tentativa controlada.
6. O resultado e a duração são gravados em `lead_delivery_attempts`.
7. O painel `/admin/leads` apresenta a situação e o histórico.

## Situações

- `DELIVERED`: resposta HTTP de sucesso do Vista.
- `MOCKED`: fluxo validado e persistido sem chamada externa.
- `FAILED`: falha definitiva, como HTTP 4xx. Pode ser reenviada por administrador após análise.
- `UNKNOWN`: timeout, rede, HTTP 5xx ou resposta inválida. Não pode ser reenviada até reconciliação manual no Vista.
- `PENDING`: registro criado antes da tentativa.

## Proteções

- cookie de sessão anônimo, `HttpOnly` e `SameSite=Lax`;
- no máximo cinco submissões por sessão em dez minutos;
- deduplicação por HMAC de origem, imóvel, contato e mensagem durante dez minutos;
- chave única de submissão para cliques/replays;
- trava transacional no PostgreSQL contra corrida;
- honeypot e limites de payload;
- logs estruturados sem nome, telefone, e-mail ou mensagem;
- nenhuma repetição automática de resultado incerto.

## Teste local

1. Configure `DATABASE_URL`, `AUTH_SECRET` e mantenha `LEAD_DELIVERY_MODE=mock`.
2. Execute `npm run db:migrate`.
3. Use um imóvel elegível e publicado ou acesse `/contato`.
4. Envie o formulário e confira `/admin/leads`.
5. O estado esperado em mock é `MOCKED`.

## Retenção

`LEAD_RETENTION_DAYS` define o prazo, com padrão de 365 dias. Execute periodicamente:

```bash
npm run leads:cleanup
```

O comando remove apenas registros antigos em estados finais `DELIVERED`, `MOCKED` ou `FAILED`. Estados `PENDING` e `UNKNOWN` são preservados para investigação. A política e o texto jurídico devem ser aprovados antes da produção.
