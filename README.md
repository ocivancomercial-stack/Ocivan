# Repassa Aí

> **Compre perto. Venda fácil. Desapegue melhor.**

Marketplace regional de moda de segunda mão (roupas, tênis, sapatos e bolsas) para Curitiba e Região Metropolitana — PR.
Aplicação web responsiva (PWA na Etapa 6), com backend preparado para futuros apps nativos.

## Status do projeto

| Etapa | Escopo | Status |
|---|---|---|
| 1 | Planejamento técnico | ✅ Concluída |
| 2 | Fundação: Next.js, Tailwind, PostgreSQL, Prisma, autenticação, layout | ✅ Concluída |
| 3 | Marketplace: anúncios, fotos, busca, filtros, favoritos, página do produto | ✅ Concluída |
| 4 | Operação: carrinho, checkout, pedidos, painel do vendedor, painel admin | ✅ Concluída |
| 5 | Integrações: Mercado Pago, webhooks, Melhor Envio (+ modelo de teste) | ✅ Concluída (aguarda contas para homologar) |
| 6 | PWA, SEO, monitoramento, e-mails, LGPD, CSP com nonce, deploy | ✅ Concluída |

Páginas ainda não implementadas exibem explicitamente "Em desenvolvimento — Etapa N". Nada é simulado como se estivesse pronto.
Detalhes em [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 16 · Prisma 6 ·
Better Auth (sessões no banco) · Zod 4 · Vitest · Vercel.

## Requisitos

- Node.js ≥ 20.9 (recomendado 22)
- PostgreSQL ≥ 14 (local, Docker, Supabase, Neon…)

## Instalação

```bash
npm install                 # .npmrc usa legacy-peer-deps (ver docs/ARQUITETURA.md)
cp .env.example .env        # preencha BETTER_AUTH_SECRET e ENCRYPTION_KEY
```

Gerar segredos:

```bash
openssl rand -base64 48     # BETTER_AUTH_SECRET
openssl rand -base64 32     # ENCRYPTION_KEY
```

## Banco de dados

```bash
# Exemplo com PostgreSQL local
createuser -P repassa && createdb -O repassa repassa

npm run db:migrate          # aplica migrations (dev)
npm run db:seed             # categorias, marcas, configurações (+ dados de exemplo fora de produção)
npm run admin:promote -- seu@email.com   # torna um usuário existente ADMIN
npm run db:studio           # inspeção visual
```

Em produção use `npm run db:deploy` (não gera migrations novas). Ver [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md).

## Executar

```bash
npm run dev                 # http://localhost:3000
npm run build && npm start  # build de produção local
```

Em desenvolvimento, e-mails (ex.: redefinição de senha) **não são enviados**: o conteúdo aparece no log do servidor (`email.simulated`).

Fotos enviadas em desenvolvimento ficam em `.data/uploads/` (fora do Git) e são servidas por `/uploads/*`. O seed cria 20 anúncios **fictícios** (selo "Exemplo") de vendedores sem senha.

## Testes

```bash
createdb -O repassa repassa_test   # banco separado (o nome precisa conter "test")
npm test                    # unitários + integração
npm run test:unit
npm run test:integration
npm run lint && npm run typecheck
npm run check               # tudo acima de uma vez (o mesmo que o CI)
```

Os testes de integração exercitam a API HTTP real de autenticação e as restrições do banco (ver `tests/`).

## Publicação

Resumo: Vercel + PostgreSQL gerenciado + Supabase Storage + Resend. Passo a passo em [docs/DEPLOY.md](docs/DEPLOY.md).

## Documentação

- [Arquitetura](docs/ARQUITETURA.md)
- [Banco de dados](docs/BANCO_DE_DADOS.md)
- [Pagamentos](docs/PAGAMENTOS.md)
- [Logística](docs/LOGISTICA.md)
- [Segurança](docs/SEGURANCA.md)
- [Deploy](docs/DEPLOY.md)
- [Roadmap](docs/ROADMAP.md)
- [Variáveis de ambiente](docs/VARIAVEIS_AMBIENTE.md)
- [Modelo de teste (integrações sem conta)](docs/MODELO_DE_TESTE.md)
