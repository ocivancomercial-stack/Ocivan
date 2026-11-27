"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { addToCart, CartError, removeFromCart } from "./service";

export type AddToCartResult = { ok: true; sellerId: string } | { ok: false; reason: "auth" | "error"; message?: string };

export async function addToCartAction(productId: string): Promise<AddToCartResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };
  if (!(await rateLimit(`cart:${user.id}`, { max: 60, windowSeconds: 60 })).allowed) return { ok: false, reason: "error", message: "Muitas ações. Aguarde um pouco." };
  try {
    const sellerId = await addToCart(user.id, String(productId));
    revalidatePath("/carrinho");
    return { ok: true, sellerId };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof CartError ? e.message : "Não foi possível adicionar ao carrinho." };
  }
}

export async function removeFromCartAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  await removeFromCart(user.id, String(formData.get("productId")));
  revalidatePath("/carrinho");
}
