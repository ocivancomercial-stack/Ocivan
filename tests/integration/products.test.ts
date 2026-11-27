import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { MemoryStorageProvider, setStorage } from "@/services/storage";
import { changeProductStatus, createProduct, ProductError, updateProduct } from "@/features/products/service";
import { getProductForPage, searchProducts } from "@/features/products/queries";
import { toggleFavorite, listFavorites } from "@/features/favorites/service";
import { createReport } from "@/features/products/report-service";
import { searchParamsSchema } from "@/schemas/product";
import { resetDatabase } from "../setup/db";
import { makeCatalog, makeUser, photo, productInput } from "../setup/fixtures";

const storage = new MemoryStorageProvider();
setStorage(storage);

let cat: Awaited<ReturnType<typeof makeCatalog>>;
beforeEach(async () => {
  await resetDatabase();
  storage.files.clear();
  cat = await makeCatalog();
});
afterAll(() => prisma.$disconnect());

const search = (q: Record<string, unknown>, viewerCity?: string) => searchProducts(searchParamsSchema.parse(q), { viewerCity });

describe("publicação de anúncios", () => {
  it("publica com fotos, coordenadas aproximadas da cidade e status ACTIVE", async () => {
    const seller = await makeUser("v@t.dev");
    const p = await createProduct(seller.id, productInput(cat.jaquetas.id), [await photo(), await photo()], "publish");
    expect(p.status).toBe("ACTIVE");
    expect(p.latitude).toBeCloseTo(-25.43, 1);
    const images = await prisma.productImage.findMany({ where: { productId: p.id }, orderBy: { position: "asc" } });
    expect(images).toHaveLength(2);
    expect(storage.files.size).toBe(2);
    expect(images[0].storageKey).toMatch(/^products\/.+\.webp$/);
  });

  it("com moderação manual vai para revisão", async () => {
    await prisma.platformSetting.create({ data: { key: "listing_moderation", value: "manual" } });
    const seller = await makeUser("v@t.dev");
    const p = await createProduct(seller.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    expect(p.status).toBe("IN_REVIEW");
  });

  it("exige foto para publicar, mas permite rascunho sem foto", async () => {
    const seller = await makeUser("v@t.dev");
    await expect(createProduct(seller.id, productInput(cat.jaquetas.id), [], "publish")).rejects.toThrow(/foto/);
    const draft = await createProduct(seller.id, productInput(cat.jaquetas.id), [], "draft");
    expect(draft.status).toBe("DRAFT");
  });

  it("recusa mais de 8 fotos", async () => {
    const seller = await makeUser("v@t.dev");
    const img = await photo();
    await expect(createProduct(seller.id, productInput(cat.jaquetas.id), Array(9).fill(img), "publish")).rejects.toThrow(/8 fotos/);
  });

  it("recusa categoria raiz (precisa ser subcategoria) e arquivo que não é imagem", async () => {
    const seller = await makeUser("v@t.dev");
    await expect(createProduct(seller.id, productInput(cat.roupas.id), [await photo()], "publish")).rejects.toThrow(/subcategoria/);
    await expect(createProduct(seller.id, productInput(cat.jaquetas.id), [Buffer.from("not an image")], "publish")).rejects.toThrow(/Foto 1/);
    expect(storage.files.size).toBe(0);
  });
});

describe("edição e permissões", () => {
  it("usuário NÃO consegue editar anúncio de outra pessoa", async () => {
    const dono = await makeUser("dono@t.dev");
    const intruso = await makeUser("intruso@t.dev");
    const p = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    await expect(updateProduct(intruso.id, p.id, productInput(cat.jaquetas.id, { title: "Hackeado!" }), [], [], "save")).rejects.toThrow(ProductError);
    await expect(changeProductStatus(intruso.id, p.id, "remove")).rejects.toThrow(ProductError);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).title).toBe("Jaqueta jeans azul");
  });

  it("edita dados, reordena, adiciona e remove fotos (apagando do storage)", async () => {
    const dono = await makeUser("dono@t.dev");
    const p = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo(), await photo()], "publish");
    const [first, second] = await prisma.productImage.findMany({ where: { productId: p.id }, orderBy: { position: "asc" } });
    await updateProduct(dono.id, p.id, productInput(cat.jaquetas.id, { price: 9990 }), [await photo()], [
      { kind: "new", index: 0 },
      { kind: "existing", id: second.id },
    ], "save");
    const images = await prisma.productImage.findMany({ where: { productId: p.id }, orderBy: { position: "asc" } });
    expect(images).toHaveLength(2);
    expect(images[1].id).toBe(second.id);
    expect(images.find((i) => i.id === first.id)).toBeUndefined();
    expect(storage.files.has(first.storageKey)).toBe(false);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).priceCents).toBe(9990);
  });

  it("não aceita foto de outro anúncio na ordem", async () => {
    const dono = await makeUser("dono@t.dev");
    const outro = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    const p = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    const foreign = await prisma.productImage.findFirstOrThrow({ where: { productId: outro.id } });
    await expect(updateProduct(dono.id, p.id, productInput(cat.jaquetas.id), [], [{ kind: "existing", id: foreign.id }], "save")).rejects.toThrow(/Foto inválida/);
  });

  it("pausar, reativar e excluir; vendido não pode ser editado", async () => {
    const dono = await makeUser("dono@t.dev");
    const p = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    expect(await changeProductStatus(dono.id, p.id, "pause")).toBe("PAUSED");
    await expect(changeProductStatus(dono.id, p.id, "pause")).rejects.toThrow();
    expect(await changeProductStatus(dono.id, p.id, "reactivate")).toBe("ACTIVE");
    expect(await changeProductStatus(dono.id, p.id, "remove")).toBe("REMOVED");

    const sold = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    await prisma.product.update({ where: { id: sold.id }, data: { status: "SOLD" } });
    await expect(updateProduct(dono.id, sold.id, productInput(cat.jaquetas.id), [], [], "save")).rejects.toThrow(/não pode mais ser editado/);
    await expect(changeProductStatus(dono.id, sold.id, "remove")).rejects.toThrow();
  });
});

describe("busca real no banco", () => {
  beforeEach(async () => {
    const a = await makeUser("a@t.dev");
    const b = await makeUser("b@t.dev");
    await createProduct(a.id, productInput(cat.jaquetas.id, { title: "Jaqueta de couro preta", brandId: cat.levis.id, price: 25000, size: "G", condition: "EXCELLENT", description: "Couro legítimo, forro intacto, bem conservada." }), [await photo()], "publish");
    await createProduct(a.id, productInput(cat.corrida.id, { title: "Tênis de corrida leve", brandId: cat.nike.id, price: 19900, size: "40", city: "Mandirituba", color: "Preto", description: "Modelo leve para treinos, amortecimento bom." }), [await photo()], "publish");
    await createProduct(b.id, productInput(cat.corrida.id, { title: "Tênis para caminhada", price: 8000, size: "38", city: "Colombo", description: "Confortável para o dia a dia, pouco uso." }), [await photo()], "publish");
    const paused = await createProduct(b.id, productInput(cat.jaquetas.id, { title: "Jaqueta pausada" }), [await photo()], "publish");
    await changeProductStatus(b.id, paused.id, "pause");
  });

  it("texto sem acento e com prefixo", async () => {
    expect((await search({ q: "tenis" })).total).toBe(2);
    expect((await search({ q: "jaq" })).items.map((p) => p.title)).toEqual(["Jaqueta de couro preta"]);
  });
  it("encontra pela marca", async () => {
    expect((await search({ q: "nike" })).items.map((p) => p.title)).toEqual(["Tênis de corrida leve"]);
  });
  it("não mostra anúncios pausados", async () => {
    expect((await search({ q: "pausada" })).total).toBe(0);
  });
  it("filtra por categoria, subcategoria, marca, tamanho e estado", async () => {
    expect((await search({ categoria: "tenis" })).total).toBe(2);
    expect((await search({ subcategoria: "roupas-jaquetas" })).total).toBe(1);
    expect((await search({ marca: "nike" })).total).toBe(1);
    expect((await search({ tamanho: "g" })).total).toBe(1);
    expect((await search({ estado: "EXCELLENT" })).total).toBe(1);
  });
  it("filtra por faixa de preço (em reais) e ordena", async () => {
    const r = await search({ precoMin: "100", precoMax: "220", ordem: "menor-preco" });
    expect(r.items.map((p) => p.priceCents)).toEqual([19900]); // a jaqueta de R$ 129,90 está pausada
    const asc = await search({ ordem: "menor-preco" });
    const prices = asc.items.map((p) => p.priceCents);
    expect(prices).toEqual([...prices].sort((x, y) => x - y));
    const desc = (await search({ ordem: "maior-preco" })).items.map((p) => p.priceCents);
    expect(desc[0]).toBe(25000);
  });
  it("filtra por cidade e por distância aproximada", async () => {
    expect((await search({ cidade: "Colombo" })).total).toBe(1);
    const near = await search({ distancia: "25", perto: "Curitiba" });
    expect(near.items.map((p) => p.city)).not.toContain("Mandirituba");
    expect((await search({ distancia: "50" }, "Curitiba")).items.map((p) => p.city)).toContain("Mandirituba");
  });
  it("entrada maliciosa na busca não quebra nem vaza", async () => {
    const r = await search({ q: "%' OR 1=1 --" });
    expect(r.total).toBe(0);
  });
});

describe("visibilidade e privacidade da página do produto", () => {
  it("rascunho/pausado só é visível para o dono", async () => {
    const dono = await makeUser("dono@t.dev");
    const outro = await makeUser("outro@t.dev");
    const p = await createProduct(dono.id, productInput(cat.jaquetas.id), [], "draft");
    expect(await getProductForPage(p.id, outro.id)).toBeNull();
    expect(await getProductForPage(p.id, null)).toBeNull();
    expect((await getProductForPage(p.id, dono.id))?.isOwner).toBe(true);
  });
  it("não expõe e-mail, telefone ou nome completo do vendedor", async () => {
    const dono = await prisma.user.create({ data: { name: "Maria Souza Lima", email: "maria@t.dev", phone: "41999990000", city: "Curitiba" } });
    const p = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    const page = await getProductForPage(p.id, null);
    const json = JSON.stringify(page);
    expect(json).not.toContain("maria@t.dev");
    expect(json).not.toContain("41999990000");
    expect(json).not.toContain("Souza");
    expect(page?.seller.name).toBe("Maria L.");
  });
});

describe("favoritos e denúncias", () => {
  it("favoritar/desfavoritar e listar", async () => {
    const dono = await makeUser("dono@t.dev");
    const fan = await makeUser("fan@t.dev");
    const p = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    expect(await toggleFavorite(fan.id, p.id)).toBe(true);
    expect((await listFavorites(fan.id)).map((f) => f.product.id)).toEqual([p.id]);
    expect(await toggleFavorite(fan.id, p.id)).toBe(false);
    expect(await listFavorites(fan.id)).toHaveLength(0);
  });
  it("não permite favoritar anúncio pausado", async () => {
    const dono = await makeUser("dono@t.dev");
    const fan = await makeUser("fan@t.dev");
    const p = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    await changeProductStatus(dono.id, p.id, "pause");
    await expect(toggleFavorite(fan.id, p.id)).rejects.toThrow();
  });
  it("denúncia: não denuncia o próprio anúncio e não duplica", async () => {
    const dono = await makeUser("dono@t.dev");
    const u = await makeUser("u@t.dev");
    const p = await createProduct(dono.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    expect((await createReport(dono.id, { productId: p.id, reason: "Outro" })).ok).toBe(false);
    expect(await createReport(u.id, { productId: p.id, reason: "Outro" })).toEqual({ ok: true, duplicate: false });
    expect(await createReport(u.id, { productId: p.id, reason: "Outro" })).toEqual({ ok: true, duplicate: true });
    expect(await prisma.report.count()).toBe(1);
  });
});
