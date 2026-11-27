# Banco de dados

PostgreSQL + Prisma. Schema em `prisma/schema.prisma`; migrations em `prisma/migrations/`.

## Convenções

- IDs `cuid()` (não sequenciais). Tabelas em snake_case (`@@map`).
- Dinheiro em **centavos** (`priceCents`, `totalCents`…). Comissão em **pontos-base** (`platformFeeBps`).
- `isSample = true` marca anúncios fictícios de demonstração (nunca inseridos com `APP_ENV=production`).
- Nenhum dado de cartão é armazenado. Tokens OAuth de vendedores são cifrados (AES-256-GCM).

## Entidades

| Grupo | Tabelas |
|---|---|
| Autenticação | `users`, `sessions`, `accounts` (hash de senha), `verifications`, `rate_limits` |
| Usuário | `addresses` |
| Catálogo | `categories` (árvore via `parentId`), `brands`, `products`, `product_images`, `favorites` |
| Compra | `cart_items`, `product_reservations`, `orders`, `order_items` (snapshot de título/preço), `coupons` |
| Pagamento | `payments`, `seller_payment_accounts` |
| Logística | `shipments`, `shipment_events` |
| Pós-venda | `reviews`, `disputes` |
| Moderação | `reports`, `notifications` |
| Operação | `platform_settings`, `webhook_events` (idempotência), `audit_logs`, `data_requests` (LGPD) |

Mapeamento dos nomes do briefing: `price → priceCents`, `subtotal → subtotalCents`, `avatar` (o Better Auth o chama de `image`, mapeado em `src/lib/auth.ts`).

## Estados

- **Produto**: `DRAFT → IN_REVIEW → ACTIVE ⇄ PAUSED`, `ACTIVE → RESERVED → SOLD`, qualquer → `REMOVED`.
- **Pedido**: `PENDING_PAYMENT → PAID → SHIPPED → DELIVERED → COMPLETED`; ramos `CANCELED`, `REFUNDED`, `DISPUTED`.
- **Pagamento**: `PENDING, AUTHORIZED, APPROVED, REJECTED, CANCELED, REFUNDED, CHARGED_BACK, IN_MEDIATION`.

## Restrições além do Prisma (migration `integrity_constraints`)

- Índice único parcial: **uma única reserva `ACTIVE` por produto** (impede dois checkouts da mesma peça, mesmo sob concorrência).
- `CHECK`: preço > 0, nota 1–5, quantidades > 0, valores do pedido ≥ 0, comissão entre 0 e 50%.
- Índice GIN de busca textual em português (`to_tsvector('portuguese', title || description)`).

## Índices

Compostos por `status` para as consultas públicas (recentes, preço, categoria, marca, cidade, vendedor) e por comprador/vendedor nos pedidos.

## Comandos

```bash
npm run db:migrate      # cria/aplica migration em dev
npm run db:deploy       # aplica migrations em produção
npm run db:seed         # dados iniciais (idempotente)
npm run db:reset        # recria o banco de DEV (apaga tudo)
```
