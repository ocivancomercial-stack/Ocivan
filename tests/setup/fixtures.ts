import sharp from "sharp";
import { prisma } from "@/lib/db";
import type { ProductInput } from "@/schemas/product";

export async function makeUser(email: string, extra: { city?: string } = {}) {
  return prisma.user.create({ data: { name: "Pessoa Teste", email, city: extra.city ?? "Curitiba" } });
}

export async function makeCatalog() {
  const roupas = await prisma.category.create({ data: { name: "Roupas", slug: "roupas" } });
  const jaquetas = await prisma.category.create({ data: { name: "Jaquetas", slug: "roupas-jaquetas", parentId: roupas.id } });
  const tenis = await prisma.category.create({ data: { name: "Tênis", slug: "tenis" } });
  const corrida = await prisma.category.create({ data: { name: "Corrida", slug: "tenis-corrida", parentId: tenis.id } });
  const nike = await prisma.brand.create({ data: { name: "Nike", slug: "nike" } });
  const levis = await prisma.brand.create({ data: { name: "Levi's", slug: "levi-s" } });
  return { roupas, jaquetas, tenis, corrida, nike, levis };
}

export async function photo(width = 800, height = 1000, withExif = false) {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 36, g: 132, b: 94 } } }).jpeg();
  if (withExif) img = img.withExif({ IFD0: { Make: "CameraTeste", Copyright: "GPS-SECRETO" } });
  return img.toBuffer();
}

export function productInput(categoryId: string, overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    title: "Jaqueta jeans azul",
    categoryId,
    brandId: undefined,
    size: "M",
    color: "Azul",
    condition: "GOOD",
    description: "Jaqueta jeans em ótimo estado, pouco usada, tecido grosso.",
    defects: undefined,
    price: 12990,
    city: "Curitiba",
    shippingAvailable: true,
    localPickup: false,
    ...overrides,
  };
}
