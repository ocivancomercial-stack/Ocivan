# Arquitetura

## Visão geral

Monólito modular em Next.js (App Router). Renderização no servidor por padrão; componentes cliente apenas onde há interação.
Mutações via **Server Actions** (formulários) e **Route Handlers** (`/api/*`) para integrações externas (auth, webhooks)
e para futuros apps nativos.

```
Navegador / PWA ──► proxy.ts (checagem otimista de sessão)
                    │
                    ├─► Server Components (páginas)  ──┐
                    ├─► Server Actions (formulários) ──┼─► features/*/service.ts ─► Prisma ─► PostgreSQL
                    └─► Route Handlers /api/*        ──┘           │
                                                                  └─► services/* (e-mail, storage, pagamento, frete, IA)
```

## Decisões técnicas

| Decisão | Motivo |
|---|---|
| **Next.js 16** | Versão estável atual; `middleware` passou a se chamar `proxy`. `cacheComponents` **desativado**: o marketplace é majoritariamente dinâmico e por usuário; simplifica corretude. Pode ser habilitado depois para vitrines. |
| **Better Auth** em vez de Auth.js | Auth.js v5 segue em beta; Better Auth é estável (o projeto Auth.js foi incorporado a ele), tem sessões persistidas no banco (revogáveis), recuperação de senha, rate limit e adapter Prisma. Sem lock-in de fornecedor (diferente de Supabase Auth). |
| **Prisma 6** | Linha estável e madura (a 7 mudou o modelo de drivers; a "latest" do npm é RC). |
| **Valores em centavos (Int)** | Evita erros de ponto flutuante em preços, comissão e repasses. |
| **Comissão em pontos-base** | `1200 bps = 12%`; configurável em `platform_settings`. |
| **Abstrações de provedores** | `EmailProvider` e `StorageProvider` (prontos), `ListingAssistant` (IA — interface pronta, sem provedor), `PaymentProvider` e `ShippingProvider` (Etapa 5) — trocar fornecedor sem reescrever regras. |
| **Busca no PostgreSQL** | Full-text `portuguese` + `unaccent` com índice GIN e prefixo; suficiente para o volume regional do MVP sem custo de serviço externo (Algolia/Meilisearch podem entrar depois). |
| **Distância sem geolocalização** | Cada anúncio guarda só a cidade; o raio é calculado entre centros de municípios (Haversine). Privacidade por padrão e zero custo. |
| **Imagens** | Compressão no navegador + reprocessamento no servidor (sharp). Upload enviado com o formulário final (limite de 10 MB por envio). |
| **Simulação nunca em produção** | `src/lib/env.ts` recusa iniciar com `APP_ENV=production` e qualquer driver simulado. Faixa amarela visível fora de produção. |
| **`legacy-peer-deps`** | O npm 10 falha ao resolver os peers opcionais do Better Auth (`edgesOut` null). Não afeta o runtime. |

## Estrutura de pastas

```
src/
  app/                 Rotas (App Router)
    (site)/            Páginas com cabeçalho + rodapé (landing, perfil, políticas…)
    (auth)/            Entrar, cadastro, recuperar/redefinir senha
    admin/             Painel administrativo (requer ADMIN; 404 para os demais)
    api/auth/[...all]  Endpoints do Better Auth
  components/          UI reutilizável (ui/, layout/, brand/, catalog/)
  features/            Módulos de domínio (auth, profile, catalog, legal, admin…)
                       └─ actions.ts (Server Actions finas) + service.ts (regras testáveis)
  lib/                 Infra: db, auth, session, env, rate-limit, audit, crypto, logger
  services/            Adaptadores de terceiros (email; storage/pagamento/frete/IA nas próximas etapas)
  providers/           Context providers React (reservado)
  hooks/               Hooks React (reservado)
  schemas/             Schemas Zod compartilhados (cliente + servidor)
  types/               Tipos compartilhados
  proxy.ts             Redireciono otimista para login em rotas protegidas
prisma/                schema.prisma, migrations/, seed/
tests/                 unit/, integration/, setup/
docs/                  Documentação
scripts/               Utilitários de linha de comando
```

## Padrões

- **Autorização no servidor sempre**: `requireUser()` / `requireAdmin()` em cada página/Action; consultas sempre filtradas pelo dono (`where: { id, userId }`).
- **Actions finas, serviços testáveis**: a regra de negócio vive em `service.ts` recebendo `userId`, sem depender de `next/headers`.
- **Validação com Zod** no servidor (e reaproveitada no cliente quando útil).
- **Tokens de design** centralizados em `src/app/globals.css` (`@theme`).
