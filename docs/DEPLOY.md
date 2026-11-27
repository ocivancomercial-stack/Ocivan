# Deploy

Alvo: **Vercel** (app) + **PostgreSQL gerenciado** (Supabase, Neon ou equivalente) + **Supabase Storage** (imagens) + **Resend** (e-mail).

## 1. Banco

1. Crie o banco (região São Paulo, `sa-east-1`, se disponível).
2. Copie a URL com pooling para `DATABASE_URL` e a URL direta para `DIRECT_DATABASE_URL`.

## 2. Vercel

1. Importe o repositório.
2. Configure as variáveis de [VARIAVEIS_AMBIENTE.md](VARIAVEIS_AMBIENTE.md) para *Production* e *Preview*:
   - Production: `APP_ENV=production` (exige integrações reais).
   - Preview: `APP_ENV=staging` (simulações permitidas, faixa de homologação visível).
3. Build command padrão (`npm run build` já executa `prisma generate`).
4. Migrations: rode `npm run db:deploy` apontando para o banco de produção (CI ou manualmente) **antes** de promover o deploy.

## 3. Primeiro acesso

```bash
DATABASE_URL=... npm run db:seed          # catálogo e configurações (sem dados de exemplo em produção)
DATABASE_URL=... npm run admin:promote -- voce@empresa.com.br
```

## 4. Checklist de produção

- [ ] Domínio próprio com HTTPS; `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` com `https://`
- [ ] Segredos gerados com `openssl` (não reutilizar os de dev)
- [ ] Resend com domínio verificado (SPF/DKIM)
- [ ] Bucket público `product-images` no Supabase Storage (leitura pública; gravação só com a service role no servidor) e `STORAGE_DRIVER=supabase`
- [ ] Credenciais de produção do Mercado Pago e Melhor Envio homologadas (Etapa 5)
- [ ] Textos legais revisados por advogado
- [ ] Backups automáticos do banco habilitados
