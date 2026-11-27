"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { echoValues, formToObject, zodErrors } from "@/lib/form-data";
import { addressSchema, profileSchema } from "@/schemas/profile";
import type { FormState } from "@/types/forms";
import { createAddress, deleteAddress, setDefaultAddress } from "./service";

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/perfil");
  const raw = formToObject(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values: echoValues(raw) };

  await prisma.user.update({ where: { id: user.id }, data: { ...parsed.data, state: "PR" } });
  await audit({ actorId: user.id, action: "profile.update", entityType: "user", entityId: user.id });
  revalidatePath("/perfil");
  return { ok: true, message: "Perfil atualizado." };
}

export async function addAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/perfil");
  const raw = formToObject(formData, ["isDefault"]);
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values: echoValues(raw) };

  const result = await createAddress(user.id, parsed.data);
  if (!result.ok) return { message: result.error, values: echoValues(raw) };
  revalidatePath("/perfil");
  return { ok: true, message: "Endereço salvo." };
}

export async function deleteAddressAction(formData: FormData) {
  const user = await requireUser("/perfil");
  await deleteAddress(user.id, String(formData.get("id") ?? ""));
  revalidatePath("/perfil");
}

export async function setDefaultAddressAction(formData: FormData) {
  const user = await requireUser("/perfil");
  await setDefaultAddress(user.id, String(formData.get("id") ?? ""));
  revalidatePath("/perfil");
}
