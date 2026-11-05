# Vitória Maison

Frontend editorial e responsivo para a nova experiência digital da Vitória Maison. A aplicação usa Next.js App Router, TypeScript, Tailwind CSS e um repositório mockado substituível por uma integração futura.

## Executar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Verificar

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Configuração de contato

Configure opcionalmente `NEXT_PUBLIC_WHATSAPP_NUMBER` e `NEXT_PUBLIC_CONTACT_EMAIL`. Sem esses valores, o site não cria links de contato fictícios.

Os imóveis e artigos são demonstrativos. `robots.ts` bloqueia indexação nesta fase.
