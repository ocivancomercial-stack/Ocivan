# Publicar uma demonstração (grátis, sem contas de pagamento)

Resultado: um link público (ex.: `https://repassa-ai-demo.vercel.app`) para testar no celular e no computador,
com **pagamentos e fretes simulados** (nenhum dinheiro é cobrado), anúncios de exemplo e painel administrativo.

Tempo estimado: 20–30 minutos. Você precisa de: conta no GitHub (já tem), **Supabase** e **Vercel** (planos gratuitos).

## 1. Supabase (banco de dados + fotos)

1. Crie uma conta em supabase.com → **New project**. Região: *South America (São Paulo)*. Guarde a senha do banco.
2. **Connect** (botão no topo do projeto) → aba *ORMs* ou *Connection string*:
   - copie a URL do **Transaction pooler** (porta 6543) → será `DATABASE_URL` — acrescente `?pgbouncer=true&connection_limit=1` ao final;
   - copie a URL da **Direct connection** / *Session pooler* (porta 5432) → será `DIRECT_DATABASE_URL`.
   Troque `[YOUR-PASSWORD]` pela senha do banco nas duas.
3. **Project Settings → API**: copie a *Project URL* (`SUPABASE_URL`) e a chave **service_role** (`SUPABASE_SERVICE_ROLE_KEY` — é secreta, não compartilhe).
4. **Storage → New bucket**: nome `product-images`, marque **Public bucket**.

## 2. Vercel (hospedagem)

1. Crie uma conta em vercel.com entrando com o GitHub.
2. **Add New → Project** → importe o repositório `Ocivan` e escolha o branch com o código do Repassa Aí
   (depois do merge do PR, o branch padrão).
3. Em **Environment Variables**, cole as variáveis da tabela abaixo.
4. Clique em **Deploy**. O primeiro build aplica o banco, cria o catálogo, 20 anúncios de exemplo e o administrador.
5. Depois do primeiro deploy, copie o domínio gerado (ex.: `repassa-ai-demo.vercel.app`), atualize
   `NEXT_PUBLIC_APP_URL` e `BETTER_AUTH_URL` com `https://` + esse domínio e faça **Redeploy**.

## 3. Variáveis de ambiente da demonstração

| Variável | Valor |
|---|---|
| `APP_ENV` | `staging` |
| `DEMO_MODE` | `1` (botão "Confirmar e-mail agora" — sem precisar de serviço de e-mail) |
| `NEXT_PUBLIC_APP_URL` | `https://SEU-PROJETO.vercel.app` |
| `BETTER_AUTH_URL` | igual ao anterior |
| `BETTER_AUTH_SECRET` | texto aleatório de 48+ caracteres |
| `ENCRYPTION_KEY` | 32 bytes em base64 |
| `CRON_SECRET` | texto aleatório de 32+ caracteres |
| `DATABASE_URL` | URL do *Transaction pooler* + `?pgbouncer=true&connection_limit=1` |
| `DIRECT_DATABASE_URL` | URL da conexão direta (5432) |
| `STORAGE_DRIVER` | `supabase` |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role |
| `SUPABASE_STORAGE_BUCKET` | `product-images` |
| `PAYMENT_PROVIDER` | `simulated` |
| `SHIPPING_PROVIDER` | `simulated` |
| `EMAIL_PROVIDER` | `console` |
| `MIGRATE_ON_BUILD` | `1` |
| `SEED_ON_BUILD` | `1` |
| `SEED_ADMIN_EMAIL` | seu e-mail de administrador da demo |
| `SEED_ADMIN_PASSWORD` | senha forte (letras e números, 8+) |

Os três segredos (`BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`) podem ser gerados com
`openssl rand -base64 48` / `openssl rand -base64 32`, ou use os valores do arquivo de demonstração fornecido.
**Nunca reutilize os segredos da demonstração em produção.**

## 4. O que testar

- Como visitante: vitrine, busca com filtros, página de produto (exemplos fictícios não podem ser comprados).
- Crie duas contas (vendedor e comprador) — em abas anônimas diferentes.
- Vendedor: **Vender** → confirmar e-mail (botão de demonstração) → fotos, dados, preço → publicar.
- Comprador: perfil → endereço → produto do vendedor → **Comprar agora** → frete → pagar → botões **SIMULADO**.
- Vendedor: pedido → informar rastreio. Comprador: **Recebi o produto** → avaliação.
- Administrador (`SEED_ADMIN_EMAIL`): `/admin` — usuários, anúncios, pedidos, cupons, configurações, relatórios.
- No celular: menu do navegador → **Instalar app / Adicionar à tela inicial**.

## Limites da demonstração

- Pagamento e frete são simulados; e-mails não são enviados (ficam nos logs da Vercel).
- Plano gratuito da Vercel: a rotina de reservas roda 1x/dia (reservas vencidas também são liberadas a cada checkout e ao abrir o produto).
- Cada envio de anúncio tem limite de ~4,5 MB na Vercel; as fotos são comprimidas no celular antes do envio.
- Para remover os dados de teste ao lançar: crie um projeto Supabase novo para produção.
