"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { toggleFavorite } from "./service";

export type ToggleFavoriteResult = { ok: true; favorited: boolean } | { ok: false; reason: "auth" | "error" };

export async function toggleFavoriteAction(productId: string): Promise<ToggleFavoriteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };
  if (typeof productId !== "string" || productId.length > 40) return { ok: false, reason: "error" };
  if (!(await rateLimit(`fav:${user.id}`, { max: 60, windowSeconds: 60 })).allowed) return { ok: false, reason: "error" };
  try {
    const favorited = await toggleFavorite(user.id, productId);
    revalidatePath("/favoritos");
    return { ok: true, favorited };
  } catch {
    return { ok: false, reason: "error" };
  }
}
