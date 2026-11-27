# Deploy

Alvo: **Vercel** (app) + **Supabase** (PostgreSQL + Storage) + **Resend** (e-mail) + **Mercado Pago** + **Melhor Envio**.

## 1. Pré-requisitos (contas)

| Serviço | O que criar | Variáveis |
|---|---|---|
| Supabase | Projeto (região São Paulo); bucket **público** `product-images` | `DATABASE_URL` (pooler, porta 6543, `?pgbouncer=true`), `DIRECT_DATABASE_URL` (porta 5432), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_DRIVER=supabase` |
| Resend | Domínio verificado (SPF/DKIM) | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` |
| Mercado Pago | Aplicação + Marketplace habilitado; Redirect URL e Webhook (ver PAGAMENTOS.md) | `PAYMENT_PROVIDER=mercadopago`, `MERCADOPAGO_*` |
| Melhor Envio | Aplicativo (Área Dev.), callback e webhook (ver LOGISTICA.md) | `SHIPPING_PROVIDER=melhorenvio`, `MELHORENVIO_*` |
| Vercel | Projeto ligado ao repositório | demais variáveis abaixo |

O banco precisa permitir `CREATE EXTENSION unaccent` (Supabase permite).

## 2. Variáveis na Vercel

- **Production**: `APP_ENV=production` — o app **recusa iniciar** com simuladores, sandbox, URLs não oficiais, segredos de desenvolvimento ou sem `CRON_SECRET`.
- **Preview**: `APP_ENV=staging` + modelo de teste (`.env.test-model.example`) ou sandboxes oficiais; faixa amarela de homologação e `robots` bloqueado.
- Gere segredos novos: `openssl rand -base64 48` (BETTER_AUTH_SECRET, CRON_SECRET) e `openssl rand -base64 32` (ENCRYPTION_KEY).
- `NEXT_PUBLIC_APP_URL` e `BETTER_AUTH_URL` com o domínio final em `https://`.

Lista completa: [VARIAVEIS_AMBIENTE.md](VARIAVEIS_AMBIENTE.md).

## 3. Banco

```bash
DATABASE_URL=... DIRECT_DATABASE_URL=... npm run db:deploy   # aplica migrations
DATABASE_URL=... APP_ENV=production npm run db:seed          # catálogo e configurações (sem exemplos)
DATABASE_URL=... npm run admin:promote -- voce@empresa.com.br
```

Rode `db:deploy` antes de promover cada deploy que traga migrations (no CI ou manualmente).

## 4. Publicação

1. `git push` → a Vercel compila (`npm run build` já executa `prisma generate`).
2. `vercel.json` agenda `/api/cron/release-reservations` a cada 5 minutos (exige `CRON_SECRET`).
3. Configure um monitor externo para `GET /api/health` (200 = ok, 503 = banco indisponível).
4. Opcional: `ERROR_ALERT_WEBHOOK_URL` para alertas de erro; Log Drain da Vercel para retenção de logs.

## 5. Checklist de lançamento

- [ ] Domínio com HTTPS (HSTS e `upgrade-insecure-requests` ativam automaticamente)
- [ ] Variáveis de produção conferidas; app iniciou sem erro de validação
- [ ] Migrations aplicadas; seed de catálogo; admin promovido
- [ ] Admin › Integrações: Melhor Envio conectado; webhook de pagamentos e de frete recebendo (Admin › Pagamentos lista os eventos)
- [ ] Compra real de baixo valor ponta a ponta (pagamento, etiqueta, rastreio, reembolso)
- [ ] E-mails chegando (confirmação, redefinição de senha, pedidos)
- [ ] Bucket de imagens público apenas para leitura
- [ ] Backups automáticos do banco (point-in-time) habilitados
- [ ] Textos legais revisados; controlador e encarregado (DPO) definidos na política de privacidade
- [ ] `robots.txt` liberado só em produção; sitemap enviado ao Google Search Console
- [ ] Teste de instalação como app (Android/iOS) e Lighthouse
