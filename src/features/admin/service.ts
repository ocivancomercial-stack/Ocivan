import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { slugify } from "@/lib/utils";

/** Regras do painel administrativo. Todas recebem o id do admin (verificado pela camada de ação) e auditam. */
export class AdminError extends Error {}

export async function setUserStatus(adminId: string, userId: string, status: "ACTIVE" | "SUSPENDED") {
  if (adminId === userId) throw new AdminError("Você não pode alterar a própria conta.");
  const user = await prisma.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED") {
    await prisma.session.deleteMany({ where: { userId } }); // derruba sessões ativas
    await prisma.product.updateMany({ where: { sellerId: userId, status: "ACTIVE" }, data: { status: "PAUSED" } });
  }
  await audit({ actorId: adminId, action: `admin.user.${status === "SUSPENDED" ? "suspend" : "reactivate"}`, entityType: "user", entityId: userId, metadata: { email: user.email } });
}

export type ModerationAction = "approve" | "reject" | "remove" | "feature" | "unfeature";

export async function moderateProduct(adminId: string, productId: string, action: ModerationAction, reason?: string) {
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p) throw new AdminError("Anúncio não encontrado.");
  const rules: Record<ModerationAction, { from: string[]; data: object }> = {
    approve: { from: ["IN_REVIEW"], data: { status: "ACTIVE", publishedAt: p.publishedAt ?? new Date() } },
    reject: { from: ["IN_REVIEW"], data: { status: "DRAFT" } },
    remove: { from: ["DRAFT", "IN_REVIEW", "ACTIVE", "PAUSED"], data: { status: "REMOVED", isFeatured: false } },
    feature: { from: ["ACTIVE"], data: { isFeatured: true } },
    unfeature: { from: ["ACTIVE", "PAUSED", "RESERVED", "SOLD"], data: { isFeatured: false } },
  };
  const rule = rules[action];
  if (!rule.from.includes(p.status)) throw new AdminError("Ação não permitida para a situação atual do anúncio.");
  await prisma.product.update({ where: { id: productId }, data: rule.data });
  if (action === "remove") await prisma.cartItem.deleteMany({ where: { productId } });
  const messages: Partial<Record<ModerationAction, [string, string]>> = {
    approve: ["Anúncio aprovado", `"${p.title}" já está visível para compradores.`],
    reject: ["Anúncio precisa de ajustes", `"${p.title}" voltou para rascunho. ${reason ?? ""}`.trim()],
    remove: ["Anúncio removido", `"${p.title}" foi removido por violar as regras. ${reason ?? ""}`.trim()],
  };
  const msg = messages[action];
  if (msg) await notify(p.sellerId, msg[0], msg[1], `/vender/anuncios`);
  await audit({ actorId: adminId, action: `admin.product.${action}`, entityType: "product", entityId: productId, metadata: { reason } });
}

export async function resolveReport(adminId: string, reportId: string, outcome: "RESOLVED" | "DISMISSED", removeProduct: boolean) {
  const report = await prisma.report.update({ where: { id: reportId }, data: { status: outcome, resolvedAt: new Date() } });
  if (removeProduct && outcome === "RESOLVED") {
    await moderateProduct(adminId, report.productId, "remove", `Denúncia: ${report.reason}`).catch(() => undefined);
    await prisma.report.updateMany({ where: { productId: report.productId, status: { in: ["OPEN", "UNDER_REVIEW"] } }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  }
  await audit({ actorId: adminId, action: "admin.report.resolve", entityType: "report", entityId: reportId, metadata: { outcome, removeProduct } });
}

export async function createSubcategory(adminId: string, parentId: string, name: string) {
  const parent = await prisma.category.findFirst({ where: { id: parentId, parentId: null } });
  if (!parent) throw new AdminError("Categoria principal inválida (v1 permite apenas Roupas, Tênis, Sapatos e Bolsas).");
  const clean = name.trim().slice(0, 50);
  if (clean.length < 2) throw new AdminError("Nome muito curto.");
  const c = await prisma.category.create({ data: { name: clean, slug: `${parent.slug}-${slugify(clean)}`, parentId, position: 999 } });
  await audit({ actorId: adminId, action: "admin.category.create", entityType: "category", entityId: c.id });
}

export async function toggleCategory(adminId: string, id: string) {
  const c = await prisma.category.findUniqueOrThrow({ where: { id } });
  await prisma.category.update({ where: { id }, data: { active: !c.active } });
  await audit({ actorId: adminId, action: "admin.category.toggle", entityType: "category", entityId: id, metadata: { active: !c.active } });
}

export async function createBrand(adminId: string, name: string) {
  const clean = name.trim().slice(0, 50);
  if (clean.length < 2) throw new AdminError("Nome muito curto.");
  const b = await prisma.brand.create({ data: { name: clean, slug: slugify(clean) } }).catch(() => {
    throw new AdminError("Marca já existe.");
  });
  await audit({ actorId: adminId, action: "admin.brand.create", entityType: "brand", entityId: b.id });
}

export async function toggleBrand(adminId: string, id: string) {
  const b = await prisma.brand.findUniqueOrThrow({ where: { id } });
  await prisma.brand.update({ where: { id }, data: { active: !b.active } });
  await audit({ actorId: adminId, action: "admin.brand.toggle", entityType: "brand", entityId: id });
}

export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/, "Código: 4 a 20 letras/números"),
  discountType: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().positive("Valor deve ser positivo"),
  minOrder: z.coerce.number().min(0).default(0),
  maxUses: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  expiresAt: z.string().optional().transform((v) => (v ? new Date(`${v}T23:59:59-03:00`) : undefined)),
});

export async function createCoupon(adminId: string, input: z.output<typeof couponSchema>) {
  if (input.discountType === "PERCENT" && input.value > 100) throw new AdminError("Percentual máximo: 100%.");
  const c = await prisma.coupon
    .create({
      data: {
        code: input.code,
        discountType: input.discountType,
        discountValue: input.discountType === "PERCENT" ? Math.round(input.value * 100) : Math.round(input.value * 100),
        minOrderCents: Math.round(input.minOrder * 100),
        maxUses: input.maxUses ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    })
    .catch(() => {
      throw new AdminError("Já existe um cupom com esse código.");
    });
  await audit({ actorId: adminId, action: "admin.coupon.create", entityType: "coupon", entityId: c.id });
}

export async function toggleCoupon(adminId: string, id: string) {
  const c = await prisma.coupon.findUniqueOrThrow({ where: { id } });
  await prisma.coupon.update({ where: { id }, data: { active: !c.active } });
  await audit({ actorId: adminId, action: "admin.coupon.toggle", entityType: "coupon", entityId: id });
}

export const settingsSchema = z.object({
  feePercent: z.coerce.number().min(0, "Mínimo 0%").max(30, "Máximo 30%"),
  reservationMinutes: z.coerce.number().int().min(5, "Mínimo 5 minutos").max(120, "Máximo 120 minutos"),
  moderation: z.enum(["auto", "manual"]),
});

/** Alterar a comissão vale para pedidos NOVOS; pedidos existentes guardam a taxa aplicada. */
export async function updateSettings(adminId: string, input: z.output<typeof settingsSchema>) {
  const values = { platform_fee_bps: Math.round(input.feePercent * 100), reservation_minutes: input.reservationMinutes, listing_moderation: input.moderation };
  const before = await prisma.platformSetting.findMany({ where: { key: { in: Object.keys(values) } } });
  for (const [key, value] of Object.entries(values))
    await prisma.platformSetting.upsert({ where: { key }, update: { value, updatedBy: adminId }, create: { key, value, updatedBy: adminId } });
  await audit({ actorId: adminId, action: "admin.settings.update", entityType: "settings", metadata: { before: Object.fromEntries(before.map((b) => [b.key, b.value])) as object, after: values } });
}

/** Disputa decidida a favor do vendedor → pedido concluído. A favor do comprador → reembolso (refundOrder). */
export async function resolveDisputeForSeller(adminId: string, orderId: string, resolution: string) {
  const { count } = await prisma.order.updateMany({ where: { id: orderId, status: "DISPUTED" }, data: { status: "COMPLETED", completedAt: new Date() } });
  if (!count) throw new AdminError("Pedido não está em disputa.");
  await prisma.dispute.updateMany({ where: { orderId, status: { notIn: ["CLOSED", "RESOLVED_BUYER", "RESOLVED_SELLER"] } }, data: { status: "RESOLVED_SELLER", resolution } });
  await audit({ actorId: adminId, action: "admin.dispute.seller", entityType: "order", entityId: orderId, metadata: { resolution } });
}
