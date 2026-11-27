import { randomUUID } from "node:crypto";
import type { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { findCity } from "@/lib/regions";
import { getSetting } from "@/lib/settings";
import { getStorage } from "@/services/storage";
import { IMAGE_RULES, ImageValidationError, processUploadedImage } from "@/services/images/process";
import type { ProductInput } from "@/schemas/product";
import { canOwner, nextStatus, type OwnerAction } from "./status";

export class ProductError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
  }
}

/** Ordem das fotos: "existing:<imageId>" (já salva) ou "new:<índice no array de arquivos>". */
export type ImageSlot = { kind: "existing"; id: string } | { kind: "new"; index: number };

export function parseImageOrder(raw: string | null, newCount: number): ImageSlot[] {
  if (!raw) return Array.from({ length: newCount }, (_, index) => ({ kind: "new" as const, index }));
  let tokens: unknown;
  try {
    tokens = JSON.parse(raw);
  } catch {
    throw new ProductError("Ordem das fotos inválida", "photos");
  }
  if (!Array.isArray(tokens) || tokens.length > IMAGE_RULES.maxPerProduct) throw new ProductError("Ordem das fotos inválida", "photos");
  return tokens.map((t) => {
    const [kind, value] = String(t).split(":");
    if (kind === "existing" && value) return { kind, id: value };
    const index = Number(value);
    if (kind === "new" && Number.isInteger(index) && index >= 0 && index < newCount) return { kind, index };
    throw new ProductError("Ordem das fotos inválida", "photos");
  });
}

/** Valida a categoria: precisa ser uma SUBCATEGORIA ativa de uma das categorias permitidas. */
async function assertValidCategory(categoryId: string, brandId?: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, active: true, parentId: { not: null }, parent: { active: true } },
    select: { id: true },
  });
  if (!category) throw new ProductError("Escolha uma subcategoria válida", "categoryId");
  if (brandId) {
    const brand = await prisma.brand.findFirst({ where: { id: brandId, active: true }, select: { id: true } });
    if (!brand) throw new ProductError("Marca inválida", "brandId");
  }
}

async function uploadImages(files: Buffer[]) {
  const processed = [];
  for (const [i, file] of files.entries()) {
    try {
      processed.push(await processUploadedImage(file));
    } catch (e) {
      if (e instanceof ImageValidationError) throw new ProductError(`Foto ${i + 1}: ${e.message}`, "photos");
      throw e;
    }
  }
  const storage = getStorage();
  const uploaded = [];
  try {
    for (const img of processed) {
      const { key, url } = await storage.put(`products/${randomUUID()}.webp`, img.data, img.contentType);
      uploaded.push({ storageKey: key, imageUrl: url, width: img.width, height: img.height });
    }
  } catch (e) {
    await storage.remove(uploaded.map((u) => u.storageKey));
    throw e;
  }
  return uploaded;
}

function productData(input: ProductInput) {
  const city = findCity(input.city);
  return {
    title: input.title,
    description: input.description,
    defects: input.defects ?? null,
    size: input.size,
    color: input.color,
    condition: input.condition,
    priceCents: input.price,
    city: input.city,
    state: "PR",
    latitude: city?.lat ?? null, // centro do município — nunca o endereço
    longitude: city?.lng ?? null,
    shippingAvailable: input.shippingAvailable,
    localPickup: input.localPickup,
    categoryId: input.categoryId,
    brandId: input.brandId ?? null,
  } satisfies Partial<Prisma.ProductUncheckedCreateInput>;
}

export async function createProduct(sellerId: string, input: ProductInput, files: Buffer[], intent: "draft" | "publish") {
  if (files.length > IMAGE_RULES.maxPerProduct) throw new ProductError("Máximo de 8 fotos por anúncio", "photos");
  if (intent === "publish" && files.length === 0) throw new ProductError("Adicione pelo menos uma foto", "photos");
  await assertValidCategory(input.categoryId, input.brandId);

  const moderation = await getSetting("listing_moderation");
  const status: ProductStatus = intent === "publish" ? nextStatus("publish", "DRAFT", moderation) : "DRAFT";
  const images = await uploadImages(files);

  try {
    const product = await prisma.product.create({
      data: {
        ...productData(input),
        sellerId,
        status,
        publishedAt: status === "ACTIVE" ? new Date() : null,
        images: { create: images.map((img, position) => ({ ...img, position })) },
      },
    });
    await audit({ actorId: sellerId, action: "product.create", entityType: "product", entityId: product.id, metadata: { status } });
    return product;
  } catch (e) {
    await getStorage().remove(images.map((i) => i.storageKey));
    throw e;
  }
}

/** Busca um anúncio garantindo que pertence ao usuário (ou lança). */
export async function getOwnedProduct(sellerId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, sellerId },
    include: { images: { orderBy: { position: "asc" } }, category: { select: { id: true, parentId: true } } },
  });
  if (!product) throw new ProductError("Anúncio não encontrado");
  return product;
}

export async function updateProduct(
  sellerId: string,
  productId: string,
  input: ProductInput,
  files: Buffer[],
  order: ImageSlot[],
  intent: "draft" | "publish" | "save",
) {
  const product = await getOwnedProduct(sellerId, productId);
  if (!canOwner("edit", product.status)) throw new ProductError("Este anúncio não pode mais ser editado");
  await assertValidCategory(input.categoryId, input.brandId);

  const existingIds = new Set(product.images.map((i) => i.id));
  for (const slot of order) if (slot.kind === "existing" && !existingIds.has(slot.id)) throw new ProductError("Foto inválida", "photos");
  if (order.length > IMAGE_RULES.maxPerProduct) throw new ProductError("Máximo de 8 fotos por anúncio", "photos");

  const moderation = await getSetting("listing_moderation");
  let status = nextStatus("edit", product.status, moderation);
  if (intent === "publish" && product.status === "DRAFT") status = nextStatus("publish", "DRAFT", moderation);
  if (status !== "DRAFT" && order.length === 0) throw new ProductError("Adicione pelo menos uma foto", "photos");

  const usedNew = order.filter((s): s is Extract<ImageSlot, { kind: "new" }> => s.kind === "new").map((s) => s.index);
  const uploaded = await uploadImages(usedNew.map((i) => files[i]));
  const uploadedByIndex = new Map(usedNew.map((fileIndex, k) => [fileIndex, uploaded[k]]));
  const keptIds = new Set(order.filter((s) => s.kind === "existing").map((s) => (s as { id: string }).id));
  const removed = product.images.filter((i) => !keptIds.has(i.id));

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId, id: { in: removed.map((r) => r.id) } } });
      for (const [position, slot] of order.entries()) {
        if (slot.kind === "existing") await tx.productImage.update({ where: { id: slot.id }, data: { position } });
        else await tx.productImage.create({ data: { ...uploadedByIndex.get(slot.index)!, productId, position } });
      }
      return tx.product.update({
        where: { id: productId },
        data: { ...productData(input), status, publishedAt: status === "ACTIVE" ? (product.publishedAt ?? new Date()) : product.publishedAt },
      });
    });
    await getStorage().remove(removed.map((r) => r.storageKey));
    await audit({ actorId: sellerId, action: "product.update", entityType: "product", entityId: productId, metadata: { status } });
    return updated;
  } catch (e) {
    await getStorage().remove(uploaded.map((u) => u.storageKey));
    throw e;
  }
}

/** Pausar, reativar, publicar rascunho ou remover — sempre validando dono e transição. */
export async function changeProductStatus(sellerId: string, productId: string, action: Exclude<OwnerAction, "edit">) {
  const product = await getOwnedProduct(sellerId, productId);
  if (!canOwner(action, product.status)) throw new ProductError("Ação não permitida para este anúncio");
  if (action === "publish" && product.images.length === 0) throw new ProductError("Adicione pelo menos uma foto antes de publicar");
  const moderation = await getSetting("listing_moderation");
  const status = nextStatus(action, product.status, moderation);

  // Atualização condicional: evita corrida com uma reserva/compra simultânea.
  const { count } = await prisma.product.updateMany({
    where: { id: productId, sellerId, status: product.status },
    data: { status, ...(status === "ACTIVE" && !product.publishedAt ? { publishedAt: new Date() } : {}) },
  });
  if (count === 0) throw new ProductError("O anúncio mudou de situação. Atualize a página.");
  if (status === "REMOVED") await prisma.cartItem.deleteMany({ where: { productId } });
  await audit({ actorId: sellerId, action: `product.${action}`, entityType: "product", entityId: productId, metadata: { from: product.status, to: status } });
  return status;
}
