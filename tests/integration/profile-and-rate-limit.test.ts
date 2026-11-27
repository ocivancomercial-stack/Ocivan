import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createAddress, deleteAddress, MAX_ADDRESSES, setDefaultAddress } from "@/features/profile/service";
import { resetDatabase } from "../setup/db";

const address = {
  postalCode: "80010000", street: "Rua XV de Novembro", number: "100", neighborhood: "Centro",
  city: "Curitiba", state: "PR", isDefault: false, label: "", recipient: "", complement: "",
};

async function makeUser(email: string) {
  return prisma.user.create({ data: { name: "Pessoa Teste", email } });
}

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe("endereços (proteção contra acesso indevido)", () => {
  it("primeiro endereço vira principal automaticamente", async () => {
    const u = await makeUser("a@t.dev");
    const r = await createAddress(u.id, address);
    expect(r.ok && r.address.isDefault).toBe(true);
  });

  it("usuário NÃO consegue apagar endereço de outra pessoa", async () => {
    const dono = await makeUser("dono@t.dev");
    const intruso = await makeUser("intruso@t.dev");
    const r = await createAddress(dono.id, address);
    if (!r.ok) throw new Error("falha");
    expect(await deleteAddress(intruso.id, r.address.id)).toBe(false);
    expect(await prisma.address.count({ where: { userId: dono.id } })).toBe(1);
    expect(await deleteAddress(dono.id, r.address.id)).toBe(true);
  });

  it("usuário NÃO consegue alterar endereço principal de outra pessoa", async () => {
    const dono = await makeUser("dono@t.dev");
    const intruso = await makeUser("intruso@t.dev");
    await createAddress(dono.id, address);
    const second = await createAddress(dono.id, { ...address, number: "200" });
    if (!second.ok) throw new Error("falha");
    expect(await setDefaultAddress(intruso.id, second.address.id)).toBe(false);
    expect(await setDefaultAddress(dono.id, second.address.id)).toBe(true);
    const defaults = await prisma.address.findMany({ where: { userId: dono.id, isDefault: true } });
    expect(defaults.map((a) => a.id)).toEqual([second.address.id]);
  });

  it(`limita a ${MAX_ADDRESSES} endereços`, async () => {
    const u = await makeUser("a@t.dev");
    for (let i = 0; i < MAX_ADDRESSES; i++) await createAddress(u.id, { ...address, number: String(i) });
    const r = await createAddress(u.id, address);
    expect(r.ok).toBe(false);
  });
});

describe("rate limiting persistido", () => {
  it("bloqueia após o limite e informa o tempo de espera", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("teste:ip", { max: 3, windowSeconds: 60 }));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
  });

  it("chaves diferentes são independentes", async () => {
    await rateLimit("a", { max: 1, windowSeconds: 60 });
    expect((await rateLimit("b", { max: 1, windowSeconds: 60 })).allowed).toBe(true);
  });

  it("é atômico sob concorrência", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => rateLimit("concorrente", { max: 5, windowSeconds: 60 })));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
});

describe("integridade do banco", () => {
  it("permite apenas UMA reserva ativa por anúncio", async () => {
    const seller = await makeUser("v@t.dev");
    const buyer1 = await makeUser("c1@t.dev");
    const buyer2 = await makeUser("c2@t.dev");
    const cat = await prisma.category.create({ data: { name: "Roupas", slug: "roupas" } });
    const p = await prisma.product.create({
      data: { sellerId: seller.id, categoryId: cat.id, title: "Jaqueta", description: "x", condition: "GOOD", priceCents: 5000, city: "Curitiba" },
    });
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    await prisma.productReservation.create({ data: { productId: p.id, userId: buyer1.id, expiresAt } });
    await expect(prisma.productReservation.create({ data: { productId: p.id, userId: buyer2.id, expiresAt } })).rejects.toThrow();
  });

  it("recusa preço zero ou negativo", async () => {
    const seller = await makeUser("v@t.dev");
    const cat = await prisma.category.create({ data: { name: "Roupas", slug: "roupas" } });
    await expect(
      prisma.product.create({ data: { sellerId: seller.id, categoryId: cat.id, title: "x", description: "x", condition: "GOOD", priceCents: 0, city: "Curitiba" } }),
    ).rejects.toThrow();
  });
});
