/**
 * Regras de valores do pedido (todas em centavos, inteiros).
 *
 *  subtotal  = soma dos produtos
 *  comissão  = subtotal × taxa (pontos-base) — NÃO incide sobre o frete
 *  desconto  = cupom (custeado pela plataforma) — limitado à comissão, para que
 *              a plataforma nunca pague do próprio bolso nem reduza o valor do vendedor
 *  total     = subtotal + frete − desconto           (o que o comprador paga)
 *  vendedor  = subtotal − comissão                    (estimativa ANTES das taxas do provedor)
 */
export type CouponRule = { discountType: "PERCENT" | "FIXED"; discountValue: number; minOrderCents: number };

export function calculatePlatformFee(subtotalCents: number, feeBps: number): number {
  if (!Number.isInteger(subtotalCents) || subtotalCents < 0) throw new Error("Subtotal inválido");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5000) throw new Error("Comissão inválida");
  return Math.round((subtotalCents * feeBps) / 10000);
}

export function calculateCouponDiscount(subtotalCents: number, feeCents: number, coupon: CouponRule | null): number {
  if (!coupon || subtotalCents < coupon.minOrderCents) return 0;
  const raw = coupon.discountType === "PERCENT" ? Math.round((subtotalCents * coupon.discountValue) / 10000) : coupon.discountValue;
  return Math.max(0, Math.min(raw, feeCents));
}

export function calculateOrderTotals(input: { itemPricesCents: number[]; shippingCents: number; feeBps: number; coupon?: CouponRule | null }) {
  if (input.itemPricesCents.length === 0) throw new Error("Pedido sem itens");
  if (!Number.isInteger(input.shippingCents) || input.shippingCents < 0) throw new Error("Frete inválido");
  const subtotalCents = input.itemPricesCents.reduce((a, b) => a + b, 0);
  const platformFeeCents = calculatePlatformFee(subtotalCents, input.feeBps);
  const discountCents = calculateCouponDiscount(subtotalCents, platformFeeCents, input.coupon ?? null);
  return {
    subtotalCents,
    shippingPriceCents: input.shippingCents,
    discountCents,
    platformFeeCents,
    platformFeeBps: input.feeBps,
    totalCents: subtotalCents + input.shippingCents - discountCents,
    sellerAmountCents: subtotalCents - platformFeeCents,
  };
}
