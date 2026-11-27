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
| `PAYMENT_PROVIDER` | não | `simulated` (interno) · `mercadopago`. |
| `SHIPPING_PROVIDER` | não | `simulated` (interno) · `melhorenvio`. |
| `MOCK_PROVIDERS` | não | `1` liga os simuladores `/api/mock/*` (modelo de teste). Proibido em produção. |
| `MERCADOPAGO_CLIENT_ID` / `MERCADOPAGO_CLIENT_SECRET` | se `mercadopago` | Credenciais da aplicação (OAuth dos vendedores). |
| `MERCADOPAGO_WEBHOOK_SECRET` | se `mercadopago` | Assinatura secreta dos webhooks (valida `x-signature`). |
| `MERCADOPAGO_ACCESS_TOKEN` | não | Token da conta da plataforma (enviado nas chamadas de OAuth, como o SDK oficial). |
| `MERCADOPAGO_TEST_MODE` | não | `1` = credenciais de teste. Proibido em produção. |
| `MERCADOPAGO_API_URL` / `MERCADOPAGO_AUTH_URL` | não | Só para apontar ao simulador. Em produção, apenas as URLs oficiais. |
| `MELHORENVIO_CLIENT_ID` / `MELHORENVIO_CLIENT_SECRET` | se `melhorenvio` | Aplicativo da Área Dev.; o secret também valida `X-ME-Signature`. |
| `MELHORENVIO_SANDBOX` | não | `1` = sandbox oficial. Proibido em produção. |
| `MELHORENVIO_USER_AGENT` | se `melhorenvio` | Obrigatório pela API: nome da aplicação + e-mail de contato. |
| `MELHORENVIO_TOKEN` | não | Token pessoal (alternativa ao OAuth da plataforma). |
| `MELHORENVIO_API_URL` | não | Só para o simulador. |
| `CRON_SECRET` | produção | Segredo (32+ caracteres) da rotina `/api/cron/release-reservations`, chamada pelo Vercel Cron a cada 5 min. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | não | Cria o primeiro admin no seed. Remova após uso. |
| `TEST_DATABASE_URL` | testes | Banco exclusivo de testes (nome deve conter "test"). |

Variáveis das etapas 5/6 (Mercado Pago, Melhor Envio, monitoramento) serão acrescentadas quando implementadas.
