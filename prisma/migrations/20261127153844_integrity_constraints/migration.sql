-- Restrições de integridade que o Prisma não expressa nativamente.

-- Uma única reserva ATIVA por anúncio (impede dois checkouts simultâneos da mesma peça).
CREATE UNIQUE INDEX "product_reservations_one_active_per_product"
  ON "product_reservations" ("productId") WHERE "status" = 'ACTIVE';

-- Um produto só pode aparecer em um item de pedido não cancelado (peça única).
-- Garantido na aplicação via reserva + transação; aqui reforçamos valores válidos.
ALTER TABLE "products" ADD CONSTRAINT "products_price_positive" CHECK ("priceCents" > 0 AND "priceCents" <= 10000000);
ALTER TABLE "products" ADD CONSTRAINT "products_weight_positive" CHECK ("weightGrams" > 0);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_non_negative" CHECK (
  "subtotalCents" >= 0 AND "shippingPriceCents" >= 0 AND "discountCents" >= 0
  AND "platformFeeCents" >= 0 AND "totalCents" >= 0
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_fee_bps_range" CHECK ("platformFeeBps" BETWEEN 0 AND 5000);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_non_negative" CHECK ("amountCents" >= 0);
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0);

-- Busca textual em português (título + descrição) para o motor de busca.
CREATE INDEX "products_search_fts" ON "products"
  USING GIN (to_tsvector('portuguese', coalesce("title", '') || ' ' || coalesce("description", '')));
