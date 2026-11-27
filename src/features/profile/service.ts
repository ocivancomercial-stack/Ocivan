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
