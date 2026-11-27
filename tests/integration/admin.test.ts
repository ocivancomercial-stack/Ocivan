import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Simula o contexto de requisição do Next para testar requireAdmin() com sessões reais.
const cookieJar = { value: "" };
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: cookieJar.value, origin: "http://localhost:3000" }) }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/session";
import { adminSettingsAction, adminUserAction } from "@/features/admin/actions";
import { AdminError, moderateProduct, resolveReport, setUserStatus, updateSettings, createCoupon } from "@/features/admin/service";
import { MemoryStorageProvider, setStorage } from "@/services/storage";
import { createProduct } from "@/features/products/service";
import { createReport } from "@/features/products/report-service";
import { getSetting } from "@/lib/settings";
import { resetDatabase } from "../setup/db";
import { makeCatalog, makeUser, photo, productInput } from "../setup/fixtures";

setStorage(new MemoryStorageProvider());

async function loginAs(email: string, role: "USER" | "ADMIN") {
  const res = await auth.handler(new Request("http://localhost:3000/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ name: "Pessoa Teste", email, password: "Desapega2026", phone: "41999990000", city: "Curitiba", termsAccepted: true }),
  }));
  await prisma.user.update({ where: { email }, data: { role } });
  cookieJar.value = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

beforeEach(async () => {
  await resetDatabase();
  cookieJar.value = "";
});
afterAll(() => prisma.$disconnect());

describe("permissões do painel administrativo", () => {
  it("usuário comum recebe 404 nas páginas e ações administrativas", async () => {
    await loginAs("comum@t.dev", "USER");
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    const fd = new FormData();
    fd.set("feePercent", "1"); fd.set("reservationMinutes", "15"); fd.set("moderation", "auto");
    await expect(adminSettingsAction({ ok: false }, fd)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await getSetting("platform_fee_bps")).toBe(1200);
  });

  it("visitante sem login é enviado ao login", async () => {
    await expect(requireAdmin()).rejects.toThrow(/NEXT_REDIRECT:\/entrar/);
  });

  it("admin consegue alterar configurações; tudo vai para a auditoria", async () => {
    const admin = await loginAs("admin@t.dev", "ADMIN");
    const fd = new FormData();
    fd.set("feePercent", "10"); fd.set("reservationMinutes", "20"); fd.set("moderation", "manual");
    expect((await adminSettingsAction({ ok: false }, fd)).ok).toBe(true);
    expect(await getSetting("platform_fee_bps")).toBe(1000);
    expect(await getSetting("listing_moderation")).toBe("manual");
    expect(await prisma.auditLog.count({ where: { actorId: admin.id, action: "admin.settings.update" } })).toBe(1);
  });

  it("valida limites das configurações", async () => {
    await loginAs("admin@t.dev", "ADMIN");
    const fd = new FormData();
    fd.set("feePercent", "80"); fd.set("reservationMinutes", "1"); fd.set("moderation", "x");
    const r = await adminSettingsAction({ ok: false }, fd);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors ?? {})).toEqual(expect.arrayContaining(["feePercent", "reservationMinutes", "moderation"]));
  });

  it("admin não pode suspender a si mesmo (nem via ação)", async () => {
    const admin = await loginAs("admin@t.dev", "ADMIN");
    const fd = new FormData();
    fd.set("userId", admin.id); fd.set("status", "SUSPENDED");
    expect((await adminUserAction({ ok: false }, fd)).ok).toBe(false);
  });
});

describe("gestão", () => {
  it("suspender usuário encerra sessões e pausa anúncios", async () => {
    const cat = await makeCatalog();
    const admin = await makeUser("adm@t.dev");
    const u = await makeUser("u@t.dev");
    const p = await createProduct(u.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    await prisma.session.create({ data: { userId: u.id, token: "tok", expiresAt: new Date(Date.now() + 86400_000) } });
    await setUserStatus(admin.id, u.id, "SUSPENDED");
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PAUSED");
    await expect(setUserStatus(admin.id, admin.id, "SUSPENDED")).rejects.toThrow(AdminError);
  });

  it("fila de moderação: aprovar, devolver, remover e destacar", async () => {
    const cat = await makeCatalog();
    const admin = await makeUser("adm@t.dev");
    const u = await makeUser("u@t.dev");
    await updateSettings(admin.id, { feePercent: 12, reservationMinutes: 15, moderation: "manual" });
    const p = await createProduct(u.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    expect(p.status).toBe("IN_REVIEW");
    await expect(moderateProduct(admin.id, p.id, "feature")).rejects.toThrow(AdminError);
    await moderateProduct(admin.id, p.id, "approve");
    await moderateProduct(admin.id, p.id, "feature");
    expect(await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ status: "ACTIVE", isFeatured: true });
    await moderateProduct(admin.id, p.id, "remove", "Teste");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("REMOVED");
    expect(await prisma.notification.count({ where: { userId: u.id } })).toBe(2);
  });

  it("denúncia procedente remove o anúncio", async () => {
    const cat = await makeCatalog();
    const admin = await makeUser("adm@t.dev");
    const seller = await makeUser("s@t.dev");
    const reporter = await makeUser("r@t.dev");
    const p = await createProduct(seller.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    await createReport(reporter.id, { productId: p.id, reason: "Produto falsificado ou réplica" });
    const report = await prisma.report.findFirstOrThrow();
    await resolveReport(admin.id, report.id, "RESOLVED", true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("REMOVED");
  });

  it("cupom: código único e percentual até 100%", async () => {
    const admin = await makeUser("adm@t.dev");
    await createCoupon(admin.id, { code: "BEMVINDO", discountType: "PERCENT", value: 10, minOrder: 50, maxUses: 100, expiresAt: undefined });
    await expect(createCoupon(admin.id, { code: "BEMVINDO", discountType: "FIXED", value: 5, minOrder: 0, maxUses: undefined, expiresAt: undefined })).rejects.toThrow(/Já existe/);
    await expect(createCoupon(admin.id, { code: "DEMAIS", discountType: "PERCENT", value: 150, minOrder: 0, maxUses: undefined, expiresAt: undefined })).rejects.toThrow(/100%/);
    expect(await prisma.coupon.findUniqueOrThrow({ where: { code: "BEMVINDO" } })).toMatchObject({ discountValue: 1000, minOrderCents: 5000 });
  });
});
