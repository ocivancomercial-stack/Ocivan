# Variáveis de ambiente

Validadas em `src/lib/env.ts`. Modelo em `.env.example`. **Nunca** versione `.env`.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `APP_ENV` | sim | `development` · `test` · `staging` · `production`. Em `production`, simulações são proibidas. |
| `DATABASE_URL` | sim | PostgreSQL (com pooling em produção). |
| `DIRECT_DATABASE_URL` | sim | Conexão direta (migrations). Igual à anterior em dev. |
| `BETTER_AUTH_SECRET` | sim | ≥ 32 caracteres aleatórios (`openssl rand -base64 48`). |
| `BETTER_AUTH_URL` | sim | URL pública da aplicação. |
| `NEXT_PUBLIC_APP_URL` | sim | URL pública (origem confiável para CSRF; `https://` ativa HSTS). |
| `ENCRYPTION_KEY` | sim | 32 bytes base64 (`openssl rand -base64 32`) para cifrar tokens de terceiros. |
| `EMAIL_PROVIDER` | não | `console` (dev) · `resend`. |
| `EMAIL_FROM` | não | Remetente. |
| `RESEND_API_KEY` | se `resend` | Chave da Resend. |
| `STORAGE_DRIVER` | não | `local` (dev) · `supabase` (Etapa 3). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | se `supabase` | Storage de imagens. A service role key é **somente servidor**. |
| `AI_PROVIDER` | não | `anthropic` liga o assistente de anúncio (Claude); vazio = desligado. |
| `ANTHROPIC_API_KEY` | se `anthropic` | Chave da API da Anthropic (console.anthropic.com). Somente servidor. Sem ela o botão de IA não aparece. |
| `AI_MODEL` | não | Modelo do assistente. Padrão `claude-opus-5-5`. |
| `PAYMENT_PROVIDER` | não | `simulated` · `mercadopago` (Etapa 5). |
| `SHIPPING_PROVIDER` | não | `simulated` · `melhorenvio` (Etapa 5). |
| `CRON_SECRET` | produção | Segredo (32+ caracteres) da rotina `/api/cron/release-reservations`, chamada pelo Vercel Cron a cada 5 min. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | não | Cria o primeiro admin no seed. Remova após uso. |
| `TEST_DATABASE_URL` | testes | Banco exclusivo de testes (nome deve conter "test"). |

Variáveis das etapas 5/6 (Mercado Pago, Melhor Envio, monitoramento) serão acrescentadas quando implementadas.
