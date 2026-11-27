import { describe, expect, it } from "vitest";
import { calculateCouponDiscount, calculateOrderTotals, calculatePlatformFee } from "@/features/orders/pricing";
import { canTransition } from "@/features/orders/status";

describe("comissão da plataforma", () => {
  it("R$ 100 com 12% → comissão R$ 12 e vendedor R$ 88", () => {
    const t = calculateOrderTotals({ itemPricesCents: [10000], shippingCents: 0, feeBps: 1200 });
    expect(t).toMatchObject({ subtotalCents: 10000, platformFeeCents: 1200, sellerAmountCents: 8800, totalCents: 10000 });
  });
  it("arredonda centavos corretamente", () => {
    expect(calculatePlatformFee(12990, 1200)).toBe(1559); // 1558,8
    expect(calculatePlatformFee(1, 1200)).toBe(0);
  });
  it("recusa taxa inválida", () => {
    expect(() => calculatePlatformFee(1000, 6000)).toThrow();
    expect(() => calculatePlatformFee(10.5, 1200)).toThrow();
  });
});

describe("frete e total", () => {
  it("frete entra no total mas NÃO na base da comissão", () => {
    const t = calculateOrderTotals({ itemPricesCents: [10000, 5000], shippingCents: 2350, feeBps: 1200 });
    expect(t.subtotalCents).toBe(15000);
    expect(t.platformFeeCents).toBe(1800);
    expect(t.totalCents).toBe(17350);
    expect(t.sellerAmountCents).toBe(13200);
  });
  it("recusa pedido vazio e frete negativo", () => {
    expect(() => calculateOrderTotals({ itemPricesCents: [], shippingCents: 0, feeBps: 1200 })).toThrow();
    expect(() => calculateOrderTotals({ itemPricesCents: [100], shippingCents: -1, feeBps: 1200 })).toThrow();
  });
});

describe("cupons", () => {
  it("percentual é limitado à comissão e não reduz o valor do vendedor", () => {
    const t = calculateOrderTotals({ itemPricesCents: [10000], shippingCents: 1000, feeBps: 1200, coupon: { discountType: "PERCENT", discountValue: 2000, minOrderCents: 0 } });
    expect(t.discountCents).toBe(1200); // 20% = R$ 20, limitado à comissão de R$ 12
    expect(t.sellerAmountCents).toBe(8800);
    expect(t.totalCents).toBe(9800);
  });
  it("respeita valor mínimo do pedido", () => {
    expect(calculateCouponDiscount(5000, 600, { discountType: "FIXED", discountValue: 500, minOrderCents: 8000 })).toBe(0);
    expect(calculateCouponDiscount(9000, 1080, { discountType: "FIXED", discountValue: 500, minOrderCents: 8000 })).toBe(500);
  });
});

describe("estados do pedido", () => {
  it("só permite transições válidas", () => {
    expect(canTransition("PENDING_PAYMENT", "PAID")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "SHIPPED")).toBe(false);
    expect(canTransition("COMPLETED", "REFUNDED")).toBe(false);
    expect(canTransition("CANCELED", "PAID")).toBe(false);
  });
});
