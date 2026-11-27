"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { zodErrors } from "@/lib/form-data";
import { logger } from "@/lib/logger";
import { refundOrder } from "@/features/payments/service";
import { OrderError } from "@/features/orders/service";
import {
  AdminError, couponSchema, createBrand, createCoupon, createSubcategory, moderateProduct, resolveDisputeForSeller, resolveReport,
  setUserStatus, settingsSchema, toggleBrand, toggleCategory, toggleCoupon, updateSettings, type ModerationAction,
} from "./service";

export type AdminResult = { ok: boolean; message?: string; errors?: Record<string, string[] | undefined> };

/** Toda ação administrativa revalida o papel ADMIN no servidor (nunca confia na interface). */
async function guarded(path: string, fn: (adminId: string) => Promise<unknown>, success = "Feito."): Promise<AdminResult> {
  const admin = await requireAdmin();
  try {
    await fn(admin.id);
  } catch (e) {
    if (e instanceof AdminError || e instanceof OrderError) return { ok: false, message: e.message };
    logger.error("admin.action_failed", { error: String(e) });
    return { ok: false, message: "Falha ao executar a ação." };
  }
  revalidatePath(path);
  return { ok: true, message: success };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function adminUserAction(_p: AdminResult, fd: FormData) {
  return guarded("/admin/usuarios", (a) => setUserStatus(a, s(fd, "userId"), s(fd, "status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"));
}
export async function adminProductAction(_p: AdminResult, fd: FormData) {
  const action = s(fd, "action") as ModerationAction;
  if (!["approve", "reject", "remove", "feature", "unfeature"].includes(action)) return { ok: false, message: "Ação inválida" };
  return guarded("/admin/anuncios", (a) => moderateProduct(a, s(fd, "productId"), action, s(fd, "reason") || undefined));
}
export async function adminReportAction(_p: AdminResult, fd: FormData) {
  return guarded("/admin/denuncias", (a) => resolveReport(a, s(fd, "reportId"), s(fd, "outcome") === "RESOLVED" ? "RESOLVED" : "DISMISSED", s(fd, "remove") === "on"));
}
export async function adminCategoryAction(_p: AdminResult, fd: FormData) {
  return guarded("/admin/categorias", (a) => (s(fd, "op") === "toggle" ? toggleCategory(a, s(fd, "id")) : createSubcategory(a, s(fd, "parentId"), s(fd, "name"))));
}
export async function adminBrandAction(_p: AdminResult, fd: FormData) {
  return guarded("/admin/marcas", (a) => (s(fd, "op") === "toggle" ? toggleBrand(a, s(fd, "id")) : createBrand(a, s(fd, "name"))));
}
export async function adminCouponAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  if (s(fd, "op") === "toggle") return guarded("/admin/cupons", (a) => toggleCoupon(a, s(fd, "id")));
  const parsed = couponSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  return guarded("/admin/cupons", (a) => createCoupon(a, parsed.data), "Cupom criado.");
}
export async function adminSettingsAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  return guarded("/admin/configuracoes", (a) => updateSettings(a, parsed.data), "Configurações salvas. Valem para novos pedidos e anúncios.");
}
export async function adminOrderAction(_p: AdminResult, fd: FormData) {
  const orderId = s(fd, "orderId");
  const reason = s(fd, "reason") || "Decisão da equipe Repassa Aí";
  return guarded("/admin/pedidos", (a) => (s(fd, "op") === "refund" ? refundOrder(orderId, a, reason) : resolveDisputeForSeller(a, orderId, reason)));
}
