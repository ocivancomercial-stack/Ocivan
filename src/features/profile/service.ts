import { prisma } from "@/lib/db";
import type { AddressInput } from "@/schemas/profile";

/** Regras de endereço isoladas das Server Actions para serem testáveis. Sempre escopadas ao dono. */
export const MAX_ADDRESSES = 5;

export async function createAddress(userId: string, data: AddressInput) {
  const count = await prisma.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) return { ok: false as const, error: `Você pode cadastrar até ${MAX_ADDRESSES} endereços.` };
  const isDefault = data.isDefault || count === 0;
  const address = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...data, isDefault, userId } });
  });
  return { ok: true as const, address };
}

/** Retorna false se o endereço não pertence ao usuário (proteção contra IDOR). */
export async function deleteAddress(userId: string, addressId: string): Promise<boolean> {
  const { count } = await prisma.address.deleteMany({ where: { id: addressId, userId } });
  return count === 1;
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<boolean> {
  const owned = await prisma.address.findFirst({ where: { id: addressId, userId }, select: { id: true } });
  if (!owned) return false;
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);
  return true;
}

/** Troca a foto de perfil: valida/reencoda (quadrada 400px, sem EXIF), grava e remove a anterior. */
export async function updateAvatar(userId: string, file: Buffer) {
  const { processUploadedImage } = await import("@/services/images/process");
  const { getStorage } = await import("@/services/storage");
  const { randomUUID } = await import("node:crypto");
  const img = await processUploadedImage(file, { maxSide: 400, square: true });
  const storage = getStorage();
  const { url } = await storage.put(`avatars/${randomUUID()}.webp`, img.data, img.contentType);
  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
  await prisma.user.update({ where: { id: userId }, data: { avatar: url } });
  const oldKey = previous?.avatar?.match(/avatars\/[a-f0-9-]+\.webp$/)?.[0];
  if (oldKey) await storage.remove([oldKey]);
  return url;
}
