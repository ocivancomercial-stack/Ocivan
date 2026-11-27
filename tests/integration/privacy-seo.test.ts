import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ConsoleEmailProvider, setEmailProvider } from "@/services/email";
import { MemoryStorageProvider, setStorage } from "@/services/storage";
import { createProduct } from "@/features/products/service";
import { deleteAccount, exportUserData, PrivacyError } from "@/features/privacy/service";
import sitemap from "@/app/sitemap";
import { resetDatabase } from "../setup/db";
import { makeCatalog, makeUser, photo, productInput } from "../setup/fixtures";

const mailbox = new ConsoleEmailProvider();
setEmailProvider(mailbox);
const storage = new MemoryStorageProvider();
setStorage(storage);

beforeEach(async () => {
  await resetDatabase();
  mailbox.sent.length = 0;
  storage.files.clear();
});
afterAll(() => prisma.$disconnect());

describe("LGPD — exportação", () => {
  it("exporta somente dados do titular, sem senha nem tokens", async () => {
    const cat = await makeCatalog();
    const me = await prisma.user.create({ data: { name: "Ana Titular", email: "ana@t.dev", cpf: "52998224725" } });
    const other = await prisma.user.create({ data: { name: "Outra Pessoa", email: "outra@t.dev" } });
    await prisma.account.create({ data: { userId: me.id, accountId: me.id, providerId: "credential", password: "HASH-SECRETO" } });
    await prisma.sellerPaymentAccount.create({ data: { userId: me.id, provider: "mercadopago", providerUserId: "123", accessTokenEnc: "TOKEN-CIFRADO" } });
    await prisma.address.create({ data: { userId: me.id, postalCode: "80010000", street: "Rua Minha", number: "1", neighborhood: "C", city: "Curitiba", state: "PR" } });
    await prisma.address.create({ data: { userId: other.id, postalCode: "80010000", street: "Rua Alheia", number: "2", neighborhood: "C", city: "Curitiba", state: "PR" } });
    await createProduct(me.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    const data = await exportUserData(me.id);
    const json = JSON.stringify(data);
    expect(data.user.email).toBe("ana@t.dev");
    expect(data.addresses).toHaveLength(1);
    expect(data.products).toHaveLength(1);
    expect(json).toContain("Rua Minha");
    expect(json).not.toContain("Rua Alheia");
    expect(json).not.toContain("outra@t.dev");
    expect(json).not.toContain("HASH-SECRETO");
    expect(json).not.toContain("TOKEN-CIFRADO");
    expect(await prisma.dataRequest.count({ where: { userId: me.id, type: "ACCESS" } })).toBe(1);
  });
});

describe("LGPD — exclusão de conta", () => {
  it("anonimiza, remove anúncios não vendidos e fotos, encerra sessões", async () => {
    const cat = await makeCatalog();
    const me = await prisma.user.create({ data: { name: "Ana Titular", email: "ana@t.dev", cpf: "52998224725", phone: "41999990000" } });
    await prisma.session.create({ data: { userId: me.id, token: "t1", expiresAt: new Date(Date.now() + 86400_000) } });
    await prisma.address.create({ data: { userId: me.id, postalCode: "80010000", street: "Rua Minha", number: "1", neighborhood: "C", city: "Curitiba", state: "PR" } });
    const p = await createProduct(me.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    expect(storage.files.size).toBe(1);
    await deleteAccount(me.id);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(u).toMatchObject({ name: "Conta excluída", phone: null, cpf: null, status: "DELETED" });
    expect(u.email).toMatch(/@removido\.invalid$/);
    expect(await prisma.session.count({ where: { userId: me.id } })).toBe(0);
    expect(await prisma.address.count({ where: { userId: me.id } })).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("REMOVED");
    expect(storage.files.size).toBe(0);
    expect(await prisma.dataRequest.count({ where: { userId: me.id, type: "DELETION", status: "DONE" } })).toBe(1);
  });

  it("recusa com pedido em andamento", async () => {
    const cat = await makeCatalog();
    const seller = await makeUser("s@t.dev");
    const buyer = await makeUser("b@t.dev");
    const p = await createProduct(seller.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    await prisma.order.create({
      data: { code: "RA-TESTE1", buyerId: buyer.id, sellerId: seller.id, subtotalCents: 100, platformFeeCents: 12, platformFeeBps: 1200, totalCents: 100, status: "PAID", items: { create: { productId: p.id, productTitleSnapshot: "x", unitPriceCents: 100 } } },
    });
    await expect(deleteAccount(buyer.id)).rejects.toThrow(PrivacyError);
    await expect(deleteAccount(seller.id)).rejects.toThrow(PrivacyError);
  });

  it("conta excluída não consegue entrar", async () => {
    await auth.handler(new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Zé Teste", email: "ze@t.dev", password: "Desapega2026", phone: "41999990000", city: "Curitiba", termsAccepted: true }),
    }));
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "ze@t.dev" } });
    await deleteAccount(u.id);
    const res = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "ze@t.dev", password: "Desapega2026" }),
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("e-mails", () => {
  it("cadastro envia e-mail de confirmação e o link confirma a conta", async () => {
    await auth.handler(new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Lia Teste", email: "lia@t.dev", password: "Desapega2026", phone: "41999990000", city: "Curitiba", termsAccepted: true }),
    }));
    const mail = mailbox.sent.find((m) => m.subject.includes("Confirme"));
    expect(mail?.to).toBe("lia@t.dev");
    const link = mail!.text.match(/https?:\/\/\S+/)![0];
    await auth.handler(new Request(link, { headers: { origin: "http://localhost:3000" } }));
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "lia@t.dev" } })).emailVerified).toBe(true);
  });

  it("notificações importantes também vão por e-mail, com conteúdo escapado", async () => {
    const u = await makeUser("n@t.dev");
    await notify(u.id, "Você vendeu!", "Pedido <script>RA-1</script> pago.", "/pedidos/abc");
    expect(await prisma.notification.count({ where: { userId: u.id } })).toBe(1);
    expect(mailbox.sent[0].to).toBe("n@t.dev");
    expect(mailbox.sent[0].html).not.toContain("<script>");
    expect(mailbox.sent[0].html).toContain("/pedidos/abc");
    await notify(u.id, "Só no app", "x", undefined, { email: false });
    expect(mailbox.sent).toHaveLength(1);
  });
});

describe("SEO", () => {
  it("sitemap lista só anúncios ativos reais", async () => {
    const cat = await makeCatalog();
    const s = await makeUser("s@t.dev");
    const real = await createProduct(s.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    const sample = await createProduct(s.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    await prisma.product.update({ where: { id: sample.id }, data: { isSample: true } });
    const draft = await createProduct(s.id, productInput(cat.jaquetas.id), [], "draft");
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.endsWith(`/produto/${real.id}`))).toBe(true);
    expect(urls.some((u) => u.endsWith(`/produto/${sample.id}`))).toBe(false);
    expect(urls.some((u) => u.endsWith(`/produto/${draft.id}`))).toBe(false);
  });
});
